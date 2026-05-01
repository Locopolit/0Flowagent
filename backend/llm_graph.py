"""LangGraph-based agent runner — replaces raw OpenAI loop with a
structured ReAct graph.  Keeps the same external API so server.py
needs minimal changes.

Speed optimisations vs. the old runner:
  • Smart truncation — large API payloads are trimmed to the first N
    items + a summary line *before* being sent to the LLM.
  • Max-iterations capped with early-exit on empty tool calls.
  • Tool results ≤ 2 KB (was 4 KB) — less tokens for 3B models.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import Annotated, TypedDict

from crypto_util import decrypt

logger = logging.getLogger("agentforge.graph")

# --------------- helpers ------------------------------------------------

MAX_TOOL_RESULT_CHARS = 2000  # keep payloads small for 3B models


def _truncate_result(result: Any) -> str:
    """Aggressively shorten large API responses so small LLMs stay fast."""
    raw = json.dumps(result, default=str)
    if len(raw) <= MAX_TOOL_RESULT_CHARS:
        return raw

    body = result if not isinstance(result, dict) else result.get("body", result)
    # If body is a dict with a list field, keep only first 5 items
    if isinstance(body, dict):
        for key, val in body.items():
            if isinstance(val, list) and len(val) > 5:
                body = dict(body)
                body[key] = val[:5]
                body[f"_total_{key}"] = len(val)
                body["_note"] = f"Showing first 5 of {len(val)} items"
                break

    # Rebuild with trimmed body
    if isinstance(result, dict) and "body" in result:
        trimmed = dict(result)
        trimmed["body"] = body
        out = json.dumps(trimmed, default=str)
    else:
        out = json.dumps(body, default=str)

    return out[:MAX_TOOL_RESULT_CHARS]


def _decrypt_llm(llm: Dict) -> Dict:
    out = dict(llm)
    out["api_key"] = decrypt(llm.get("api_key", "")) if llm.get("api_key") else ""
    return out


# --------------- state --------------------------------------------------

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    trace: list
    iterations: int


# --------------- graph builder ------------------------------------------

def _build_graph(
    llm_cfg: Dict,
    tools_schema: List[Dict],
    tool_executor: Callable,
    max_iters: int,
):
    """
    Build a LangGraph ReAct agent.
    Returns a compiled graph.
    """
    llm = _decrypt_llm(llm_cfg)
    provider = llm.get("provider", "openai")

    # --- Build LangChain ChatOpenAI (works for openai + ollama) ---
    base_url = llm.get("base_url") or None
    if provider == "local" and base_url and not base_url.rstrip("/").endswith("/v1"):
        base_url = base_url.rstrip("/") + "/v1"

    api_key = llm.get("api_key") or "sk-none"
    model = llm.get("model") or "gpt-4o-mini"

    chat_llm = ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url=base_url,
        temperature=0,
        max_tokens=1024,  # keep responses short and fast
    )

    # --- Convert tool schemas to LangChain tools ---
    lc_tools = []
    tool_map: Dict[str, Dict] = {}

    for t in tools_schema:
        tool_map[t["name"]] = t

        # Build a dummy sync function — we handle execution ourselves
        def _make_placeholder(name: str):
            def _fn(**kwargs):
                return f"Executed {name}"
            _fn.__name__ = name
            return _fn

        lc_tool = StructuredTool.from_function(
            func=_make_placeholder(t["name"]),
            name=t["name"],
            description=t["description"],
            args_schema=None,
        )
        # Override the schema with the exact one from our endpoint
        lc_tool.args_schema = None
        lc_tools.append(lc_tool)

    # Bind tools to the LLM
    if lc_tools:
        # Use the raw OpenAI tool format for binding
        oai_tools = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                },
            }
            for t in tools_schema
        ]
        llm_with_tools = chat_llm.bind_tools(oai_tools)
    else:
        llm_with_tools = chat_llm

    # --- Graph nodes ---

    async def call_model(state: AgentState) -> dict:
        """Invoke the LLM."""
        response = await llm_with_tools.ainvoke(state["messages"])
        trace = list(state.get("trace") or [])
        iters = state.get("iterations", 0) + 1

        tool_calls = getattr(response, "tool_calls", None) or []
        if not tool_calls:
            trace.append({"type": "model", "content": response.content or ""})

        return {
            "messages": [response],
            "trace": trace,
            "iterations": iters,
        }

    async def call_tools(state: AgentState) -> dict:
        """Execute tool calls from the last AI message."""
        last_msg = state["messages"][-1]
        tool_calls = getattr(last_msg, "tool_calls", [])
        trace = list(state.get("trace") or [])

        tool_messages = []
        for tc in tool_calls:
            name = tc["name"]
            args = tc.get("args", {})
            tc_id = tc.get("id", name)

            trace.append({
                "type": "tool_call",
                "name": name,
                "arguments": args,
                "id": tc_id,
            })

            tmeta = tool_map.get(name)
            if tmeta:
                result = await tool_executor(tmeta, args)
            else:
                result = {"error": f"Unknown tool: {name}"}

            trace.append({
                "type": "tool_result",
                "name": name,
                "result": result,
                "id": tc_id,
            })

            content = _truncate_result(result)
            tool_messages.append(
                ToolMessage(content=content, tool_call_id=tc_id, name=name)
            )

        return {"messages": tool_messages, "trace": trace}

    def should_continue(state: AgentState) -> str:
        """Route: if the last message has tool calls AND we haven't
        exceeded max_iters, go to tools. Otherwise finish."""
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", None) or []
        iters = state.get("iterations", 0)
        if tool_calls and iters < max_iters:
            return "tools"
        return END

    # --- Assemble graph ---
    graph = StateGraph(AgentState)
    graph.add_node("agent", call_model)
    graph.add_node("tools", call_tools)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# --------------- public entry point -------------------------------------

async def run_chat(
    llm_config: Dict,
    system_prompt: str,
    messages: List[Dict],
    tools: List[Dict],
    tool_executor,
    max_iters: int = 5,
) -> Tuple[str, List[Dict]]:
    """
    Drop-in replacement for the old llm_runner.run_chat().
    Same signature, same return type: (final_text, trace[]).
    """
    graph = _build_graph(llm_config, tools, tool_executor, max_iters)

    # Build initial messages
    lc_messages: List[BaseMessage] = [SystemMessage(content=system_prompt)]
    for m in messages:
        if m["role"] == "user":
            lc_messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            lc_messages.append(AIMessage(content=m["content"]))

    initial_state: AgentState = {
        "messages": lc_messages,
        "trace": [],
        "iterations": 0,
    }

    logger.info("Starting LangGraph agent (max_iters=%d, tools=%d)", max_iters, len(tools))
    result = await graph.ainvoke(initial_state)

    # Extract final text from the last AI message
    final_text = ""
    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage) and msg.content:
            tc = getattr(msg, "tool_calls", None) or []
            if not tc:
                final_text = msg.content
                break

    trace = result.get("trace", [])
    logger.info("LangGraph agent done: %d trace items, reply_len=%d", len(trace), len(final_text))
    return final_text, trace

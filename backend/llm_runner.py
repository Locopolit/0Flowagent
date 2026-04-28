"""Unified LLM runner with tool calling for OpenAI / OpenAI-compatible local / Anthropic / Gemini."""
from typing import List, Dict, Any, Tuple, Optional
from crypto_util import decrypt


def _decrypt_llm(llm: Dict) -> Dict:
    out = dict(llm)
    out["api_key"] = decrypt(llm.get("api_key", "")) if llm.get("api_key") else ""
    return out


async def run_chat(
    llm_config: Dict,
    system_prompt: str,
    messages: List[Dict],
    tools: List[Dict],
    tool_executor,  # async fn(tool_name, args) -> any
    max_iters: int = 6,
) -> Tuple[str, List[Dict]]:
    """
    messages: [{"role": "user"|"assistant", "content": "..."}]
    tools: list of {name, description, parameters, _asset_id, _endpoint_id}
    Returns (final_text, trace[])
    trace: list of {type: 'tool_call'|'tool_result'|'model', ...}
    """
    llm = _decrypt_llm(llm_config)
    provider = llm.get("provider")
    if provider in ("openai", "local"):
        return await _run_openai_compat(llm, system_prompt, messages, tools, tool_executor, max_iters)
    if provider == "anthropic":
        return await _run_anthropic(llm, system_prompt, messages, tools, tool_executor, max_iters)
    if provider == "gemini":
        return await _run_gemini(llm, system_prompt, messages, tools, tool_executor, max_iters)
    raise ValueError(f"Unsupported provider: {provider}")


# ---------------- OpenAI / OpenAI-compatible (incl. local like Ollama) ----------------
async def _run_openai_compat(llm, system_prompt, messages, tools, tool_executor, max_iters):
    from openai import AsyncOpenAI
    base_url = llm.get("base_url") or None
    # Ensure local/Ollama URLs end with /v1 for OpenAI SDK
    if llm.get("provider") == "local" and base_url and not base_url.rstrip("/").endswith("/v1"):
        base_url = base_url.rstrip("/") + "/v1"
    api_key = llm.get("api_key") or "sk-none"  # local ollama doesn't need key
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    model = llm.get("model") or "gpt-4o-mini"

    oai_messages: List[Dict] = [{"role": "system", "content": system_prompt}]
    for m in messages:
        oai_messages.append({"role": m["role"], "content": m["content"]})

    oai_tools = []
    tool_map: Dict[str, Dict] = {}
    for t in tools:
        oai_tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        })
        tool_map[t["name"]] = t

    trace: List[Dict] = []
    for _ in range(max_iters):
        kwargs = {"model": model, "messages": oai_messages}
        if oai_tools:
            kwargs["tools"] = oai_tools
            kwargs["tool_choice"] = "auto"
        resp = await client.chat.completions.create(**kwargs)
        msg = resp.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None) or []
        if not tool_calls:
            text = msg.content or ""
            trace.append({"type": "model", "content": text})
            return text, trace
        # record assistant message with tool_calls
        oai_messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in tool_calls
            ],
        })
        for tc in tool_calls:
            import json
            try:
                args = json.loads(tc.function.arguments or "{}")
            except Exception:
                args = {}
            tool_meta = tool_map.get(tc.function.name)
            trace.append({"type": "tool_call", "name": tc.function.name, "args": args, "id": tc.id})
            result = await tool_executor(tool_meta, args) if tool_meta else {"error": "Unknown tool"}
            trace.append({"type": "tool_result", "name": tc.function.name, "result": result, "id": tc.id})
            oai_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, default=str)[:4000],
            })
    return "(Reached max tool-call iterations)", trace


# ---------------- Anthropic ----------------
async def _run_anthropic(llm, system_prompt, messages, tools, tool_executor, max_iters):
    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=llm["api_key"])
    model = llm.get("model") or "claude-sonnet-4-5-20250929"

    anthropic_tools = []
    tool_map: Dict[str, Dict] = {}
    for t in tools:
        anthropic_tools.append({
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        })
        tool_map[t["name"]] = t

    # Build message list – use content blocks for tool_use / tool_result
    conv: List[Dict] = []
    for m in messages:
        conv.append({"role": m["role"], "content": m["content"]})

    trace: List[Dict] = []
    for _ in range(max_iters):
        resp = await client.messages.create(
            model=model,
            max_tokens=2048,
            system=system_prompt,
            tools=anthropic_tools if anthropic_tools else None,
            messages=conv,
        )
        # Check if any tool_use
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            text = "".join(b.text for b in resp.content if b.type == "text")
            trace.append({"type": "model", "content": text})
            return text, trace

        # Append assistant turn with full content blocks
        conv.append({"role": "assistant", "content": [b.model_dump() for b in resp.content]})
        # Execute tools and append user message with tool_result blocks
        tool_result_blocks = []
        for tu in tool_uses:
            args = tu.input or {}
            tool_meta = tool_map.get(tu.name)
            trace.append({"type": "tool_call", "name": tu.name, "args": args, "id": tu.id})
            result = await tool_executor(tool_meta, args) if tool_meta else {"error": "Unknown tool"}
            trace.append({"type": "tool_result", "name": tu.name, "result": result, "id": tu.id})
            import json
            tool_result_blocks.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": json.dumps(result, default=str)[:4000],
            })
        conv.append({"role": "user", "content": tool_result_blocks})
    return "(Reached max tool-call iterations)", trace


# ---------------- Gemini ----------------
async def _run_gemini(llm, system_prompt, messages, tools, tool_executor, max_iters):
    import google.generativeai as genai
    genai.configure(api_key=llm["api_key"])
    model_name = llm.get("model") or "gemini-2.5-flash"

    # Build tools
    gemini_tools = None
    tool_map: Dict[str, Dict] = {}
    if tools:
        gemini_tools = [{
            "function_declarations": [
                {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}
                for t in tools
            ]
        }]
        for t in tools:
            tool_map[t["name"]] = t

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
        tools=gemini_tools,
    )
    chat = model.start_chat(history=[
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
        for m in messages[:-1]
    ])
    user_message_text = messages[-1]["content"] if messages else ""

    trace: List[Dict] = []
    # first call
    import asyncio
    loop = asyncio.get_event_loop()

    def _send(content):
        return chat.send_message(content)

    resp = await loop.run_in_executor(None, _send, user_message_text)
    for _ in range(max_iters):
        # find function calls
        fn_calls = []
        text_parts = []
        for cand in resp.candidates or []:
            for part in (cand.content.parts or []):
                fc = getattr(part, "function_call", None)
                if fc and fc.name:
                    fn_calls.append(fc)
                elif getattr(part, "text", None):
                    text_parts.append(part.text)
        if not fn_calls:
            text = "".join(text_parts)
            trace.append({"type": "model", "content": text})
            return text, trace
        # execute function calls, pack responses and send back
        responses = []
        for fc in fn_calls:
            args = dict(fc.args) if fc.args else {}
            tool_meta = tool_map.get(fc.name)
            trace.append({"type": "tool_call", "name": fc.name, "args": args, "id": fc.name})
            result = await tool_executor(tool_meta, args) if tool_meta else {"error": "Unknown tool"}
            trace.append({"type": "tool_result", "name": fc.name, "result": result, "id": fc.name})
            responses.append({
                "function_response": {"name": fc.name, "response": {"result": result}}
            })
        resp = await loop.run_in_executor(None, _send, responses)
    return "(Reached max tool-call iterations)", trace

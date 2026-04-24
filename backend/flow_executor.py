"""Flow execution engine.

Executes a flow graph starting from its trigger node, following edges in topological
order. Supports node subtypes: webhook, cron, llm, tool, if_else.

All DB reads are scoped by user_id (the flow's owner) to prevent cross-tenant access.
Variables in string configs are resolved with a mustache-like syntax:
  {{input}}                full trigger payload (as JSON string)
  {{input.<dot.path>}}     nested field from trigger payload
  {{nodes.<node_id>}}      full result of an upstream node
  {{nodes.<node_id>.path}} nested field from an upstream node result
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

from asset_tools import call_asset_endpoint
from llm_runner import run_chat

logger = logging.getLogger("agentforge.flows")

_VAR_RE = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")


def _get_path(root: Any, path: str) -> Any:
    """Walk a dotted path like 'foo.bar.0.baz' over dicts/lists. Missing = None."""
    if not path:
        return root
    cur = root
    for part in path.split("."):
        if cur is None:
            return None
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return cur


def _to_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    try:
        return json.dumps(v, default=str)
    except Exception:
        return str(v)


def _resolve_string(template: str, ctx: Dict[str, Any]) -> str:
    """Replace {{...}} occurrences in template using ctx = {input, nodes}."""
    if not isinstance(template, str):
        return template

    def sub(m: re.Match) -> str:
        expr = m.group(1).strip()
        parts = expr.split(".", 1)
        head = parts[0]
        tail = parts[1] if len(parts) > 1 else ""
        if head == "input":
            return _to_str(_get_path(ctx.get("input"), tail))
        if head == "nodes":
            if not tail:
                return _to_str(ctx.get("nodes"))
            sub_parts = tail.split(".", 1)
            nid = sub_parts[0]
            rest = sub_parts[1] if len(sub_parts) > 1 else ""
            node_res = (ctx.get("nodes") or {}).get(nid)
            return _to_str(_get_path(node_res, rest))
        # Bare node id fallback (legacy UI syntax)
        if head in (ctx.get("nodes") or {}):
            return _to_str(_get_path(ctx["nodes"][head], tail))
        return m.group(0)

    return _VAR_RE.sub(sub, template)


def _resolve_deep(value: Any, ctx: Dict[str, Any]) -> Any:
    """Recursively resolve {{...}} tokens inside strings, dicts, and lists."""
    if isinstance(value, str):
        return _resolve_string(value, ctx)
    if isinstance(value, dict):
        return {k: _resolve_deep(v, ctx) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve_deep(v, ctx) for v in value]
    return value


def _eval_condition(cond: Dict[str, Any], ctx: Dict[str, Any]) -> bool:
    """Evaluate an if_else condition {left, op, right}.

    op ∈ {eq, ne, gt, lt, contains, truthy, falsy}. Both operands are resolved.
    """
    left = _resolve_deep(cond.get("left", ""), ctx)
    right = _resolve_deep(cond.get("right", ""), ctx)
    op = (cond.get("op") or "eq").lower()

    if op == "truthy":
        return bool(left)
    if op == "falsy":
        return not bool(left)
    if op == "contains":
        return str(right) in _to_str(left)
    if op in ("eq", "ne"):
        equal = _to_str(left) == _to_str(right)
        return equal if op == "eq" else not equal
    if op in ("gt", "lt"):
        try:
            l, r = float(left), float(right)
        except (TypeError, ValueError):
            return False
        return l > r if op == "gt" else l < r
    return False


async def execute_flow(
    flow: Dict,
    input_data: Any = None,
    db: Any = None,
    user_id: Optional[str] = None,
) -> Dict:
    """Run a flow end-to-end; returns {status, nodes, error?}."""
    uid = user_id or flow.get("user_id")
    nodes_by_id: Dict[str, Dict] = {n["id"]: n for n in flow.get("nodes", [])}
    edges: List[Dict] = flow.get("edges", [])

    trigger = next((n for n in flow.get("nodes", []) if n.get("type") == "trigger"), None)
    if not trigger:
        return {"status": "error", "error": "No trigger node found", "nodes": {}}

    ctx: Dict[str, Any] = {"input": input_data, "nodes": {}}
    visited: set = set()
    logger.info("Executing flow %s (%s) for user %s", flow.get("name"), flow.get("id"), uid)

    async def walk(node_id: str) -> None:
        if not node_id or node_id in visited:
            return
        node = nodes_by_id.get(node_id)
        if not node:
            return
        visited.add(node_id)
        try:
            result = await _run_node(node, ctx, db, uid)
        except Exception as e:  # noqa: BLE001
            logger.exception("Node %s failed", node_id)
            result = {"ok": False, "error": str(e)}
        ctx["nodes"][node_id] = result

        # Branching
        if node.get("subtype") == "if_else":
            branch = "true" if result.get("value") else "false"
            next_edges = [e for e in edges if e.get("source") == node_id
                          and (e.get("sourceHandle") or "true") == branch]
        else:
            next_edges = [e for e in edges if e.get("source") == node_id]

        for e in next_edges:
            await walk(e.get("target"))

    await walk(trigger["id"])
    return {"status": "ok", "nodes": ctx["nodes"]}


async def _run_node(node: Dict, ctx: Dict, db: Any, user_id: Optional[str]) -> Any:
    subtype = node.get("subtype")
    config = node.get("config") or {}
    logger.info("Running node %s (%s)", node.get("id"), subtype)

    if subtype in ("webhook", "cron"):
        return {"ok": True, "input": ctx.get("input")}

    if subtype == "llm":
        if db is None:
            return {"ok": False, "error": "DB unavailable"}
        prompt = _resolve_string(config.get("prompt") or "", ctx)
        system_prompt = _resolve_string(
            config.get("system_prompt") or "You are a helpful automation assistant.", ctx
        )
        llm_id = config.get("llm_id")
        if not llm_id:
            return {"ok": False, "error": "No LLM selected on node"}
        query = {"id": llm_id}
        if user_id:
            query["user_id"] = user_id
        llm_cfg = await db.llm_configs.find_one(query, {"_id": 0})
        if not llm_cfg:
            return {"ok": False, "error": "LLM config not found"}
        text, trace = await run_chat(
            llm_cfg, system_prompt,
            [{"role": "user", "content": prompt}], [], None, max_iters=1,
        )
        return {"ok": True, "text": text, "trace": trace}

    if subtype == "tool":
        if db is None:
            return {"ok": False, "error": "DB unavailable"}
        asset_id = config.get("asset_id")
        endpoint_id = config.get("endpoint_id")
        if not asset_id or not endpoint_id:
            return {"ok": False, "error": "Asset or endpoint not selected"}
        asset_q = {"id": asset_id}
        ep_q = {"id": endpoint_id, "asset_id": asset_id}
        if user_id:
            asset_q["user_id"] = user_id
            ep_q["user_id"] = user_id
        asset = await db.assets.find_one(asset_q, {"_id": 0})
        endpoint = await db.asset_endpoints.find_one(ep_q, {"_id": 0})
        if not asset or not endpoint:
            return {"ok": False, "error": "Asset or endpoint not found"}
        path_params = _resolve_deep(config.get("path_params") or {}, ctx)
        query_params = _resolve_deep(config.get("query_params") or {}, ctx)
        body_raw = config.get("body")
        body = _resolve_deep(body_raw, ctx) if body_raw not in (None, "") else None
        if isinstance(body, str) and body.strip().startswith(("{", "[")):
            try:
                body = json.loads(body)
            except ValueError:
                pass  # send as string
        return await call_asset_endpoint(
            asset, endpoint,
            path_params=path_params, query_params=query_params, body=body,
        )

    if subtype == "if_else":
        value = _eval_condition(config, ctx)
        return {"ok": True, "value": value}

    return {"ok": False, "error": f"Unsupported node subtype: {subtype}"}

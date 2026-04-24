from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user,
)
from crypto_util import encrypt, decrypt, mask
from rag import extract_text_from_file, chunk_text, retrieve_context
from asset_tools import test_asset_connection, call_asset_endpoint, endpoint_to_tool_schema
from llm_runner import run_chat
from asset_templates import TEMPLATES, get_template
from flow_executor import execute_flow


from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

# ---------------- Setup ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger("agentforge")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

scheduler = AsyncIOScheduler()

app = FastAPI(title="AgentForge API")
api = APIRouter(prefix="/api")


# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def current_user(request: Request) -> dict:
    return await get_current_user(request, db)


def strip_private(doc: dict) -> dict:
    if not doc:
        return doc
    d = {k: v for k, v in doc.items() if not k.startswith("_")}
    return d


# ---------------- Auth Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


# ---------------- Flow Models ----------------
class Node(BaseModel):
    id: str
    type: str  # trigger | action | logic
    subtype: str  # webhook | cron | llm | tool | if_else
    config: Dict[str, Any] = {}
    position: Optional[Dict[str, float]] = None


class Edge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class FlowIn(BaseModel):
    name: str
    description: Optional[str] = ""
    nodes: List[Node] = []
    edges: List[Edge] = []


# ---------------- Auth Routes ----------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"id": user_id, "email": email, "name": doc["name"], "access_token": access}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user.get("name"), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(request: Request):
    return await current_user(request)


# ---------------- LLM Configs ----------------
class LLMConfigIn(BaseModel):
    name: str
    provider: str  # openai | anthropic | gemini | local
    api_key: Optional[str] = ""
    base_url: Optional[str] = ""
    model: str


@api.get("/llm-configs")
async def list_llm_configs(request: Request):
    user = await current_user(request)
    cursor = db.llm_configs.find({"user_id": user["id"]}, {"_id": 0})
    items = await cursor.to_list(500)
    for it in items:
        it["api_key_masked"] = mask(decrypt(it.get("api_key", "")))
        it.pop("api_key", None)
    return items


@api.post("/llm-configs")
async def create_llm_config(payload: LLMConfigIn, request: Request):
    user = await current_user(request)
    if payload.provider not in ("openai", "anthropic", "gemini", "local"):
        raise HTTPException(400, "Invalid provider")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name,
        "provider": payload.provider,
        "api_key": encrypt(payload.api_key or ""),
        "base_url": (payload.base_url or "").strip(),
        "model": payload.model,
        "created_at": now_iso(),
    }
    await db.llm_configs.insert_one(doc)
    out = {k: v for k, v in doc.items() if k not in ("_id", "api_key")}
    out["api_key_masked"] = mask(payload.api_key or "")
    return out


@api.put("/llm-configs/{cfg_id}")
async def update_llm_config(cfg_id: str, payload: LLMConfigIn, request: Request):
    user = await current_user(request)
    update = {
        "name": payload.name,
        "provider": payload.provider,
        "base_url": (payload.base_url or "").strip(),
        "model": payload.model,
    }
    if payload.api_key:
        update["api_key"] = encrypt(payload.api_key)
    res = await db.llm_configs.update_one({"id": cfg_id, "user_id": user["id"]}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/llm-configs/{cfg_id}")
async def delete_llm_config(cfg_id: str, request: Request):
    user = await current_user(request)
    await db.llm_configs.delete_one({"id": cfg_id, "user_id": user["id"]})
    return {"ok": True}


# ---------------- Assets ----------------
class AuthConfig(BaseModel):
    # common
    username: Optional[str] = None
    password: Optional[str] = None
    # token-specific
    login_path: Optional[str] = None
    login_method: Optional[str] = "POST"
    username_field: Optional[str] = "username"
    password_field: Optional[str] = "password"
    token_path: Optional[str] = None
    token_header: Optional[str] = "Authorization"
    token_prefix: Optional[str] = "Bearer "
    # api-key-specific
    header_name: Optional[str] = None
    header_prefix: Optional[str] = None
    api_key: Optional[str] = None


class AssetIn(BaseModel):
    name: str
    vendor: str
    description: Optional[str] = ""
    base_url: str
    auth_type: str  # token | basic | api_key | none
    auth_config: AuthConfig


def _encrypt_auth_config(cfg: dict) -> dict:
    out = dict(cfg or {})
    for k in ("password", "api_key"):
        if out.get(k):
            out[k] = encrypt(out[k])
    return out


def _sanitize_asset_out(doc: dict) -> dict:
    d = strip_private(doc)
    cfg = dict(d.get("auth_config") or {})
    for k in ("password", "api_key"):
        if cfg.get(k):
            cfg[k] = "••••••••"
    d["auth_config"] = cfg
    return d


@api.get("/assets")
async def list_assets(request: Request):
    user = await current_user(request)
    items = await db.assets.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    return [_sanitize_asset_out(a) for a in items]


@api.post("/assets")
async def create_asset(payload: AssetIn, request: Request):
    user = await current_user(request)
    if payload.auth_type not in ("token", "basic", "api_key", "none"):
        raise HTTPException(400, "Invalid auth_type")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name,
        "vendor": payload.vendor,
        "description": payload.description or "",
        "base_url": payload.base_url.rstrip("/"),
        "auth_type": payload.auth_type,
        "auth_config": _encrypt_auth_config(payload.auth_config.model_dump(exclude_none=True)),
        "created_at": now_iso(),
    }
    await db.assets.insert_one(doc)
    return _sanitize_asset_out(doc)


@api.get("/assets/{asset_id}")
async def get_asset(asset_id: str, request: Request):
    user = await current_user(request)
    doc = await db.assets.find_one({"id": asset_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return _sanitize_asset_out(doc)


@api.put("/assets/{asset_id}")
async def update_asset(asset_id: str, payload: AssetIn, request: Request):
    user = await current_user(request)
    existing = await db.assets.find_one({"id": asset_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    new_cfg_in = payload.auth_config.model_dump(exclude_none=True)
    # preserve unchanged secrets (masked from frontend means keep)
    existing_cfg = existing.get("auth_config") or {}
    for k in ("password", "api_key"):
        if new_cfg_in.get(k) in (None, "", "••••••••"):
            if existing_cfg.get(k):
                new_cfg_in[k] = decrypt(existing_cfg[k])
    update = {
        "name": payload.name,
        "vendor": payload.vendor,
        "description": payload.description or "",
        "base_url": payload.base_url.rstrip("/"),
        "auth_type": payload.auth_type,
        "auth_config": _encrypt_auth_config(new_cfg_in),
    }
    await db.assets.update_one({"id": asset_id, "user_id": user["id"]}, {"$set": update})
    return {"ok": True}


@api.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, request: Request):
    user = await current_user(request)
    await db.assets.delete_one({"id": asset_id, "user_id": user["id"]})
    await db.asset_endpoints.delete_many({"asset_id": asset_id, "user_id": user["id"]})
    return {"ok": True}


@api.post("/assets/{asset_id}/test")
async def test_asset(asset_id: str, request: Request):
    user = await current_user(request)
    asset = await db.assets.find_one({"id": asset_id, "user_id": user["id"]}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "Not found")
    result = await test_asset_connection(asset)
    return result


# ---------------- Asset Templates (Marketplace) ----------------
class InstantiateTemplateIn(BaseModel):
    name: Optional[str] = None  # override asset display name (default = template name)
    base_url: str
    auth_config: AuthConfig


@api.get("/asset-templates")
async def list_templates():
    # Strip nothing — public catalog, no secrets
    return [
        {
            "id": t["id"],
            "vendor": t["vendor"],
            "name": t["name"],
            "tagline": t["tagline"],
            "description": t["description"],
            "auth_type": t["auth_type"],
            "auth_hint": t["auth_hint"],
            "auth_defaults": t.get("auth_defaults", {}),
            "base_url_example": t["base_url_example"],
            "color": t.get("color", "#3B82F6"),
            "endpoint_count": len(t["endpoints"]),
            "endpoints": [
                {"name": e["name"], "method": e["method"], "path": e["path"],
                 "description": e.get("description", "")}
                for e in t["endpoints"]
            ],
        }
        for t in TEMPLATES
    ]


@api.post("/asset-templates/{template_id}/instantiate")
async def instantiate_template(template_id: str, payload: InstantiateTemplateIn, request: Request):
    user = await current_user(request)
    tpl = get_template(template_id)
    if not tpl:
        raise HTTPException(404, "Template not found")

    # Merge template auth defaults with user-supplied auth_config
    # Use exclude_unset so Pydantic model defaults don't override template defaults
    merged_cfg = dict(tpl.get("auth_defaults") or {})
    user_cfg = payload.auth_config.model_dump(exclude_unset=True, exclude_none=True)
    merged_cfg.update(user_cfg)

    asset_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name or tpl["name"],
        "vendor": tpl["vendor"],
        "description": tpl["description"],
        "base_url": payload.base_url.rstrip("/"),
        "auth_type": tpl["auth_type"],
        "auth_config": _encrypt_auth_config(merged_cfg),
        "created_at": now_iso(),
        "from_template": template_id,
    }
    await db.assets.insert_one(asset_doc)

    # Bulk-create endpoints
    ep_docs = []
    for ep in tpl["endpoints"]:
        ep_docs.append({
            "id": str(uuid.uuid4()),
            "asset_id": asset_doc["id"],
            "user_id": user["id"],
            "name": ep["name"],
            "description": ep.get("description", ""),
            "method": ep["method"].upper(),
            "path": ep["path"],
            "query_params": ep.get("query_params", []),
            "created_at": now_iso(),
        })
    if ep_docs:
        await db.asset_endpoints.insert_many(ep_docs)

    return {
        "asset": _sanitize_asset_out(asset_doc),
        "endpoints_created": len(ep_docs),
    }


# ---------------- Asset Endpoints ----------------
class QueryParam(BaseModel):
    name: str
    description: Optional[str] = ""
    required: Optional[bool] = False


class EndpointIn(BaseModel):
    name: str
    description: Optional[str] = ""
    method: str
    path: str
    query_params: Optional[List[QueryParam]] = []


@api.get("/assets/{asset_id}/endpoints")
async def list_endpoints(asset_id: str, request: Request):
    user = await current_user(request)
    items = await db.asset_endpoints.find(
        {"asset_id": asset_id, "user_id": user["id"]}, {"_id": 0}
    ).to_list(500)
    return items


@api.post("/assets/{asset_id}/endpoints")
async def create_endpoint(asset_id: str, payload: EndpointIn, request: Request):
    user = await current_user(request)
    asset = await db.assets.find_one({"id": asset_id, "user_id": user["id"]}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "Asset not found")
    if payload.method.upper() not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        raise HTTPException(400, "Invalid method")
    doc = {
        "id": str(uuid.uuid4()),
        "asset_id": asset_id,
        "user_id": user["id"],
        "name": payload.name,
        "description": payload.description or "",
        "method": payload.method.upper(),
        "path": payload.path,
        "query_params": [q.model_dump() for q in (payload.query_params or [])],
        "created_at": now_iso(),
    }
    await db.asset_endpoints.insert_one(doc)
    return strip_private(doc)


@api.put("/assets/{asset_id}/endpoints/{ep_id}")
async def update_endpoint(asset_id: str, ep_id: str, payload: EndpointIn, request: Request):
    user = await current_user(request)
    res = await db.asset_endpoints.update_one(
        {"id": ep_id, "asset_id": asset_id, "user_id": user["id"]},
        {"$set": {
            "name": payload.name,
            "description": payload.description or "",
            "method": payload.method.upper(),
            "path": payload.path,
            "query_params": [q.model_dump() for q in (payload.query_params or [])],
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/assets/{asset_id}/endpoints/{ep_id}")
async def delete_endpoint(asset_id: str, ep_id: str, request: Request):
    user = await current_user(request)
    await db.asset_endpoints.delete_one({"id": ep_id, "asset_id": asset_id, "user_id": user["id"]})
    return {"ok": True}


class EndpointTestIn(BaseModel):
    path_params: Optional[Dict[str, Any]] = {}
    query_params: Optional[Dict[str, Any]] = {}
    body: Optional[Any] = None


@api.post("/assets/{asset_id}/endpoints/{ep_id}/test")
async def test_endpoint(asset_id: str, ep_id: str, payload: EndpointTestIn, request: Request):
    user = await current_user(request)
    asset = await db.assets.find_one({"id": asset_id, "user_id": user["id"]}, {"_id": 0})
    endpoint = await db.asset_endpoints.find_one({"id": ep_id, "asset_id": asset_id, "user_id": user["id"]}, {"_id": 0})
    if not asset or not endpoint:
        raise HTTPException(404, "Not found")
    result = await call_asset_endpoint(
        asset, endpoint,
        path_params=payload.path_params, query_params=payload.query_params, body=payload.body,
    )
    return result


# ---------------- Workspaces ----------------
class WorkspaceIn(BaseModel):
    name: str
    description: Optional[str] = ""
    llm_config_id: str
    asset_ids: List[str] = []
    system_prompt: Optional[str] = "You are a helpful assistant that can use tools to call external APIs."


@api.get("/workspaces")
async def list_workspaces(request: Request):
    user = await current_user(request)
    items = await db.workspaces.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    return items


@api.post("/workspaces")
async def create_workspace(payload: WorkspaceIn, request: Request):
    user = await current_user(request)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name,
        "description": payload.description or "",
        "llm_config_id": payload.llm_config_id,
        "asset_ids": payload.asset_ids,
        "system_prompt": payload.system_prompt or "",
        "created_at": now_iso(),
    }
    await db.workspaces.insert_one(doc)
    return strip_private(doc)


@api.get("/workspaces/{ws_id}")
async def get_workspace(ws_id: str, request: Request):
    user = await current_user(request)
    ws = await db.workspaces.find_one({"id": ws_id, "user_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Not found")
    return ws


@api.put("/workspaces/{ws_id}")
async def update_workspace(ws_id: str, payload: WorkspaceIn, request: Request):
    user = await current_user(request)
    res = await db.workspaces.update_one(
        {"id": ws_id, "user_id": user["id"]},
        {"$set": {
            "name": payload.name,
            "description": payload.description or "",
            "llm_config_id": payload.llm_config_id,
            "asset_ids": payload.asset_ids,
            "system_prompt": payload.system_prompt or "",
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/workspaces/{ws_id}")
async def delete_workspace(ws_id: str, request: Request):
    user = await current_user(request)
    await db.workspaces.delete_one({"id": ws_id, "user_id": user["id"]})
    await db.documents.delete_many({"workspace_id": ws_id, "user_id": user["id"]})
    await db.conversations.delete_many({"workspace_id": ws_id, "user_id": user["id"]})
    await db.messages.delete_many({"workspace_id": ws_id, "user_id": user["id"]})
    return {"ok": True}


# ---------------- Documents (RAG) ----------------
@api.post("/workspaces/{ws_id}/documents")
async def upload_document(ws_id: str, request: Request, file: UploadFile = File(...)):
    user = await current_user(request)
    ws = await db.workspaces.find_one({"id": ws_id, "user_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workspace not found")
    data = await file.read()
    text = extract_text_from_file(file.filename, data)
    chunks = chunk_text(text)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "workspace_id": ws_id,
        "filename": file.filename,
        "size": len(data),
        "chunks": chunks,
        "created_at": now_iso(),
    }
    await db.documents.insert_one(doc)
    out = strip_private(doc)
    out["chunks"] = len(chunks)
    return out


@api.get("/workspaces/{ws_id}/documents")
async def list_documents(ws_id: str, request: Request):
    user = await current_user(request)
    items = await db.documents.find(
        {"workspace_id": ws_id, "user_id": user["id"]}, {"_id": 0, "chunks": 0}
    ).to_list(500)
    return items


@api.delete("/workspaces/{ws_id}/documents/{doc_id}")
async def delete_document(ws_id: str, doc_id: str, request: Request):
    user = await current_user(request)
    await db.documents.delete_one({"id": doc_id, "workspace_id": ws_id, "user_id": user["id"]})
    return {"ok": True}


# ---------------- Conversations ----------------
@api.get("/workspaces/{ws_id}/conversations")
async def list_conversations(ws_id: str, request: Request):
    user = await current_user(request)
    items = await db.conversations.find(
        {"workspace_id": ws_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return items


class ConversationIn(BaseModel):
    title: Optional[str] = "New conversation"


@api.post("/workspaces/{ws_id}/conversations")
async def create_conversation(ws_id: str, payload: ConversationIn, request: Request):
    user = await current_user(request)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "workspace_id": ws_id,
        "title": payload.title or "New conversation",
        "created_at": now_iso(),
    }
    await db.conversations.insert_one(doc)
    return strip_private(doc)


@api.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, request: Request):
    user = await current_user(request)
    await db.conversations.delete_one({"id": conv_id, "user_id": user["id"]})
    await db.messages.delete_many({"conversation_id": conv_id, "user_id": user["id"]})
    return {"ok": True}


@api.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, request: Request):
    user = await current_user(request)
    items = await db.messages.find(
        {"conversation_id": conv_id, "user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    return items


# ---------------- Chat ----------------
class ChatIn(BaseModel):
    message: str


@api.post("/conversations/{conv_id}/chat")
async def chat(conv_id: str, payload: ChatIn, request: Request):
    user = await current_user(request)
    conv = await db.conversations.find_one({"id": conv_id, "user_id": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversation not found")
    ws = await db.workspaces.find_one({"id": conv["workspace_id"], "user_id": user["id"]}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workspace not found")
    llm_cfg = await db.llm_configs.find_one({"id": ws["llm_config_id"], "user_id": user["id"]}, {"_id": 0})
    if not llm_cfg:
        raise HTTPException(400, "LLM config not found. Please select a valid LLM in the workspace.")

    # Build tools from attached assets' endpoints
    assets = await db.assets.find(
        {"id": {"$in": ws.get("asset_ids", [])}, "user_id": user["id"]}, {"_id": 0}
    ).to_list(200)
    asset_map = {a["id"]: a for a in assets}
    endpoints = []
    if asset_map:
        endpoints = await db.asset_endpoints.find(
            {"asset_id": {"$in": list(asset_map.keys())}, "user_id": user["id"]}, {"_id": 0}
        ).to_list(500)
    tools = []
    tool_to_ep: Dict[str, Dict] = {}
    for ep in endpoints:
        asset = asset_map.get(ep["asset_id"])
        if not asset:
            continue
        schema = endpoint_to_tool_schema(asset, ep)
        tools.append(schema)
        tool_to_ep[schema["name"]] = {"asset": asset, "endpoint": ep}

    # Build context from RAG docs
    docs = await db.documents.find(
        {"workspace_id": ws["id"], "user_id": user["id"]}, {"_id": 0}
    ).to_list(500)
    rag_context = retrieve_context(payload.message, docs)
    system_prompt = ws.get("system_prompt") or ""
    if rag_context:
        system_prompt = (system_prompt + "\n\n# Reference Context (retrieved from attached documents)\n" + rag_context).strip()

    # Load recent message history (last 20)
    history = await db.messages.find(
        {"conversation_id": conv_id, "user_id": user["id"], "role": {"$in": ["user", "assistant"]}},
        {"_id": 0},
    ).sort("created_at", 1).to_list(40)
    messages: List[Dict] = []
    for m in history[-20:]:
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": payload.message})

    # Save user message
    user_msg = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "workspace_id": ws["id"],
        "conversation_id": conv_id, "role": "user", "content": payload.message,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(user_msg)

    # Tool executor
    async def executor(tool_meta: Dict, args: Dict) -> Any:
        mapping = tool_to_ep.get(tool_meta["name"]) if tool_meta else None
        if not mapping:
            return {"error": "unknown tool"}
        # split args
        path_params, query_params, body = {}, {}, None
        for k, v in (args or {}).items():
            if k.startswith("path_"):
                path_params[k[5:]] = v
            elif k.startswith("query_"):
                query_params[k[6:]] = v
            elif k == "body":
                body = v
        return await call_asset_endpoint(
            mapping["asset"], mapping["endpoint"],
            path_params=path_params, query_params=query_params, body=body,
        )

    try:
        final_text, trace = await run_chat(
            llm_cfg, system_prompt, messages, tools, executor, max_iters=6,
        )
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(500, f"Chat failed: {e}")

    # Save assistant message with trace
    asst_msg = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "workspace_id": ws["id"],
        "conversation_id": conv_id, "role": "assistant", "content": final_text,
        "trace": trace, "created_at": now_iso(),
    }
    await db.messages.insert_one(asst_msg)

    # Auto-title first message
    if (conv.get("title") or "").startswith("New conversation"):
        title = payload.message.strip().split("\n")[0][:60]
        await db.conversations.update_one({"id": conv_id}, {"$set": {"title": title}})

    return {"assistant": strip_private(asst_msg)}


# ---------------- Flows ----------------
@api.get("/flows")
async def list_flows(request: Request):
    user = await current_user(request)
    cursor = db.flows.find({"user_id": user["id"]}).sort("created_at", -1)
    return [strip_private(f) for f in await cursor.to_list(length=100)]


@api.post("/flows")
async def create_flow(payload: FlowIn, request: Request):
    user = await current_user(request)
    flow_id = str(uuid.uuid4())
    doc = {
        "id": flow_id,
        "user_id": user["id"],
        "name": payload.name,
        "description": payload.description,
        "nodes": [n.model_dump() for n in payload.nodes],
        "edges": [e.model_dump() for e in payload.edges],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.flows.insert_one(doc)
    _schedule_flow_crons(doc)
    return strip_private(doc)


@api.get("/flows/{flow_id}")
async def get_flow(flow_id: str, request: Request):
    user = await current_user(request)
    flow = await db.flows.find_one({"id": flow_id, "user_id": user["id"]})
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return strip_private(flow)


@api.put("/flows/{flow_id}")
async def update_flow(flow_id: str, payload: FlowIn, request: Request):
    user = await current_user(request)
    flow = await db.flows.find_one({"id": flow_id, "user_id": user["id"]})
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    update = {
        "name": payload.name,
        "description": payload.description,
        "nodes": [n.model_dump() for n in payload.nodes],
        "edges": [e.model_dump() for e in payload.edges],
        "updated_at": now_iso(),
    }
    await db.flows.update_one({"id": flow_id}, {"$set": update})
    updated = await db.flows.find_one({"id": flow_id, "user_id": user["id"]}, {"_id": 0})
    if updated:
        _unschedule_flow_crons(flow_id)
        _schedule_flow_crons(updated)
    return {"status": "ok"}


@api.delete("/flows/{flow_id}")
async def delete_flow(flow_id: str, request: Request):
    user = await current_user(request)
    await db.flows.delete_one({"id": flow_id, "user_id": user["id"]})
    _unschedule_flow_crons(flow_id)
    return {"status": "ok"}


class FlowExecuteIn(BaseModel):
    input: Optional[Any] = None


@api.post("/flows/{flow_id}/execute")
async def execute_flow_manual(flow_id: str, request: Request, payload: Optional[FlowExecuteIn] = None):
    user = await current_user(request)
    flow = await db.flows.find_one({"id": flow_id, "user_id": user["id"]}, {"_id": 0})
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    input_data = payload.input if payload else None
    result = await execute_flow(flow, input_data=input_data, db=db, user_id=user["id"])
    return {"status": "ok", "result": result}


# ---------------- Webhooks ----------------
@app.post("/api/webhooks/{webhook_id}")
async def public_webhook(webhook_id: str, request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = (await request.body()).decode("utf-8", errors="ignore")
    # Find flow that has a Webhook trigger node with this ID
    flow = await db.flows.find_one(
        {"nodes": {"$elemMatch": {"subtype": "webhook", "config.webhook_id": webhook_id}}},
        {"_id": 0},
    )
    if not flow:
        return JSONResponse(status_code=404, content={"error": "Webhook not found"})
    result = await execute_flow(flow, input_data=payload, db=db, user_id=flow.get("user_id"))
    return {"status": "received", "result": result}


# ---------------- Cron scheduling helpers ----------------
def _schedule_flow_crons(flow: Dict) -> None:
    """Register APScheduler jobs for every cron trigger in the flow."""
    flow_id = flow.get("id")
    if not flow_id:
        return
    for node in flow.get("nodes", []):
        if node.get("type") != "trigger" or node.get("subtype") != "cron":
            continue
        cron_expr = (node.get("config") or {}).get("cron")
        if not cron_expr:
            continue
        job_id = f"flow:{flow_id}:{node['id']}"
        try:
            trigger = CronTrigger.from_crontab(cron_expr)
        except Exception as e:  # noqa: BLE001
            logger.warning("Invalid cron '%s' on flow %s: %s", cron_expr, flow_id, e)
            continue
        scheduler.add_job(
            _run_cron_flow, trigger=trigger, id=job_id,
            args=[flow_id], replace_existing=True, misfire_grace_time=30,
        )
        logger.info("Scheduled cron job %s (%s)", job_id, cron_expr)


def _unschedule_flow_crons(flow_id: str) -> None:
    for job in list(scheduler.get_jobs()):
        if job.id.startswith(f"flow:{flow_id}:"):
            scheduler.remove_job(job.id)


async def _run_cron_flow(flow_id: str) -> None:
    flow = await db.flows.find_one({"id": flow_id}, {"_id": 0})
    if not flow:
        return
    try:
        await execute_flow(flow, input_data=None, db=db, user_id=flow.get("user_id"))
    except Exception:  # noqa: BLE001
        logger.exception("Cron execution failed for flow %s", flow_id)


# ---------------- Stats ----------------
@api.get("/stats")
async def stats(request: Request):
    user = await current_user(request)
    uid = user["id"]
    return {
        "assets": await db.assets.count_documents({"user_id": uid}),
        "llm_configs": await db.llm_configs.count_documents({"user_id": uid}),
        "workspaces": await db.workspaces.count_documents({"user_id": uid}),
        "conversations": await db.conversations.count_documents({"user_id": uid}),
        "messages": await db.messages.count_documents({"user_id": uid}),
    }


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"name": "AgentForge API", "status": "ok"}


# ---------------- Mount ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.assets.create_index([("user_id", 1), ("id", 1)])
    await db.asset_endpoints.create_index([("asset_id", 1)])
    await db.workspaces.create_index([("user_id", 1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.flows.create_index([("user_id", 1)])
    scheduler.start()
    # Re-hydrate cron jobs for existing flows
    async for flow in db.flows.find({}, {"_id": 0}):
        _schedule_flow_crons(flow)
    logger.info("Indexes ensured and scheduler started")


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown()
    client.close()

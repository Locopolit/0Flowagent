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


# ---------------- Setup ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger("agentforge")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

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
    logger.info("Indexes ensured")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()

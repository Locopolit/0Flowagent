# AgentForge — Product Requirements

## Original Problem Statement
User shared an architecture diagram (Frontend, Agent Orchestrator, LLM Layer, RAG Pipeline, Tool Use via MCP, Code Agent, Data Layer, Observability) and asked:
> "Help me build this entire architecture both frontend and backend as per this entire flow as I have my APIs ready for testing the asset and many vendors."

## Product (v1)
AgentForge — an AI agent orchestration platform for IT/storage/backup admins. Users register enterprise vendor APIs (Commvault, Rubrik, NetApp, Dell PowerMax, Pure, Veeam, etc.) as "Assets", bring their own LLM key, compose a Workspace (Agent) with attached Assets and optional RAG documents, then chat — the agent autonomously calls the right vendor API to answer.

## Personas
- Storage / Backup engineer
- DevOps / SRE
- IT operations admin

## Core Requirements
1. JWT email/password auth (Bearer token primary, cookies fallback).
2. Assets: CRUD, auth types supported = `token` | `basic` | `api_key` | `none`. Credentials encrypted at rest (Fernet).
3. Asset Endpoints: CRUD with method (GET/POST/PUT/PATCH/DELETE), path (with `{params}`), description, query params. Run-endpoint test UI.
4. LLM Providers (BYOK): OpenAI, Anthropic, Gemini, Local (OpenAI-compatible).
5. Workspaces: pick LLM, attach N assets, system prompt. Isolated chat per workspace.
6. RAG: lightweight in-memory TF-IDF retrieval over PDF/DOCX/MD/TXT.
7. Chat: unified tool-calling loop across all 4 providers, returns answer + tool-call trace.
8. Conversation history + message persistence.
9. Tool-call trace viewer (LangSmith-style collapsible).

## Architecture Implemented
- **Backend (FastAPI):** `server.py` + `auth.py` + `crypto_util.py` + `rag.py` + `asset_tools.py` + `llm_runner.py`. All routes under `/api/*`. MongoDB via motor.
- **Frontend (React):** IBM Plex Sans + JetBrains Mono, dark Swiss / High-Contrast theme. Pages: Login, Register, Dashboard, AssetsList, AssetDetail, LLMConfigs, WorkspacesList, WorkspaceDetail.

## What's Implemented (2026-04-24)
- Auth: register / login / logout / me (Bearer + cookies)
- LLM configs CRUD
- Assets CRUD + test-connection
- Asset endpoints CRUD + test-endpoint
- Workspaces CRUD
- Document upload + in-memory TF-IDF RAG
- Conversations + messages + chat endpoint with unified tool-calling (OpenAI, Anthropic, Gemini, Local/OpenAI-compat)
- Stats endpoint
- Control-room UI with sidebar + bg-grid + tool-call trace viewer
- All interactive elements tagged with `data-testid`

## Backlog (P1)
- P1: Streaming chat responses (SSE)
- P1: Request/response body schemas per endpoint (more granular tool schemas)
- P1: Export / share workspaces
- P2: Observability dashboard (latencies, token usage)
- P2: Persist embeddings (e.g., Mongo vector) for larger corpora
- P2: Role-based access / team workspaces

## Next Tasks
- Verify end-to-end via testing agent
- Optionally integrate a "Marketplace" of preset vendor asset templates (Commvault, Rubrik etc.)

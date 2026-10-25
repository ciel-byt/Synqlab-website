# Architecture

**Analysis Date:** 2026-05-02

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         React/TypeScript SPA                            │
│              `frontend/src/` — Vite + React Router + Tailwind           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Agent UI    │  │  Lab/Tools   │  │   Workspace  │  │     Chat     │ │
│  │ AgentChat.tsx│  │ ToolsPage.tsx│  │WorkspacePage │  │ ChatPage.tsx │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────┼─────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   FastAPI Gateway — `app/main.py`                       │
│  JWT auth middleware │ REST + WebSocket │ Job dispatch │ Static assets  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ agents.py   │ │  chat.py    │ │ projects.py │ │ pipelines.py│        │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘        │
└─────────┼───────────────┼───────────────┼───────────────┼───────────────┘
          │               │               │               │
          ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       synqlab Python Package                            │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│ `agent/`        │ `orchestrator/` │ `engine/`       │ `adapters/`       │
│ AgentEngine     │ V1 pipeline     │ adapter_resolver│ ProtGPT2, Omega-  │
│ Tools, Context  │ BudgetTracker   │ RemoteProxy     │ Fold, FoldX, ...  │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬──────────┘
         │                 │                 │                 │
         ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ML Tool Microservices — `services/`                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ProtGPT2  │  │OmegaFold │  │ ESMFold  │  │  FoldX   │  │Reranker  │   │
│  │ :8001    │  │  :8002   │  │  :8003   │  │  :8004   │  │  :8005   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (experiments, artifacts, auth) │ GCS / Artifact Storage     │
│  `synqlab/storage/`                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI Gateway | HTTP/WS routing, JWT auth, static file serving | `app/main.py` |
| Agents Router | Agent session CRUD, message streaming, artifact mgmt | `app/routers/agents.py` |
| AgentEngine | LLM query loop, tool dispatch, budget tracking | `synqlab/agent/engine.py` |
| AgentContext | Session state, tool approvals, task manager ref | `synqlab/agent/context.py` |
| Tools Registry | Agent tools (folding, sequence gen, literature) | `synqlab/agent/tools/__init__.py` |
| V1 Pipeline | 5-stage protein design pipeline (orchestrator) | `synqlab/orchestrator/pipeline.py` |
| Adapter Resolver | Local vs. remote adapter dispatch | `synqlab/engine/adapter_resolver.py` |
| BaseAdapter | Abstract interface for all tool adapters | `synqlab/adapters/base.py` |
| Model Service | Reusable FastAPI template for ML microservices | `services/model_service.py` |
| Storage Layer | SQLAlchemy models, DB session factory | `synqlab/storage/db.py` |
| Auth Service | JWT encode/decode, password hashing | `synqlab/auth/service.py` |
| Registry Loader | YAML → ToolDefinition objects | `synqlab/registry/loader.py` |
| API Client | Frontend HTTP helpers (typed) | `frontend/src/api/client.ts` |

## Pattern Overview

**Overall:** Microservices + monolith hybrid

The codebase uses a hybrid architecture: a FastAPI monolith for API gateway, auth, and business logic, with dedicated microservices for GPU-intensive ML tools. This allows scaling ML workloads independently while keeping the core API lightweight.

**Key Characteristics:**
- Gateway pattern: single FastAPI app routes to internal packages or remote services
- Adapter pattern: `BaseAdapter` ABC unifies local and remote tool execution
- Feature-sliced frontend: `frontend/src/features/{agent,lab,workspace,chat}/`
- Event-driven agent loop: OpenAI function-calling with async streaming

## Layers

**Presentation Layer (Frontend):**
- Purpose: React SPA with feature-sliced architecture
- Location: `frontend/src/`
- Contains: Pages, features, components, hooks, API client
- Depends on: FastAPI REST/WS endpoints
- Used by: Browser clients

**API Gateway Layer:**
- Purpose: HTTP routing, authentication, request validation
- Location: `app/`
- Contains: FastAPI routers, middleware, Pydantic schemas
- Depends on: `synqlab` package, SQLAlchemy
- Used by: Frontend, external API consumers

**Agent Layer:**
- Purpose: LLM orchestration, tool dispatch, context management
- Location: `synqlab/agent/`
- Contains: AgentEngine, AgentContext, tool implementations
- Depends on: OpenAI SDK, adapters, storage
- Used by: Agents router

**Orchestrator Layer:**
- Purpose: Multi-stage experiment pipelines
- Location: `synqlab/orchestrator/`
- Contains: V1 pipeline, budget tracker, policy gates
- Depends on: Adapters, storage, registry
- Used by: Pipeline endpoints

**Engine/Adapter Layer:**
- Purpose: Abstract tool execution (local or remote)
- Location: `synqlab/engine/`, `synqlab/adapters/`
- Contains: Adapter resolver, remote proxy, tool adapters
- Depends on: ML libraries (torch, transformers)
- Used by: Agent tools, orchestrator

**Storage Layer:**
- Purpose: Database access, artifact persistence
- Location: `synqlab/storage/`
- Contains: SQLAlchemy models, session factory
- Depends on: PostgreSQL
- Used by: All layers

**Microservices Layer:**
- Purpose: GPU-isolated ML inference
- Location: `services/`
- Contains: FastAPI apps wrapping adapters
- Depends on: `synqlab.adapters`, torch, model weights
- Used by: Gateway via HTTP (RemoteAdapterProxy)

## Data Flow

### Primary Request Path: Agent Chat Message

1. User types message in `AgentChat.tsx` → WebSocket send (`frontend/src/features/agent/components/AgentChat.tsx`)
2. Gateway receives on `/ws/agent/{session_id}` → validates JWT (`app/routers/agents.py:356`)
3. `AgentEngine.submit_message()` adds to history, calls OpenAI (`synqlab/agent/engine.py:306`)
4. LLM returns tool_calls → engine dispatches to registered tools (`synqlab/agent/engine.py:411`)
5. Tool calls adapter (e.g., `protein_folding.py`) → may proxy to remote service (`synqlab/agent/tools/protein_folding.py`)
6. Results appended to history, streamed as `AgentEvent` to client (`synqlab/agent/engine.py:469`)

### V1 Pipeline Flow

1. POST `/api/run-pipeline` → enqueue job (`app/main.py:813`)
2. `_run_pipeline_worker()` calls `run_experiment()` (`synqlab/orchestrator/pipeline.py:64`)
3. Stage 1: ProtGPT2 generates sequences (via adapter)
4. Stage 2: OmegaFold folds → Gate 1 (pLDDT filter)
5. Stage 3: FoldX scores → Gate 2 (ΔΔG filter)
6. Stage 4: Optional reranker
7. Stage 5: Select top-k, persist summary artifact

### Tool Adapter Resolution

1. Orchestrator/agent requests tool execution
2. `resolve_adapter()` checks env var (e.g., `SYNQLAB_PROTGPT2_URL`) (`synqlab/engine/adapter_resolver.py:40`)
3. If set → return `RemoteAdapterProxy` pointing to microservice
4. If not → import local adapter class, instantiate
5. Adapter.run(request) → returns ToolOutput

**State Management:**
- Frontend: React Context (AuthContext, ThemeContext) + local component state
- Agent sessions: In-memory engine registry (`_active_engines` dict)
- Persistence: PostgreSQL via SQLAlchemy ORM

## Key Abstractions

**AgentTool:**
- Purpose: Callable tool exposed to LLM via function calling
- Examples: `synqlab/agent/tools/protein_folding.py`, `synqlab/agent/tools/sequence_generation.py`
- Pattern: Pydantic input schema + `async call(args, ctx)` method

**BaseAdapter:**
- Purpose: Unified interface for ML tool execution
- Examples: `synqlab/adapters/protgpt2.py`, `synqlab/adapters/omegafold.py`
- Pattern: ABC with `run(ToolRequest) → ToolOutput`

**ToolDefinition:**
- Purpose: Registry entry describing a tool's metadata
- Examples: Loaded from `registry/v1.yaml`
- Pattern: Dataclass with id, name, inputs, outputs, adapter_class

**AgentContext:**
- Purpose: Session-scoped state container for agent execution
- Examples: `synqlab/agent/context.py`
- Pattern: Holds session_id, user_id, tool approvals, task manager

**AgentEvent:**
- Purpose: Streaming event from engine to client
- Examples: TEXT_DONE, TOOL_USE_START, BUDGET_WARNING
- Pattern: Enum type + data dict

## Entry Points

**FastAPI Server:**
- Location: `app/main.py:1074`
- Triggers: `synqlab-server` CLI or `uvicorn app.main:app`
- Responsibilities: Boot gateway, mount routers, serve SPA

**V1 Pipeline CLI:**
- Location: `synqlab/orchestrator/pipeline.py` (via argparse)
- Triggers: Direct script execution
- Responsibilities: Run protein design experiment

**Model Microservice:**
- Location: `services/{model}/serve.py`
- Triggers: `uvicorn services.protgpt2.serve:app --port 8001`
- Responsibilities: Serve single ML model inference

**Frontend Dev Server:**
- Location: `frontend/package.json` (`npm run dev`)
- Triggers: Vite dev server
- Responsibilities: HMR, proxy to backend

## Architectural Constraints

- **Threading:** FastAPI async event loop; CPU-bound ML runs in ThreadPoolExecutor (`_executor` with max_workers=2)
- **Global state:** `_active_engines` dict (session → AgentEngine); `_jobs` dict for pipeline jobs; SQLAlchemy session factory singleton
- **Circular imports:** Auth models imported in `synqlab/storage/db.py` to register with Base; agent/storage coupling via models
- **Remote vs. local:** Adapter resolution is environment-driven (SYNQLAB_*_URL env vars)

## Anti-Patterns

### Direct DB Access in Routers

**What happens:** Some routers call `get_session()` directly and manage transactions inline
**Why it's wrong:** Inconsistent error handling, no unit-of-work abstraction
**Do this instead:** Use service-layer functions like `synqlab/storage/service.py:create_experiment()`

### In-Memory Session State

**What happens:** `_active_engines` holds live AgentEngine instances per session
**Why it's wrong:** State lost on restart; no horizontal scaling without sticky sessions
**Do this instead:** Consider Redis or database-backed session state for production scale-out

### Sync Tool Execution in Async Context

**What happens:** Some tool adapters are synchronous but called from async engine
**Why it's wrong:** Can block event loop if not wrapped properly
**Do this instead:** Use `asyncio.to_thread()` or ensure tools are truly async

## Error Handling

**Strategy:** Exception-based with HTTP status codes

**Patterns:**
- Routers catch exceptions → return JSONResponse with error detail
- Adapters raise `AdapterError` for tool failures
- AgentEngine yields `ERROR` event type for client display
- FastAPI HTTPException for 4xx/5xx responses

## Cross-Cutting Concerns

**Logging:** Python `logging` module; `synqlab.*` loggers with QueueHandler for WebSocket streaming
**Validation:** Pydantic models at API boundary; dataclasses in core
**Authentication:** JWT middleware (`app/main.py:202`) + `synqlab/auth/jwt.py`; X-Api-Key header alternative

---

*Architecture analysis: 2026-05-02*

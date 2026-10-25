# Codebase Structure

**Analysis Date:** 2026-05-02

## Directory Layout

```
synqLab-agent/
├── app/                        # FastAPI gateway application
│   ├── main.py                 # App factory, middleware, core routes
│   ├── routers/                # API routers (agents, auth, chat, projects, ...)
│   └── static/                 # Built frontend assets (dist/)
├── synqlab/                    # Core Python package
│   ├── agent/                  # LLM agent engine & tools
│   │   ├── engine.py           # AgentEngine query loop
│   │   ├── context.py          # AgentContext session state
│   │   ├── tools/              # Agent-callable tools
│   │   └── models.py           # SQLAlchemy models (AgentSession, AgentMessage)
│   ├── adapters/               # ML tool adapters (BaseAdapter subclasses)
│   ├── orchestrator/           # V1 pipeline & budget tracking
│   ├── engine/                 # Adapter resolution & remote proxy
│   ├── storage/                # Database layer (SQLAlchemy)
│   ├── auth/                   # JWT, passwords, user service
│   ├── chat/                   # Human-to-human chat (non-agent)
│   ├── core/                   # Shared schemas, config, exceptions
│   ├── registry/               # Tool registry loader & validator
│   ├── query/                  # Knowledge store query API
│   └── knowledge_store/        # Embeddings & retrieval
├── services/                   # ML microservices (one per model)
│   ├── model_service.py        # Reusable FastAPI template
│   ├── protgpt2/               # ProtGPT2 service (serve.py, Dockerfile)
│   ├── omegafold/              # OmegaFold service
│   ├── esmfold/                # ESMFold service
│   ├── foldx/                  # FoldX service
│   ├── reranker/               # Reranker service
│   └── proteinmpnn/            # ProteinMPNN service
├── frontend/                   # React/TypeScript SPA
│   ├── src/
│   │   ├── App.tsx             # React Router root
│   │   ├── api/client.ts       # Typed API client
│   │   ├── features/           # Feature-sliced modules
│   │   ├── components/         # Shared UI components
│   │   ├── contexts/           # React Context providers
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/              # Route page components
│   │   ├── lib/                # Utilities (api.ts, utils.ts)
│   │   ├── types/              # TypeScript type definitions
│   │   └── styles/             # Global CSS
│   └── package.json            # Frontend dependencies
├── deploy/                     # Kubernetes deployment
│   └── helm/synqlab/           # Helm chart
│       ├── Chart.yaml
│       ├── values.yaml         # Default values
│       ├── values-prod.yaml    # Production overrides
│       ├── templates/          # K8s manifests
│       └── files/              # Registry YAMLs bundled into ConfigMap
├── tests/                      # Test suite
│   └── unit/                   # Unit tests (pytest)
├── scripts/                    # Dev/ops scripts
├── configs/                    # Runtime config files
├── artifacts/                  # Local experiment artifacts
├── data/                       # Local data files
├── evals/                      # Evaluation scripts
├── alembic/                    # DB migrations
├── infra/                      # Infrastructure-as-code
├── resources/                  # Static resources (images, etc.)
├── pyproject.toml              # Python package definition
└── README.md                   # Project documentation
```

## Directory Purposes

**app/**
- Purpose: FastAPI HTTP gateway — routes, middleware, static serving
- Contains: `main.py` (app factory), `routers/*.py` (API endpoints)
- Key files: `main.py`, `routers/agents.py`, `routers/auth.py`

**synqlab/**
- Purpose: Core Python library — business logic, adapters, storage
- Contains: Agent engine, tool adapters, orchestrator, auth, storage
- Key files: `agent/engine.py`, `adapters/base.py`, `orchestrator/pipeline.py`

**synqlab/agent/**
- Purpose: LLM agent system — query loop, tools, context
- Contains: Engine, tools, models, templates, skills
- Key files: `engine.py`, `tools/__init__.py`, `context.py`

**synqlab/agent/tools/**
- Purpose: Agent-callable tool implementations
- Contains: One file per tool (protein_folding, sequence_generation, etc.)
- Key files: `protein_folding.py`, `sequence_generation.py`, `literature_search.py`

**synqlab/adapters/**
- Purpose: ML tool adapters (local inference or remote proxy)
- Contains: BaseAdapter ABC, per-model adapters
- Key files: `base.py`, `protgpt2.py`, `omegafold.py`, `foldx.py`

**synqlab/orchestrator/**
- Purpose: Multi-stage experiment pipelines
- Contains: V1 pipeline, policy gates, budget tracker
- Key files: `pipeline.py`, `policy.py`, `budget_tracker.py`

**synqlab/engine/**
- Purpose: Adapter resolution (local vs. remote)
- Contains: Resolver, remote proxy, executor
- Key files: `adapter_resolver.py`, `remote_adapter.py`, `executor.py`

**synqlab/storage/**
- Purpose: Database layer — SQLAlchemy models & session factory
- Contains: Models, DB connection, artifact path helpers
- Key files: `db.py`, `models.py`, `service.py`

**synqlab/auth/**
- Purpose: Authentication & authorization
- Contains: JWT handling, password hashing, user service
- Key files: `jwt.py`, `password.py`, `service.py`, `models.py`

**services/**
- Purpose: GPU-isolated ML microservices
- Contains: One folder per model with serve.py + Dockerfile
- Key files: `model_service.py` (shared template), `*/serve.py`

**frontend/src/**
- Purpose: React SPA source code
- Contains: Components, pages, features, hooks, API client
- Key files: `App.tsx`, `api/client.ts`, `features/*/`

**frontend/src/features/**
- Purpose: Feature-sliced architecture — self-contained feature modules
- Contains: agent/, chat/, lab/, workspace/, tools/, projects/, organization/
- Key files: `agent/components/AgentChat.tsx`, `lab/views/LabOverviewView.tsx`

**frontend/src/components/**
- Purpose: Shared UI components (not feature-specific)
- Contains: ui/ (shadcn primitives), layout/, blocks/, auth/
- Key files: `ui/button.tsx`, `layout/Layout.tsx`, `blocks/MarkdownContent.tsx`

**deploy/helm/synqlab/**
- Purpose: Kubernetes Helm chart for full-stack deployment
- Contains: Chart definition, values files, K8s templates
- Key files: `values.yaml`, `templates/gateway/deployment.yaml`

**tests/unit/**
- Purpose: Unit tests (pytest)
- Contains: Test files mirroring source structure
- Key files: `test_*.py`

**alembic/**
- Purpose: Database migration scripts
- Contains: Migration versions, alembic config
- Key files: `versions/*.py`

## Key File Locations

**Entry Points:**
- `app/main.py`: FastAPI server entry (also `synqlab-server` CLI)
- `frontend/src/App.tsx`: React app root
- `services/*/serve.py`: Microservice entry points

**Configuration:**
- `pyproject.toml`: Python package config, dependencies
- `frontend/package.json`: Frontend dependencies
- `configs/base.yaml`: Runtime config (DB URL, paths)
- `deploy/helm/synqlab/values.yaml`: K8s deployment config

**Core Logic:**
- `synqlab/agent/engine.py`: AgentEngine (LLM query loop)
- `synqlab/orchestrator/pipeline.py`: V1 experiment pipeline
- `synqlab/adapters/base.py`: BaseAdapter ABC
- `synqlab/engine/adapter_resolver.py`: Local/remote adapter dispatch

**API Layer:**
- `app/routers/agents.py`: Agent session & message endpoints
- `app/routers/auth.py`: Login, signup, JWT refresh
- `app/routers/projects.py`: Project CRUD

**Frontend API:**
- `frontend/src/api/client.ts`: Typed fetch wrappers for all endpoints
- `frontend/src/lib/api.ts`: Base fetch with auth headers

**Testing:**
- `tests/unit/test_*.py`: Unit tests
- `pytest.ini` / `pyproject.toml [tool.pytest]`: pytest config

## Naming Conventions

**Files:**
- Python: `snake_case.py` (e.g., `adapter_resolver.py`, `agent_engine.py`)
- TypeScript: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Test files: `test_<module>.py`

**Directories:**
- Python packages: `snake_case` (e.g., `knowledge_store`)
- Frontend features: `kebab-case` in routes, `camelCase` in imports
- Helm templates: `kebab-case.yaml`

**Classes:**
- Python: `PascalCase` (e.g., `AgentEngine`, `BaseAdapter`)
- TypeScript: `PascalCase` for components & types

**Functions:**
- Python: `snake_case` (e.g., `resolve_adapter`, `run_experiment`)
- TypeScript: `camelCase` (e.g., `sendAgentMessage`, `pollJob`)

**Constants:**
- Python: `SCREAMING_SNAKE_CASE` (e.g., `DEFAULT_MODEL`, `MAX_TURNS`)
- TypeScript: `SCREAMING_SNAKE_CASE` or `camelCase` depending on scope

## Where to Add New Code

**New Agent Tool:**
1. Create `synqlab/agent/tools/<tool_name>.py` with Pydantic schema + `call()` method
2. Register in `synqlab/agent/tools/__init__.py` → `get_tools_for_agent_type()`
3. Add tests in `tests/unit/test_<tool_name>.py`

**New ML Adapter:**
1. Create `synqlab/adapters/<model>.py` extending `BaseAdapter`
2. Register in `synqlab/engine/adapter_resolver.py` → `_ADAPTER_MODULE_MAP`
3. Add env var to `_SERVICE_ENV_MAP` for remote mode
4. Create `services/<model>/serve.py` using `create_model_app()`
5. Add Dockerfile in `services/<model>/`

**New API Router:**
1. Create `app/routers/<domain>.py` with `APIRouter(prefix="/api/<domain>")`
2. Register in `app/main.py` → `app.include_router(<domain>_router)`
3. Add Pydantic request/response models in the router file

**New Frontend Feature:**
1. Create `frontend/src/features/<feature>/` with:
   - `components/` — React components
   - `hooks/` — Custom hooks
   - `views/` — Page-level views
   - `types.ts` — TypeScript types
2. Add routes in `frontend/src/App.tsx`
3. Add API methods in `frontend/src/api/client.ts`

**New Frontend Page:**
1. Create `frontend/src/pages/<PageName>Page.tsx`
2. Add route in `frontend/src/App.tsx`
3. Import any feature components needed

**New Shared Component:**
1. UI primitives: `frontend/src/components/ui/` (shadcn pattern)
2. Layout: `frontend/src/components/layout/`
3. Reusable blocks: `frontend/src/components/blocks/`

**New Database Model:**
1. Define in appropriate module (e.g., `synqlab/storage/models.py` or `synqlab/agent/models.py`)
2. Ensure imported in `synqlab/storage/db.py` to register with Base
3. Create Alembic migration: `alembic revision --autogenerate -m "Add <model>"`

**New Helm Template:**
1. Create `deploy/helm/synqlab/templates/<category>/<resource>.yaml`
2. Reference values from `values.yaml`
3. Test with `helm template .`

## Special Directories

**app/static/dist/**
- Purpose: Built frontend assets copied from `frontend/dist/`
- Generated: Yes (via `npm run build` in frontend/)
- Committed: No (built at deploy time)

**artifacts/**
- Purpose: Local experiment output files (summaries, PDBs)
- Generated: Yes (by pipeline runs)
- Committed: No (ephemeral experiment data)

**data/agent_artifacts/**
- Purpose: Agent session artifacts (uploaded files, reports)
- Generated: Yes (by agent tool calls)
- Committed: No (runtime data)

**.venv/**
- Purpose: Python virtual environment
- Generated: Yes (via `python -m venv` or `uv venv`)
- Committed: No

**node_modules/**
- Purpose: Frontend npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No

**.planning/**
- Purpose: GSD planning artifacts (phases, roadmap, codebase docs)
- Generated: Yes (by GSD commands)
- Committed: Yes (part of project documentation)

**alembic/versions/**
- Purpose: Database migration scripts
- Generated: Yes (via `alembic revision`)
- Committed: Yes (needed for DB setup)

---

*Structure analysis: 2026-05-02*

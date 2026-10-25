# External Integrations

**Analysis Date:** 2026-05-02

## APIs & External Services

**LLM / AI:**
- OpenAI API — Chat assistant and agent reasoning
  - SDK: `openai>=1.0` (`synqlab/chat/llm.py`)
  - Auth: `OPENAI_API_KEY` env var
  - Endpoint: `OPENAI_BASE_URL` (optional, for Azure/custom)
  - Model: `SYNQLAB_CHAT_MODEL` (default: `gpt-4o-mini`)
  - Fallback: Echo mode when API key absent

**Scientific Literature:**
- PubMed E-utilities (NCBI) — Literature search
  - Endpoint: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`
  - Implementation: `synqlab/agent/tools/literature_search.py`
  - Auth: None required (public API)
  - Methods: `esearch.fcgi`, `esummary.fcgi`

**Model Weight Downloads:**
- HuggingFace Hub — ProtGPT2 model weights
  - SDK: `huggingface-hub>=0.20`
  - Cache: `~/.cache/huggingface/`
  - Auth: None for public models
- Helixon S3 — OmegaFold weights
  - URL: `https://helixon.s3.amazonaws.com/release*.pt`
  - Cache: `~/.cache/omegafold_ckpt/`
- PyTorch Hub — ESMFold weights
  - Cache: `~/.cache/torch/hub/checkpoints/`

## Internal Tool Microservices

**Architecture:** Microservices communicate over HTTP. Main app probes tool services via `/health` endpoints.

| Service | Env Var | Default URL | Purpose |
|---------|---------|-------------|---------|
| ProtGPT2 | `SYNQLAB_PROTGPT2_URL` | `http://protgpt2-svc:8001` | Protein sequence generation |
| OmegaFold | `SYNQLAB_OMEGAFOLD_URL` | `http://omegafold-svc:8002` | Structure prediction |
| FoldX | `SYNQLAB_FOLDX_URL` | `http://foldx-svc:8003` | Stability scoring (ΔΔG) |
| Reranker | `SYNQLAB_RERANKER_URL` | `http://reranker-svc:8004` | ML candidate ranking |
| ESMFold | `SYNQLAB_ESMFOLD_URL` | `http://esmfold-svc:8005` | Structure prediction |
| ProteinMPNN | `SYNQLAB_PROTEINMPNN_URL` | `http://proteinmpnn-svc:8006` | Inverse folding |

**Health Probing:**
- Implementation: `app/main.py:_check_tool_availability()`
- Endpoint: Each service exposes `/health`
- Response: `{"status": "ok", "model": "...", "device": "cpu|cuda"}`

## Data Storage

**Primary Database:**
- PostgreSQL 16
  - Connection: `SYNQLAB_DB_URL` env var
  - Default: `postgresql://synqlab:synqlab@localhost:5432/synqlab`
  - Driver: `psycopg2-binary`
  - ORM: SQLAlchemy 2.x (`synqlab/storage/db.py`)
  - Migrations: Alembic (`alembic/versions/`)

**Database Schema (key tables):**
- `users`, `organizations`, `org_members` — Identity/auth
- `teams`, `team_members`, `projects` — Collaboration
- `pipelines`, `pipeline_versions`, `runs` — Workflow management
- `experiments`, `tool_runs`, `artifacts` — Experiment tracking
- `candidates` — Protein sequence candidates
- `datasets`, `dataset_entries` — Training data
- `chat_sessions`, `chat_messages` — Chat history
- `agent_sessions`, `agent_artifacts` — Agent state

**File Storage:**
- Local filesystem (development/Docker volumes)
  - Artifacts: `SYNQLAB_ARTIFACT_DIR` (default: `/app/data/agent_artifacts`)
  - User uploads: `/app/artifacts/user_media/`
  - Bundled PDB samples: `/app/pdb_samples/`
- Named Docker volumes:
  - `postgres_data` — Database persistence
  - `artifacts_data` — Experiment artifacts
  - `hf_cache` — HuggingFace model cache
  - `omegafold_cache` — OmegaFold weights
  - `esmfold_cache` — ESMFold weights

**Caching:**
- In-memory job store (`app/main.py:_jobs`)
- No external cache service (Redis, Memcached)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication
  - Implementation: `synqlab/auth/jwt.py`
  - Algorithm: HS256
  - Secret: `SYNQLAB_JWT_SECRET` env var
  - Token lifetime: 24 hours (configurable)
  - Fallback: Dev-insecure secret in development

**Password Handling:**
- Library: `passlib[bcrypt]`
- Implementation: `synqlab/auth/password.py`
- Algorithm: bcrypt

**Session Management:**
- Stateless JWT tokens in `Authorization: Bearer <token>` header
- API key auth via `X-Api-Key` header (for programmatic access)

**User Model:**
- Email-based registration
- OAuth support prepared (`auth_provider`, `auth_sub` columns)
- Organization membership with roles

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)
- Errors logged via Python `logging` module

**Logging:**
- Standard Python logging (`synqlab.*` namespace)
- In-memory queue for WebSocket streaming (`app/main.py:_log_queue`)
- WebSocket endpoint: `/ws/logs` — Real-time log streaming to UI
- Log level: `SYNQLAB_LOG_LEVEL` (default: `INFO`)

**Health Checks:**
- `/healthz` — Lightweight liveness probe (returns `{"status": "ok"}`)
- `/api/health` — Full health check (probes all tool services)
- `/api/compute` — GPU/device info from tool services
- Docker healthchecks configured in `docker-compose.yml`

## CI/CD & Deployment

**CI Pipeline:**
- GitHub Actions (`.github/workflows/test.yml`)
- Matrix: Python 3.11, 3.12
- PostgreSQL service container for integration tests
- SQLite for unit tests (fast, no deps)
- Frontend build validation (Node 22)

**Container Registry:**
- Build: Multi-stage Dockerfile
- Image: `synqlab-app:local`
- Base images:
  - `node:22` (frontend build)
  - `python:3.12-slim` (API runtime)

**Deployment Target:**
- Docker Compose (local/dev)
- Kubernetes-ready (UID 1000 user, health probes, ConfigMap mounts)
- Helm chart references in Dockerfile comments

## Webhooks & Callbacks

**Incoming:**
- None (no webhook receivers implemented)

**Outgoing:**
- None (no webhook dispatchers implemented)

**WebSocket:**
- `/ws/logs` — Real-time log streaming (push)
- Implementation: `app/main.py:ws_logs()`

## Email (Planned)

**Status:** Not implemented (placeholders in `.env.example`)

**Planned Config:**
- `SMTP_HOST` — SMTP server (e.g., `smtp.sendgrid.net`)
- `SMTP_PORT` — SMTP port (e.g., 587)
- `SMTP_USER` / `SMTP_PASSWORD` — SMTP credentials
- `EMAIL_FROM` — Sender address

**Use Cases:**
- Organization invite notifications
- Password reset (if email auth)

## Environment Configuration

**Required for Production:**
- `SYNQLAB_DB_URL` — PostgreSQL connection string
- `SYNQLAB_JWT_SECRET` — JWT signing secret
- `OPENAI_API_KEY` — OpenAI API key (for chat features)

**Optional Service URLs:**
- `SYNQLAB_PROTGPT2_URL` — ProtGPT2 service
- `SYNQLAB_OMEGAFOLD_URL` — OmegaFold service
- `SYNQLAB_ESMFOLD_URL` — ESMFold service
- `SYNQLAB_FOLDX_URL` — FoldX service
- `SYNQLAB_RERANKER_URL` — Reranker service
- `SYNQLAB_PROTEINMPNN_URL` — ProteinMPNN service

**Local Tool Paths:**
- `SYNQLAB_FOLDX_BINARY_PATH` — Path to FoldX executable

**Secrets Location:**
- Environment variables (`.env` file, Kubernetes secrets)
- No cloud secret manager integration

## External Binary Dependencies

**FoldX:**
- Source: https://foldxsuite.crg.eu/ (free academic license)
- Installation: `bash scripts/setup_foldx.sh /path/to/foldx`
- Docker mount: `./resources/foldx5_Linux:/opt/foldx:ro`
- Config: `SYNQLAB_FOLDX_BINARY_PATH`

**ProteinMPNN:**
- Source: https://github.com/dauparas/ProteinMPNN
- Directory: `SYNQLAB_PROTEINMPNN_DIR` (default: `/app/proteinmpnn`)

---

*Integration audit: 2026-05-02*

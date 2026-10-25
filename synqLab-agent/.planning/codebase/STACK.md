# Technology Stack

**Analysis Date:** 2026-05-02

## Languages

**Primary:**
- Python 3.10+ — Backend API, ML adapters, agent engine (`synqlab/`, `app/`, `services/`)
- TypeScript 5.9 — Frontend React SPA (`frontend/`)

**Secondary:**
- SQL — Database migrations via Alembic (`alembic/versions/`)
- YAML — Configuration files (`configs/`, registry files)
- Bash — Setup and helper scripts (`scripts/`)

## Runtime

**Backend:**
- Python 3.12 (Docker) / 3.10+ (development)
- uvicorn ASGI server
- Package manager: uv (astral-sh) + pip fallback

**Frontend:**
- Node.js 22
- Package manager: npm
- Lockfile: `frontend/package-lock.json` (present)

## Frameworks

**Backend Core:**
- FastAPI — REST API framework (`app/main.py`)
- SQLAlchemy — ORM and database abstraction (`synqlab/storage/`)
- Pydantic — Data validation and schemas (`synqlab/core/schemas.py`)
- Alembic — Database migrations (`alembic/`)

**ML/AI:**
- PyTorch — Deep learning runtime (optional, `[ml]` extra)
- Transformers (HuggingFace) ≥4.40 — ProtGPT2 inference
- fair-esm — ESMFold structure prediction
- OpenAI SDK ≥1.0 — Chat assistant LLM integration

**Frontend Core:**
- React 19 — UI framework
- Vite 8 — Build tool and dev server
- TailwindCSS 3.4 — Utility-first CSS
- React Router DOM 7 — Client-side routing

**Testing:**
- pytest — Python test runner
- pytest-asyncio — Async test support
- ESLint — TypeScript linting
- TypeScript tsc — Type checking

## Key Dependencies

**Backend Critical:**
- `fastapi` — HTTP API framework
- `sqlalchemy` — Database ORM
- `psycopg2-binary` — PostgreSQL driver
- `python-jose[cryptography]` — JWT authentication
- `passlib[bcrypt]` — Password hashing
- `openai>=1.0` — LLM chat integration
- `httpx` — Async HTTP client for tool services

**ML/Science:**
- `torch` — PyTorch deep learning
- `transformers>=4.40` — HuggingFace models
- `huggingface-hub>=0.20` — Model downloads
- `scikit-learn` — Reranker ML model
- `pandas` / `openpyxl` — Data processing
- `biopython` — Bioinformatics utilities

**Frontend Critical:**
- `react` / `react-dom` — UI framework
- `@radix-ui/*` — Accessible component primitives
- `react-hook-form` + `zod` — Form validation
- `@xyflow/react` — Node-based pipeline editor
- `@react-three/fiber` + `three` — 3D protein visualization
- `lucide-react` — Icon library
- `sonner` — Toast notifications
- `cmdk` — Command palette

## Build & DevTools

**Python:**
- uv — Fast package installer (`uv sync`, `uv pip install`)
- setuptools — Build backend (`pyproject.toml`)

**Frontend:**
- Vite 8 — Build and dev server
- TypeScript 5.9 — Type checking
- PostCSS + Autoprefixer — CSS processing
- ESLint 9 — Code linting

**Containerization:**
- Docker — Multi-stage builds (`Dockerfile`)
- Docker Compose — Local orchestration (`docker-compose.yml`)

## Configuration

**Environment Variables:**
- `SYNQLAB_DB_URL` — PostgreSQL connection URL
- `SYNQLAB_JWT_SECRET` — JWT signing secret (required in production)
- `OPENAI_API_KEY` — OpenAI API key for chat assistant
- `SYNQLAB_CHAT_MODEL` — Override chat model (default: `gpt-4o-mini`)
- `SYNQLAB_*_URL` — Tool service endpoints (ProtGPT2, OmegaFold, etc.)
- `SYNQLAB_FOLDX_BINARY_PATH` — Path to FoldX binary
- `SYNQLAB_ARTIFACT_DIR` — Shared artifact storage path
- `SYNQLAB_LOG_LEVEL` — Logging level (`INFO` default)

**Config Files:**
- `configs/base.yaml` — Default configuration
- `configs/local.yaml` — Local overrides (gitignored)
- `.env` — Environment variables (copy from `.env.example`)
- `pyproject.toml` — Python project metadata and dependencies
- `frontend/package.json` — Frontend dependencies
- `alembic.ini` — Database migration config

**Resolution Order (highest wins):**
1. Environment variables prefixed `SYNQLAB_`
2. `configs/local.yaml` (if present)
3. `configs/base.yaml` (always loaded)
4. Hard-coded defaults in `ExperimentConfig`

## Platform Requirements

**Development:**
- Python 3.10+ with uv or pip
- Node.js 22+ with npm
- PostgreSQL 16 (or SQLite for tests)
- Docker + Docker Compose (optional, for full stack)

**Production (Docker):**
- Multi-stage Docker build (frontend → API)
- PostgreSQL 16 database
- GPU support via `docker-compose.gpu.yml` overlay
- Tool microservices (ProtGPT2, OmegaFold, ESMFold, FoldX, ProteinMPNN, Reranker)

**CI/CD:**
- GitHub Actions (`.github/workflows/test.yml`)
- Python 3.11 + 3.12 matrix
- PostgreSQL 16 service container
- Frontend build validation

## Service Architecture

**Main Application:**
- `synqlab-app:local` — API + built frontend (port 8000)

**Tool Microservices (Docker Compose profiles):**
| Service | Port | Framework | ML Runtime |
|---------|------|-----------|------------|
| `protgpt2-svc` | 8001 | FastAPI | PyTorch + Transformers |
| `omegafold-svc` | 8002 | FastAPI | PyTorch + OmegaFold |
| `foldx-svc` | 8003 | FastAPI | FoldX binary (subprocess) |
| `reranker-svc` | 8004 | FastAPI | scikit-learn |
| `esmfold-svc` | 8005 | FastAPI | PyTorch + fair-esm |
| `proteinmpnn-svc` | 8006 | FastAPI | PyTorch |

**Database:**
- PostgreSQL 16 (`db` service, port 5432)
- PostgreSQL 16 test instance (`db_test` profile, port 5433)

---

*Stack analysis: 2026-05-02*

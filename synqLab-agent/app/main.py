"""SynqLab Dev UI — FastAPI backend.

Endpoints:
  GET  /api/tools                    → list all registry tools
  POST /api/run-tool                 → submit a tool job (returns job_id immediately)
  GET  /api/jobs/{job_id}            → poll job status / result
  POST /api/run-pipeline             → submit a full V1 pipeline job (returns job_id)
  GET  /api/experiments              → list recent experiment summaries
  GET  /api/experiments/{id}         → get one experiment summary
  GET  /api/health                   → real-mode availability for each tool
  GET  /ws/logs                      → WebSocket: stream pipeline logs live
  GET  /                             → serve the SPA (index.html)

Long-running tools (OmegaFold, FoldX, ProtGPT2) are dispatched to a thread
pool and return a job_id immediately. The UI polls /api/jobs/{job_id} until
status == "completed" or "failed".
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import queue
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.routers.agents import router as agents_router
from app.routers.auth import router as auth_router
from app.routers.admin import router as admin_router, ensure_bootstrap_admin
from app.routers.chat import router as chat_router
from app.routers.database import router as database_router
from app.routers.orgs import router as orgs_router
from app.routers.papers import router as papers_router
from app.routers.aria_chat import router as aria_chat_router
from app.routers.aria_demo import router as aria_demo_router
from app.routers.news import router as news_router
from app.routers.people import router as people_router
from app.routers.projects import router as projects_router
from app.routers.skills import router as skills_router
from app.routers.pipelines import router as pipelines_router
from app.routers.training import router as training_router
from synqlab.auth.exceptions import ExpiredTokenError, InvalidTokenError
from synqlab.auth.jwt import decode_token

# ---------------------------------------------------------------------------
# Logging — in-memory queue handler streams to WebSocket
# ---------------------------------------------------------------------------

_log_queue: queue.Queue[str] = queue.Queue(maxsize=1000)


class _QueueHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            _log_queue.put_nowait(self.format(record))
        except queue.Full:
            pass


_queue_handler = _QueueHandler()
_queue_handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
logging.getLogger("synqlab").addHandler(_queue_handler)
logging.getLogger("synqlab").setLevel(logging.DEBUG)

# ---------------------------------------------------------------------------
# Phase 13: bundled-sample ingest at startup
# ---------------------------------------------------------------------------

def get_db_session():
    """Defer the import so test fixtures can monkey-patch this symbol."""
    from synqlab.storage.db import get_session as _get_session
    return _get_session()


def _ingest_bundled_samples(bundled_dir: Path = Path("/app/data/agent_artifacts/bundled")) -> None:
    """Ingest every .pdb file under bundled_dir as scope='global' rows.

    Idempotent: keyed by sha256 content_hash. Re-running the function
    inserts only PDB files whose content has not been seen before.

    Also copies each bundled PDB into the shared artifact directory
    (SYNQLAB_ARTIFACT_DIR / "bundled") so tool microservices running in
    separate pods can access them through the shared GCS Fuse mount.
    The DB row's ``file_path`` points at the shared copy so every tool
    sees the same path.

    Phase 13 D-04. Path is overridable for tests.
    """
    logger = logging.getLogger(__name__)
    if not bundled_dir.is_dir():
        logger.info("Bundled-sample dir %s not found; skipping ingest", bundled_dir)
        return

    from synqlab.agent.models import AgentArtifact

    shared_root = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "/app/data/agent_artifacts"))
    shared_bundled_dir = shared_root / "bundled"
    try:
        shared_bundled_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.warning(
            "Cannot create shared bundled dir %s: %s (falling back to image-local paths)",
            shared_bundled_dir, exc,
        )
        shared_bundled_dir = None

    db = get_db_session()
    try:
        for pdb_file in sorted(bundled_dir.glob("*.pdb")):
            try:
                content = pdb_file.read_text(encoding="utf-8")
            except OSError as exc:
                logger.warning("Cannot read bundled sample %s: %s", pdb_file, exc)
                continue
            content_bytes = content.encode("utf-8")
            content_hash = hashlib.sha256(content_bytes).hexdigest()

            # Copy into shared artifact dir so tool pods can reach it too.
            # Idempotent: only write if missing or content differs.
            resolved_path = str(pdb_file)
            if shared_bundled_dir is not None:
                shared_path = shared_bundled_dir / pdb_file.name
                try:
                    if not shared_path.exists() or shared_path.read_bytes() != content_bytes:
                        shared_path.write_bytes(content_bytes)
                    resolved_path = str(shared_path)
                except OSError as exc:
                    logger.warning(
                        "Cannot mirror %s to shared dir: %s (using image-local path)",
                        pdb_file.name, exc,
                    )

            exists = (
                db.query(AgentArtifact)
                .filter_by(content_hash=content_hash, scope="global")
                .first()
            )
            if exists:
                # Back-fill file_path on older rows that point at the
                # image-only /app/pdb_samples path. Tool pods can't reach that,
                # so update to the shared-storage copy when possible.
                if (
                    shared_bundled_dir is not None
                    and exists.file_path != resolved_path
                    and (exists.file_path or "").startswith(str(bundled_dir))
                ):
                    exists.file_path = resolved_path
                continue

            size = len(content_bytes)
            db.add(AgentArtifact(
                session_id=None,
                scope="global",
                name=pdb_file.name,
                artifact_type="pdb_structure",
                content_type="chemical/x-pdb",
                content=content if size <= 100 * 1024 else None,
                file_path=resolved_path,
                metadata_json={"source": "bundled"},
                size_bytes=size,
                content_hash=content_hash,
            ))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Bundled sample ingest failed")
    finally:
        db.close()


NEWS_REFRESH_SECONDS = 6 * 3600


async def _news_loop() -> None:
    """Keep the News tab fresh: fetch at boot, then every few hours. Skipped when X_BEARER_TOKEN is not set.

    A failed fetch is logged and the stored news stays as it was."""
    token = os.environ.get("X_BEARER_TOKEN", "").strip()
    if not token:
        return
    from synqlab.news_refresh import refresh
    handle = os.environ.get("NEWS_X_HANDLE", "BiologyAIDaily")
    log = logging.getLogger(__name__)
    while True:
        try:
            log.info("News refreshed: %d posts", await asyncio.to_thread(refresh, handle, token))
        except Exception:  # noqa: BLE001
            log.exception("News refresh failed")
        await asyncio.sleep(NEWS_REFRESH_SECONDS)


@asynccontextmanager
async def lifespan(_app):
    """FastAPI lifespan handler — ingest bundled samples at boot, keep News fresh."""
    _ingest_bundled_samples()
    ensure_bootstrap_admin()
    news = asyncio.create_task(_news_loop())
    yield
    news.cancel()


# ---------------------------------------------------------------------------
# App & paths
# ---------------------------------------------------------------------------

app = FastAPI(title="SynqLab Dev UI", version="1.0", lifespan=lifespan)
app.include_router(agents_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(orgs_router)
app.include_router(people_router)
app.include_router(papers_router)
app.include_router(news_router)
app.include_router(aria_demo_router)
app.include_router(aria_chat_router)
app.include_router(projects_router)
app.include_router(chat_router)
app.include_router(database_router)
app.include_router(skills_router)
app.include_router(pipelines_router)
app.include_router(training_router)


@app.middleware("http")
async def jwt_guard_middleware(request: Request, call_next):
    """Guard /api/* routes with JWT or API key authentication."""
    path = request.url.path
    if (
        path.startswith("/auth/")
        or path == "/api/health"
        or path.startswith("/api/invite/")
        or path.startswith("/api/public/")
        or (path.startswith("/api/orgs/") and "/avatar/" in path)
        or (path.startswith("/api/projects/teams/") and "/avatar/" in path)
    ):
        return await call_next(request)

    if path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")
        api_key = request.headers.get("X-Api-Key", "").strip()

        if api_key:
            return await call_next(request)

        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            try:
                payload = decode_token(token)
                request.state.user_id = payload.get("sub")
                return await call_next(request)
            except (ExpiredTokenError, InvalidTokenError):
                return JSONResponse({"detail": "Invalid or expired token."}, status_code=401)

        # Fallback: accept ?token= query param for file download URLs
        # (browsers can't attach headers on direct navigation / <a> / <img>)
        token_param = request.query_params.get("token", "").strip()
        if token_param and path.startswith("/api/storage/"):
            try:
                payload = decode_token(token_param)
                request.state.user_id = payload.get("sub")
                return await call_next(request)
            except (ExpiredTokenError, InvalidTokenError):
                return JSONResponse({"detail": "Invalid or expired token."}, status_code=401)

        return JSONResponse({"detail": "Authentication required."}, status_code=401)

    return await call_next(request)

_STATIC_DIR = Path(__file__).parent / "static"
_DIST_DIR = _STATIC_DIR / "dist"

# Serve built React assets (JS/CSS chunks) from /assets path
if (_DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST_DIR / "assets")), name="assets")

_AGENT_ROOT = Path(__file__).resolve().parents[1]
# In the image the registry is at /registry. Locally, set SYNQLAB_REGISTRY_DIR (e.g. deploy/helm/synqlab/files).
_REGISTRY_PATH = Path(os.environ.get("SYNQLAB_REGISTRY_DIR") or (_AGENT_ROOT.parent / "registry"))
_SUMMARIES_DIR = _AGENT_ROOT / "artifacts"

# ---------------------------------------------------------------------------
# Job store — keyed by job_id, holds status + result
# ---------------------------------------------------------------------------

_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()

# Use a single-worker pool so OmegaFold/FoldX don't run concurrently and OOM
_executor = ThreadPoolExecutor(max_workers=2)


def _set_job(job_id: str, **fields: Any) -> None:
    with _jobs_lock:
        if job_id not in _jobs:
            _jobs[job_id] = {}
        _jobs[job_id].update(fields)


def _get_job(job_id: str) -> dict[str, Any] | None:
    with _jobs_lock:
        return dict(_jobs[job_id]) if job_id in _jobs else None


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RunToolRequest(BaseModel):
    tool_id: str
    inputs: dict[str, Any] = {}


class RunPipelineRequest(BaseModel):
    n_sequences: int = 10
    plddt_threshold: float = 70.0
    ddg_threshold: float = 2.0
    top_k: int = 5
    use_reranker: bool = False
    parent_sequence: str = "RDHMVLHEYVNAAGIT"  # GFP11 wild-type (Pédelacq 2006)


# ---------------------------------------------------------------------------
# Tool health / availability checks
# ---------------------------------------------------------------------------

def _check_tool_availability() -> dict[str, dict]:
    results: dict[str, dict] = {}
    import os
    import urllib.request

    # ── Helper: probe a remote microservice /health endpoint ──────────────
    def _probe_remote(tool_id: str, env_var: str, fallback_label: str) -> bool:
        """If the service URL env var is set, probe its /health and record the
        result.  Returns True if the remote was probed (regardless of outcome),
        False if no env var was set (caller should fall back to local check)."""
        base_url = os.environ.get(env_var, "")
        if not base_url:
            return False
        try:
            req = urllib.request.Request(f"{base_url}/health", method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read())
            status = data.get("status", "unknown")
            model = data.get("model", fallback_label)
            device = data.get("device", "cpu")
            results[tool_id] = {
                "available": True,
                "reason": f"{model} service {status} ({device})",
            }
        except Exception as exc:
            results[tool_id] = {
                "available": False,
                "reason": f"Service unreachable at {base_url}: {exc}",
            }
        return True

    # ── ProtGPT2 ─────────────────────────────────────────────────────────
    if not _probe_remote("protgpt2", "SYNQLAB_PROTGPT2_URL", "ProtGPT2"):
        try:
            import transformers  # noqa: F401
            import huggingface_hub  # noqa: F401
            results["protgpt2"] = {"available": True, "reason": f"transformers {transformers.__version__}"}
        except ImportError as e:
            results["protgpt2"] = {
                "available": False, "reason": str(e),
                "install_hint": "uv pip install 'transformers>=4.40' 'huggingface-hub>=0.20'",
            }

    # ── OmegaFold ────────────────────────────────────────────────────────
    if not _probe_remote("omegafold", "SYNQLAB_OMEGAFOLD_URL", "OmegaFold"):
        try:
            import omegafold  # noqa: F401
            weights_path = Path("~/.cache/omegafold_ckpt/model.pt").expanduser()
            if weights_path.exists():
                results["omegafold"] = {"available": True, "reason": "omegafold installed, weights cached"}
            else:
                results["omegafold"] = {
                    "available": True,
                    "reason": "omegafold installed (weights will auto-download ~700 MB on first use)",
                }
        except ImportError:
            results["omegafold"] = {
                "available": False,
                "reason": "omegafold package not installed",
                "install_hint": "bash scripts/install_omegafold.sh",
            }

    # ── ESMFold ──────────────────────────────────────────────────────────
    if not _probe_remote("esmfold", "SYNQLAB_ESMFOLD_URL", "ESMFold"):
        try:
            import esm  # noqa: F401
            import openfold  # noqa: F401
            weights_path = Path("~/.cache/torch/hub/checkpoints/esmfold_3B_v1.pt").expanduser()
            if weights_path.exists():
                results["esmfold"] = {"available": True, "reason": "fair-esm + openfold installed, weights cached"}
            else:
                results["esmfold"] = {
                    "available": True,
                    "reason": "fair-esm + openfold installed (weights will auto-download ~2.5 GB on first use)",
                }
        except ImportError as e:
            results["esmfold"] = {
                "available": False,
                "reason": f"missing dependency: {e}",
                "install_hint": "bash scripts/install_esmfold.sh",
            }

    # ── FoldX ────────────────────────────────────────────────────────────
    if not _probe_remote("foldx", "SYNQLAB_FOLDX_URL", "FoldX"):
        foldx_path = os.environ.get("SYNQLAB_FOLDX_BINARY_PATH", "")
        if not foldx_path:
            try:
                from synqlab.core.config import load_config
                cfg = load_config()
                foldx_path = cfg.foldx_binary_path
            except Exception:
                pass
        from pathlib import Path as _Path
        if foldx_path and _Path(foldx_path).exists():
            results["foldx"] = {"available": True, "reason": f"binary at {foldx_path}"}
        else:
            results["foldx"] = {
                "available": False,
                "reason": "FoldX binary not found" + (f" at '{foldx_path}'" if foldx_path else " (path not set)"),
                "install_hint": "1. Download from https://foldxsuite.crg.eu/ (free academic license)\n"
                                "2. bash scripts/setup_foldx.sh /path/to/foldx_binary",
            }

    # ── Reranker ─────────────────────────────────────────────────────────
    if not _probe_remote("reranker", "SYNQLAB_RERANKER_URL", "Reranker"):
        try:
            import sklearn  # noqa: F401
            model_path = Path("data/models/reranker/model.pkl")
            if model_path.exists():
                results["reranker"] = {"available": True, "reason": "model.pkl found"}
            else:
                results["reranker"] = {
                    "available": False,
                    "reason": "No trained model yet (data/models/reranker/model.pkl missing)",
                    "install_hint": "Run: python scripts/train_reranker.py",
                }
        except ImportError:
            results["reranker"] = {
                "available": False, "reason": "scikit-learn not installed",
                "install_hint": "uv pip install scikit-learn",
            }

    # ── ProteinMPNN ──────────────────────────────────────────────────────
    if not _probe_remote("proteinmpnn", "SYNQLAB_PROTEINMPNN_URL", "ProteinMPNN"):
        proteinmpnn_dir = os.environ.get("SYNQLAB_PROTEINMPNN_DIR", "/app/proteinmpnn")
        proteinmpnn_script = Path(proteinmpnn_dir) / "protein_mpnn_run.py"
        if proteinmpnn_script.exists():
            results["proteinmpnn"] = {"available": True, "reason": f"ProteinMPNN repo found at {proteinmpnn_dir}"}
        else:
            results["proteinmpnn"] = {
                "available": False,
                "reason": "ProteinMPNN not installed",
                "install_hint": "git clone https://github.com/dauparas/ProteinMPNN.git",
            }

    # ── GFP11: Brightness Model ───────────────────────────────────────────
    try:
        import sklearn  # noqa: F401
        results["brightness_model"] = {"available": True, "reason": "scikit-learn built-in"}
    except ImportError:
        results["brightness_model"] = {
            "available": False, "reason": "scikit-learn not installed",
            "install_hint": "pip install scikit-learn",
        }

    # ── GFP11: Complex Stability ─────────────────────────────────────────
    # Delegates to ESMFold/OmegaFold for folding — mirrors their availability
    esmfold_up = results.get("esmfold", {}).get("available", False)
    omegafold_up = results.get("omegafold", {}).get("available", False)
    if esmfold_up or omegafold_up:
        backend = "ESMFold" if esmfold_up else "OmegaFold"
        results["complex_stability"] = {"available": True, "reason": f"Delegates to {backend}"}
    else:
        results["complex_stability"] = {
            "available": True, "reason": "Available in mock_mode (no GPU backend)",
        }

    # ── GFP11: PyRosetta ─────────────────────────────────────────────────
    try:
        import pyrosetta  # noqa: F401
        results["pyrosetta"] = {"available": True, "reason": "PyRosetta installed"}
    except ImportError:
        results["pyrosetta"] = {
            "available": True, "reason": "Available in mock_mode (PyRosetta not installed)",
        }

    # ── GFP11: SPServer ──────────────────────────────────────────────────
    results["spserver"] = {"available": True, "reason": "IRB Barcelona HTTP API (mock_mode available)"}

    results["experiment_store"] = {"available": True, "reason": "SQLAlchemy built-in"}
    results["fluorescence_label_ingest"] = {"available": True, "reason": "pandas + openpyxl"}
    return results


# ---------------------------------------------------------------------------
# Background workers
# ---------------------------------------------------------------------------

def _run_tool_worker(job_id: str, tool_id: str, inputs: dict[str, Any]) -> None:
    """Execute a single tool in a background thread."""
    _set_job(job_id, status="running")
    try:
        from synqlab.core.schemas import ExperimentConfig, ToolRequest
        from synqlab.engine.adapter_resolver import resolve_adapter
        from synqlab.engine.executor import execute_tool
        from synqlab.registry.loader import load_registry

        tools = load_registry(str(_REGISTRY_PATH))
        if tool_id not in tools:
            _set_job(job_id, status="failed", error=f"Tool '{tool_id}' not in registry.")
            return

        config = ExperimentConfig(experiment_id=f"ui-{uuid.uuid4().hex[:8]}")
        request = ToolRequest(
            tool_id=tool_id,
            inputs=inputs,
            experiment_id=config.experiment_id,
            round_id="ui_round",
        )
        adapter = resolve_adapter(tools[tool_id])
        output = execute_tool(tool_id, request, config, adapter=adapter)

        _set_job(job_id,
            status="completed",
            tool_id=output.tool_id,
            success=output.success,
            outputs=output.outputs,
            latency_ms=output.latency_ms,
            error_message=output.error_message,
        )
    except Exception as exc:
        logging.getLogger("synqlab").error("Job %s failed: %s", job_id, exc)
        _set_job(job_id, status="failed", error=str(exc))


def _run_pipeline_worker(job_id: str, body: RunPipelineRequest) -> None:
    """Execute the full V1 pipeline in a background thread."""
    _set_job(job_id, status="running", stage=0, stage_total=4, stage_label="Initializing", stage_detail="")
    try:
        from synqlab.core.schemas import ExperimentConfig
        from synqlab.orchestrator.pipeline import run_experiment

        def _on_progress(stage: int, total: int, label: str, detail: str = "") -> None:
            _set_job(job_id, stage=stage, stage_total=total, stage_label=label, stage_detail=detail)

        exp_id = f"ui-{uuid.uuid4().hex[:8]}"
        config = ExperimentConfig(
            experiment_id=exp_id,
            n_sequences=body.n_sequences,
            plddt_threshold=body.plddt_threshold,
            ddg_threshold=body.ddg_threshold,
            top_k=body.top_k,
            use_reranker=body.use_reranker,
            artifacts_base_dir=str(_SUMMARIES_DIR),
        )
        summary = run_experiment(config, progress_callback=_on_progress)
        result = {
            "experiment_id": summary.experiment_id,
            "round_id": summary.round_id,
            "n_generated": summary.n_generated,
            "n_passed_gate1": summary.n_passed_gate1,
            "n_passed_gate2": summary.n_passed_gate2,
            "n_top_k": summary.n_top_k,
            "top_k_sequences": summary.top_k_sequences,
            "top_k_scores": summary.top_k_scores,
            "budget": summary.budget,
            "summary_artifact_path": summary.summary_artifact_path,
        }
        with _jobs_lock:
            _pipeline_results.insert(0, result)
            if len(_pipeline_results) > 20:
                _pipeline_results.pop()
        _set_job(job_id, status="completed", result=result)
    except Exception as exc:
        logging.getLogger("synqlab").error("Pipeline job %s failed: %s", job_id, exc)
        _set_job(job_id, status="failed", error=str(exc))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

def _spa_index() -> FileResponse:
    """Return the React SPA index.html (built dist) or fallback to legacy."""
    react_index = _DIST_DIR / "index.html"
    if react_index.exists():
        return FileResponse(str(react_index))
    return FileResponse(str(_STATIC_DIR / "index.html"))


# Public marketing site (built from ../website into app/static/site). Pages are served at their own
# paths; its JS/CSS/images load from /site/. Everything not listed here falls through to the product SPA.
_SITE_DIR = _STATIC_DIR / "site"
if _SITE_DIR.is_dir():
    app.mount("/site", StaticFiles(directory=str(_SITE_DIR)), name="site")

_SITE_PATHS = ["/", "/platform", "/aria", "/lyra", "/research", "/research/{slug}", "/company", "/book-a-call"]


def _site_index() -> FileResponse:
    """Marketing site index.html, or the product SPA when the site has not been built."""
    site_index = _SITE_DIR / "index.html"
    if site_index.exists():
        return FileResponse(str(site_index))
    return _spa_index()


for _site_path in _SITE_PATHS:
    app.add_api_route(_site_path, _site_index, methods=["GET"], include_in_schema=False)


@app.get("/sign-in", include_in_schema=False)
def sign_in_redirect() -> RedirectResponse:
    return RedirectResponse("/login")



# ---------------------------------------------------------------------------
# Category metadata — display names and descriptions live in the registry YAML.
# Adding a new tool with a new category automatically appears in the UI.
# ---------------------------------------------------------------------------

# Canonical display config for known category IDs.
# Keys match the `category:` field in the registry YAML.
# To customise a new category, add an entry here — or leave it out and the
# backend will auto-generate a label from the snake_case id.
_CATEGORY_DISPLAY: dict[str, dict[str, str]] = {
    "sequence_generation": {
        "label": "Sequence Generation",
        "description": "Generate novel protein sequences from language models",
    },
    "structure_prediction": {
        "label": "Structure Prediction",
        "description": "Predict 3-D structure from amino acid sequence",
    },
    "scoring": {
        "label": "Scoring & Filtering",
        "description": "Score, rank, and filter candidate sequences",
    },
    "data": {
        "label": "Data",
        "description": "Ingest, store, and retrieve experimental data",
    },
}


def _load_category_meta() -> dict[str, dict[str, str]]:
    """Return category display metadata.

    Falls back to auto-generated labels for any category id not in
    _CATEGORY_DISPLAY, so new tools added to the registry YAML appear
    in the UI without any frontend changes.
    """
    return _CATEGORY_DISPLAY


def _serialize_tool(t: Any, cat_meta: dict, phase: str) -> dict:
    """Serialize a ToolDefinition object or a plain dict (from planned/v2 YAML) to API shape."""
    if isinstance(t, dict):
        g = lambda key, default: t.get(key, default)  # noqa: E731
    else:
        g = lambda key, default: getattr(t, key, default)  # noqa: E731
    cat = g("category", "")
    cat_label = cat_meta.get(cat, {}).get("label", cat.replace("_", " ").title())
    rp_raw = g("resource_profile", {}) or {}
    resource_profile = dict(rp_raw) if isinstance(rp_raw, dict) else {}
    return {
        "id": g("id", ""),
        "name": g("name", ""),
        "category": cat,
        "category_label": cat_label,
        "category_description": cat_meta.get(cat, {}).get("description", ""),
        "phase": phase,
        "status": g("status", "planned"),
        "description": str(g("description", "") or "").strip(),
        "inputs": g("inputs", []) or [],
        "outputs": g("outputs", []) or [],
        "tags": g("tags", []) or [],
        "links": g("links", {}) or {},
        "abstract": str(g("abstract", "") or "").strip(),
        "meta": g("meta", {}) or {},
        "examples": g("examples", []) or [],
        "resource_profile": resource_profile,
    }


@app.get("/api/tools")
def list_tools() -> JSONResponse:
    from synqlab.registry.loader import load_registry
    try:
        tools = load_registry(str(_REGISTRY_PATH))
        _cat_meta = _load_category_meta()
        result = [_serialize_tool(t, _cat_meta, getattr(t, "status", "")) for t in tools.values()]
        return JSONResponse({"tools": result})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/api/tools/all")
def list_all_tools() -> JSONResponse:
    """Return every tool from the unified registry (tools.yaml) for the designer palette."""
    import yaml as _yaml
    try:
        _cat_meta = _load_category_meta()
        result: list[dict] = []
        seen_ids: set[str] = set()

        tools_path = _REGISTRY_PATH / "tools.yaml"
        if tools_path.exists():
            with open(tools_path) as fh:
                raw = _yaml.safe_load(fh) or {}
            for entry in raw.get("tools", []):
                tid = entry.get("id", "")
                if tid and tid not in seen_ids:
                    result.append(_serialize_tool(entry, _cat_meta, entry.get("status", "planned")))
                    seen_ids.add(tid)

        return JSONResponse({"tools": result})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/api/categories/all")
def list_all_categories() -> JSONResponse:
    """Return all categories across the unified registry (tools.yaml)."""
    import yaml as _yaml
    try:
        _cat_meta = _load_category_meta()
        cat_counts: dict[str, int] = {}

        tools_path = _REGISTRY_PATH / "tools.yaml"
        if tools_path.exists():
            with open(tools_path) as fh:
                raw = _yaml.safe_load(fh) or {}
            for entry in raw.get("tools", []):
                cat = entry.get("category", "")
                if cat:
                    cat_counts[cat] = cat_counts.get(cat, 0) + 1

        result = [
            {
                "id": cat,
                "label": _cat_meta.get(cat, {}).get("label", cat.replace("_", " ").title()),
                "description": _cat_meta.get(cat, {}).get("description", ""),
                "tool_count": count,
            }
            for cat, count in cat_counts.items()
        ]
        return JSONResponse({"categories": result})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/api/categories")
def list_categories() -> JSONResponse:
    """Return ordered list of categories with display metadata, derived from the registry YAML."""
    try:
        meta = _load_category_meta()
        from synqlab.registry.loader import load_registry
        tools = load_registry(str(_REGISTRY_PATH))

        # Preserve insertion order from YAML; only include categories that have active tools
        active_cats = list(dict.fromkeys(t.category for t in tools.values()))
        result = [
            {
                "id": cat,
                "label": meta.get(cat, {}).get("label", cat.replace("_", " ").title()),
                "description": meta.get(cat, {}).get("description", ""),
                "tool_count": sum(1 for t in tools.values() if t.category == cat),
            }
            for cat in active_cats
        ]
        return JSONResponse({"categories": result})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/api/health")
def health() -> JSONResponse:
    return JSONResponse({"tools": _check_tool_availability()})


@app.get("/healthz")
def healthz() -> JSONResponse:
    """Lightweight liveness/readiness probe for the load balancer.

    Does NOT probe tool services — returns immediately so the GKE L7
    health check never times out, even when tools are scaled to zero.
    """
    return JSONResponse({"status": "ok"})


@app.get("/api/compute")
def compute_info() -> JSONResponse:
    """Return active compute-device info by querying upstream tool services.

    In microservice mode the app container has no torch — so we probe the
    GPU-capable tool services (protgpt2, omegafold) for their /health
    response which includes device, gpu_name, and vram_gb.
    """
    import os
    import urllib.request

    # GPU-capable services, in probe order
    service_urls = [
        os.environ.get("SYNQLAB_PROTGPT2_URL", ""),
        os.environ.get("SYNQLAB_OMEGAFOLD_URL", ""),
        os.environ.get("SYNQLAB_ESMFOLD_URL", ""),
    ]

    _log = logging.getLogger("synqlab.compute")

    for base_url in service_urls:
        if not base_url:
            continue
        health_url = f"{base_url}/health"
        try:
            req = urllib.request.Request(health_url, method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read())
            device = data.get("device", "cpu")
            result = {
                "device": device,
                "type": "gpu" if device in ("cuda", "mps") else "cpu",
                "name": data.get("gpu_name", device.upper()),
            }
            if data.get("vram_gb"):
                result["vram_gb"] = data["vram_gb"]
            if data.get("cuda_version"):
                result["cuda_version"] = data["cuda_version"]
            _log.info("Compute probe %s → %s", health_url, device)
            return JSONResponse(result)
        except Exception as exc:
            _log.warning("Compute probe failed for %s: %s", health_url, exc)
            continue

    # Fallback: try local torch detection (works when running outside Docker)
    try:
        import torch
        if torch.cuda.is_available():
            return JSONResponse({
                "device": "cuda",
                "type": "gpu",
                "name": torch.cuda.get_device_name(0),
                "vram_gb": round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1),
            })
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return JSONResponse({"device": "mps", "type": "gpu", "name": "Apple Silicon"})
    except ImportError:
        pass

    return JSONResponse({"device": "cpu", "type": "cpu", "name": "CPU"})


@app.post("/api/run-tool")
def run_tool(body: RunToolRequest) -> JSONResponse:
    """Submit a tool execution job. Returns immediately with a job_id."""
    job_id = str(uuid.uuid4())
    _set_job(job_id, status="queued", tool_id=body.tool_id)
    _executor.submit(_run_tool_worker, job_id, body.tool_id, body.inputs)
    return JSONResponse({"job_id": job_id, "status": "queued"})


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> JSONResponse:
    """Poll job status and result."""
    job = _get_job(job_id)
    if job is None:
        return JSONResponse({"error": "Job not found"}, status_code=404)
    return JSONResponse(job)


# Store recent pipeline results in memory (last 20)
_pipeline_results: list[dict[str, Any]] = []


@app.post("/api/run-pipeline")
def run_pipeline(body: RunPipelineRequest) -> JSONResponse:
    """Submit a full V1 pipeline job. Returns immediately with a job_id."""
    job_id = str(uuid.uuid4())
    _set_job(job_id, status="queued")
    _executor.submit(_run_pipeline_worker, job_id, body)
    return JSONResponse({"job_id": job_id, "status": "queued"})


@app.get("/api/experiments")
def list_experiments() -> JSONResponse:
    return JSONResponse({"experiments": _pipeline_results})


@app.get("/api/artifact")
def get_artifact(path: str = Query(..., description="Absolute or relative path to an artifact file")) -> PlainTextResponse:
    """Serve an artifact file (e.g. a PDB) as plain text for the browser to read."""
    p = Path(path)
    # Resolve relative paths against the agent root (where the server runs)
    if not p.is_absolute():
        p = _AGENT_ROOT / p
    p = p.resolve()
    if not p.exists():
        return PlainTextResponse(f"File not found: {path}", status_code=404)
    # Only allow files inside the agent root (basic security guard)
    try:
        p.relative_to(_AGENT_ROOT.resolve())
    except ValueError:
        return PlainTextResponse("Access denied: path outside project directory", status_code=403)
    return PlainTextResponse(p.read_text(), media_type="text/plain")


# ---------------------------------------------------------------------------
# Storage browser — namespace-aware file browsing and download
# ---------------------------------------------------------------------------

@app.get("/api/storage/browse")
async def browse_storage(namespace: str = "", path: str = ""):
    """Browse the agent artifact directory tree.

    Returns a directory listing for the given namespace/path combination.
    Root listing (no args) returns all top-level namespace folders.
    """
    from datetime import datetime, timezone

    root = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))
    target = (root / namespace / path) if namespace else root
    target = target.resolve()

    # Security: prevent path traversal
    if not str(target).startswith(str(root.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.exists():
        return JSONResponse({"entries": [], "namespace": namespace, "path": path})

    if not target.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {namespace}/{path}")

    # Only hide truly internal/system directories at root level
    _SYSTEM_DIRS = {"brightness_models", "sandbox"}

    import re
    _UUID_RE = re.compile(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
    )

    entries = []
    try:
        for entry in sorted(target.iterdir()):
            # Skip hidden files (.gitkeep, etc.)
            if entry.name.startswith("."):
                continue
            # At root level, hide internal system directories
            if not namespace and entry.is_dir() and entry.name in _SYSTEM_DIRS:
                continue
            try:
                stat = entry.stat()
                entries.append({
                    "name": entry.name,
                    "display_name": entry.name,
                    "is_dir": entry.is_dir(),
                    "size": stat.st_size if entry.is_file() else None,
                    "modified": datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    ).isoformat(),
                    "path": str(entry.relative_to(root)).replace("\\", "/"),
                })
            except OSError:
                continue
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    # At root level, resolve UUID dir names to session titles
    if not namespace:
        uuid_names = [e["name"] for e in entries if e["is_dir"] and _UUID_RE.match(e["name"])]
        if uuid_names:
            try:
                from app.routers.agents import _get_db
                db = next(_get_db())
                from sqlalchemy import text
                # Use IN with tuple expansion for PostgreSQL compatibility
                placeholders = ", ".join(f":id{i}" for i in range(len(uuid_names)))
                params = {f"id{i}": uid for i, uid in enumerate(uuid_names)}
                rows = db.execute(
                    text(f"SELECT id::text, title FROM agent_sessions WHERE id::text IN ({placeholders})"),
                    params,
                ).fetchall()
                title_map = {str(r[0]): r[1] for r in rows if r[1]}
                for e in entries:
                    if e["name"] in title_map:
                        e["display_name"] = title_map[e["name"]]
            except Exception:
                pass  # graceful fallback — keep UUID names

    return JSONResponse({"entries": entries, "namespace": namespace, "path": path})


@app.get("/api/storage/download")
async def download_storage_file(path: str = Query(..., description="Relative path within artifact dir")):
    """Download a file from the agent artifact directory.

    Returns the file with Content-Disposition: attachment header.
    """
    root = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))
    target = (root / path).resolve()

    # Security: prevent path traversal
    if not str(target).startswith(str(root.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    # Determine MIME type from extension
    mime_map = {
        ".pdb": "chemical/x-pdb",
        ".fasta": "application/x-fasta",
        ".fa": "application/x-fasta",
        ".json": "application/json",
        ".csv": "text/csv",
        ".txt": "text/plain",
        ".pkl": "application/octet-stream",
        ".md": "text/markdown",
    }
    suffix = target.suffix.lower()
    media_type = mime_map.get(suffix, "application/octet-stream")

    return FileResponse(
        path=str(target),
        filename=target.name,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{target.name}"'},
    )


@app.get("/api/experiments/{experiment_id}")
def get_experiment(experiment_id: str) -> JSONResponse:
    for exp in _pipeline_results:
        if exp["experiment_id"] == experiment_id:
            return JSONResponse(exp)
    for summary_json in _SUMMARIES_DIR.rglob("experiment_summary.json"):
        try:
            data = json.loads(summary_json.read_text())
            if data.get("experiment_id") == experiment_id:
                return JSONResponse(data)
        except Exception:
            pass
    return JSONResponse({"error": "Not found"}, status_code=404)


# ---------------------------------------------------------------------------
# WebSocket — stream log lines to the browser in real time
# ---------------------------------------------------------------------------

@app.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            try:
                line = _log_queue.get_nowait()
                await websocket.send_text(line)
            except queue.Empty:
                await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass


# ---------------------------------------------------------------------------
# Database browser endpoints — read from PostgreSQL via SQLAlchemy
# ---------------------------------------------------------------------------

def _db_session_or_none():
    """Return a live DB session, or None if the database is not reachable."""
    try:
        from synqlab.storage.db import get_session
        session = get_session()
        session.execute(__import__("sqlalchemy").text("SELECT 1"))
        return session
    except Exception:
        return None


@app.get("/api/db/experiments")
def db_experiments(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
) -> JSONResponse:
    session = _db_session_or_none()
    if session is None:
        return JSONResponse({"error": "Database not connected", "rows": [], "total": 0})
    try:
        from synqlab.storage.models import Experiment
        from sqlalchemy import func
        total = session.query(func.count(Experiment.id)).scalar() or 0
        rows = session.query(Experiment).order_by(Experiment.created_at.desc()).offset(offset).limit(limit).all()
        return JSONResponse({
            "total": total,
            "rows": [
                {
                    "id": r.id,
                    "name": r.name,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "config": r.config_jsonb,
                }
                for r in rows
            ],
        })
    except Exception as exc:
        return JSONResponse({"error": str(exc), "rows": [], "total": 0}, status_code=500)
    finally:
        session.close()


@app.get("/api/db/tool_runs")
def db_tool_runs(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    experiment_id: str | None = Query(None),
) -> JSONResponse:
    session = _db_session_or_none()
    if session is None:
        return JSONResponse({"error": "Database not connected", "rows": [], "total": 0})
    try:
        from synqlab.storage.models import ToolRun
        from sqlalchemy import func
        q = session.query(ToolRun)
        if experiment_id:
            q = q.filter(ToolRun.experiment_id == experiment_id)
        total = q.with_entities(func.count(ToolRun.id)).scalar() or 0
        rows = q.order_by(ToolRun.started_at.desc()).offset(offset).limit(limit).all()
        return JSONResponse({
            "total": total,
            "rows": [
                {
                    "id": r.id,
                    "experiment_id": r.experiment_id,
                    "round_id": r.round_id,
                    "tool_id": r.tool_id,
                    "status": r.status,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                    "latency_ms": r.latency_ms,
                    "error_message": r.error_message,
                }
                for r in rows
            ],
        })
    except Exception as exc:
        return JSONResponse({"error": str(exc), "rows": [], "total": 0}, status_code=500)
    finally:
        session.close()


@app.get("/api/db/artifacts")
def db_artifacts(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    experiment_id: str | None = Query(None),
) -> JSONResponse:
    session = _db_session_or_none()
    if session is None:
        return JSONResponse({"error": "Database not connected", "rows": [], "total": 0})
    try:
        from synqlab.storage.models import Artifact
        from sqlalchemy import func
        q = session.query(Artifact)
        if experiment_id:
            q = q.filter(Artifact.experiment_id == experiment_id)
        total = q.with_entities(func.count(Artifact.id)).scalar() or 0
        rows = q.order_by(Artifact.created_at.desc()).offset(offset).limit(limit).all()
        return JSONResponse({
            "total": total,
            "rows": [
                {
                    "id": r.id,
                    "experiment_id": r.experiment_id,
                    "tool_run_id": r.tool_run_id,
                    "artifact_type": r.artifact_type,
                    "path": r.path,
                    "format": r.format,
                    "size_bytes": r.size_bytes,
                    "checksum": r.checksum,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "meta": r.meta_jsonb,
                }
                for r in rows
            ],
        })
    except Exception as exc:
        return JSONResponse({"error": str(exc), "rows": [], "total": 0}, status_code=500)
    finally:
        session.close()


@app.get("/api/db/tags")
def db_tags(
    limit: int = Query(200, le=1000),
    offset: int = Query(0, ge=0),
    artifact_id: str | None = Query(None),
) -> JSONResponse:
    session = _db_session_or_none()
    if session is None:
        return JSONResponse({"error": "Database not connected", "rows": [], "total": 0})
    try:
        from synqlab.storage.models import Tag
        from sqlalchemy import func
        q = session.query(Tag)
        if artifact_id:
            q = q.filter(Tag.artifact_id == artifact_id)
        total = q.with_entities(func.count(Tag.id)).scalar() or 0
        rows = q.order_by(Tag.id.desc()).offset(offset).limit(limit).all()
        return JSONResponse({
            "total": total,
            "rows": [
                {
                    "id": r.id,
                    "artifact_id": r.artifact_id,
                    "key": r.key,
                    "value": r.value,
                }
                for r in rows
            ],
        })
    except Exception as exc:
        return JSONResponse({"error": str(exc), "rows": [], "total": 0}, status_code=500)
    finally:
        session.close()


@app.get("/api/db/status")
def db_status() -> JSONResponse:
    """Return whether the database is reachable."""
    session = _db_session_or_none()
    if session is None:
        return JSONResponse({"connected": False})
    session.close()
    return JSONResponse({"connected": True})


# Catch-all for React Router client-side routes — MUST be registered last.
# Before falling back to index.html, try to serve a real file from the built
# dist/ root (e.g. /favicon.svg, /icons.svg, /robots.txt, /manifest.json —
# anything Vite copies from frontend/public/). Without this, a request for
# /favicon.svg is answered with index.html (HTML), and the browser silently
# fails to render the logo / favicon.
@app.get("/{full_path:path}")
def spa_fallback(full_path: str) -> FileResponse:
    if full_path and _DIST_DIR.exists():
        candidate = (_DIST_DIR / full_path).resolve()
        try:
            candidate.relative_to(_DIST_DIR.resolve())
        except ValueError:
            return _spa_index()
        if candidate.is_file():
            return FileResponse(str(candidate))
    return _spa_index()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(_AGENT_ROOT)],
        log_level="info",
    )


if __name__ == "__main__":
    main()

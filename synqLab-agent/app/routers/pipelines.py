"""Pipeline API router — templates, execution, and batch processing.

Endpoints:
  GET    /api/pipelines/templates           → List core pipeline templates
  GET    /api/pipelines/{pipeline_id}       → Get pipeline definition
  PUT    /api/pipelines/{pipeline_id}       → Update pipeline definition
  POST   /api/pipelines/{pipeline_id}/run   → Execute a pipeline
  POST   /api/pipelines/{pipeline_id}/batch → Submit batch (CSV/FASTA)
  GET    /api/pipelines/runs/{run_id}       → Get run status + results
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from synqlab.agent.pipeline import (
    PIPELINE_TEMPLATES,
    PipelineDefinition,
    PipelineEngine,
    PipelineNode,
    auto_wire_nodes,
)
from synqlab.agent.batch import BatchProcessor, detect_format

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])

# File-backed storage for pipeline runs (persists across restarts).
from pathlib import Path as _Path

from synqlab.storage.artifact_paths import PIPELINES, build_agent_artifact_path

_RUNS_DIR = build_agent_artifact_path(
    _Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts")),
    PIPELINES,
)
_RUNS_DIR.mkdir(parents=True, exist_ok=True)

# Path to the YAML tool registry (used for wrapping YAML tools as pipeline-callable).
# In Docker: mounted at /registry; locally: ../registry relative to project root.
_REGISTRY_PATH = (
    _Path("/registry") if _Path("/registry").exists()
    else _Path(__file__).resolve().parents[2] / "registry"
)


class _RunStore:
    """Simple file-backed dict for pipeline runs.

    Keeps an in-memory cache for fast reads and writes each mutation
    to a JSON file so runs survive app restarts.
    """

    def __init__(self, directory: _Path) -> None:
        self._dir = directory
        self._cache: dict[str, dict[str, Any]] = {}
        # Load existing runs on startup.
        for f in self._dir.glob("*.json"):
            try:
                self._cache[f.stem] = json.loads(f.read_text())
            except Exception:
                pass

    def get(self, run_id: str) -> dict[str, Any] | None:
        return self._cache.get(run_id)

    def __contains__(self, run_id: str) -> bool:
        return run_id in self._cache

    def __setitem__(self, run_id: str, data: dict[str, Any]) -> None:
        self._cache[run_id] = data
        self._flush(run_id)

    def _flush(self, run_id: str) -> None:
        try:
            (self._dir / f"{run_id}.json").write_text(
                json.dumps(self._cache[run_id], default=str),
                encoding="utf-8",
            )
        except Exception:
            pass

    def sync(self, run_id: str) -> None:
        """Persist current in-memory state for a run."""
        if run_id in self._cache:
            self._flush(run_id)

    def list_all(self) -> list[dict[str, Any]]:
        return list(self._cache.values())

    def delete(self, run_id: str) -> bool:
        if run_id in self._cache:
            del self._cache[run_id]
            file_path = self._dir / f"{run_id}.json"
            if file_path.exists():
                try:
                    file_path.unlink()
                except Exception:
                    pass
            return True
        return False


_runs = _RunStore(_RUNS_DIR)


# ── Request / Response models ───────────────────────────────────────────────


class PipelineNodeSchema(BaseModel):
    id: str
    tool_name: str
    parameters: dict[str, Any] = {}
    depends_on: list[str] = []
    label: str = ""
    position: dict[str, float] | None = None


class PipelineDefSchema(BaseModel):
    id: str = ""
    name: str = ""
    description: str = ""
    nodes: list[PipelineNodeSchema] = []


class RunPipelineRequest(BaseModel):
    inputs: dict[str, Any] = {}


# ── Templates ───────────────────────────────────────────────────────────────


@router.get("/templates")
async def list_templates():
    """List available core pipeline templates."""
    templates = []
    for key, factory in PIPELINE_TEMPLATES.items():
        defn = factory()
        templates.append({
            "template_id": key,
            "name": defn.name,
            "description": defn.description,
            "node_count": len(defn.nodes),
            "nodes": [n.to_dict() for n in defn.nodes],
        })
    return templates


@router.get("/custom")
async def list_custom_pipelines():
    """List user-created custom pipelines."""
    results = []
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    if custom_dir.exists():
        for f in sorted(custom_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                results.append(data)
            except Exception:
                pass
    return results


@router.post("")
async def create_pipeline(body: PipelineDefSchema):
    """Create a new custom pipeline definition."""
    pipeline_id = body.id or str(uuid.uuid4())
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    custom_dir.mkdir(parents=True, exist_ok=True)

    data = {
        "template_id": pipeline_id,
        "id": pipeline_id,
        "name": body.name or "Untitled Pipeline",
        "description": body.description or "",
        "node_count": len(body.nodes),
        "nodes": [n.model_dump() for n in body.nodes],
        "is_custom": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    (custom_dir / f"{pipeline_id}.json").write_text(
        json.dumps(data, default=str), encoding="utf-8"
    )
    return data


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get a specific pipeline template."""
    factory = PIPELINE_TEMPLATES.get(template_id)
    if not factory:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    defn = factory()
    return defn.to_dict()


# ── Run Management (must be before /{pipeline_id} catch-all) ────────────────


@router.get("/runs")
async def list_runs():
    """List all pipeline runs (most recent first)."""
    runs = _runs.list_all()
    runs.sort(key=lambda r: r.get("started_at", ""), reverse=True)
    return [
        {
            "id": r.get("id"),
            "pipeline_id": r.get("pipeline_id"),
            "status": r.get("status"),
            "started_at": r.get("started_at"),
            "completed_at": r.get("completed_at"),
            "node_statuses": r.get("node_statuses", {}),
            "results": r.get("results"),
            "round": r.get("round"),
            "max_rounds": r.get("max_rounds"),
            "error": r.get("error"),
        }
        for r in runs[:50]
    ]


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get the status and results of a pipeline run."""
    run = _runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str):
    """Delete a pipeline run."""
    if _runs.delete(run_id):
        return {"status": "deleted", "id": run_id}
    raise HTTPException(status_code=404, detail="Run not found")


# ── Pipeline CRUD ───────────────────────────────────────────────────────────


@router.get("/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    """Get a pipeline definition by ID (from templates, file storage, or DB)."""
    # Check templates.
    factory = PIPELINE_TEMPLATES.get(pipeline_id)
    if factory:
        return factory().to_dict()

    # Check file-backed custom pipelines.
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    custom_file = custom_dir / f"{pipeline_id}.json"
    if custom_file.exists():
        try:
            data = json.loads(custom_file.read_text(encoding="utf-8"))
            return {
                "id": data.get("id", pipeline_id),
                "name": data.get("name", "Untitled Pipeline"),
                "description": data.get("description", ""),
                "nodes": data.get("nodes", []),
                "pipeline_params": data.get("pipeline_params", []),
            }
        except Exception:
            pass

    # Check DB.
    try:
        from synqlab.storage.db import get_session as get_db_session
        from synqlab.storage.models import PipelineVersion, Pipeline

        db = get_db_session()
        try:
            pipeline = db.query(Pipeline).filter_by(id=pipeline_id).first()
            if not pipeline:
                raise HTTPException(status_code=404, detail="Pipeline not found")

            version = (
                db.query(PipelineVersion)
                .filter_by(pipeline_id=pipeline_id, version=pipeline.current_version)
                .first()
            )
            config = version.config_jsonb if version else {}
            return {
                "id": pipeline.id,
                "name": pipeline.name,
                "description": pipeline.description or "",
                "nodes": config.get("nodes", []),
                "pipeline_params": config.get("pipeline_params", []),
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Pipeline not found")


@router.put("/{pipeline_id}")
async def update_pipeline(pipeline_id: str, body: PipelineDefSchema):
    """Update a pipeline's node definition."""
    # Check file-backed custom pipelines first.
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    custom_file = custom_dir / f"{pipeline_id}.json"
    if custom_file.exists():
        try:
            data = json.loads(custom_file.read_text(encoding="utf-8"))
            data["nodes"] = [n.model_dump() for n in body.nodes]
            if body.name:
                data["name"] = body.name
            if body.description:
                data["description"] = body.description
            data["node_count"] = len(body.nodes)
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            custom_file.write_text(
                json.dumps(data, default=str), encoding="utf-8"
            )
            return {"id": pipeline_id, "version": 1, "status": "updated"}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    # Fall through to DB.
    try:
        from synqlab.storage.db import get_session as get_db_session
        from synqlab.storage.models import Pipeline, PipelineVersion

        db = get_db_session()
        try:
            pipeline = db.query(Pipeline).filter_by(id=pipeline_id).first()
            if not pipeline:
                raise HTTPException(status_code=404, detail="Pipeline not found")

            new_version = pipeline.current_version + 1
            pv = PipelineVersion(
                pipeline_id=pipeline_id,
                version=new_version,
                config_jsonb={"nodes": [n.model_dump() for n in body.nodes]},
                changelog=f"Updated to v{new_version}",
                created_by="system",
            )
            pipeline.current_version = new_version
            if body.name:
                pipeline.name = body.name
            if body.description:
                pipeline.description = body.description

            db.add(pv)
            db.commit()

            return {"id": pipeline_id, "version": new_version, "status": "updated"}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class PipelinePatchSchema(BaseModel):
    name: str | None = None
    description: str | None = None


@router.patch("/{pipeline_id}")
async def patch_pipeline(pipeline_id: str, body: PipelinePatchSchema):
    """Partially update a pipeline (rename, change description)."""
    # Core templates are immutable.
    if pipeline_id in PIPELINE_TEMPLATES:
        raise HTTPException(status_code=400, detail="Core templates cannot be modified")

    # File-backed custom pipelines.
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    custom_file = custom_dir / f"{pipeline_id}.json"
    if custom_file.exists():
        try:
            data = json.loads(custom_file.read_text(encoding="utf-8"))
            if body.name is not None:
                data["name"] = body.name
            if body.description is not None:
                data["description"] = body.description
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            custom_file.write_text(
                json.dumps(data, default=str), encoding="utf-8"
            )
            return {"id": pipeline_id, "name": data["name"], "status": "updated"}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    # Fall through to DB.
    try:
        from synqlab.storage.db import get_session as get_db_session
        from synqlab.storage.models import Pipeline

        db = get_db_session()
        try:
            pipeline = db.query(Pipeline).filter_by(id=pipeline_id).first()
            if not pipeline:
                raise HTTPException(status_code=404, detail="Pipeline not found")
            if body.name is not None:
                pipeline.name = body.name
            if body.description is not None:
                pipeline.description = body.description
            db.commit()
            return {"id": pipeline_id, "name": pipeline.name, "status": "updated"}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    """Delete a custom pipeline definition."""
    # Core templates cannot be deleted.
    if pipeline_id in PIPELINE_TEMPLATES:
        raise HTTPException(status_code=400, detail="Core templates cannot be deleted")

    # File-backed custom pipelines.
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    custom_file = custom_dir / f"{pipeline_id}.json"
    if custom_file.exists():
        try:
            custom_file.unlink()
            return {"id": pipeline_id, "status": "deleted"}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

    # Fall through to DB.
    try:
        from synqlab.storage.db import get_session as get_db_session
        from synqlab.storage.models import Pipeline, PipelineVersion

        db = get_db_session()
        try:
            pipeline = db.query(Pipeline).filter_by(id=pipeline_id).first()
            if not pipeline:
                raise HTTPException(status_code=404, detail="Pipeline not found")
            db.query(PipelineVersion).filter_by(pipeline_id=pipeline_id).delete()
            db.delete(pipeline)
            db.commit()
            return {"id": pipeline_id, "status": "deleted"}
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Execution ───────────────────────────────────────────────────────────────


@router.post("/{pipeline_id}/run")
async def run_pipeline(pipeline_id: str, body: RunPipelineRequest):
    """Execute a pipeline with given inputs."""
    defn = _resolve_definition(pipeline_id)

    # Inject user inputs — supports node-scoped keys ("propose::n") and
    # legacy flat keys (fall back to first node for backward compat).
    if body.inputs and defn.nodes:
        node_map = {n.id: n for n in defn.nodes}
        for key, val in body.inputs.items():
            # Pipeline-level overrides
            if key == "max_rounds":
                try:
                    defn.max_rounds = int(val)
                except (ValueError, TypeError):
                    pass
            elif key == "score_all_candidates":
                defn.score_all_candidates = bool(val)
            elif "::" in key:
                # Node-scoped: "propose::n" → node "propose", param "n"
                node_id, param_name = key.split("::", 1)
                if node_id in node_map:
                    node_map[node_id].parameters[param_name] = val
                else:
                    logger.warning("Input key '%s' references unknown node '%s'", key, node_id)
            else:
                # Legacy flat format → inject into first node
                defn.nodes[0].parameters[key] = val

    run_id = str(uuid.uuid4())
    _runs[run_id] = {
        "id": run_id,
        "pipeline_id": pipeline_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "node_statuses": {},
        "results": None,
        "inputs": dict(body.inputs) if body.inputs else {},
    }

    # Run in background.
    logger.info("Launching pipeline task for run_id=%s, pipeline_id=%s", run_id, pipeline_id)
    task = asyncio.create_task(_execute_pipeline(run_id, defn))

    def _task_done(t: asyncio.Task) -> None:
        exc = t.exception() if not t.cancelled() else None
        if exc:
            logger.error("Pipeline task %s crashed: %s", run_id, exc, exc_info=exc)
            run = _runs.get(run_id)
            if run:
                run["status"] = "failed"
                run["error"] = str(exc)

    task.add_done_callback(_task_done)

    return {"run_id": run_id, "status": "running"}


@router.post("/{pipeline_id}/batch")
async def run_batch(
    pipeline_id: str,
    file: UploadFile = File(...),
    max_concurrency: int = Form(default=5),
):
    """Submit a batch file (CSV or FASTA) for parallel pipeline execution."""
    content = (await file.read()).decode("utf-8")
    fmt = detect_format(content)
    if fmt == "unknown":
        raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV or FASTA.")

    defn = _resolve_definition(pipeline_id)

    run_id = str(uuid.uuid4())
    _runs[run_id] = {
        "id": run_id,
        "pipeline_id": pipeline_id,
        "status": "running",
        "batch": True,
        "format": fmt,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "results": None,
    }

    asyncio.create_task(_execute_batch(run_id, defn, content, fmt, max_concurrency))

    return {"run_id": run_id, "status": "running", "format": fmt}




# ── Internal helpers ────────────────────────────────────────────────────────


def _resolve_definition(pipeline_id: str) -> PipelineDefinition:
    """Resolve a pipeline ID to a PipelineDefinition."""
    # Check templates first.
    factory = PIPELINE_TEMPLATES.get(pipeline_id)
    if factory:
        return factory()

    # Check file-backed custom pipelines.
    custom_dir = _RUNS_DIR.parent / "custom_pipelines"
    custom_file = custom_dir / f"{pipeline_id}.json"
    if custom_file.exists():
        try:
            data = json.loads(custom_file.read_text(encoding="utf-8"))
            return PipelineDefinition.from_dict({
                "id": data.get("id", pipeline_id),
                "name": data.get("name", "Untitled Pipeline"),
                "description": data.get("description", ""),
                "nodes": data.get("nodes", []),
                "pipeline_params": data.get("pipeline_params", []),
            })
        except Exception:
            pass

    # Check DB.
    try:
        from synqlab.storage.db import get_session as get_db_session
        from synqlab.storage.models import Pipeline, PipelineVersion

        db = get_db_session()
        try:
            pipeline = db.query(Pipeline).filter_by(id=pipeline_id).first()
            if not pipeline:
                raise HTTPException(status_code=404, detail="Pipeline not found")

            version = (
                db.query(PipelineVersion)
                .filter_by(pipeline_id=pipeline_id, version=pipeline.current_version)
                .first()
            )
            config = version.config_jsonb if version else {}
            return PipelineDefinition.from_dict({
                "id": pipeline.id,
                "name": pipeline.name,
                "description": pipeline.description or "",
                "nodes": config.get("nodes", []),
                "pipeline_params": config.get("pipeline_params", []),
            })
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Pipeline not found")


def _register_yaml_tools(
    registry: dict,
    defn: PipelineDefinition,
) -> None:
    """Register YAML registry tools as AgentTool-compatible wrappers.

    For custom pipelines that reference tools like 'protgpt2', 'omegafold',
    'foldx' — these exist in the YAML registry but not as Python AgentTools.
    This function creates lightweight wrappers that call the existing
    adapter/executor system so they work in the pipeline engine.
    """
    # Find tool names that aren't already in the agent tool registry.
    missing = {
        n.tool_name for n in defn.nodes
        if n.tool_name not in registry
    }
    if not missing:
        return

    try:
        from synqlab.registry.loader import load_registry
        from synqlab.engine.adapter_resolver import resolve_adapter
        from synqlab.engine.executor import execute_tool
        from synqlab.core.schemas import ExperimentConfig, ToolRequest
        from synqlab.agent.tool import AgentTool, ToolResult
        from pydantic import BaseModel

        yaml_tools = load_registry(str(_REGISTRY_PATH))

        for tool_name in missing:
            if tool_name not in yaml_tools:
                logger.warning("Tool '%s' not found in agent tools or YAML registry", tool_name)
                continue

            tool_def = yaml_tools[tool_name]

            # Create a dynamic Pydantic model from the YAML tool's inputs.
            # Inputs are plain dicts from YAML: {"name": "...", "type": "...", ...}
            field_defs = {}
            for inp in tool_def.inputs or []:
                inp_name = inp["name"] if isinstance(inp, dict) else getattr(inp, "name", "")
                if inp_name:
                    field_defs[inp_name] = str
            DynInput = type(f"{tool_name}_Input", (BaseModel,), {"__annotations__": field_defs} if field_defs else {"__annotations__": {"_dummy": str}})

            # Build the async call function (closure over tool_def).
            def _make_call(t_name, t_def):
                async def _call(inputs: dict, ctx) -> ToolResult:
                    try:
                        adapter = resolve_adapter(t_def)
                        config = ExperimentConfig(experiment_id=f"pipeline-{uuid.uuid4().hex[:8]}")
                        request = ToolRequest(
                            tool_id=t_name,
                            inputs=inputs,
                            experiment_id=config.experiment_id,
                            round_id="pipeline",
                        )
                        output = execute_tool(t_name, request, config, adapter=adapter)
                        if output.success:
                            return ToolResult.ok(output.outputs or {})
                        return ToolResult.fail(output.error_message or f"{t_name} failed")
                    except Exception as exc:
                        return ToolResult.fail(f"{t_name} execution error: {exc}")
                return _call

            wrapper = AgentTool(
                name=tool_name,
                description=getattr(tool_def, 'description', tool_name),
                input_schema=DynInput,
                call=_make_call(tool_name, tool_def),
                is_enabled=lambda: True,
                is_read_only=False,
                is_concurrency_safe=False,
                max_result_size_chars=100_000,
                search_hint="",
            )
            registry[tool_name] = wrapper
            logger.info("Registered YAML tool '%s' as pipeline-callable wrapper", tool_name)

    except Exception as exc:
        logger.warning("Failed to register YAML tools: %s", exc)


async def _execute_pipeline(run_id: str, defn: PipelineDefinition) -> None:
    """Background task to execute a pipeline and update run state."""
    import sys
    print(f"[PIPELINE] _execute_pipeline started for {run_id}", flush=True)
    try:
        # Build tool registry from agent science tools so the engine
        # can resolve tool_name → AgentTool for each node.
        from synqlab.agent.tools import get_worker_tools
        registry = {t.name: t for t in get_worker_tools()}

        # Also register YAML registry tools as callable wrappers so custom
        # pipelines that reference tools like 'protgpt2', 'omegafold', 'foldx'
        # can execute through the adapter/executor system.
        _register_yaml_tools(registry, defn)

        print(f"[PIPELINE] Built registry with {len(registry)} tools: {list(registry.keys())}", flush=True)

        # Auto-wire downstream node parameters for custom pipelines that
        # don't have explicit {{placeholder}} wiring from the frontend.
        auto_wire_nodes(defn, tool_registry=registry)

        engine = PipelineEngine(definition=defn, tool_registry=registry)
        print(f"[PIPELINE] Engine created, starting execute()", flush=True)
        async for event in engine.execute():
            err_info = f" error={event.data.get('error','')[:200]}" if event.type.value == 'node_failed' else ''
            print(f"[PIPELINE] Event: {event.type.value} node={event.node_id}{err_info}", flush=True)
            run = _runs.get(run_id)
            if run:
                run["node_statuses"] = dict(engine.node_statuses)
                if event.type.value == "round_started":
                    run["round"] = event.data.get("round", 1)
                    run["max_rounds"] = event.data.get("max_rounds", 1)
                elif event.type.value == "round_completed":
                    # Accumulate per-round results for cross-round visibility.
                    if "rounds" not in run:
                        run["rounds"] = []
                    run["rounds"].append(event.data)
                elif event.type.value == "pipeline_done":
                    run["status"] = event.data.get("status", "completed")
                    run["results"] = event.data
                    run["completed_at"] = datetime.now(timezone.utc).isoformat()
                _runs.sync(run_id)
    except Exception as exc:
        import traceback
        print(f"[PIPELINE] CRASHED: {exc}", flush=True)
        traceback.print_exc()
        logger.exception("Pipeline run %s failed", run_id)
        run = _runs.get(run_id)
        if run:
            run["status"] = "failed"
            run["error"] = str(exc)
            _runs.sync(run_id)


async def _execute_batch(
    run_id: str,
    defn: PipelineDefinition,
    content: str,
    fmt: str,
    max_concurrency: int,
) -> None:
    """Background task to execute a batch and update run state."""
    try:
        processor = BatchProcessor(
            definition=defn,
            max_concurrency=max_concurrency,
        )

        if fmt == "csv":
            events = processor.process_csv(content)
        else:
            events = processor.process_fasta(content)

        async for event in events:
            run = _runs.get(run_id)
            if run:
                if event.type.value == "batch_done":
                    run["status"] = "completed"
                    run["results"] = event.data
                    run["completed_at"] = datetime.now(timezone.utc).isoformat()
    except Exception as exc:
        logger.exception("Batch run %s failed", run_id)
        run = _runs.get(run_id)
        if run:
            run["status"] = "failed"
            run["error"] = str(exc)

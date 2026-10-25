"""Training API — upload datasets, train brightness models, and manage versions.

POST /api/training/brightness/upload   → upload CSV/XLSX dataset
POST /api/training/brightness/train    → trigger model training (background)
GET  /api/training/brightness/status   → check training job status
GET  /api/training/brightness/models   → list trained model versions
POST /api/training/brightness/deploy   → set active model version
"""

from __future__ import annotations

import asyncio
import logging
import os
import pickle
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/training", tags=["training"])

# Paths
_ARTIFACT_DIR = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))
_UPLOAD_DIR = Path(os.environ.get("SYNQLAB_TRAINING_DATA_DIR", str(_ARTIFACT_DIR / "training_datasets")))
# Read-only source for listing/deploying existing models (GCS Fuse in k8s)
_MODEL_DIR = Path(os.environ.get("SYNQLAB_BRIGHTNESS_MODEL_DIR", "models/brightness"))
# Writable output for newly trained models — lives on the artifact volume
_MODEL_OUTPUT_DIR = Path(os.environ.get("SYNQLAB_BRIGHTNESS_MODEL_OUTPUT_DIR", str(_ARTIFACT_DIR / "brightness_models")))
_KS_DB_PATH = os.environ.get("SYNQLAB_KS_DB_PATH", "data/knowledge/store.json")

# In-memory job tracking (single-instance; upgrade to Redis for multi-worker)
_training_jobs: dict[str, dict[str, Any]] = {}


# ── Upload endpoint ──────────────────────────────────────────────────────────


@router.post("/brightness/upload")
async def upload_brightness_dataset(
    file: UploadFile = File(...),
    sequence_column: str = Form(default=""),
    label_column: str = Form(default=""),
) -> JSONResponse:
    """Upload a CSV or XLSX brightness dataset for training."""
    if not file.filename:
        raise HTTPException(400, "No file provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(400, f"Unsupported file type: {suffix}. Use CSV or XLSX.")

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dataset_id = str(uuid.uuid4())[:8]
    saved_name = f"{dataset_id}_{file.filename}"
    save_path = _UPLOAD_DIR / saved_name

    content = await file.read()
    save_path.write_bytes(content)

    # Quick validation: try reading columns
    columns: list[str] = []
    n_rows = 0
    try:
        import pandas as pd
        if suffix in (".xlsx", ".xls"):
            df = pd.read_excel(save_path)
        else:
            df = pd.read_csv(save_path)
        columns = list(df.columns)
        n_rows = len(df)
    except Exception as exc:
        logger.warning("Could not preview dataset %s: %s", saved_name, exc)

    # Auto-detect sequence and label columns
    seq_candidates = ("sequence", "GFP11_sequence", "Amino Acid Sequence")
    label_candidates = ("brightness", "Median Brightness", "label")

    detected_seq = sequence_column or next((c for c in seq_candidates if c in columns), None)
    detected_label = label_column or next((c for c in label_candidates if c in columns), None)

    return JSONResponse({
        "dataset_id": dataset_id,
        "filename": saved_name,
        "path": str(save_path),
        "columns": columns,
        "n_rows": n_rows,
        "detected_sequence_column": detected_seq,
        "detected_label_column": detected_label,
    })


# ── Train endpoint ───────────────────────────────────────────────────────────


@router.post("/brightness/train")
async def train_brightness_model(body: dict[str, Any]) -> JSONResponse:
    """Trigger brightness model training in background.

    Body:
        dataset_path: str — path to the uploaded dataset
        sequence_column: str — column name for sequences
        label_column: str — column name for brightness labels
        feature_mode: str — "one_hot" | "embedding" | "hybrid" (default: one_hot)
        tau: float | null — hit threshold (auto-detected if null)
    """
    dataset_path = body.get("dataset_path", "")
    if not dataset_path or not Path(dataset_path).exists():
        raise HTTPException(400, f"Dataset not found: {dataset_path}")

    job_id = str(uuid.uuid4())
    _training_jobs[job_id] = {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": dataset_path,
        "feature_mode": body.get("feature_mode", "one_hot"),
        "progress": "Initializing...",
        "error": None,
        "model_version": None,
        "metrics": None,
    }

    # Run training in background
    asyncio.create_task(_run_training(job_id, body))

    return JSONResponse({"job_id": job_id, "status": "running"})


async def _run_training(job_id: str, body: dict[str, Any]) -> None:
    """Execute the training pipeline in a background task."""
    job = _training_jobs[job_id]
    loop = asyncio.get_event_loop()

    try:
        def _train_sync() -> dict[str, Any]:
            """Synchronous training logic reusing the existing script's functions."""
            import numpy as np  # noqa: F401

            from scripts.train_brightness_model import (
                LabeledRecord,
                _next_model_version,
                compute_features,
                evaluate_cv,
                save_model_artifact,
                train_final_model,
            )

            dataset_path = body["dataset_path"]
            feature_mode = body.get("feature_mode", "one_hot")
            seq_col = body.get("sequence_column")
            label_col = body.get("label_column")
            tau_override = body.get("tau")

            # 1. Load records from the uploaded file
            job["progress"] = "Loading dataset..."
            import pandas as pd
            path = Path(dataset_path)
            if path.suffix.lower() in (".xlsx", ".xls"):
                df = pd.read_excel(path)
            else:
                df = pd.read_csv(path)

            # Resolve columns
            if not seq_col:
                for c in ("sequence", "GFP11_sequence", "Amino Acid Sequence"):
                    if c in df.columns:
                        seq_col = c
                        break
            if not label_col:
                for c in ("brightness", "Median Brightness", "label"):
                    if c in df.columns:
                        label_col = c
                        break
            if not seq_col or not label_col:
                raise ValueError(
                    f"Could not detect columns. Available: {list(df.columns)}"
                )

            df = df[[seq_col, label_col]].dropna()
            records = [
                LabeledRecord(
                    sequence=str(row[seq_col]).strip().upper(),
                    brightness=float(row[label_col]),
                )
                for _, row in df.iterrows()
                if str(row[seq_col]).strip()
            ]

            if not records:
                raise ValueError("No valid records found in dataset")

            job["progress"] = f"Loaded {len(records)} records"

            # 2. Compute features
            job["progress"] = f"Computing features ({feature_mode})..."
            X, y = compute_features(records, feature_mode)

            # 3. Determine tau
            import statistics
            tau = float(tau_override) if tau_override is not None else statistics.median(
                r.brightness for r in records
            )
            job["progress"] = f"Using τ = {tau:.4f}"

            # 4. Cross-validation
            job["progress"] = "Running cross-validation..."
            metrics = evaluate_cv(X, y, tau, k_folds=5)

            # 5. Train final model
            job["progress"] = "Training final model..."
            output_dir = _MODEL_OUTPUT_DIR
            output_dir.mkdir(parents=True, exist_ok=True)
            version = _next_model_version(output_dir, _MODEL_DIR)

            from datetime import datetime, timezone
            envelope = train_final_model(
                X, y, tau, feature_mode,
                target_length=16,
                embedder_id=None,
                model_version=version,
                metadata={
                    "n_train": len(y),
                    "n_positives": int((y >= tau).sum()),
                    "trained_at": datetime.now(timezone.utc).isoformat(),
                    "source_file": str(dataset_path),
                },
            )
            saved_path = save_model_artifact(envelope, output_dir)

            # Auto-deploy: copy trained model to the shared model-weights
            # volume so brightness-svc picks it up immediately.
            try:
                _MODEL_DIR.mkdir(parents=True, exist_ok=True)
                deploy_path = _MODEL_DIR / "model.pkl"
                if deploy_path.exists() or deploy_path.is_symlink():
                    deploy_path.unlink()
                shutil.copy2(saved_path, deploy_path)
                logger.info(
                    "Saved brightness model to %s (latest=%s).",
                    saved_path, deploy_path,
                )
            except OSError as deploy_err:
                logger.warning(
                    "Auto-deploy to %s failed: %s. Use /deploy endpoint manually.",
                    _MODEL_DIR, deploy_err,
                )

            return {
                "model_version": version,
                "model_path": str(saved_path),
                "metrics": metrics,
                "n_records": len(records),
                "tau": tau,
                "feature_mode": feature_mode,
            }

        result = await loop.run_in_executor(None, _train_sync)
        job["status"] = "completed"
        job["model_version"] = result["model_version"]
        job["metrics"] = result["metrics"]
        job["progress"] = f"Model {result['model_version']} trained on {result['n_records']} records"
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Training job %s completed: %s", job_id, result["model_version"])

    except Exception as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
        job["progress"] = f"Failed: {exc}"
        logger.exception("Training job %s failed", job_id)


# ── Status & models endpoints ────────────────────────────────────────────────


@router.get("/brightness/status/{job_id}")
async def training_status(job_id: str) -> JSONResponse:
    """Check training job status."""
    job = _training_jobs.get(job_id)
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")
    return JSONResponse(job)


@router.get("/brightness/models")
async def list_models() -> JSONResponse:
    """List all trained brightness model versions."""
    models: list[dict[str, Any]] = []
    # Scan both the read-only deployed models dir and the writable output dir
    seen_names: set[str] = set()
    scan_dirs = [d for d in [_MODEL_DIR, _MODEL_OUTPUT_DIR] if d.exists()]
    for scan_dir in scan_dirs:
        for pkl_path in sorted(scan_dir.glob("model_v*.pkl")):
            try:
                if pkl_path.name in seen_names:
                    continue
                seen_names.add(pkl_path.name)
                with open(pkl_path, "rb") as fh:
                    envelope = pickle.load(fh)
                models.append({
                    "version": envelope.get("model_version", pkl_path.stem),
                    "feature_mode": envelope.get("feature_mode", "unknown"),
                    "tau": envelope.get("tau"),
                    "n_train": envelope.get("metadata", {}).get("n_train"),
                    "trained_at": envelope.get("metadata", {}).get("trained_at"),
                    "path": str(pkl_path),
                    "is_active": _is_active_model(pkl_path),
                })
            except Exception as exc:
                logger.warning("Could not read model %s: %s", pkl_path, exc)

    return JSONResponse({"models": models})


def _is_active_model(pkl_path: Path) -> bool:
    """Check if this version is the currently active (symlinked) model."""
    latest = pkl_path.parent / "model.pkl"
    if latest.is_symlink():
        return latest.resolve() == pkl_path.resolve()
    # Fallback: compare content
    if latest.exists():
        return latest.stat().st_size == pkl_path.stat().st_size
    return False


@router.post("/brightness/deploy")
async def deploy_model(body: dict[str, Any]) -> JSONResponse:
    """Set a specific model version as the active brightness model.

    Also notifies brightness-svc to reload (if reachable).
    """
    version = body.get("version", "")
    # Look in the writable output dir first, then the read-only model dir
    model_path = _MODEL_OUTPUT_DIR / f"model_{version}.pkl"
    if not model_path.exists():
        model_path = _MODEL_DIR / f"model_{version}.pkl"
    if not model_path.exists():
        raise HTTPException(404, f"Model {version} not found")

    # Deploy to the model dir (mounted read-write on gateway)
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    latest = _MODEL_DIR / "model.pkl"
    # Remove existing link/file
    if latest.exists() or latest.is_symlink():
        latest.unlink()
    # Copy (more portable than symlinks on Windows/Docker volumes)
    shutil.copy2(model_path, latest)

    # Try to notify brightness-svc to reload
    reload_status = "not_attempted"
    try:
        import httpx
        brightness_url = os.environ.get("SYNQLAB_BRIGHTNESS_URL", "http://brightness-svc:8007")
        r = httpx.post(f"{brightness_url}/unload", timeout=5)
        reload_status = "reloaded" if r.status_code == 200 else f"error_{r.status_code}"
    except Exception as exc:
        reload_status = f"unreachable: {exc}"

    return JSONResponse({
        "deployed": version,
        "path": str(latest),
        "reload_status": reload_status,
    })

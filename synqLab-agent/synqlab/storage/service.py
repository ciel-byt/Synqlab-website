"""Storage service — high-level CRUD operations for SynqLab entities."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from synqlab.core.exceptions import StorageError
from synqlab.storage.models import Artifact, Experiment, Tag, ToolRun

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Experiment
# ---------------------------------------------------------------------------

def create_experiment(
    session: Session,
    experiment_id: str | None = None,
    name: str | None = None,
    config: dict[str, Any] | None = None,
) -> Experiment:
    """Create and persist a new Experiment record."""
    exp = Experiment(
        id=experiment_id or str(uuid.uuid4()),
        name=name,
        config_jsonb=config,
        status="running",
    )
    session.add(exp)
    try:
        session.commit()
        session.refresh(exp)
    except Exception as exc:
        session.rollback()
        raise StorageError(f"Failed to create experiment: {exc}") from exc
    logger.debug("Created experiment %s", exp.id)
    return exp


def complete_experiment(session: Session, experiment_id: str, status: str = "completed") -> None:
    """Mark an experiment as completed (or any terminal status)."""
    exp = session.get(Experiment, experiment_id)
    if exp is None:
        raise StorageError(f"Experiment not found: {experiment_id}")
    exp.status = status
    try:
        session.commit()
    except Exception as exc:
        session.rollback()
        raise StorageError(f"Failed to update experiment: {exc}") from exc


# ---------------------------------------------------------------------------
# ToolRun
# ---------------------------------------------------------------------------

def create_tool_run(
    session: Session,
    experiment_id: str,
    round_id: str,
    tool_id: str,
    request: dict[str, Any] | None = None,
    run_id: str | None = None,
) -> ToolRun:
    """Create and persist a new ToolRun record (status=running)."""
    run = ToolRun(
        id=run_id or str(uuid.uuid4()),
        experiment_id=experiment_id,
        round_id=round_id,
        tool_id=tool_id,
        status="running",
        started_at=_now(),
        request_jsonb=request,
    )
    session.add(run)
    try:
        session.commit()
        session.refresh(run)
    except Exception as exc:
        session.rollback()
        raise StorageError(f"Failed to create tool run: {exc}") from exc
    logger.debug("Created tool_run %s for tool %s", run.id, tool_id)
    return run


def complete_tool_run(
    session: Session,
    run_id: str,
    response: dict[str, Any] | None = None,
    error_message: str | None = None,
    latency_ms: float | None = None,
) -> ToolRun:
    """Update an existing ToolRun to completed or failed status."""
    run = session.get(ToolRun, run_id)
    if run is None:
        raise StorageError(f"ToolRun not found: {run_id}")
    run.finished_at = _now()
    run.response_jsonb = response
    run.latency_ms = latency_ms
    if error_message:
        run.status = "failed"
        run.error_message = error_message
    else:
        run.status = "completed"
    try:
        session.commit()
        session.refresh(run)
    except Exception as exc:
        session.rollback()
        raise StorageError(f"Failed to complete tool run: {exc}") from exc
    return run


# ---------------------------------------------------------------------------
# Artifact
# ---------------------------------------------------------------------------

def record_artifact(
    session: Session,
    experiment_id: str,
    tool_run_id: Optional[str],
    artifact_type: str,
    path: str,
    format: str | None = None,
    size_bytes: int | None = None,
    checksum: str | None = None,
    meta: dict[str, Any] | None = None,
    artifact_id: str | None = None,
) -> Artifact:
    """Create and persist an Artifact record."""
    artifact = Artifact(
        id=artifact_id or str(uuid.uuid4()),
        experiment_id=experiment_id,
        tool_run_id=tool_run_id,
        artifact_type=artifact_type,
        uri=path,
        path=path,
        format=format,
        size_bytes=size_bytes,
        checksum=checksum,
        meta_jsonb=meta,
    )
    session.add(artifact)
    try:
        session.commit()
        session.refresh(artifact)
    except Exception as exc:
        session.rollback()
        raise StorageError(f"Failed to record artifact: {exc}") from exc
    logger.debug("Recorded artifact %s at %s", artifact.id, path)
    return artifact


# ---------------------------------------------------------------------------
# Tag
# ---------------------------------------------------------------------------

def attach_tag(
    session: Session,
    artifact_id: str,
    key: str,
    value: str | None = None,
) -> Tag:
    """Attach a key/value tag to an artifact."""
    tag = Tag(artifact_id=artifact_id, key=key, value=value)
    session.add(tag)
    try:
        session.commit()
        session.refresh(tag)
    except Exception as exc:
        session.rollback()
        raise StorageError(f"Failed to attach tag: {exc}") from exc
    return tag

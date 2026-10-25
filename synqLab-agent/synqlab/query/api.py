"""Query API — functions to inspect experiment results."""

from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from synqlab.core.exceptions import StorageError
from synqlab.storage.models import Artifact, Experiment, Tag, ToolRun

logger = logging.getLogger(__name__)


def get_experiment(session: Session, experiment_id: str) -> Optional[Experiment]:
    """Return the Experiment record by ID, or None if not found."""
    return session.get(Experiment, experiment_id)


def list_runs(session: Session, experiment_id: str) -> list[ToolRun]:
    """Return all ToolRun rows for a given experiment, ordered by start time."""
    return (
        session.query(ToolRun)
        .filter_by(experiment_id=experiment_id)
        .order_by(ToolRun.started_at)
        .all()
    )


def list_candidates(session: Session, experiment_id: str) -> list[Artifact]:
    """Return all Artifact rows for a given experiment."""
    return (
        session.query(Artifact)
        .filter_by(experiment_id=experiment_id)
        .order_by(Artifact.created_at)
        .all()
    )


def filter_by_tag(session: Session, key: str, value: Optional[str] = None) -> list[Artifact]:
    """Return artifacts that have a specific tag key (and optional value)."""
    query = session.query(Artifact).join(Tag).filter(Tag.key == key)
    if value is not None:
        query = query.filter(Tag.value == value)
    return query.all()


def top_k(
    session: Session,
    experiment_id: str,
    k: int,
    sort_by: str = "confidence",
) -> list[dict[str, Any]]:
    """Return the top-k tool runs for an experiment, sorted by a score field.

    Looks for ToolRun rows with ``tool_id == 'omegafold'`` that have a
    ``confidence`` key in their ``response_jsonb``.  Falls back to all
    completed runs sorted by tool_id alphabetically.

    Args:
        session: Active database session.
        experiment_id: Target experiment ID.
        k: Number of results to return.
        sort_by: Field name to sort by (currently ``"confidence"``).

    Returns:
        List of dicts with run metadata and score.
    """
    runs = (
        session.query(ToolRun)
        .filter_by(experiment_id=experiment_id, status="completed")
        .all()
    )

    scored: list[dict[str, Any]] = []
    for run in runs:
        resp = run.response_jsonb or {}
        if sort_by in resp:
            scored.append(
                {
                    "run_id": run.id,
                    "tool_id": run.tool_id,
                    "round_id": run.round_id,
                    sort_by: resp[sort_by],
                    "response": resp,
                }
            )

    scored.sort(key=lambda r: r.get(sort_by, 0.0), reverse=True)
    return scored[:k]

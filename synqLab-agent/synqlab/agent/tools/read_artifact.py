"""Agent tool: Read experiment artifacts (PDB files, scores, logs)."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class ReadArtifactInput(BaseModel):
    """Input schema for reading an experiment artifact."""

    artifact_id: str = Field(
        default="",
        description="Artifact UUID to read (from a previous experiment)",
    )
    experiment_id: str = Field(
        default="",
        description="Experiment UUID — lists all artifacts when artifact_id is empty",
    )


async def _call(inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    """Read an artifact from the database."""
    artifact_id = inputs.get("artifact_id", "")
    experiment_id = inputs.get("experiment_id", "")

    if not artifact_id and not experiment_id:
        return ToolResult.fail("Provide either artifact_id or experiment_id.")

    try:
        from synqlab.storage.db import get_session
        from synqlab.storage.models import Artifact, Experiment

        db = get_session()
        try:
            if artifact_id:
                artifact = db.query(Artifact).filter_by(id=artifact_id).first()
                if not artifact:
                    return ToolResult.fail(f"Artifact '{artifact_id}' not found.")
                return ToolResult.ok({
                    "artifact_id": artifact.id,
                    "type": artifact.artifact_type,
                    "format": artifact.format,
                    "path": artifact.path,
                    "uri": artifact.uri,
                    "size_bytes": artifact.size_bytes,
                    "metadata": artifact.meta_jsonb or {},
                })
            else:
                # List artifacts for an experiment.
                experiment = db.query(Experiment).filter_by(id=experiment_id).first()
                if not experiment:
                    return ToolResult.fail(f"Experiment '{experiment_id}' not found.")
                artifacts = db.query(Artifact).filter_by(experiment_id=experiment_id).all()
                return ToolResult.ok({
                    "experiment_id": experiment_id,
                    "experiment_status": experiment.status,
                    "artifacts": [
                        {
                            "id": a.id,
                            "type": a.artifact_type,
                            "format": a.format,
                            "path": a.path,
                        }
                        for a in artifacts
                    ],
                })
        finally:
            db.close()

    except Exception as exc:
        logger.exception("Failed to read artifact")
        return ToolResult.fail(f"Database error: {exc}")


read_artifact_tool = build_tool(AgentToolDef(
    name="read_artifact",
    description=(
        "Read experiment artifacts (PDB files, score files, logs) from the "
        "SynqLab database. Provide an artifact_id to read a specific artifact, "
        "or an experiment_id to list all artifacts from an experiment."
    ),
    input_schema=ReadArtifactInput,
    call=_call,
    is_read_only=True,
    is_concurrency_safe=True,
    search_hint="read artifact experiment result PDB score output",
))

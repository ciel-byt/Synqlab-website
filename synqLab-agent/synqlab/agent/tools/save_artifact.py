"""save_artifact — persist agent-generated files (reports, PDB, scores).

Thin wrapper around `synqlab.agent.tools._persist`. The canonical owner of
constants (`ARTIFACT_DIR`, `_INLINE_LIMIT`, `_CONTENT_TYPES`, `_EXTENSIONS`)
and the inline/disk persistence routine is `_persist.py`. This module only
provides the tool registration and the per-call validation/return-shape
adapter for the existing `save_artifact` tool.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool
from synqlab.agent.tools._persist import (
    _CONTENT_TYPES,
    _EXTENSIONS,
    _INLINE_LIMIT,
    ARTIFACT_DIR,
    _persist_to_db,
    get_db_session,  # re-export for back-compat with test fixtures that patch save_mod.get_db_session
)

logger = logging.getLogger(__name__)

# Re-exports retained for back-compat with any importer that already
# referenced these names from save_artifact (the canonical home is now
# `_persist.py` — prefer importing from there going forward).
__all__ = [
    "ARTIFACT_DIR",
    "_CONTENT_TYPES",
    "_EXTENSIONS",
    "_INLINE_LIMIT",
    "SaveArtifactInput",
    "_save_artifact_call",
    "get_db_session",
    "save_artifact_tool",
]


class SaveArtifactInput(BaseModel):
    name: str = Field(description="Human-readable filename, e.g. 'stability_report.md'")
    artifact_type: str = Field(
        description="Type: markdown_report | pdb_structure | score_table | sequence_fasta",
    )
    content: str = Field(description="The artifact content (text, markdown, PDB, CSV, FASTA)")
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional metadata (scores, metrics, parameters)",
    )


async def _save_artifact_call(args: dict[str, Any], context: Any) -> ToolResult:
    """Persist an artifact to the database (and optionally to disk)."""
    ctx = context
    name = args["name"]
    artifact_type = args["artifact_type"]
    content = args["content"]
    metadata = args.get("metadata", {})

    if artifact_type not in _CONTENT_TYPES:
        return ToolResult.fail(
            f"Unknown artifact_type '{artifact_type}'. "
            f"Use one of: {', '.join(_CONTENT_TYPES.keys())}"
        )

    try:
        artifact_id = await _persist_to_db(
            content=content,
            name=name,
            artifact_type=artifact_type,
            ctx=ctx,
            scope="session",                    # save_artifact is always session-scoped
            metadata=metadata if metadata else None,
        )
    except ValueError as exc:
        return ToolResult.fail(str(exc))
    except Exception as exc:
        logger.exception("Failed to save artifact")
        return ToolResult.fail(f"Database error: {exc}")

    size_bytes = len(content.encode("utf-8"))
    return ToolResult.ok({
        "artifact_id": artifact_id,
        "name": name,
        "artifact_type": artifact_type,
        "size_bytes": size_bytes,
        "message": f"Artifact '{name}' saved ({size_bytes:,} bytes).",
    })


save_artifact_tool = build_tool(AgentToolDef(
    name="save_artifact",
    description=(
        "Save an agent-generated artifact (report, PDB file, score table, "
        "FASTA sequences) to persistent storage. The artifact can be "
        "retrieved later via the session's artifact list."
    ),
    input_schema=SaveArtifactInput,
    call=_save_artifact_call,
))

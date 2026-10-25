"""list_pdb_samples — discovery surface for PDB structures.

Returns all PDB structures available to the current session:
  - scope='global' (bundled samples, ingested at app startup)
  - scope='session' (user uploads for the current session)

The LLM uses these artifact_ids as input to analyze_stability or any
other PDB-consuming tool.

Phase 13 D-07.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel
from sqlalchemy import or_

from synqlab.agent.context import AgentContext
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


def get_db_session():
    """Defer the import so test fixtures can monkey-patch this symbol."""
    from synqlab.storage.db import get_session as _get_session
    return _get_session()


class ListPdbSamplesInput(BaseModel):
    """No inputs — this tool lists all available PDB samples."""
    pass


async def _call(_inputs: dict[str, Any], ctx: AgentContext) -> ToolResult:
    from synqlab.agent.models import AgentArtifact

    db = get_db_session()
    try:
        # Include both global (bundled) and session-scoped (user uploads) PDBs
        rows = (
            db.query(AgentArtifact)
            .filter(
                AgentArtifact.artifact_type == "pdb_structure",
                or_(
                    AgentArtifact.scope == "global",
                    (AgentArtifact.scope == "session") & (AgentArtifact.session_id == ctx.session_id),
                ),
            )
            .order_by(AgentArtifact.scope.desc(), AgentArtifact.name)  # session first, then global
            .all()
        )
        return ToolResult.ok({
            "samples": [
                {
                    "artifact_id": r.id,
                    "name": r.name,
                    "scope": r.scope,
                    "size_bytes": r.size_bytes,
                    "metadata": r.metadata_json or {},
                }
                for r in rows
            ],
            "count": len(rows),
        })
    except Exception as exc:
        logger.exception("list_pdb_samples failed")
        return ToolResult.fail(f"Database error: {exc}")
    finally:
        db.close()


list_pdb_samples_tool = build_tool(AgentToolDef(
    name="list_pdb_samples",
    description=(
        "List all PDB structures available in this session: bundled samples "
        "(global) and user uploads (session). Returns {artifact_id, name, "
        "scope, size_bytes, metadata} for each. Pass the artifact_id to "
        "analyze_stability or any other PDB-consuming tool."
    ),
    input_schema=ListPdbSamplesInput,
    call=_call,
    is_read_only=True,
    is_concurrency_safe=True,
    search_hint="list bundled PDB samples discovery test fixtures uploads",
))

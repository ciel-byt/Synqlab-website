"""Canonical persistence helpers for agent tool outputs.

This module is the single owner of:
  - the artifact directory (SYNQLAB_ARTIFACT_DIR env var)
  - the inline/disk threshold (100 KB)
  - the artifact_type → MIME and artifact_type → extension maps
  - the inline-vs-disk write logic (`_persist_to_db`)
  - the public one-line API for tools (`persist_artifact`)

Every other tool file imports from here. Do NOT redefine these constants
elsewhere. (Pitfall #4 in 13-RESEARCH.md.)
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import Any

from synqlab.storage.artifact_paths import SESSIONS, build_agent_artifact_path

logger = logging.getLogger(__name__)


# ── Public constants (canonical home — import these, do not redefine) ────

ARTIFACT_DIR = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", "data/agent_artifacts"))

_CONTENT_TYPES: dict[str, str] = {
    "markdown_report": "text/markdown",
    "pdb_structure": "chemical/x-pdb",
    "score_table": "text/csv",
    "sequence_fasta": "text/plain",
}

_EXTENSIONS: dict[str, str] = {
    "markdown_report": ".md",
    "pdb_structure": ".pdb",
    "score_table": ".csv",
    "sequence_fasta": ".fasta",
}

_INLINE_LIMIT = 100 * 1024  # 100 KB


# ── DB session getter, isolated for monkey-patching in tests ──────────────

def get_db_session():
    """Defer the import so test fixtures can monkey-patch this symbol."""
    from synqlab.storage.db import get_session as _get_session
    return _get_session()


# ── Internal: write the row + (optionally) the file ─────────────────────

async def _persist_to_db(
    *,
    content: str,
    name: str,
    artifact_type: str,
    ctx: Any,                      # AgentContext (avoid import cycle)
    scope: str = "session",
    metadata: dict[str, Any] | None = None,
    org_id: str | None = None,
    project_id: str | None = None,
    created_by: str | None = None,
    content_hash: str | None = None,
) -> str:
    """Persist `content` and return the new artifact_id.

    Inline if size <= _INLINE_LIMIT, otherwise written to
    ARTIFACT_DIR / <session_or_scope>/<uuid>.<ext>.

    Validates `artifact_type` against `_CONTENT_TYPES`. Raises ValueError
    for unknown types so the caller can surface a ToolResult.fail.
    """
    if artifact_type not in _CONTENT_TYPES:
        raise ValueError(
            f"Unknown artifact_type '{artifact_type}'. "
            f"Use one of: {', '.join(_CONTENT_TYPES.keys())}"
        )

    from synqlab.agent.models import AgentArtifact

    content_type = _CONTENT_TYPES[artifact_type]
    size_bytes = len(content.encode("utf-8"))
    file_path: str | None = None
    stored_content: str | None = content

    # Re-resolve ARTIFACT_DIR each call so tests using monkeypatch.setenv
    # (after module import) still target the temp directory.
    artifact_root = Path(os.environ.get("SYNQLAB_ARTIFACT_DIR", str(ARTIFACT_DIR)))

    # Always write PDB files to disk (analyze_stability requires file_path).
    # Other artifact types: write to disk only if over the inline limit.
    needs_disk = size_bytes > _INLINE_LIMIT or artifact_type == "pdb_structure"
    if needs_disk:
        # Bucket directory: scope decides the layout.
        #   session-scoped: data/agent_artifacts/<session_id>/<uuid>.<ext>
        #   project-scoped: data/agent_artifacts/project/<project_id>/<uuid>.<ext>
        #   global:         data/agent_artifacts/global/<uuid>.<ext>
        if scope == "session":
            bucket = build_agent_artifact_path(
                artifact_root, SESSIONS, ctx.session_id or "unknown",
            )
        elif scope == "project":
            bucket = artifact_root / "project" / (
                project_id or getattr(ctx, "project_id", "") or "unknown"
            )
        elif scope == "global":
            bucket = artifact_root / "global"
        else:
            raise ValueError(f"Unknown scope '{scope}'")
        bucket.mkdir(parents=True, exist_ok=True)
        ext = _EXTENSIONS.get(artifact_type, ".txt")
        file_name = f"{uuid.uuid4().hex[:12]}{ext}"
        disk_path = bucket / file_name
        disk_path.write_text(content, encoding="utf-8")
        file_path = str(disk_path)
        stored_content = None
        logger.info(
            "Artifact written to disk: %s (%d bytes, scope=%s)",
            disk_path, size_bytes, scope,
        )

    # Resolve scope-related FK columns from ctx if caller didn't supply.
    effective_session_id = ctx.session_id if scope == "session" else None
    effective_org_id = org_id if org_id is not None else getattr(ctx, "org_id", None)
    effective_project_id = (
        project_id if project_id is not None else getattr(ctx, "project_id", None)
    )

    db = get_db_session()
    try:
        row = AgentArtifact(
            session_id=effective_session_id,
            scope=scope,
            org_id=effective_org_id,
            project_id=effective_project_id,
            created_by=created_by,
            content_hash=content_hash,
            name=name,
            artifact_type=artifact_type,
            content_type=content_type,
            content=stored_content,
            file_path=file_path,
            metadata_json=metadata if metadata else None,
            size_bytes=size_bytes,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id
    except Exception:
        db.rollback()
        logger.exception("Failed to persist artifact")
        raise
    finally:
        db.close()


# ── Public one-line API for tools ────────────────────────────────────────

async def persist_artifact(
    *,
    content: str,
    name: str,
    artifact_type: str,
    ctx: Any,
    scope: str = "session",
    metadata: dict[str, Any] | None = None,
) -> str:
    """One-line per-tool helper: returns the new artifact_id.

    D-03 contract: callers in tool `_call` functions invoke this with the
    five kw-args above (sometimes plus metadata) and use the returned id
    directly in their `ToolResult.ok({"artifact_id": ...})`.
    """
    return await _persist_to_db(
        content=content,
        name=name,
        artifact_type=artifact_type,
        ctx=ctx,
        scope=scope,
        metadata=metadata,
    )

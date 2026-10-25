"""KnowledgeStore — register, retrieve, and promote knowledge artifacts.

V1 uses an in-process dict backed by optional JSON persistence on disk.
No database dependency is required for V1 (SQLite or JSON file is sufficient).
"""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from pathlib import Path
from typing import Any, Literal, Optional

from synqlab.knowledge_store.schemas import KnowledgeArtifact

logger = logging.getLogger(__name__)

_STORE_LOCK = threading.Lock()

KindType = Literal["dataset", "target", "prompt", "finding"]
_SCOPE_ORDER = {"project": 0, "team": 1, "global": 2}


def _scope_prefix(scope: str) -> str:
    return scope.split(":")[0]


class KnowledgeStore:
    """In-process Knowledge Store with optional JSON persistence.

    Args:
        db_path: Path to the JSON persistence file. If None, data is in-memory only.
        artifacts_root: Root directory for artifact files.
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        artifacts_root: str = "data/knowledge/",
    ) -> None:
        self._db_path = Path(db_path) if db_path else None
        self._artifacts_root = Path(artifacts_root)
        self._store: dict[str, KnowledgeArtifact] = {}
        if self._db_path and self._db_path.exists():
            self._load()

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    def register(
        self,
        kind: KindType,
        name: str,
        scope: str,
        task_type: str,
        payload: dict[str, Any],
        tags: Optional[list[str]] = None,
        created_by: str = "system",
        provenance: Optional[dict[str, Any]] = None,
        artifact_id: Optional[str] = None,
    ) -> str:
        """Register a new knowledge artifact.

        Returns:
            The artifact ID.
        """
        artifact = KnowledgeArtifact(
            id=artifact_id or str(uuid.uuid4()),
            kind=kind,
            scope=scope,
            task_type=task_type,
            name=name,
            payload=payload,
            tags=tags or [],
            created_by=created_by,
            provenance=provenance or {},
        )
        with _STORE_LOCK:
            self._store[artifact.id] = artifact
            self._save()
        logger.info(
            "KnowledgeStore registered artifact '%s' (kind=%s, scope=%s).",
            artifact.id,
            kind,
            scope,
        )
        return artifact.id

    def retrieve(
        self,
        task_type: Optional[str] = None,
        project_id: Optional[str] = None,
        team_id: Optional[str] = None,
        kinds: Optional[list[KindType]] = None,
        tags: Optional[list[str]] = None,
    ) -> list[KnowledgeArtifact]:
        """Retrieve artifacts visible to the given project/team context.

        Scope priority: project > team > global.
        """
        allowed_scopes: set[str] = {"global"}
        if team_id:
            allowed_scopes.add(f"team:{team_id}")
        if project_id:
            allowed_scopes.add(f"project:{project_id}")

        results: list[KnowledgeArtifact] = []
        with _STORE_LOCK:
            for artifact in self._store.values():
                if artifact.scope not in allowed_scopes:
                    continue
                if task_type and artifact.task_type != task_type:
                    continue
                if kinds and artifact.kind not in kinds:
                    continue
                if tags and not any(t in artifact.tags for t in tags):
                    continue
                results.append(artifact)

        results.sort(key=lambda a: _SCOPE_ORDER.get(_scope_prefix(a.scope), 99))
        return results

    def promote(self, artifact_id: str, to_scope: str) -> KnowledgeArtifact:
        """Promote an artifact to a broader scope (e.g. project → team)."""
        with _STORE_LOCK:
            if artifact_id not in self._store:
                raise KeyError(f"Artifact not found: {artifact_id}")
            artifact = self._store[artifact_id]
            old_scope = artifact.scope
            artifact.scope = to_scope
            artifact.version += 1
            self._save()
        logger.info(
            "KnowledgeStore promoted artifact '%s' from '%s' to '%s'.",
            artifact_id,
            old_scope,
            to_scope,
        )
        return artifact

    def get(self, artifact_id: str) -> Optional[KnowledgeArtifact]:
        """Return a single artifact by ID, or None if not found."""
        return self._store.get(artifact_id)

    def list_all(self) -> list[KnowledgeArtifact]:
        """Return all registered artifacts."""
        with _STORE_LOCK:
            return list(self._store.values())

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _save(self) -> None:
        if self._db_path is None:
            return
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            aid: {
                "id": a.id,
                "kind": a.kind,
                "scope": a.scope,
                "task_type": a.task_type,
                "name": a.name,
                "version": a.version,
                "created_at": a.created_at.isoformat(),
                "created_by": a.created_by,
                "payload": a.payload,
                "tags": a.tags,
                "provenance": a.provenance,
            }
            for aid, a in self._store.items()
        }
        with open(self._db_path, "w") as fh:
            json.dump(data, fh, indent=2)

    def _load(self) -> None:
        from datetime import datetime

        with open(self._db_path, "r") as fh:  # type: ignore[arg-type]
            data: dict[str, Any] = json.load(fh)
        for aid, d in data.items():
            artifact = KnowledgeArtifact(
                id=d["id"],
                kind=d["kind"],
                scope=d["scope"],
                task_type=d["task_type"],
                name=d["name"],
                version=d.get("version", 1),
                created_at=datetime.fromisoformat(d["created_at"]),
                created_by=d.get("created_by", "system"),
                payload=d.get("payload", {}),
                tags=d.get("tags", []),
                provenance=d.get("provenance", {}),
            )
            self._store[aid] = artifact
        logger.debug("KnowledgeStore loaded %d artifacts from %s.", len(self._store), self._db_path)

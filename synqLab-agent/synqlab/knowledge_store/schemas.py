"""KnowledgeArtifact dataclass — see docs/design-docs/knowledge-store.md."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class KnowledgeArtifact:
    """Envelope for all knowledge artifacts in the SynqLab Knowledge Store."""

    kind: Literal["dataset", "target", "prompt", "finding"]
    scope: str  # "global" | "team:<id>" | "project:<id>"
    task_type: str  # e.g. "gfp11_brightness"
    name: str
    payload: dict[str, Any]

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    version: int = 1
    created_at: datetime = field(default_factory=_now)
    created_by: str = "system"
    tags: list[str] = field(default_factory=list)
    provenance: dict[str, Any] = field(default_factory=dict)

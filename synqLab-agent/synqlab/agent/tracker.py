"""Candidate tracking for pipeline rounds.

Manages candidates across multi-round pipeline executions, linking
tool outputs to sequences and enforcing PDB dependency rules.
Ported from the GFP11 feature branch's Candidate dataclass
(synqlab/agent/loop.py) into a generic, template-driven tracker.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class CandidateField:
    """Schema for one tracked metric."""

    name: str
    type: str  # "float", "str", "int"
    source_tool: str  # which tool produces this
    output_key: str = ""  # key in tool output dict; defaults to name


@dataclass
class PipelineCandidate:
    """A single candidate tracked across pipeline rounds."""

    id: str = ""
    sequence: str = ""
    metrics: dict[str, Any] = field(default_factory=dict)
    pdb_paths: dict[str, str] = field(default_factory=dict)
    rounds_seen: list[int] = field(default_factory=list)

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())

    def update_from(
        self,
        tool_name: str,
        outputs: dict[str, Any],
        schema: list[CandidateField] | None = None,
    ) -> None:
        """Merge tool outputs into candidate metrics.

        Uses schema to auto-map outputs to fields when available.
        Falls back to direct key copy for unschema'd fields.
        """
        # PDB path tracking
        pdb_path = outputs.get("pdb_path")
        if pdb_path:
            self.pdb_paths[tool_name] = str(pdb_path)

        # Schema-driven merge
        if schema:
            for f in schema:
                if f.source_tool == tool_name:
                    key = f.output_key or f.name
                    if key in outputs and outputs[key] is not None:
                        self.metrics[f.name] = outputs[key]
        else:
            # Fallback: copy all non-None outputs as metrics
            for key, val in outputs.items():
                if val is not None and key != "pdb_path":
                    self.metrics[key] = val

    def to_payload(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "sequence": self.sequence,
            "metrics": dict(self.metrics),
            "pdb_paths": dict(self.pdb_paths),
            "rounds_seen": list(self.rounds_seen),
        }


class CandidateTracker:
    """Manages candidates across pipeline rounds.

    Ported from the GFP11 feature branch's candidate accumulation
    logic (_ingest_dispatch_result, _best_p_hit, _pick_best) into
    a reusable, template-driven tracker.
    """

    def __init__(self, schema: list[CandidateField] | None = None):
        self.schema = schema or []
        self.candidates: dict[str, PipelineCandidate] = {}
        self.known_pdb_paths: set[str] = set()

    def update(
        self,
        sequence: str,
        tool_name: str,
        outputs: dict[str, Any],
        round_idx: int,
    ) -> PipelineCandidate:
        """Update or create a candidate from tool outputs."""
        if sequence not in self.candidates:
            self.candidates[sequence] = PipelineCandidate(
                sequence=sequence,
                rounds_seen=[round_idx],
            )
        candidate = self.candidates[sequence]
        if round_idx not in candidate.rounds_seen:
            candidate.rounds_seen.append(round_idx)
        candidate.update_from(tool_name, outputs, self.schema)

        # Track PDB paths for dependency enforcement
        pdb_path = outputs.get("pdb_path")
        if pdb_path:
            self.known_pdb_paths.add(str(pdb_path))

        return candidate

    def ingest_variants(
        self, variants: list[str], round_idx: int
    ) -> list[PipelineCandidate]:
        """Register new variant sequences from a propose_variants call."""
        added = []
        for seq in variants:
            seq = str(seq).strip()
            if not seq:
                continue
            if seq not in self.candidates:
                self.candidates[seq] = PipelineCandidate(
                    sequence=seq,
                    rounds_seen=[round_idx],
                )
                added.append(self.candidates[seq])
            elif round_idx not in self.candidates[seq].rounds_seen:
                self.candidates[seq].rounds_seen.append(round_idx)
        return added

    def best(self, metric: str) -> float | None:
        """Return the highest value for a given metric across all candidates."""
        values = [
            c.metrics.get(metric)
            for c in self.candidates.values()
            if c.metrics.get(metric) is not None
        ]
        if not values:
            return None
        numeric = [v for v in values if isinstance(v, (int, float))]
        return max(numeric) if numeric else None

    def pick_best(self, metric: str) -> PipelineCandidate | None:
        """Return the candidate with the highest value for a metric."""
        scored = [
            c
            for c in self.candidates.values()
            if c.metrics.get(metric) is not None
        ]
        if not scored:
            return None
        return max(scored, key=lambda c: c.metrics.get(metric, 0.0))

    def to_db_payload(self) -> dict[str, Any]:
        """Serialize tracker state for DB persistence."""
        return {
            "candidates": [c.to_payload() for c in self.candidates.values()],
            "candidate_count": len(self.candidates),
            "known_pdb_paths": list(self.known_pdb_paths),
        }

    @classmethod
    def from_db_payload(
        cls,
        data: dict[str, Any],
        schema: list[CandidateField] | None = None,
    ) -> CandidateTracker:
        """Deserialize tracker state from DB payload."""
        tracker = cls(schema=schema)
        tracker.known_pdb_paths = set(data.get("known_pdb_paths", []))
        for cp in data.get("candidates", []):
            candidate = PipelineCandidate(
                id=cp.get("id", ""),
                sequence=cp.get("sequence", ""),
                metrics=cp.get("metrics", {}),
                pdb_paths=cp.get("pdb_paths", {}),
                rounds_seen=cp.get("rounds_seen", []),
            )
            tracker.candidates[candidate.sequence] = candidate
        return tracker

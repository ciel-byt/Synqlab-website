"""Tests for pipeline loop support and CandidateTracker.

Phase 23 — verifies multi-round execution, fitness gating,
and candidate tracking across pipeline rounds.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest

from synqlab.agent.pipeline import (
    PipelineDefinition,
    PipelineEngine,
    PipelineEvent,
    PipelineEventType,
    PipelineNode,
)
from synqlab.agent.tracker import (
    CandidateField,
    CandidateTracker,
    PipelineCandidate,
)


# ── Helpers ─────────────────────────────────────────────────────────────────


class _FakeToolResult:
    def __init__(self, data: dict, success: bool = True):
        self.data = data
        self.is_success = success
        self.error_message = "" if success else "mock error"


class _FakeTool:
    """Minimal tool mock that returns a ToolResult-like object."""

    def __init__(self, outputs: dict, success: bool = True):
        self._outputs = outputs
        self._success = success

    async def call(self, inputs: dict, ctx=None) -> _FakeToolResult:
        return _FakeToolResult(self._outputs, self._success)


async def _collect_events(engine: PipelineEngine) -> list[PipelineEvent]:
    events = []
    async for event in engine.execute():
        events.append(event)
    return events


# ── PipelineDefinition field tests ──────────────────────────────────────────


def test_definition_defaults():
    defn = PipelineDefinition(nodes=[PipelineNode(id="a", tool_name="t", parameters={})])
    assert defn.max_rounds == 1
    assert defn.fitness_threshold is None
    assert defn.fitness_metric == ""


def test_definition_to_dict_includes_loop_fields():
    defn = PipelineDefinition(
        name="test",
        max_rounds=5,
        fitness_threshold=0.7,
        fitness_metric="p_hit",
        nodes=[],
    )
    d = defn.to_dict()
    assert d["max_rounds"] == 5
    assert d["fitness_threshold"] == 0.7
    assert d["fitness_metric"] == "p_hit"


def test_definition_from_dict_parses_loop_fields():
    d = {"nodes": [], "max_rounds": 3, "fitness_threshold": 0.5, "fitness_metric": "plddt_mean"}
    defn = PipelineDefinition.from_dict(d)
    assert defn.max_rounds == 3
    assert defn.fitness_threshold == 0.5
    assert defn.fitness_metric == "plddt_mean"


def test_definition_from_dict_defaults():
    defn = PipelineDefinition.from_dict({"nodes": []})
    assert defn.max_rounds == 1
    assert defn.fitness_threshold is None
    assert defn.fitness_metric == ""


# ── Pipeline engine round tests ─────────────────────────────────────────────


def test_single_round_unchanged():
    """Pipeline with max_rounds=1 produces ROUND_STARTED + ROUND_COMPLETED."""
    defn = PipelineDefinition(
        max_rounds=1,
        nodes=[PipelineNode(id="a", tool_name="mock_tool", parameters={})],
    )
    registry = {"mock_tool": _FakeTool({"value": 42})}
    engine = PipelineEngine(defn, tool_registry=registry)
    events = asyncio.run(_collect_events(engine))

    types = [e.type for e in events]
    assert PipelineEventType.PIPELINE_STARTED in types
    assert PipelineEventType.ROUND_STARTED in types
    assert PipelineEventType.NODE_COMPLETED in types
    assert PipelineEventType.ROUND_COMPLETED in types
    assert PipelineEventType.PIPELINE_DONE in types

    done = [e for e in events if e.type == PipelineEventType.PIPELINE_DONE][0]
    assert done.data["status"] == "completed"


def test_multi_round_execution():
    """Pipeline with max_rounds=3 runs DAG 3 times."""
    defn = PipelineDefinition(
        max_rounds=3,
        nodes=[PipelineNode(id="a", tool_name="mock_tool", parameters={})],
    )
    registry = {"mock_tool": _FakeTool({"v": 1})}
    engine = PipelineEngine(defn, tool_registry=registry)
    events = asyncio.run(_collect_events(engine))

    round_starts = [e for e in events if e.type == PipelineEventType.ROUND_STARTED]
    round_completes = [e for e in events if e.type == PipelineEventType.ROUND_COMPLETED]
    assert len(round_starts) == 3
    assert len(round_completes) == 3
    assert round_starts[0].data["round"] == 1
    assert round_starts[2].data["round"] == 3

    done = [e for e in events if e.type == PipelineEventType.PIPELINE_DONE][0]
    assert done.data["rounds_used"] == 3


def test_fitness_threshold_early_stop():
    """Pipeline stops early when tracker reports metric >= threshold."""
    tracker = CandidateTracker()
    # Pre-populate tracker with a candidate that meets threshold
    tracker.update("ACDE", "score_brightness", {"p_hit": 0.8}, round_idx=1)

    defn = PipelineDefinition(
        max_rounds=5,
        fitness_threshold=0.5,
        fitness_metric="p_hit",
        nodes=[PipelineNode(id="a", tool_name="mock_tool", parameters={})],
    )
    registry = {"mock_tool": _FakeTool({"ok": True})}
    engine = PipelineEngine(defn, tool_registry=registry, tracker=tracker)
    events = asyncio.run(_collect_events(engine))

    done = [e for e in events if e.type == PipelineEventType.PIPELINE_DONE][0]
    assert done.data["status"] == "threshold_met"
    assert done.data["best_value"] == 0.8
    assert done.data["round"] == 1

    # Should only have 1 round
    round_starts = [e for e in events if e.type == PipelineEventType.ROUND_STARTED]
    assert len(round_starts) == 1


# ── CandidateTracker tests ──────────────────────────────────────────────────


def test_candidate_tracker_update():
    tracker = CandidateTracker()
    c = tracker.update("ACDE", "brightness", {"p_hit": 0.6, "pdb_path": "/tmp/a.pdb"}, round_idx=1)
    assert c.sequence == "ACDE"
    assert c.metrics["p_hit"] == 0.6
    assert c.pdb_paths["brightness"] == "/tmp/a.pdb"
    assert 1 in c.rounds_seen
    assert "/tmp/a.pdb" in tracker.known_pdb_paths


def test_candidate_tracker_best():
    tracker = CandidateTracker()
    tracker.update("AAA", "t", {"p_hit": 0.3}, round_idx=1)
    tracker.update("BBB", "t", {"p_hit": 0.9}, round_idx=1)
    tracker.update("CCC", "t", {"p_hit": 0.5}, round_idx=1)
    assert tracker.best("p_hit") == 0.9
    assert tracker.best("nonexistent") is None


def test_candidate_tracker_pick_best():
    tracker = CandidateTracker()
    tracker.update("AAA", "t", {"score": 10}, round_idx=1)
    tracker.update("BBB", "t", {"score": 50}, round_idx=1)
    best = tracker.pick_best("score")
    assert best is not None
    assert best.sequence == "BBB"


def test_candidate_tracker_serialization():
    tracker = CandidateTracker()
    tracker.update("ACDE", "brightness", {"p_hit": 0.6, "pdb_path": "/a.pdb"}, round_idx=1)
    tracker.update("FGHI", "fold", {"plddt": 80.0}, round_idx=2)

    payload = tracker.to_db_payload()
    assert payload["candidate_count"] == 2
    assert "/a.pdb" in payload["known_pdb_paths"]

    # Round-trip
    restored = CandidateTracker.from_db_payload(payload)
    assert len(restored.candidates) == 2
    assert restored.candidates["ACDE"].metrics["p_hit"] == 0.6
    assert "/a.pdb" in restored.known_pdb_paths


def test_candidate_tracker_ingest_variants():
    tracker = CandidateTracker()
    added = tracker.ingest_variants(["AAA", "BBB", "AAA", ""], round_idx=1)
    assert len(added) == 2  # deduplication + empty filter
    assert "AAA" in tracker.candidates
    assert "BBB" in tracker.candidates
    assert "" not in tracker.candidates


def test_candidate_tracker_schema_driven_merge():
    schema = [
        CandidateField(name="brightness", type="float", source_tool="score_brightness", output_key="p_hit"),
    ]
    tracker = CandidateTracker(schema=schema)
    tracker.update("SEQ", "score_brightness", {"p_hit": 0.7, "extra": "ignored"}, round_idx=1)

    c = tracker.candidates["SEQ"]
    assert c.metrics["brightness"] == 0.7
    assert "extra" not in c.metrics  # schema filters non-matching keys

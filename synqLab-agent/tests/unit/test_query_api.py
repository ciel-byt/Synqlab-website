"""Unit tests for synqlab.query.api — seeds a small in-memory DB."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from synqlab.query.api import (
    filter_by_tag,
    get_experiment,
    list_candidates,
    list_runs,
    top_k,
)
from synqlab.storage.models import Base
from synqlab.storage.service import (
    attach_tag,
    complete_tool_run,
    create_experiment,
    create_tool_run,
    record_artifact,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


@pytest.fixture
def seeded_session(session: Session) -> Session:
    """Seed the DB with one experiment, two runs, and two artifacts."""
    create_experiment(session, experiment_id="q-exp-001", name="Query Test")

    run1 = create_tool_run(session, "q-exp-001", "r1", "omegafold", run_id="run-001")
    complete_tool_run(
        session, "run-001",
        response={"confidence": 88.0, "pdb_path": "data/agent_artifacts/a.pdb", "per_residue_plddt": []},
        latency_ms=250.0,
    )

    run2 = create_tool_run(session, "q-exp-001", "r1", "foldx", run_id="run-002")
    complete_tool_run(
        session, "run-002",
        response={"ddg": -1.5, "raw_output_path": "data/agent_artifacts/b.txt"},
        latency_ms=80.0,
    )

    art1 = record_artifact(session, "q-exp-001", "run-001", "pdb", "data/agent_artifacts/a.pdb")
    art2 = record_artifact(session, "q-exp-001", "run-002", "json", "data/agent_artifacts/b.json")
    attach_tag(session, art1.id, "gate", "gate1")
    attach_tag(session, art2.id, "gate", "gate2")

    return session


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_get_experiment_found(seeded_session: Session) -> None:
    exp = get_experiment(seeded_session, "q-exp-001")
    assert exp is not None
    assert exp.name == "Query Test"


def test_get_experiment_not_found(seeded_session: Session) -> None:
    exp = get_experiment(seeded_session, "nonexistent")
    assert exp is None


def test_list_runs_returns_all(seeded_session: Session) -> None:
    runs = list_runs(seeded_session, "q-exp-001")
    assert len(runs) == 2
    tool_ids = {r.tool_id for r in runs}
    assert "omegafold" in tool_ids
    assert "foldx" in tool_ids


def test_list_runs_empty_experiment(seeded_session: Session) -> None:
    create_experiment(seeded_session, experiment_id="empty-exp")
    runs = list_runs(seeded_session, "empty-exp")
    assert runs == []


def test_list_candidates_returns_artifacts(seeded_session: Session) -> None:
    artifacts = list_candidates(seeded_session, "q-exp-001")
    assert len(artifacts) == 2


def test_filter_by_tag_key(seeded_session: Session) -> None:
    results = filter_by_tag(seeded_session, "gate")
    assert len(results) == 2


def test_filter_by_tag_key_and_value(seeded_session: Session) -> None:
    results = filter_by_tag(seeded_session, "gate", "gate1")
    assert len(results) == 1
    assert results[0].artifact_type == "pdb"


def test_top_k_returns_scored_runs(seeded_session: Session) -> None:
    results = top_k(seeded_session, "q-exp-001", k=5)
    assert len(results) >= 1
    assert "confidence" in results[0]


def test_top_k_respects_k_limit(seeded_session: Session) -> None:
    results = top_k(seeded_session, "q-exp-001", k=1)
    assert len(results) <= 1


def test_top_k_sorted_descending(seeded_session: Session) -> None:
    results = top_k(seeded_session, "q-exp-001", k=10)
    scores = [r["confidence"] for r in results]
    assert scores == sorted(scores, reverse=True)

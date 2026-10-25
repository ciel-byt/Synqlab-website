"""Unit tests for synqlab.storage.service — uses SQLite in-memory DB."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

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


# ---------------------------------------------------------------------------
# create_experiment
# ---------------------------------------------------------------------------

def test_create_experiment(session: Session) -> None:
    exp = create_experiment(session, experiment_id="exp-001", name="Test Experiment")
    assert exp.id == "exp-001"
    assert exp.name == "Test Experiment"
    assert exp.status == "running"


def test_create_experiment_auto_id(session: Session) -> None:
    exp = create_experiment(session)
    assert exp.id  # non-empty UUID


def test_create_experiment_with_config(session: Session) -> None:
    cfg = {"n_sequences": 10, "use_reranker": False}
    exp = create_experiment(session, config=cfg)
    assert exp.config_jsonb == cfg


# ---------------------------------------------------------------------------
# create_tool_run
# ---------------------------------------------------------------------------

def test_create_tool_run(session: Session) -> None:
    create_experiment(session, experiment_id="exp-002")
    run = create_tool_run(session, "exp-002", "round_001", "protgpt2", run_id="run-001")
    assert run.id == "run-001"
    assert run.status == "running"
    assert run.tool_id == "protgpt2"


def test_create_tool_run_with_request(session: Session) -> None:
    create_experiment(session, experiment_id="exp-003")
    req = {"n_sequences": 5}
    run = create_tool_run(session, "exp-003", "round_001", "protgpt2", request=req)
    assert run.request_jsonb == req


# ---------------------------------------------------------------------------
# complete_tool_run
# ---------------------------------------------------------------------------

def test_complete_tool_run_success(session: Session) -> None:
    create_experiment(session, experiment_id="exp-004")
    run = create_tool_run(session, "exp-004", "round_001", "omegafold", run_id="run-002")
    resp = {"confidence": 85.0}
    completed = complete_tool_run(session, "run-002", response=resp, latency_ms=123.4)
    assert completed.status == "completed"
    assert completed.response_jsonb == resp
    assert completed.latency_ms == 123.4
    assert completed.finished_at is not None


def test_complete_tool_run_failure(session: Session) -> None:
    create_experiment(session, experiment_id="exp-005")
    run = create_tool_run(session, "exp-005", "round_001", "foldx", run_id="run-003")
    completed = complete_tool_run(session, "run-003", error_message="binary not found")
    assert completed.status == "failed"
    assert completed.error_message == "binary not found"


# ---------------------------------------------------------------------------
# record_artifact
# ---------------------------------------------------------------------------

def test_record_artifact(session: Session) -> None:
    create_experiment(session, experiment_id="exp-006")
    artifact = record_artifact(
        session,
        experiment_id="exp-006",
        tool_run_id=None,
        artifact_type="pdb",
        path="data/agent_artifacts/exp-006/round_001/omegafold/run-x/structure.pdb",
    )
    assert artifact.id
    assert artifact.artifact_type == "pdb"


def test_record_artifact_linked_to_run(session: Session) -> None:
    create_experiment(session, experiment_id="exp-007")
    run = create_tool_run(session, "exp-007", "round_001", "omegafold", run_id="run-007")
    artifact = record_artifact(
        session,
        experiment_id="exp-007",
        tool_run_id=run.id,
        artifact_type="json",
        path="data/agent_artifacts/exp-007/round_001/omegafold/run-007/output.json",
    )
    assert artifact.tool_run_id == run.id


# ---------------------------------------------------------------------------
# attach_tag
# ---------------------------------------------------------------------------

def test_attach_tag(session: Session) -> None:
    create_experiment(session, experiment_id="exp-008")
    artifact = record_artifact(
        session, "exp-008", None, "json", "data/agent_artifacts/test.json"
    )
    tag = attach_tag(session, artifact.id, "round", "round_001")
    assert tag.key == "round"
    assert tag.value == "round_001"


def test_attach_multiple_tags(session: Session) -> None:
    create_experiment(session, experiment_id="exp-009")
    artifact = record_artifact(session, "exp-009", None, "pdb", "data/agent_artifacts/a.pdb")
    attach_tag(session, artifact.id, "top_k", "true")
    attach_tag(session, artifact.id, "gate", "gate1")
    session.refresh(artifact)
    assert len(artifact.tags) == 2

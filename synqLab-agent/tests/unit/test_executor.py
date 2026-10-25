"""Unit tests for synqlab.engine.executor."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from synqlab.adapters.base import BaseAdapter
from synqlab.core.schemas import ExperimentConfig, ToolOutput, ToolRequest
from synqlab.core.tool_definition import ToolDefinition
from synqlab.engine.executor import execute_tool
from synqlab.storage.models import Base
from synqlab.storage.service import create_experiment


# ---------------------------------------------------------------------------
# Stub adapter (replaces MockAdapter)
# ---------------------------------------------------------------------------

class _StubAdapter(BaseAdapter):
    """Minimal adapter returning a fixed output — no external dependencies."""

    def __init__(self, tool_id: str = "protgpt2") -> None:
        self._tool_id = tool_id

    def run(self, request: ToolRequest) -> ToolOutput:
        return ToolOutput(
            tool_id=request.tool_id,
            outputs={"sequences": ["ACDEF"] * 5},
            success=True,
        )


class _FailingAdapter(BaseAdapter):
    def run(self, request: ToolRequest) -> ToolOutput:
        raise RuntimeError("tool exploded")


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
def config() -> ExperimentConfig:
    return ExperimentConfig(experiment_id="exp-exec-test")


@pytest.fixture
def request_obj() -> ToolRequest:
    return ToolRequest(
        tool_id="protgpt2",
        inputs={"n_sequences": 5},
        experiment_id="exp-exec-test",
        round_id="round_001",
    )


# ---------------------------------------------------------------------------
# Tests (no DB)
# ---------------------------------------------------------------------------

def test_execute_tool_returns_tool_output(config: ExperimentConfig, request_obj: ToolRequest) -> None:
    result = execute_tool("protgpt2", request_obj, config, adapter=_StubAdapter())
    assert isinstance(result, ToolOutput)


def test_execute_tool_success(config: ExperimentConfig, request_obj: ToolRequest) -> None:
    result = execute_tool("protgpt2", request_obj, config, adapter=_StubAdapter())
    assert result.success is True
    assert result.tool_id == "protgpt2"


def test_execute_tool_records_latency(config: ExperimentConfig, request_obj: ToolRequest) -> None:
    result = execute_tool("protgpt2", request_obj, config, adapter=_StubAdapter())
    assert result.latency_ms is not None
    assert result.latency_ms >= 0


def test_execute_tool_adapter_exception_returns_failed(
    config: ExperimentConfig, request_obj: ToolRequest
) -> None:
    result = execute_tool("protgpt2", request_obj, config, adapter=_FailingAdapter())
    assert result.success is False
    assert "tool exploded" in (result.error_message or "")


# ---------------------------------------------------------------------------
# Tests (with SQLite DB)
# ---------------------------------------------------------------------------

def test_execute_tool_writes_db_rows(
    session: Session, config: ExperimentConfig, request_obj: ToolRequest
) -> None:
    create_experiment(session, experiment_id="exp-exec-test")
    execute_tool("protgpt2", request_obj, config, adapter=_StubAdapter(), session=session)

    from synqlab.storage.models import ToolRun
    runs = session.query(ToolRun).filter_by(experiment_id="exp-exec-test").all()
    assert len(runs) == 1
    assert runs[0].status == "completed"


def test_execute_tool_failed_call_writes_failed_row(
    session: Session, config: ExperimentConfig, request_obj: ToolRequest
) -> None:
    create_experiment(session, experiment_id="exp-exec-test")
    result = execute_tool("protgpt2", request_obj, config, adapter=_FailingAdapter(), session=session)
    assert result.success is False

    from synqlab.storage.models import ToolRun
    runs = session.query(ToolRun).filter_by(experiment_id="exp-exec-test").all()
    assert runs[0].status == "failed"
    assert "tool exploded" in runs[0].error_message

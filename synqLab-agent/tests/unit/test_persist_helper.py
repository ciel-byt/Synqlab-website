"""RED tests for the persist_artifact() helper (D-01, D-02, D-03).

These tests fail until plan 13-03 lands `synqlab/agent/tools/_persist.py`.
"""
from __future__ import annotations
import asyncio
import pytest

pytestmark = pytest.mark.usefixtures("agent_db_session")


def _ctx(session_id: str = "test-sess-001"):
    # Minimal AgentContext stand-in — adjust to actual constructor when
    # synqlab.agent.context is loaded.
    from synqlab.agent.context import AgentContext
    return AgentContext(
        session_id=session_id,
        user_id="test-user",
        org_id="test-org",
        project_id=None,
    )


def test_threshold_split(agent_db_session, monkeypatch, tmp_path):
    """D-01: content > 100 KB writes file_path; <= 100 KB stays inline."""
    monkeypatch.setenv("SYNQLAB_ARTIFACT_DIR", str(tmp_path))
    from synqlab.agent.tools._persist import persist_artifact
    from synqlab.agent.models import AgentArtifact

    # Patch get_db_session to return the test session.
    import synqlab.agent.tools._persist as persist_mod
    monkeypatch.setattr(persist_mod, "get_db_session", lambda: agent_db_session)

    # Seed parent session row so FK passes (only matters when scope='session').
    # Skip if AgentSession requires non-trivial fields — leave session_id orphaned;
    # SQLite in-memory may or may not enforce the FK depending on PRAGMA.
    small = "x" * 1000
    large = "y" * (200 * 1024)

    small_id = asyncio.run(persist_artifact(
        content=small, name="small.csv", artifact_type="score_table", ctx=_ctx(),
    ))
    large_id = asyncio.run(persist_artifact(
        content=large, name="large.pdb", artifact_type="pdb_structure", ctx=_ctx(),
    ))

    rows = {r.id: r for r in agent_db_session.query(AgentArtifact).all()}
    assert rows[small_id].content == small
    assert rows[small_id].file_path is None
    assert rows[large_id].content is None
    assert rows[large_id].file_path is not None


def test_row_shape_parity(agent_db_session, monkeypatch, tmp_path):
    """D-02: persist_artifact and save_artifact produce structurally identical rows."""
    monkeypatch.setenv("SYNQLAB_ARTIFACT_DIR", str(tmp_path))
    from synqlab.agent.tools._persist import persist_artifact
    from synqlab.agent.tools.save_artifact import _save_artifact_call
    from synqlab.agent.models import AgentArtifact

    import synqlab.agent.tools._persist as persist_mod
    import synqlab.agent.tools.save_artifact as save_mod
    monkeypatch.setattr(persist_mod, "get_db_session", lambda: agent_db_session)
    monkeypatch.setattr(save_mod, "get_db_session", lambda: agent_db_session)

    content = "x" * 500
    helper_id = asyncio.run(persist_artifact(
        content=content, name="a.md", artifact_type="markdown_report", ctx=_ctx(),
    ))
    save_result = asyncio.run(_save_artifact_call(
        {"name": "b.md", "artifact_type": "markdown_report", "content": content,
         "metadata": {}}, _ctx(),
    ))
    assert save_result.is_success, save_result
    save_id = save_result.data["artifact_id"]

    helper_row = agent_db_session.query(AgentArtifact).filter_by(id=helper_id).one()
    save_row = agent_db_session.query(AgentArtifact).filter_by(id=save_id).one()
    # Same set of populated columns:
    for col in ("artifact_type", "content_type", "size_bytes"):
        assert getattr(helper_row, col) == getattr(save_row, col), col
    assert (helper_row.content is None) == (save_row.content is None)
    assert (helper_row.file_path is None) == (save_row.file_path is None)


def test_one_line_api(agent_db_session, monkeypatch, tmp_path):
    """D-03: persist_artifact callable with kw-only args, returns artifact_id string."""
    monkeypatch.setenv("SYNQLAB_ARTIFACT_DIR", str(tmp_path))
    from synqlab.agent.tools._persist import persist_artifact

    import synqlab.agent.tools._persist as persist_mod
    monkeypatch.setattr(persist_mod, "get_db_session", lambda: agent_db_session)

    aid = asyncio.run(persist_artifact(
        content="hello", name="x.csv", artifact_type="score_table", ctx=_ctx(),
    ))
    assert isinstance(aid, str) and len(aid) > 0

"""RED tests for analyze_stability artifact_id refactor (D-05, D-06, D-13).

These tests fail until plan 13-04 lands the stability_analysis refactor.
"""
from __future__ import annotations
import asyncio
import json
from unittest.mock import patch, MagicMock
import pytest


def _ctx(session_id: str = "test-sess-002"):
    from synqlab.agent.context import AgentContext
    return AgentContext(
        session_id=session_id, user_id="u", org_id="o", project_id=None,
    )


def test_schema_no_pdb_path():
    """D-06: pdb_path field is REMOVED from StabilityAnalysisInput."""
    from synqlab.agent.tools.stability_analysis import StabilityAnalysisInput
    fields = set(StabilityAnalysisInput.model_fields.keys())
    assert "pdb_path" not in fields, "D-06 violated: pdb_path must be deleted, not coexist"
    assert "artifact_id" in fields, "D-05 violated: artifact_id must be the new input"


def test_resolution(agent_db_session, monkeypatch):
    """D-05r: tool resolves artifact_id -> file_path via DB before HTTP POST."""
    monkeypatch.setenv("SYNQLAB_FOLDX_URL", "http://foldx-test:8000")
    from synqlab.agent.models import AgentArtifact
    import synqlab.agent.tools.stability_analysis as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)

    # Seed a global artifact row.
    row = AgentArtifact(
        id="art-1", session_id=None, scope="global", name="1crn.pdb",
        artifact_type="pdb_structure", content_type="chemical/x-pdb",
        content=None, file_path="/app/data/agent_artifacts/global/1crn.pdb",
        size_bytes=4096,
    )
    agent_db_session.add(row)
    agent_db_session.commit()

    captured = {}
    async def fake_post_json(url, payload, *, timeout=180.0):
        captured["url"] = url
        captured["payload"] = payload
        return {"success": True, "outputs": {"ddg": -0.5}}
    monkeypatch.setattr(mod, "post_json", fake_post_json)

    result = asyncio.run(mod._call({"artifact_id": "art-1", "mutations": []}, _ctx()))
    assert result.is_success, result
    # Payload sent to foldx-svc must contain resolved path, NOT artifact_id.
    assert captured["payload"]["inputs"]["pdb_path"] == "/app/data/agent_artifacts/global/1crn.pdb"
    assert "artifact_id" not in captured["payload"]["inputs"]


def test_payload_has_resolved_path(agent_db_session, monkeypatch):
    """D-13: tool service request body never contains artifact_id, only resolved file_path."""
    # Same as test_resolution but asserts the inverse explicitly.
    # Re-run a minimal version asserting the absence side.
    monkeypatch.setenv("SYNQLAB_FOLDX_URL", "http://foldx-test:8000")
    from synqlab.agent.models import AgentArtifact
    import synqlab.agent.tools.stability_analysis as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)
    agent_db_session.add(AgentArtifact(
        id="art-2", session_id=None, scope="global", name="x.pdb",
        artifact_type="pdb_structure", content_type="chemical/x-pdb",
        file_path="/app/data/agent_artifacts/global/x.pdb", size_bytes=1024,
    ))
    agent_db_session.commit()
    captured = {}
    async def fake_post_json(url, payload, *, timeout=180.0):
        captured["payload"] = payload
        return {"success": True, "outputs": {"ddg": 0.0}}
    monkeypatch.setattr(mod, "post_json", fake_post_json)
    asyncio.run(mod._call({"artifact_id": "art-2", "mutations": []}, _ctx()))
    assert "artifact_id" not in json.dumps(captured["payload"]), "service must not see artifact_id"
    assert captured["payload"]["inputs"]["pdb_path"].startswith("/app/data/agent_artifacts/")


def test_rejects_missing_artifact(agent_db_session, monkeypatch):
    """D-05: unknown artifact_id returns ToolResult.fail, no HTTP call made."""
    monkeypatch.setenv("SYNQLAB_FOLDX_URL", "http://foldx-test:8000")
    import synqlab.agent.tools.stability_analysis as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)

    called = {"n": 0}
    async def fake_post_json(url, payload, *, timeout=180.0):
        called["n"] += 1
        raise AssertionError("post_json must not be called for missing artifact")
    monkeypatch.setattr(mod, "post_json", fake_post_json)

    result = asyncio.run(mod._call({"artifact_id": "does-not-exist", "mutations": []}, _ctx()))
    assert not result.is_success
    assert "not found" in (result.error_message or "").lower()
    assert called["n"] == 0


def _ctx_with_project(session_id: str, project_id: str | None):
    from synqlab.agent.context import AgentContext
    return AgentContext(
        session_id=session_id, user_id="u", org_id="o", project_id=project_id,
    )


def test_cross_project_artifact_rejected(agent_db_session, monkeypatch):
    """Visibility: a session in P1 cannot use a scope='project' artifact owned by P2.

    Plan 13-04 must add a project-scope visibility check to analyze_stability._call.
    """
    monkeypatch.setenv("SYNQLAB_FOLDX_URL", "http://foldx-test:8000")
    from synqlab.agent.models import AgentArtifact
    import synqlab.agent.tools.stability_analysis as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)

    # Project-scoped artifact owned by P2.
    agent_db_session.add(AgentArtifact(
        id="p2-art", session_id=None, scope="project", project_id="P2",
        name="p2.pdb", artifact_type="pdb_structure",
        content_type="chemical/x-pdb",
        file_path="/app/data/agent_artifacts/P2/p2.pdb", size_bytes=1024,
    ))
    agent_db_session.commit()

    called = {"n": 0}
    async def fake_post_json(url, payload, *, timeout=180.0):
        called["n"] += 1
        raise AssertionError("post_json must not be called for cross-project leak")
    monkeypatch.setattr(mod, "post_json", fake_post_json)

    # Session in project P1 attempting to use the P2 artifact.
    result = asyncio.run(mod._call(
        {"artifact_id": "p2-art", "mutations": []},
        _ctx_with_project("sess-p1", "P1"),
    ))
    assert not result.is_success
    assert "not accessible" in (result.error_message or "").lower()
    assert called["n"] == 0


def test_project_artifact_accessible_in_same_project(agent_db_session, monkeypatch):
    """Visibility: a session in P1 CAN use a scope='project' artifact owned by P1."""
    monkeypatch.setenv("SYNQLAB_FOLDX_URL", "http://foldx-test:8000")
    from synqlab.agent.models import AgentArtifact
    import synqlab.agent.tools.stability_analysis as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)

    agent_db_session.add(AgentArtifact(
        id="p1-art", session_id=None, scope="project", project_id="P1",
        name="p1.pdb", artifact_type="pdb_structure",
        content_type="chemical/x-pdb",
        file_path="/app/data/agent_artifacts/P1/p1.pdb", size_bytes=1024,
    ))
    agent_db_session.commit()

    async def fake_post_json(url, payload, *, timeout=180.0):
        return {"success": True, "outputs": {"ddg": 0.0}}
    monkeypatch.setattr(mod, "post_json", fake_post_json)

    result = asyncio.run(mod._call(
        {"artifact_id": "p1-art", "mutations": []},
        _ctx_with_project("sess-p1", "P1"),
    ))
    assert result.is_success, result


def test_global_artifact_accessible_anywhere(agent_db_session, monkeypatch):
    """Visibility: scope='global' rows are visible to any session/project."""
    monkeypatch.setenv("SYNQLAB_FOLDX_URL", "http://foldx-test:8000")
    from synqlab.agent.models import AgentArtifact
    import synqlab.agent.tools.stability_analysis as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)

    agent_db_session.add(AgentArtifact(
        id="glob", session_id=None, scope="global", name="1crn.pdb",
        artifact_type="pdb_structure", content_type="chemical/x-pdb",
        file_path="/app/data/agent_artifacts/global/1crn.pdb", size_bytes=4096,
    ))
    agent_db_session.commit()

    async def fake_post_json(url, payload, *, timeout=180.0):
        return {"success": True, "outputs": {"ddg": 0.0}}
    monkeypatch.setattr(mod, "post_json", fake_post_json)

    # Session with no project at all.
    result_no_proj = asyncio.run(mod._call(
        {"artifact_id": "glob", "mutations": []},
        _ctx_with_project("sess-x", None),
    ))
    assert result_no_proj.is_success, result_no_proj

    # Session in project P9 that does not own the global row.
    result_other = asyncio.run(mod._call(
        {"artifact_id": "glob", "mutations": []},
        _ctx_with_project("sess-y", "P9"),
    ))
    assert result_other.is_success, result_other

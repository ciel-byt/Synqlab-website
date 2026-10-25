"""RED tests for GET /api/agents/datasets endpoint (D-08 dedicated route).

Fails until plan 13-05 lands GET /api/agents/datasets on the agents router.
"""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_data(agent_db_session, monkeypatch):
    from synqlab.agent.models import AgentArtifact, AgentSession
    from app.main import app
    import app.routers.agents as agents_router
    monkeypatch.setattr(agents_router, "get_db_session", lambda: agent_db_session)

    # Sessions in two distinct projects + a project row in each + session/global rows.
    agent_db_session.add(AgentSession(
        id="s-p1", org_id="O1", project_id="P1", user_id="U1",
        agent_type="general", status="active",
        autonomy_mode="autonomous", model="gpt-4o",
    ))
    agent_db_session.add_all([
        # P1 project rows (target).
        AgentArtifact(id="d-p1-a", session_id=None, scope="project", project_id="P1",
                      name="p1-a.csv", artifact_type="score_table",
                      content_type="text/csv", size_bytes=100, file_path="/x"),
        AgentArtifact(id="d-p1-b", session_id=None, scope="project", project_id="P1",
                      name="p1-b.pdb", artifact_type="pdb_structure",
                      content_type="chemical/x-pdb", size_bytes=200, file_path="/y"),
        # P2 project row (must be excluded).
        AgentArtifact(id="d-p2", session_id=None, scope="project", project_id="P2",
                      name="p2.csv", artifact_type="score_table",
                      content_type="text/csv", size_bytes=300, file_path="/z"),
        # Session row in P1 (must be excluded — endpoint is project-scope only).
        AgentArtifact(id="d-sess", session_id="s-p1", scope="session",
                      name="sess.pdb", artifact_type="pdb_structure",
                      content_type="chemical/x-pdb", size_bytes=400, file_path="/w"),
        # Global row (must be excluded).
        AgentArtifact(id="d-glob", session_id=None, scope="global",
                      name="1crn.pdb", artifact_type="pdb_structure",
                      content_type="chemical/x-pdb", size_bytes=500, file_path="/g"),
    ])
    agent_db_session.commit()
    return TestClient(app)


def test_returns_project_rows_for_requested_project(client_with_data):
    r = client_with_data.get(
        "/api/agents/datasets?project_id=P1",
        headers={"X-Api-Key": "test-bypass"},
    )
    assert r.status_code == 200, r.text
    ids = {row["id"] for row in r.json()}
    assert ids == {"d-p1-a", "d-p1-b"}
    for row in r.json():
        assert row["scope"] == "project"
        assert row["project_id"] == "P1"


def test_does_not_return_other_projects(client_with_data):
    r = client_with_data.get(
        "/api/agents/datasets?project_id=P1",
        headers={"X-Api-Key": "test-bypass"},
    )
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()}
    assert "d-p2" not in ids


def test_excludes_session_and_global_rows(client_with_data):
    r = client_with_data.get(
        "/api/agents/datasets?project_id=P1",
        headers={"X-Api-Key": "test-bypass"},
    )
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()}
    assert "d-sess" not in ids
    assert "d-glob" not in ids


def test_400_when_project_id_missing(client_with_data):
    r = client_with_data.get(
        "/api/agents/datasets",
        headers={"X-Api-Key": "test-bypass"},
    )
    assert r.status_code == 400

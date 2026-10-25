"""RED test for scope-merging list endpoint (D-08).

Fails until plan 13-05 lands the list-endpoint refactor in app/routers/agents.py.
"""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_session(patch_db_session):
    from synqlab.agent.models import AgentArtifact, AgentSession
    from app.main import app

    # Seed: a session in project P1.
    sess = AgentSession(id="s1", org_id="O1", project_id="P1", user_id="U1",
                        agent_type="general", status="active",
                        autonomy_mode="autonomous", model="gpt-4o")
    patch_db_session.add(sess)
    patch_db_session.add_all([
        AgentArtifact(id="a-sess", session_id="s1", scope="session", name="own.pdb",
                      artifact_type="pdb_structure", content_type="chemical/x-pdb",
                      size_bytes=100, file_path="/x"),
        AgentArtifact(id="a-proj", session_id=None, scope="project", project_id="P1",
                      name="proj.csv", artifact_type="score_table",
                      content_type="text/csv", size_bytes=200, file_path="/y"),
        AgentArtifact(id="a-glob", session_id=None, scope="global", name="1crn.pdb",
                      artifact_type="pdb_structure", content_type="chemical/x-pdb",
                      size_bytes=300, file_path="/z"),
        AgentArtifact(id="a-other", session_id=None, scope="project", project_id="P2",
                      name="other.csv", artifact_type="score_table",
                      content_type="text/csv", size_bytes=400, file_path="/w"),
    ])
    patch_db_session.commit()

    # Bypass JWT middleware: hit the endpoint directly through TestClient with a stub auth header.
    return TestClient(app), "s1"


def test_list_merges_session_project_global(client_with_session, monkeypatch):
    client, sid = client_with_session
    monkeypatch.setenv("SYNQLAB_TEST_AUTH_BYPASS", "1")  # plan 13-05 may add this; otherwise mock auth differently
    # NB: if middleware blocks unauthenticated calls, plan 13-05 must document
    # the test-auth strategy. This assertion is what success looks like.
    r = client.get(f"/api/agents/sessions/{sid}/artifacts",
                   headers={"X-Api-Key": "test-bypass"})
    assert r.status_code == 200, r.text
    ids = {row["id"] for row in r.json()}
    assert "a-sess" in ids
    assert "a-proj" in ids
    assert "a-glob" in ids
    assert "a-other" not in ids, "Other-project rows must not leak"
    # All rows carry scope field.
    for row in r.json():
        assert "scope" in row and row["scope"] in {"session", "project", "global"}

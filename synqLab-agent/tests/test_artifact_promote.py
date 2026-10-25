"""RED test for promote endpoint (D-10).

Fails until plan 13-05 lands POST /artifacts/{id}/promote.
"""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_session_artifact(patch_db_session):
    from synqlab.agent.models import AgentSession, AgentArtifact
    from app.main import app

    patch_db_session.add(AgentSession(
        id="s3", org_id="O1", project_id="P1", user_id="U1",
        agent_type="general", status="active",
        autonomy_mode="autonomous", model="gpt-4o",
    ))
    patch_db_session.add(AgentArtifact(
        id="a-src", session_id="s3", scope="session", name="user.pdb",
        artifact_type="pdb_structure", content_type="chemical/x-pdb",
        size_bytes=4096, file_path="/app/data/agent_artifacts/s3/user.pdb",
    ))
    patch_db_session.commit()
    return TestClient(app), patch_db_session


def test_promote_copies_row(client_with_session_artifact):
    from synqlab.agent.models import AgentArtifact
    client, db_session = client_with_session_artifact
    r = client.post(
        "/api/agents/artifacts/a-src/promote",
        headers={"X-Api-Key": "test-bypass"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    new_id = body["artifact_id"]
    assert body["scope"] == "project"
    assert new_id != "a-src"

    rows = db_session.query(AgentArtifact).all()
    # Original survives, new project row exists.
    ids = {r.id for r in rows}
    assert "a-src" in ids
    assert new_id in ids
    new_row = db_session.query(AgentArtifact).filter_by(id=new_id).one()
    assert new_row.scope == "project"
    assert new_row.project_id == "P1"
    assert new_row.session_id is None
    assert new_row.file_path == "/app/data/agent_artifacts/s3/user.pdb"  # shared path

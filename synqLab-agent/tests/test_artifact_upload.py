"""RED tests for upload endpoint (D-09, D-11).

Fails until plan 13-05 lands POST /sessions/{id}/artifacts.
"""
from __future__ import annotations
from pathlib import Path
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_session(patch_db_session):
    from synqlab.agent.models import AgentSession
    from app.main import app
    patch_db_session.add(AgentSession(
        id="s2", org_id="O1", project_id="P1", user_id="U1",
        agent_type="general", status="active",
        autonomy_mode="autonomous", model="gpt-4o",
    ))
    patch_db_session.commit()
    return TestClient(app), "s2"


def test_upload_creates_session_row(client_with_session, tmp_path):
    client, sid = client_with_session
    sample = Path("tests/fixtures/sample.pdb")
    with sample.open("rb") as fh:
        r = client.post(
            f"/api/agents/sessions/{sid}/artifacts",
            files={"file": ("sample.pdb", fh, "chemical/x-pdb")},
            headers={"X-Api-Key": "test-bypass"},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "sample.pdb"
    assert "artifact_id" in body
    assert body.get("scope") in {"session", None}  # default is session


def test_extension_allowlist(client_with_session):
    """D-11: extensions outside {.pdb, .fasta, .fa, .csv, .json} are rejected."""
    client, sid = client_with_session
    r = client.post(
        f"/api/agents/sessions/{sid}/artifacts",
        files={"file": ("malicious.exe", b"MZ\x90\x00", "application/octet-stream")},
        headers={"X-Api-Key": "test-bypass"},
    )
    assert r.status_code == 400
    assert ".pdb" in r.text or "supported" in r.text.lower()

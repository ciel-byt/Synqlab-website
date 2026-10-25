"""RED test for bundled-sample lifespan ingest (D-04).

Fails until plan 13-05 lands the lifespan handler in app/main.py.
"""
from __future__ import annotations
import hashlib
import pytest


def test_ingest_creates_global_rows_idempotent(agent_db_session, monkeypatch, tmp_path):
    # Stage two PDB files in a temp dir representing /app/pdb_samples.
    sample_a = tmp_path / "1crn.pdb"
    sample_b = tmp_path / "1ubq.pdb"
    sample_a.write_text("HEADER  TEST A\nATOM      1  N   ALA A   1\nEND\n")
    sample_b.write_text("HEADER  TEST B\nATOM      1  N   GLY A   1\nEND\n")

    # Import the lifespan-helper that 13-05 will create.
    from app.main import _ingest_bundled_samples
    from synqlab.agent.models import AgentArtifact

    # Patch DB getter + bundled dir.
    import app.main as main_mod
    monkeypatch.setattr(main_mod, "get_db_session", lambda: agent_db_session, raising=False)

    # First run inserts.
    _ingest_bundled_samples(bundled_dir=tmp_path)
    rows = agent_db_session.query(AgentArtifact).filter_by(scope="global").all()
    assert {r.name for r in rows} == {"1crn.pdb", "1ubq.pdb"}
    assert all(r.session_id is None for r in rows)
    assert all(r.artifact_type == "pdb_structure" for r in rows)
    assert all(r.content_hash for r in rows)

    # Second run: idempotent (no duplicates).
    _ingest_bundled_samples(bundled_dir=tmp_path)
    rows2 = agent_db_session.query(AgentArtifact).filter_by(scope="global").all()
    assert len(rows2) == 2

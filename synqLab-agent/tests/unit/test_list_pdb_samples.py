"""RED test for list_pdb_samples tool (D-07).

Fails until plan 13-04 lands synqlab/agent/tools/list_pdb_samples.py.
"""
from __future__ import annotations
import asyncio


def test_returns_global_pdb_rows(agent_db_session, monkeypatch):
    from synqlab.agent.models import AgentArtifact
    from synqlab.agent.context import AgentContext
    import synqlab.agent.tools.list_pdb_samples as mod
    monkeypatch.setattr(mod, "get_db_session", lambda: agent_db_session, raising=False)

    # Two globals, one session-scoped (must be excluded).
    agent_db_session.add_all([
        AgentArtifact(id="g1", session_id=None, scope="global", name="1crn.pdb",
                      artifact_type="pdb_structure", content_type="chemical/x-pdb",
                      file_path="/app/pdb_samples/1crn.pdb", size_bytes=4096),
        AgentArtifact(id="g2", session_id=None, scope="global", name="1ubq.pdb",
                      artifact_type="pdb_structure", content_type="chemical/x-pdb",
                      file_path="/app/pdb_samples/1ubq.pdb", size_bytes=8192),
        AgentArtifact(id="s1", session_id="some-session", scope="session", name="user.pdb",
                      artifact_type="pdb_structure", content_type="chemical/x-pdb",
                      file_path="/tmp/user.pdb", size_bytes=2048),
    ])
    agent_db_session.commit()

    ctx = AgentContext(session_id="x", user_id="u", org_id="o", project_id=None)
    result = asyncio.run(mod._call({}, ctx))
    assert result.is_success
    names = {s["name"] for s in result.data["samples"]}
    assert names == {"1crn.pdb", "1ubq.pdb"}
    assert result.data["count"] == 2

"""RED tests for predict_structure auto-persist (D-01, D-02, D-03 wiring).

Fails until plan 13-04 wires `protein_folding._call` to `persist_artifact()`.
These cover the protein_folding -> persist_artifact integration that the
existing test_persist_helper.py does NOT exercise (helper is exercised
independently; these tests prove the *call site* is wired).
"""
from __future__ import annotations
import asyncio
from pathlib import Path
from unittest.mock import MagicMock
import pytest


def _ctx(session_id: str = "test-sess-pf"):
    from synqlab.agent.context import AgentContext
    return AgentContext(
        session_id=session_id, user_id="u", org_id="o", project_id=None,
    )


def test_predict_structure_calls_persist_artifact(agent_db_session, monkeypatch, tmp_path):
    """predict_structure auto-persists its OmegaFold output and returns artifact_id (NOT pdb_path)."""
    monkeypatch.setenv("SYNQLAB_OMEGAFOLD_URL", "http://omegafold-test:8000")
    monkeypatch.setenv("SYNQLAB_ARTIFACT_DIR", str(tmp_path))

    # Stage a fake OmegaFold output file on disk.
    fake_pdb = tmp_path / "fold_out.pdb"
    fake_pdb.write_text("HEADER FOLDED\nATOM 1  N   ALA A   1\nEND\n", encoding="utf-8")

    # Stub the async HTTP helper used by the tool. model_service wraps adapter
    # output in `outputs`, so we match production shape.
    import synqlab.agent.tools.protein_folding as pf

    async def fake_post_json(url, payload, *, timeout=300.0):
        return {
            "success": True,
            "outputs": {
                "pdb_path": str(fake_pdb),
                "plddt_mean": 0.87,
            },
        }
    monkeypatch.setattr(pf, "post_json", fake_post_json)

    # Patch the DB getter used by the persist helper this tool calls into.
    import synqlab.agent.tools._persist as persist_mod
    monkeypatch.setattr(persist_mod, "get_db_session", lambda: agent_db_session)

    # Spy on persist_artifact to assert the call shape.
    seen = {}
    original_persist = persist_mod.persist_artifact
    async def spy_persist(*, content, name, artifact_type, ctx, scope="session", metadata=None):
        seen["content"] = content
        seen["name"] = name
        seen["artifact_type"] = artifact_type
        seen["scope"] = scope
        seen["metadata"] = metadata
        return await original_persist(
            content=content, name=name, artifact_type=artifact_type,
            ctx=ctx, scope=scope, metadata=metadata,
        )
    # Replace the symbol in protein_folding's namespace, not just the source.
    monkeypatch.setattr(pf, "persist_artifact", spy_persist, raising=False)

    result = asyncio.run(pf._call(
        {"sequence": "MKWVTFISLL", "method": "omegafold"}, _ctx(),
    ))
    assert result.is_success, result
    # Auto-persist should have run with artifact_type='pdb_structure'.
    assert seen.get("artifact_type") == "pdb_structure"
    # Result must surface artifact_id, NOT pdb_path.
    assert "artifact_id" in result.data
    assert "pdb_path" not in result.data


def test_predict_structure_handles_missing_pdb_path(monkeypatch, tmp_path):
    """When OmegaFold response has no pdb_path, the tool returns ok-result without artifact_id (no crash)."""
    monkeypatch.setenv("SYNQLAB_OMEGAFOLD_URL", "http://omegafold-test:8000")

    import synqlab.agent.tools.protein_folding as pf

    async def fake_post_json(url, payload, *, timeout=300.0):
        return {
            "success": True,
            "outputs": {
                "plddt_mean": 0.50,
                # No pdb_path field.
            },
        }
    monkeypatch.setattr(pf, "post_json", fake_post_json)

    # No persist call should occur when there is nothing to read.
    result = asyncio.run(pf._call(
        {"sequence": "MKWVTFISLL", "method": "omegafold"}, _ctx(),
    ))
    # Either ok-without-artifact_id OR fail with a clear message — both acceptable.
    if result.is_success:
        assert "artifact_id" not in result.data, "no pdb_path -> no artifact"
        assert "pdb_path" not in result.data
    else:
        assert "pdb" in (result.error_message or "").lower() or "path" in (result.error_message or "").lower()

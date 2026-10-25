"""Unit tests for SPServerAdapter.

Mock mode covers the deterministic-stub path. Real mode is exercised with
``urllib.request.urlopen`` patched at the module level so no network call
is made; this lets us pin behaviour for response parsing, retries, and
the "PDB-must-come-from-ESMFold" precondition.
"""

from __future__ import annotations

import io
import json
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import URLError

import pytest

from synqlab.adapters.spserver import SPServerAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="spserver",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )


@pytest.fixture
def candidate_pdb(tmp_path: Path) -> Path:
    p = tmp_path / "candidate.pdb"
    p.write_bytes(b"HEADER stub\nATOM      1  CA  ALA A   1      0.000   0.000   0.000  1.00 80.00\n")
    return p


@pytest.fixture
def partner_pdb(tmp_path: Path) -> Path:
    p = tmp_path / "partner.pdb"
    p.write_bytes(b"HEADER partner\nATOM      1  CA  GLY B   1      1.000   0.000   0.000  1.00 70.00\n")
    return p


# ----------------------------------------------------------------------
# Mock mode
# ----------------------------------------------------------------------


def test_mock_returns_stub(tmp_path: Path, candidate_pdb: Path) -> None:
    adapter = SPServerAdapter(mock_mode=True)
    out = adapter.run(_req(
        pdb_path=str(candidate_pdb),
        artifact_dir=str(tmp_path / "art"),
    ))
    assert out.success is True
    assert out.outputs["interaction_score"] == -5.0
    raw = Path(out.outputs["raw_response_path"])
    assert raw.exists()
    payload = json.loads(raw.read_text())
    assert payload["mock_mode"] is True
    assert payload["interaction_score"] == -5.0


def test_mock_does_not_require_real_pdb(tmp_path: Path) -> None:
    """In mock mode we don't insist the PDB exists on disk."""
    adapter = SPServerAdapter(mock_mode=True)
    out = adapter.run(_req(
        pdb_path=str(tmp_path / "fake.pdb"),
        partner_pdb_path=str(tmp_path / "fake_partner.pdb"),
        artifact_dir=str(tmp_path),
    ))
    assert out.success is True
    assert out.outputs["interaction_score"] == -5.0


# ----------------------------------------------------------------------
# Input validation
# ----------------------------------------------------------------------


def test_missing_pdb_path_raises_with_helpful_message() -> None:
    adapter = SPServerAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="ESMFold"):
        adapter.run(_req())


def test_real_mode_missing_pdb_raises(tmp_path: Path) -> None:
    adapter = SPServerAdapter(mock_mode=False)
    with pytest.raises(AdapterError, match="not found"):
        adapter.run(_req(pdb_path=str(tmp_path / "nope.pdb")))


def test_real_mode_missing_partner_raises(tmp_path: Path, candidate_pdb: Path) -> None:
    adapter = SPServerAdapter(mock_mode=False)
    with pytest.raises(AdapterError, match="Partner PDB"):
        adapter.run(_req(
            pdb_path=str(candidate_pdb),
            partner_pdb_path=str(tmp_path / "ghost_partner.pdb"),
        ))


# ----------------------------------------------------------------------
# Real mode (HTTP path patched)
# ----------------------------------------------------------------------


def _fake_response(payload: dict) -> MagicMock:
    body = json.dumps(payload).encode("utf-8")
    response = MagicMock()
    response.read.return_value = body
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


def test_real_mode_extracts_known_score_keys(
    tmp_path: Path, candidate_pdb: Path, partner_pdb: Path,
) -> None:
    adapter = SPServerAdapter(mock_mode=False, retries=0)
    fake = _fake_response({"interaction_score": -7.42, "details": "ok"})
    with patch("urllib.request.urlopen", return_value=fake) as mock_open:
        out = adapter.run(_req(
            pdb_path=str(candidate_pdb),
            partner_pdb_path=str(partner_pdb),
            artifact_dir=str(tmp_path / "art"),
        ))
    assert mock_open.called
    assert out.outputs["interaction_score"] == pytest.approx(-7.42)
    raw = Path(out.outputs["raw_response_path"])
    assert raw.exists()
    saved = json.loads(raw.read_text())
    assert saved["interaction_score"] == -7.42


def test_real_mode_accepts_alternate_score_keys(
    tmp_path: Path, candidate_pdb: Path,
) -> None:
    adapter = SPServerAdapter(mock_mode=False, retries=0)
    fake = _fake_response({"score": -3.1})
    with patch("urllib.request.urlopen", return_value=fake):
        out = adapter.run(_req(
            pdb_path=str(candidate_pdb),
            artifact_dir=str(tmp_path),
        ))
    assert out.outputs["interaction_score"] == pytest.approx(-3.1)


def test_real_mode_accepts_nested_result(tmp_path: Path, candidate_pdb: Path) -> None:
    adapter = SPServerAdapter(mock_mode=False, retries=0)
    fake = _fake_response({"result": {"Z_score": -2.5}})
    with patch("urllib.request.urlopen", return_value=fake):
        out = adapter.run(_req(
            pdb_path=str(candidate_pdb),
            artifact_dir=str(tmp_path),
        ))
    assert out.outputs["interaction_score"] == pytest.approx(-2.5)


def test_real_mode_unknown_payload_raises(tmp_path: Path, candidate_pdb: Path) -> None:
    adapter = SPServerAdapter(mock_mode=False, retries=0)
    fake = _fake_response({"hello": "world"})
    with patch("urllib.request.urlopen", return_value=fake):
        with pytest.raises(AdapterError, match="did not contain"):
            adapter.run(_req(
                pdb_path=str(candidate_pdb),
                artifact_dir=str(tmp_path),
            ))


def test_real_mode_retries_then_raises(tmp_path: Path, candidate_pdb: Path) -> None:
    adapter = SPServerAdapter(mock_mode=False, retries=2, backoff=0.0)
    with patch(
        "urllib.request.urlopen",
        side_effect=URLError("dns broke"),
    ) as mock_open:
        with pytest.raises(AdapterError, match="failed after"):
            adapter.run(_req(
                pdb_path=str(candidate_pdb),
                artifact_dir=str(tmp_path),
            ))
    # 1 + retries=2 → 3 attempts
    assert mock_open.call_count == 3


def test_capabilities() -> None:
    adapter = SPServerAdapter(mock_mode=True)
    caps = adapter.capabilities()
    assert "statistical_potential_score" in caps

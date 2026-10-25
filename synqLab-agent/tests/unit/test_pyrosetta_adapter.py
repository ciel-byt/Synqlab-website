"""Unit tests for PyRosettaAdapter.

Real PyRosetta is gated behind an academic license, so all tests run in
``mock_mode=True`` (which writes a stub artifact and returns deterministic
outputs) plus a few that verify the real-mode path raises a clear
``AdapterError`` when ``pyrosetta`` is not importable. No network access
required.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from synqlab.adapters.pyrosetta import PyRosettaAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="pyrosetta",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )


@pytest.fixture
def stub_pdb(tmp_path: Path) -> Path:
    p = tmp_path / "stub.pdb"
    p.write_text("HEADER stub\nATOM      1  CA  ALA A   1      0.000   0.000   0.000  1.00 80.00\n")
    return p


# ----------------------------------------------------------------------
# Mock mode
# ----------------------------------------------------------------------


def test_mock_interface_dg_returns_stub(tmp_path: Path, stub_pdb: Path) -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    out = adapter.run(_req(
        pdb_path=str(stub_pdb), mode="interface_dg",
        chains="A_B", artifact_dir=str(tmp_path / "art"),
    ))
    assert out.success is True
    assert out.outputs["score"] == -10.0
    assert out.outputs["per_residue"] is None
    raw = Path(out.outputs["raw_output_path"])
    assert raw.exists()
    body = raw.read_text()
    assert "interface_dg" in body
    assert "A_B" in body
    assert out.metadata.get("mock_mode") is True


def test_mock_point_mutation_scan_returns_per_residue(
    tmp_path: Path, stub_pdb: Path,
) -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    out = adapter.run(_req(
        pdb_path=str(stub_pdb), mode="point_mutation_scan",
        chains="A_B", artifact_dir=str(tmp_path / "art"),
    ))
    assert out.success is True
    assert out.outputs["score"] == -10.0
    per_res = out.outputs["per_residue"]
    assert isinstance(per_res, list)
    assert len(per_res) == 16
    assert all(v == 0.0 for v in per_res)


def test_mock_writes_stub_artifact(tmp_path: Path, stub_pdb: Path) -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    art_dir = tmp_path / "artifacts"
    out = adapter.run(_req(
        pdb_path=str(stub_pdb), mode="interface_dg",
        chains="A_B", artifact_dir=str(art_dir),
    ))
    raw = Path(out.outputs["raw_output_path"])
    assert raw.parent == art_dir
    assert raw.suffix == ".txt"


def test_mock_records_latency(tmp_path: Path, stub_pdb: Path) -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    out = adapter.run(_req(
        pdb_path=str(stub_pdb), mode="interface_dg",
        chains="A_B", artifact_dir=str(tmp_path),
    ))
    assert out.latency_ms is not None
    assert out.latency_ms >= 0.0


# ----------------------------------------------------------------------
# Input validation
# ----------------------------------------------------------------------


def test_missing_pdb_path_raises() -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="pdb_path"):
        adapter.run(_req(mode="interface_dg", chains="A_B"))


def test_unknown_mode_raises(stub_pdb: Path) -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    with pytest.raises(AdapterError, match="Unsupported"):
        adapter.run(_req(pdb_path=str(stub_pdb), mode="bogus", chains="A_B"))


def test_real_mode_missing_pdb_raises(tmp_path: Path) -> None:
    adapter = PyRosettaAdapter(mock_mode=False)
    with pytest.raises(AdapterError, match="not found"):
        adapter.run(_req(
            pdb_path=str(tmp_path / "nope.pdb"),
            mode="interface_dg", chains="A_B",
        ))


def test_real_mode_without_pyrosetta_raises_clearly(stub_pdb: Path) -> None:
    """If pyrosetta isn't installed, we should surface a clear AdapterError."""
    import importlib

    adapter = PyRosettaAdapter(mock_mode=False)
    try:
        importlib.import_module("pyrosetta")
        pytest.skip("pyrosetta is installed; this test only exercises the missing-import path.")
    except ImportError:
        pass
    with pytest.raises(AdapterError, match="pyrosetta"):
        adapter.run(_req(
            pdb_path=str(stub_pdb), mode="interface_dg",
            chains="A_B",
        ))


def test_capabilities() -> None:
    adapter = PyRosettaAdapter(mock_mode=True)
    caps = adapter.capabilities()
    assert "interface_dg" in caps
    assert "point_mutation_scan" in caps

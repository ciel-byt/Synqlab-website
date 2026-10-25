"""Unit tests for FoldXAdapter — patches subprocess to avoid requiring the FoldX binary."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from synqlab.adapters.foldx import FoldXAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolRequest


def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="foldx",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )


def test_missing_pdb_path_raises() -> None:
    adapter = FoldXAdapter(binary_path="/fake/foldx")
    with pytest.raises(AdapterError, match="pdb_path"):
        adapter.run(_req())


def test_no_binary_configured_raises() -> None:
    adapter = FoldXAdapter(binary_path="")
    with pytest.raises(AdapterError, match="binary path"):
        adapter.run(_req(pdb_path="s.pdb"))


def test_binary_not_found_raises(tmp_path: Path) -> None:
    adapter = FoldXAdapter(binary_path="/nonexistent/foldx")
    with pytest.raises(AdapterError, match="not found"):
        adapter.run(_req(pdb_path=str(tmp_path / "s.pdb")))


def test_real_mode_returns_ddg(tmp_path: Path) -> None:
    """Patch _run_real to verify the adapter calls it and returns outputs correctly."""
    adapter = FoldXAdapter(binary_path="/fake/foldx")
    adapter._run_real = MagicMock(return_value={  # type: ignore[method-assign]
        "ddg": -1.2,
        "raw_output_path": str(tmp_path / "foldx_output.txt"),
    })

    pdb = tmp_path / "structure.pdb"
    pdb.write_text("ATOM ...")

    result = adapter.run(_req(pdb_path=str(pdb), artifact_dir=str(tmp_path)))
    assert result.success is True
    assert "ddg" in result.outputs
    assert isinstance(result.outputs["ddg"], float)


def test_ddg_in_plausible_range(tmp_path: Path) -> None:
    adapter = FoldXAdapter(binary_path="/fake/foldx")
    adapter._run_real = MagicMock(return_value={  # type: ignore[method-assign]
        "ddg": -1.5,
        "raw_output_path": str(tmp_path / "foldx_output.txt"),
    })
    pdb = tmp_path / "structure.pdb"
    pdb.write_text("ATOM ...")
    result = adapter.run(_req(pdb_path=str(pdb), artifact_dir=str(tmp_path)))
    assert -20.0 <= result.outputs["ddg"] <= 20.0


def test_success_flag(tmp_path: Path) -> None:
    adapter = FoldXAdapter(binary_path="/fake/foldx")
    adapter._run_real = MagicMock(return_value={  # type: ignore[method-assign]
        "ddg": 0.5,
        "raw_output_path": str(tmp_path / "foldx_output.txt"),
    })
    pdb = tmp_path / "structure.pdb"
    pdb.write_text("ATOM ...")
    result = adapter.run(_req(pdb_path=str(pdb), artifact_dir=str(tmp_path)))
    assert result.success is True

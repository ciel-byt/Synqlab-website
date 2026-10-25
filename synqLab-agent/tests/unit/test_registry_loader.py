"""Unit tests for synqlab.registry.loader and .validator."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
import yaml

from synqlab.core.exceptions import RegistryError
from synqlab.registry.loader import load_registry
from synqlab.registry.validator import validate_registry
from synqlab.core.tool_definition import ToolDefinition


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_registry(tmp_path: Path, tools: list[dict]) -> Path:
    data = {"registry_version": 1, "phase": "test", "tools": tools}
    path = tmp_path / "registry.yaml"
    path.write_text(yaml.dump(data))
    return path


MINIMAL_TOOL = {
    "id": "mock_tool",
    "name": "Mock Tool",
    "category": "test",
    "status": "active",
    "adapter": "adapters/mock.py",
    "adapter_class": "MockAdapter",
    "execution_mode": "sync",
}


# ---------------------------------------------------------------------------
# loader tests
# ---------------------------------------------------------------------------

def test_load_registry_returns_dict(tmp_path: Path) -> None:
    path = _write_registry(tmp_path, [MINIMAL_TOOL])
    tools = load_registry(str(path))
    assert isinstance(tools, dict)
    assert "mock_tool" in tools


def test_load_registry_returns_tool_definition(tmp_path: Path) -> None:
    path = _write_registry(tmp_path, [MINIMAL_TOOL])
    tools = load_registry(str(path))
    assert isinstance(tools["mock_tool"], ToolDefinition)


def test_load_registry_multiple_tools(tmp_path: Path) -> None:
    tool2 = dict(MINIMAL_TOOL, id="tool2", name="Tool Two")
    path = _write_registry(tmp_path, [MINIMAL_TOOL, tool2])
    tools = load_registry(str(path))
    assert len(tools) == 2


def test_load_registry_missing_file_raises() -> None:
    with pytest.raises(RegistryError, match="not found"):
        load_registry("/nonexistent/path/registry.yaml")


def test_load_registry_no_tools_key(tmp_path: Path) -> None:
    path = tmp_path / "bad.yaml"
    path.write_text("registry_version: 1\n")
    with pytest.raises(RegistryError, match="'tools'"):
        load_registry(str(path))


def test_load_registry_empty_tools_raises(tmp_path: Path) -> None:
    path = tmp_path / "empty.yaml"
    path.write_text("tools: []\n")
    with pytest.raises(RegistryError, match="no tools"):
        load_registry(str(path))


def test_load_registry_real_tools(tmp_path: Path) -> None:
    """Load the actual unified tools.yaml from the repo (relative path)."""
    repo_root = Path(__file__).resolve().parents[3]  # SynqLab/
    tools_path = repo_root / "registry" / "tools.yaml"
    if not tools_path.exists():
        pytest.skip("registry/tools.yaml not found; skipping integration check.")
    tools = load_registry(str(tools_path))
    # Implemented (adapter-backed) tools must all be present.
    implemented_ids = {
        "protgpt2", "omegafold", "foldx", "reranker",
        "experiment_store", "fluorescence_label_ingest",
    }
    assert implemented_ids <= set(tools.keys())
    # Catalogue tools (no adapter) must be skipped at load time.
    assert "esm2" not in tools
    assert "gromacs" not in tools


# ---------------------------------------------------------------------------
# validator tests
# ---------------------------------------------------------------------------

def test_validate_registry_passes_valid_tool() -> None:
    tool = ToolDefinition(**{k: v for k, v in MINIMAL_TOOL.items()})
    validate_registry({"mock_tool": tool})  # should not raise


def test_validate_registry_empty_raises() -> None:
    with pytest.raises(RegistryError, match="no tools"):
        validate_registry({})


def test_validate_registry_missing_name_raises() -> None:
    tool = ToolDefinition(
        id="t1", name="", category="x", status="active",
        adapter="a", adapter_class="A", execution_mode="sync"
    )
    with pytest.raises(RegistryError, match="'name'"):
        validate_registry({"t1": tool})


def test_duplicate_id_first_wins(tmp_path: Path) -> None:
    """Duplicate IDs are silently skipped — first definition wins."""
    tool_a = {**MINIMAL_TOOL, "id": "dup", "name": "First"}
    tool_b = {**MINIMAL_TOOL, "id": "dup", "name": "Second"}
    path = _write_registry(tmp_path, [tool_a, tool_b])
    registry = load_registry(str(path))
    # Only one tool with ID "dup" should exist, and it's the first one
    assert "dup" in registry
    assert registry["dup"].name == "First"

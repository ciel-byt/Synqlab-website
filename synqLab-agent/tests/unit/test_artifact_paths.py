"""Unit tests for synqlab.storage.artifact_paths."""

from __future__ import annotations

from pathlib import Path

from synqlab.storage.artifact_paths import (
    BUNDLED,
    CANDIDATES,
    FOLDX,
    FOLDING,
    PIPELINES,
    SANDBOX,
    SESSIONS,
    build_agent_artifact_path,
    build_artifact_path,
)


# ── Legacy build_artifact_path tests ─────────────────────────────────────


def test_path_structure() -> None:
    p = build_artifact_path("exp1", "round_001", "omegafold", "run-abc", "structure.pdb")
    assert p == Path("data/agent_artifacts/exp1/round_001/omegafold/run-abc/structure.pdb")


def test_custom_base_dir() -> None:
    p = build_artifact_path("e", "r", "t", "u", "f.json", base_dir="/data/synqlab/artifacts")
    # Use as_posix() for cross-platform comparison
    assert p.as_posix().startswith("/data/synqlab/artifacts")
    assert p.name == "f.json"


def test_returns_path_object() -> None:
    p = build_artifact_path("a", "b", "c", "d", "e.txt")
    assert isinstance(p, Path)


def test_components_present() -> None:
    p = build_artifact_path("myexp", "r1", "foldx", "run-001", "scores.txt")
    parts = p.parts
    assert "myexp" in parts
    assert "r1" in parts
    assert "foldx" in parts
    assert "run-001" in parts
    assert "scores.txt" in parts


# ── Agent artifact namespace constants ───────────────────────────────────


class TestNamespaceConstants:
    """Namespace constants are plain strings matching directory names."""

    def test_sessions(self) -> None:
        assert SESSIONS == "sessions"

    def test_pipelines(self) -> None:
        assert PIPELINES == "pipelines"

    def test_folding(self) -> None:
        assert FOLDING == "folding"

    def test_candidates(self) -> None:
        assert CANDIDATES == "candidates"

    def test_foldx(self) -> None:
        assert FOLDX == "foldx"

    def test_sandbox(self) -> None:
        assert SANDBOX == "sandbox"

    def test_bundled(self) -> None:
        assert BUNDLED == "bundled"


# ── build_agent_artifact_path ────────────────────────────────────────────


class TestBuildAgentArtifactPath:
    """build_agent_artifact_path joins root + namespace + sub_parts."""

    ROOT = Path("data/agent_artifacts")

    def test_namespace_only(self) -> None:
        result = build_agent_artifact_path(self.ROOT, SESSIONS)
        assert result == self.ROOT / "sessions"

    def test_session_with_id(self) -> None:
        result = build_agent_artifact_path(self.ROOT, SESSIONS, "abc-123")
        assert result == self.ROOT / "sessions" / "abc-123"

    def test_session_with_id_and_file(self) -> None:
        result = build_agent_artifact_path(self.ROOT, SESSIONS, "abc-123", "out.pdb")
        assert result == self.ROOT / "sessions" / "abc-123" / "out.pdb"

    def test_folding_engine_scoped(self) -> None:
        result = build_agent_artifact_path(self.ROOT, FOLDING, "omegafold", "hash.pdb")
        assert result == self.ROOT / "folding" / "omegafold" / "hash.pdb"

    def test_folding_esmfold(self) -> None:
        result = build_agent_artifact_path(self.ROOT, FOLDING, "esmfold", "hash.fasta")
        assert result == self.ROOT / "folding" / "esmfold" / "hash.fasta"

    def test_candidates_run_scoped(self) -> None:
        result = build_agent_artifact_path(self.ROOT, CANDIDATES, "run-42", "hash.pdb")
        assert result == self.ROOT / "candidates" / "run-42" / "hash.pdb"

    def test_pipelines_json(self) -> None:
        result = build_agent_artifact_path(self.ROOT, PIPELINES, "run-99.json")
        assert result == self.ROOT / "pipelines" / "run-99.json"

    def test_foldx_scratch(self) -> None:
        result = build_agent_artifact_path(self.ROOT, FOLDX, "abc12345")
        assert result == self.ROOT / "foldx" / "abc12345"

    def test_bundled_no_subparts(self) -> None:
        result = build_agent_artifact_path(self.ROOT, BUNDLED)
        assert result == self.ROOT / "bundled"

    def test_sandbox_no_subparts(self) -> None:
        result = build_agent_artifact_path(self.ROOT, SANDBOX)
        assert result == self.ROOT / "sandbox"

    def test_returns_path_type(self) -> None:
        result = build_agent_artifact_path(self.ROOT, SESSIONS, "x")
        assert isinstance(result, Path)

    def test_absolute_root(self) -> None:
        root = Path("/app/data/agent_artifacts")
        result = build_agent_artifact_path(root, FOLDING, "omegafold")
        assert result.as_posix() == "/app/data/agent_artifacts/folding/omegafold"

    def test_many_sub_parts(self) -> None:
        result = build_agent_artifact_path(self.ROOT, CANDIDATES, "run1", "sub", "deep.pdb")
        assert result == self.ROOT / "candidates" / "run1" / "sub" / "deep.pdb"


"""Deterministic artifact path builder for SynqLab."""

from __future__ import annotations

from pathlib import Path


def build_artifact_path(
    experiment_id: str,
    round_id: str,
    tool_id: str,
    run_id: str,
    filename: str,
    base_dir: str = "data/agent_artifacts",
) -> Path:
    """Return the canonical path for a tool-run artifact.

    Structure:
        ``<base_dir>/<experiment_id>/<round_id>/<tool_id>/<run_id>/<filename>``

    Args:
        experiment_id: Unique identifier for the experiment.
        round_id: Design round identifier (e.g. ``round_001``).
        tool_id: Registry tool ID (e.g. ``omegafold``).
        run_id: Unique run identifier (UUID).
        filename: The artifact filename (e.g. ``structure.pdb``).
        base_dir: Root artifacts directory. Defaults to ``data/agent_artifacts``.

    Returns:
        A :class:`~pathlib.Path` object. The path is **not** created on disk.
    """
    return Path(base_dir) / experiment_id / round_id / tool_id / run_id / filename


# ── Agent artifact namespaces ────────────────────────────────────────────

SESSIONS = "sessions"
PIPELINES = "pipelines"
FOLDING = "folding"
CANDIDATES = "candidates"
FOLDX = "foldx"
SANDBOX = "sandbox"
BUNDLED = "bundled"


def build_agent_artifact_path(
    artifact_root: Path,
    namespace: str,
    *sub_parts: str,
) -> Path:
    """Build canonical path under the agent artifact root.

    All agent artifact writers should use this function to construct paths
    instead of hardcoding directory layouts.  The ``namespace`` argument
    selects the top-level subdirectory (e.g. ``SESSIONS``, ``FOLDING``),
    and ``sub_parts`` drills into sub-directories or filenames.

    Examples::

        build_agent_artifact_path(root, SESSIONS, session_id, "abc.pdb")
        # → root / sessions / <session_id> / abc.pdb

        build_agent_artifact_path(root, FOLDING, "omegafold", "hash.pdb")
        # → root / folding / omegafold / hash.pdb

        build_agent_artifact_path(root, PIPELINES, f"{run_id}.json")
        # → root / pipelines / <run_id>.json

    Args:
        artifact_root: Base directory for agent artifacts
            (e.g. ``data/agent_artifacts``).
        namespace: One of the module-level namespace constants
            (``SESSIONS``, ``PIPELINES``, ``FOLDING``, etc.).
        *sub_parts: Additional path segments (identifiers, filenames).

    Returns:
        A :class:`~pathlib.Path` object.  The path is **not** created on
        disk — callers should call ``path.parent.mkdir(parents=True,
        exist_ok=True)`` before writing.
    """
    result = artifact_root / namespace
    for part in sub_parts:
        result = result / part
    return result


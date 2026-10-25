"""artifact_io — unified helpers for writing and reading adapter outputs.

Every structure-prediction adapter (OmegaFold, AlphaFold, OpenFold, …)
should use these functions so that artifact layout and formats stay
consistent across the whole system.

Layout produced per run
-----------------------
<out_dir>/
    input.fasta          — the query sequence (written by the adapter)
    <name>.pdb           — predicted 3D structure
    plddt.json           — per-residue pLDDT scores + mean
    scores.json          — arbitrary numeric scores (ΔΔG, TM-score, …)
    meta.json            — run metadata (tool, device, model, timestamps)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# pLDDT
# ---------------------------------------------------------------------------

def save_plddt(
    out_dir: Path,
    per_residue: list[float],
    *,
    mean: float | None = None,
) -> Path:
    """Write per-residue pLDDT scores to ``<out_dir>/plddt.json``.

    Args:
        out_dir:      Directory where the artifact lives.
        per_residue:  List of per-residue pLDDT values (0–100 scale).
        mean:         Pre-computed mean. Computed from *per_residue* if omitted.

    Returns:
        Path to the written file.
    """
    if mean is None:
        mean = float(sum(per_residue) / len(per_residue)) if per_residue else 0.0

    payload = {
        "mean_plddt": round(mean, 2),
        "per_residue_plddt": [round(v, 2) for v in per_residue],
    }
    path = out_dir / "plddt.json"
    path.write_text(json.dumps(payload, indent=2))
    logger.debug("pLDDT saved → %s  (mean=%.1f, n=%d)", path, mean, len(per_residue))
    return path


def load_plddt(out_dir: Path) -> dict[str, Any]:
    """Load ``<out_dir>/plddt.json``. Returns empty dict if file is absent."""
    path = out_dir / "plddt.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Generic numeric scores  (ΔΔG, TM-score, PAE, …)
# ---------------------------------------------------------------------------

def save_scores(out_dir: Path, scores: dict[str, Any]) -> Path | None:
    """Write arbitrary numeric scores to ``<out_dir>/scores.json``.

    Returns ``None`` without writing anything when *scores* is empty.
    Merges with any existing file so multiple adapters in a pipeline
    can each contribute scores to the same artifact directory.
    """
    if not scores:
        return None
    path = out_dir / "scores.json"
    existing: dict[str, Any] = {}
    if path.exists():
        try:
            existing = json.loads(path.read_text())
        except json.JSONDecodeError:
            pass
    existing.update(scores)
    path.write_text(json.dumps(existing, indent=2))
    logger.debug("Scores saved → %s  keys=%s", path, list(scores))
    return path


def load_scores(out_dir: Path) -> dict[str, Any]:
    """Load ``<out_dir>/scores.json``. Returns empty dict if file is absent."""
    path = out_dir / "scores.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Run metadata
# ---------------------------------------------------------------------------

def save_meta(
    out_dir: Path,
    tool_id: str,
    *,
    extra: dict[str, Any] | None = None,
) -> Path:
    """Write run metadata to ``<out_dir>/meta.json``.

    Always records *tool_id* and an ISO-8601 timestamp.  Pass *extra* for
    adapter-specific fields (device, model version, num_cycle, …).
    """
    payload: dict[str, Any] = {
        "tool_id": tool_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    path = out_dir / "meta.json"
    path.write_text(json.dumps(payload, indent=2))
    logger.debug("Meta saved → %s", path)
    return path


def load_meta(out_dir: Path) -> dict[str, Any]:
    """Load ``<out_dir>/meta.json``. Returns empty dict if file is absent."""
    path = out_dir / "meta.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Convenience: save everything a structure predictor produces in one call
# ---------------------------------------------------------------------------

def save_structure_outputs(
    out_dir: Path,
    *,
    tool_id: str,
    per_residue_plddt: list[float],
    mean_plddt: float | None = None,
    extra_scores: dict[str, Any] | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Path]:
    """Save all standard structure-prediction artifacts atomically.

    Returns a dict with keys ``plddt_path``, ``scores_path``, ``meta_path``
    pointing to the files that were written.

    Usage (OmegaFold, AlphaFold, OpenFold, …)::

        paths = save_structure_outputs(
            out_dir,
            tool_id="omegafold",
            per_residue_plddt=per_residue,
            meta={"device": self._device, "model_id": self._model_id},
        )
    """
    plddt_path = save_plddt(out_dir, per_residue_plddt, mean=mean_plddt)
    scores_path = save_scores(out_dir, extra_scores or {})  # None if no scores
    meta_path = save_meta(out_dir, tool_id, extra=meta)
    paths: dict[str, Path | None] = {
        "plddt_path": plddt_path,
        "scores_path": scores_path,
        "meta_path": meta_path,
    }
    return paths

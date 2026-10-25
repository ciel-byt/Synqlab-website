#!/usr/bin/env python3
"""Run OmegaFold on a single hardcoded sequence.

Install first:  bash scripts/install_omegafold.sh
Run:            python scripts/run_omegafold.py
"""

import sys
from pathlib import Path

# Make sure synqlab package is importable from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from synqlab.adapters.omegafold import OmegaFoldAdapter
from synqlab.core.schemas import ToolRequest

# ── Config ────────────────────────────────────────────────────────────────────
SEQUENCE   = "MAGAASPCANGCGPSAPSDAARLLLAALLLCLPQGRAALE"
OUT_DIR    = "data/agent_artifacts/folding/omegafold"
DEVICE     = "cpu"   # "mps" on Apple Silicon, "cuda" on Nvidia GPU
# ─────────────────────────────────────────────────────────────────────────────

adapter = OmegaFoldAdapter(device=DEVICE)

request = ToolRequest(
    tool_id="omegafold",
    inputs={"sequence": SEQUENCE, "artifact_dir": OUT_DIR},
    experiment_id="example-run",
    round_id="1",
)

print(f"Running OmegaFold on {len(SEQUENCE)}-residue sequence …")
result = adapter.run(request)

print(f"  pLDDT : {result.outputs['confidence']}")
print(f"  PDB   : {result.outputs['pdb_path']}")

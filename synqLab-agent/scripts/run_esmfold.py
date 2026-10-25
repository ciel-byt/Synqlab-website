#!/usr/bin/env python3
"""Run ESMFold on a single hardcoded sequence.

Install first:  bash scripts/install_esmfold.sh
Run:            python scripts/run_esmfold.py
"""

import sys
from pathlib import Path

# Make sure synqlab package is importable from the repo root
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from synqlab.adapters.esmfold import ESMFoldAdapter
from synqlab.core.schemas import ToolRequest

# ── Config ────────────────────────────────────────────────────────────────────
SEQUENCE   = "MAGAASPCANGCGPSAPSDAARLLLAALLLCLPQGRAALE"
OUT_DIR    = "data/agent_artifacts/folding/esmfold"
DEVICE     = "cpu"        # "mps" on Apple Silicon, "cuda" on Nvidia GPU
CHUNK_SIZE = 64           # reduce for low VRAM; set None to disable chunking
# ─────────────────────────────────────────────────────────────────────────────

adapter = ESMFoldAdapter(device=DEVICE, chunk_size=CHUNK_SIZE)

request = ToolRequest(
    tool_id="esmfold",
    inputs={"sequence": SEQUENCE, "artifact_dir": OUT_DIR},
    experiment_id="example-run",
    round_id="1",
)

print(f"Running ESMFold on {len(SEQUENCE)}-residue sequence …")
result = adapter.run(request)

print(f"  pLDDT : {result.outputs['confidence']}")
print(f"  PDB   : {result.outputs['pdb_path']}")

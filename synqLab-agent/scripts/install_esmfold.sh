#!/usr/bin/env bash
# Install ESMFold (fair-esm) and its dependencies.
#
# Usage:  bash scripts/install_esmfold.sh
#
# What this does:
#   1. Installs fair-esm from PyPI (includes ESMFold v1)
#   2. Installs OpenFold's structure utilities needed by ESMFold
#      (openfold — for atom14 coordinate handling)
#   3. Installs biotite for PDB I/O helpers
#
# Model weights (~700 MB) are downloaded automatically on first inference
# to: ~/.cache/torch/hub/facebookresearch_esm_main/
#
# Hardware notes:
#   - CPU: works, slow for sequences >150 aa
#   - Apple Silicon (MPS): set device='mps' — significant speedup
#   - Nvidia GPU (CUDA): set device='cuda' — fastest; chunk_size=128 recommended
#
# Memory:
#   - Model itself: ~2.5 GB GPU VRAM (fp32) / ~1.4 GB (fp16)
#   - Sequence length scales memory; use chunk_size to trade speed for VRAM

set -euo pipefail

# torch must exist before anything else; openfold's setup.py imports it.
echo "Checking for PyTorch …"
python3 -c "import torch" 2>/dev/null || {
    echo "  torch not found — installing CPU build …"
    uv pip install torch --index-url https://download.pytorch.org/whl/cpu -q
}

echo "Installing fair-esm and required dependencies …"
# omegaconf is a hidden runtime dep of esm.esmfold.v1 (not declared in fair-esm's setup.py)
uv pip install fair-esm omegaconf -q

echo "Installing biotite (PDB I/O) …"
uv pip install biotite -q

echo ""
echo "✓ ESMFold installed successfully."
echo "  Model weights (~700 MB) will be downloaded on first use"
echo "  to: ~/.cache/torch/hub/facebookresearch_esm_main/"
echo ""
echo "Quick test:"
echo "  python scripts/run_esmfold.py"

#!/usr/bin/env bash
# Install OmegaFold with Python 3.11+ compatibility patch.
#
# Usage:  bash scripts/install_omegafold.sh
#
# What this does:
#   1. Clones HeliXonProtein/OmegaFold
#   2. Patches setup.py to remove the Python 3.10-only version check
#      (that check only existed to pick a CUDA torch URL; we use whatever
#       torch is already installed)
#   3. Installs OmegaFold in editable mode
#
# Model weights (~700 MB) are downloaded automatically on first inference
# to ~/.cache/omegafold_ckpt/model.pt

set -euo pipefail

CLONE_DIR="${TMPDIR:-/tmp}/OmegaFold"

echo "Cloning OmegaFold…"
rm -rf "${CLONE_DIR}"
git clone --quiet https://github.com/HeliXonProtein/OmegaFold.git "${CLONE_DIR}"

echo "Patching setup.py for Python 3.11+ compatibility…"
python3 - <<'EOF'
import re, pathlib, sys

setup_path = pathlib.Path(sys.argv[1]) / "setup.py"
text = setup_path.read_text()

# Replace the entire get_url() body (only used for picking a CUDA torch URL)
text = re.sub(
    r'def get_url\(\) -> str:.*?return f".*?"',
    'def get_url() -> str:\n    return None  # torch already installed',
    text,
    flags=re.DOTALL,
)

# Remove the torch@ install_requires line (keep biopython)
text = text.replace(
    'install_requires=[\n        "biopython",\n        f"torch@{get_url()}"\n    ],',
    'install_requires=[\n        "biopython",\n    ],',
)
setup_path.write_text(text)
print("setup.py patched.")
EOF "${CLONE_DIR}"

echo "Installing OmegaFold…"
uv pip install -e "${CLONE_DIR}" -q

echo ""
echo "✓ OmegaFold installed successfully."
echo "  Model weights (~700 MB) will be downloaded automatically on first use"
echo "  to: ~/.cache/omegafold_ckpt/model.pt"
echo ""
echo "To use real mode in the UI, set mock_mode=false and device=cpu (or mps on Apple Silicon)."

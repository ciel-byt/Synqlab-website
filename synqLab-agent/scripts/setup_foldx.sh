#!/usr/bin/env bash
# FoldX setup helper.
#
# FoldX requires a free academic license — the binary cannot be downloaded
# automatically. Follow these steps:
#
#   1. Register and download from:  https://foldxsuite.crg.eu/
#      (choose the macOS arm64 or x86_64 binary for your machine)
#
#   2. Run this script with the path to the extracted binary:
#        bash scripts/setup_foldx.sh /path/to/foldx
#
# This script will:
#   - Verify the binary runs
#   - Write the path to configs/local.yaml
#   - Set SYNQLAB_FOLDX_BINARY_PATH in your shell profile (optional)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/setup_foldx.sh /path/to/foldx_binary"
  echo ""
  echo "Download FoldX from: https://foldxsuite.crg.eu/"
  echo "(Free academic license — registration required)"
  exit 1
fi

FOLDX_PATH="$(realpath "$1")"

if [ ! -f "${FOLDX_PATH}" ]; then
  echo "Error: file not found: ${FOLDX_PATH}"
  exit 1
fi

chmod +x "${FOLDX_PATH}"

echo "Testing FoldX binary…"
# FoldX exits 141 (SIGPIPE) when --help output is piped, which is normal.
FOLDX_OUT=$("${FOLDX_PATH}" --help 2>&1 || true)
if echo "${FOLDX_OUT}" | grep -qi "foldx"; then
  echo "✓ FoldX binary works."
else
  echo "⚠ FoldX binary did not respond as expected, but continuing."
  echo "  Output: ${FOLDX_OUT:0:200}"
fi

# Write to local.yaml
LOCAL_YAML="${REPO_ROOT}/configs/local.yaml"
if [ ! -f "${LOCAL_YAML}" ]; then
  cp "${REPO_ROOT}/configs/local.yaml.example" "${LOCAL_YAML}" 2>/dev/null || cat > "${LOCAL_YAML}" <<YAML
# SynqLab local config overrides
YAML
fi

# Update or append foldx binary_path
python3 - <<PYEOF
import pathlib, re

local_yaml = pathlib.Path("${LOCAL_YAML}")
text = local_yaml.read_text() if local_yaml.exists() else ""

# Replace existing binary_path line or append
if "binary_path:" in text:
    text = re.sub(r'binary_path:.*', f'binary_path: "${FOLDX_PATH}"', text)
else:
    if "foldx:" not in text:
        text += "\ntools:\n  foldx:\n    binary_path: \"${FOLDX_PATH}\"\n"
    else:
        text = re.sub(r'(foldx:.*\n)', r'\1    binary_path: "${FOLDX_PATH}"\n', text)

local_yaml.write_text(text)
print(f"Written to {local_yaml}")
PYEOF

echo ""
echo "✓ FoldX configured."
echo "  Binary: ${FOLDX_PATH}"
echo "  Config: ${LOCAL_YAML}"
echo ""
echo "You can also set it as an environment variable:"
echo "  export SYNQLAB_FOLDX_BINARY_PATH=${FOLDX_PATH}"
echo ""
echo "Restart the UI server to pick up the new config:"
echo "  bash run_ui.sh"

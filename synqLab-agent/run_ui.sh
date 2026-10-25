#!/usr/bin/env bash
# Start the SynqLab server.
# Usage:  bash run_ui.sh [--port 8000]

set -euo pipefail
PORT=${1:-8000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${SCRIPT_DIR}"

echo "Starting SynqLab on http://localhost:${PORT}"
uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --reload \
  --reload-dir synqlab --reload-dir app

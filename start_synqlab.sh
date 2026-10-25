#!/usr/bin/env bash
# start.sh — Start SynqLab backend + frontend dev server
# Usage:
#   ./start.sh          → backend on :8000, frontend dev on :5173
#   ./start.sh --prod   → backend serves built React bundle on :8000 only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$REPO_ROOT/synqLab-agent"
FRONTEND_DIR="$AGENT_DIR/frontend"

# Always use the pyenv-managed Python so conda doesn't shadow the env
# export PATH="/Users/sepehrbayat/.pyenv/shims:$PATH"
# export PYENV_VERSION=3.11.5

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  Stopping process(es) on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

cleanup() {
  echo ""
  echo "Shutting down…"
  kill_port 8000
  kill_port 5173
  echo "Done."
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
PROD=false
for arg in "$@"; do
  case $arg in
    --prod) PROD=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Free ports
# ---------------------------------------------------------------------------
echo "→ Freeing ports…"
kill_port 8000
[ "$PROD" = false ] && kill_port 5173

# ---------------------------------------------------------------------------
# Build frontend if --prod
# ---------------------------------------------------------------------------
if [ "$PROD" = true ]; then
  echo "→ Building frontend…"
  cd "$FRONTEND_DIR"
  npm run build
  cd "$REPO_ROOT"
fi

# ---------------------------------------------------------------------------
# Start backend (uvicorn with reload in dev, plain in prod)
# ---------------------------------------------------------------------------
echo "→ Starting backend on http://localhost:8000"
cd "$AGENT_DIR"
if [ "$PROD" = true ]; then
  uvicorn app.main:app --host 0.0.0.0 --port 8000 &
else
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload \
    --reload-dir "$AGENT_DIR/synqlab" --reload-dir "$AGENT_DIR/app" &
fi
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ---------------------------------------------------------------------------
# Start frontend dev server (dev mode only)
# ---------------------------------------------------------------------------
if [ "$PROD" = false ]; then
  echo "→ Starting frontend dev server on http://localhost:5173"
  cd "$FRONTEND_DIR"
  # Load nvm if npm is not in PATH (nvm installs are not visible in non-interactive shells)
  if ! command -v npm &>/dev/null; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi
  npm run dev &
  FRONTEND_PID=$!
  echo "  Frontend PID: $FRONTEND_PID"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "┌─────────────────────────────────────────────────────┐"
if [ "$PROD" = true ]; then
  echo "│  SynqLab  →  http://localhost:8000                  │"
else
  echo "│  Backend  →  http://localhost:8000  (API + WS)      │"
  echo "│  Frontend →  http://localhost:5173  (Vite dev HMR)  │"
fi
echo "│                                                     │"
echo "│  Press Ctrl+C to stop both servers                  │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

# Keep script alive so trap fires on Ctrl+C
wait

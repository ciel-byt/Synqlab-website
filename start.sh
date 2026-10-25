#!/usr/bin/env bash
# Start SynqLab locally: website + product from one server (see docs/engineering/running-locally.md).
#
#   ./start.sh                 build everything and run on http://localhost:8010
#   ./start.sh --dev           same, with auto-reload of the API code
#   ./start.sh --no-build      skip the website / frontend builds (use what is already built)
#   ./start.sh --port 8010     choose the port
#
# Needs: Docker running (Postgres), node/npm, and synqLab-agent/.venv (cd synqLab-agent && uv sync --extra server).
# Reads ./.env if present (for example X_BEARER_TOKEN for the News tab). Never commit .env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT="$ROOT/synqLab-agent"
PORT=8010
BUILD=true
DEV=false
while [ $# -gt 0 ]; do
  case "$1" in
    --dev) DEV=true ;;
    --no-build) BUILD=false ;;
    --port) PORT="${2:?--port needs a number}"; shift ;;
    -h|--help) sed -n 2,10p "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# nvm installs are not visible in non-interactive shells
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

# Secrets and overrides
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi

DB_PORT="${SYNQLAB_DB_PORT:-5545}"
export SYNQLAB_DB_URL="${SYNQLAB_DB_URL:-postgresql://synqlab:synqlab@127.0.0.1:${DB_PORT}/synqlab}"
export SYNQLAB_JWT_SECRET="${SYNQLAB_JWT_SECRET:-local-dev-secret-change-me}"
export SYNQLAB_REGISTRY_DIR="${SYNQLAB_REGISTRY_DIR:-$AGENT/deploy/helm/synqlab/files}"
export SYNQLAB_ARTIFACT_DIR="${SYNQLAB_ARTIFACT_DIR:-$ROOT/.local/artifacts}"
mkdir -p "$SYNQLAB_ARTIFACT_DIR"

# Preflight
[ -x "$AGENT/.venv/bin/python" ] || { echo "Missing $AGENT/.venv. Run: cd synqLab-agent && uv sync --extra server"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker is not running. Start Docker Desktop and try again."; exit 1; }
if lsof -ti:"$PORT" >/dev/null 2>&1; then echo "Port $PORT is already in use. Stop that process or use --port."; exit 1; fi

# Postgres (a container named synqlab-local-db, created on first run)
echo "→ Database"
if docker ps -a --format '{{.Names}}' | grep -qx synqlab-local-db; then
  docker start synqlab-local-db >/dev/null
else
  docker run -d --name synqlab-local-db -p "127.0.0.1:${DB_PORT}:5432" \
    -e POSTGRES_DB=synqlab -e POSTGRES_USER=synqlab -e POSTGRES_PASSWORD=synqlab \
    -v synqlab_local_pg:/var/lib/postgresql/data postgres:16 >/dev/null
fi
for _ in $(seq 1 30); do
  docker exec synqlab-local-db pg_isready -U synqlab >/dev/null 2>&1 && break
  sleep 1
done
docker exec synqlab-local-db pg_isready -U synqlab >/dev/null 2>&1 || { echo "Database did not start."; exit 1; }

echo "→ Migrations"
(cd "$AGENT" && .venv/bin/alembic upgrade head 2>&1 | tail -1)

if [ "$BUILD" = true ]; then
  echo "→ Building the website"
  (cd "$ROOT/website" && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run build >/dev/null)
  rm -rf "$AGENT/app/static/site" && cp -R "$ROOT/website/dist" "$AGENT/app/static/site"
  echo "→ Building the product frontend"
  (cd "$AGENT/frontend" && { [ -d node_modules ] || npm ci --include=optional --no-audit --no-fund; } && npx vite build >/dev/null)
fi

echo ""
echo "  SynqLab  →  http://localhost:${PORT}        (website at /, product at /login)"
[ -n "${X_BEARER_TOKEN:-}" ] && echo "  News     →  X token found in .env" || echo "  News     →  no X_BEARER_TOKEN set, the News tab will be empty"
echo "  Ctrl+C to stop"
echo ""

cd "$AGENT"
if [ "$DEV" = true ]; then
  exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --reload --reload-dir synqlab --reload-dir app
else
  exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
fi

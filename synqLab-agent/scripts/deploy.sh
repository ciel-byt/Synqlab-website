#!/usr/bin/env bash
# SynqLab V1 deployment and smoke-test script.
#
# Usage:  bash scripts/deploy.sh
#
# Steps:
#   1. Create required directories
#   2. Start PostgreSQL container (docker compose up -d db)
#   3. Wait for DB to become healthy (max 30 s)
#   4. Validate registry
#   5. Initialise DB tables
#   6. Run all unit tests
#   7. Run one smoke experiment in mock mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

echo "===== SynqLab V1 Deploy ====="
echo "Working directory: ${REPO_ROOT}"

# ── 1. Create required directories ──────────────────────────────────────────
echo ""
echo "Step 1: Creating directories..."
mkdir -p artifacts/reranker
touch artifacts/.gitkeep

# ── 2. Start PostgreSQL container ───────────────────────────────────────────
echo ""
echo "Step 2: Starting PostgreSQL container..."
docker compose up -d db

# ── 3. Wait for DB ──────────────────────────────────────────────────────────
echo ""
echo "Step 3: Waiting for DB to become healthy (max 30 s)..."
MAX_WAIT=30
WAITED=0
until docker compose exec -T db pg_isready -U synqlab -d synqlab >/dev/null 2>&1; do
    if [ "${WAITED}" -ge "${MAX_WAIT}" ]; then
        echo "ERROR: DB did not become healthy within ${MAX_WAIT} seconds."
        exit 1
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done
echo "DB is healthy (waited ${WAITED}s)."

# ── 4. Validate registry ─────────────────────────────────────────────────────
echo ""
echo "Step 4: Validating registry..."
python -c "
from synqlab.registry.loader import load_registry
tools = load_registry('../registry/tools.yaml')
print(f'  Loaded {len(tools)} tools: {list(tools.keys())}')
"

# ── 5. Initialise DB tables ──────────────────────────────────────────────────
echo ""
echo "Step 5: Initialising DB tables..."
python -m synqlab.storage.db

# ── 6. Run unit tests ────────────────────────────────────────────────────────
echo ""
echo "Step 6: Running unit tests..."
pytest tests/unit/ -q

# ── 7. Smoke experiment in mock mode ────────────────────────────────────────
echo ""
echo "Step 7: Running smoke experiment (mock mode)..."
python -m synqlab.orchestrator.pipeline --config configs/base.yaml

echo ""
echo "===== SynqLab V1 Deploy COMPLETE ====="

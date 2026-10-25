# syntax=docker/dockerfile:1.7

# ─── Stage 1: Build the React frontend ────────────────────────
# Use full node image (not slim) — Vite 8 uses rolldown which needs
# native bindings + libc++ that slim images don't include.
FROM node:22 AS frontend-build

WORKDIR /app/frontend

# Cache `npm ci` on package files only — source changes don't bust this layer.
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=optional --no-audit --no-fund

COPY frontend/ ./

# Create the output directory that vite.config.ts expects (../app/static/dist).
RUN mkdir -p /app/app/static/dist

# Skip tsc type-checking in Docker (just build with vite — typing is enforced
# locally and in CI; the Docker build only needs the JS bundle).
RUN npx vite build


# ─── Stage 2: Python API server ───────────────────────────────
FROM python:3.12-slim AS api

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1

# System deps for psycopg2-binary + curl for healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (pinned by image digest in upstream; using `latest` keeps us
# tracking astral-sh's stable release).
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Create the non-root runtime user that matches the chart's
# podSecurityDefaults (runAsUser / runAsGroup / fsGroup = 1000).
# Baking it in here gives `kubectl exec` a real /etc/passwd entry
# (no more "I have no name!") and lets alembic write __pycache__
# and future migration files without needing root at runtime.
RUN groupadd --system --gid 1000 synqlab \
    && useradd  --system --uid 1000 --gid 1000 \
    --home /home/synqlab --create-home \
    --shell /bin/bash synqlab

WORKDIR /app

# Copy project metadata + source for install (as root, so pip can
# write site-packages; we'll drop privileges at the end).
COPY pyproject.toml ./
RUN mkdir -p synqlab app \
    && printf '' > synqlab/__init__.py \
    && printf '' > app/__init__.py \
    && uv pip install --no-cache --system ".[ml,server]"

# ── Source layer ────────────────────────────────────────────────
COPY synqlab/ ./synqlab/
COPY app/ ./app/
COPY configs/ ./configs/
COPY scripts/ ./scripts/

# Alembic config + migration scripts (needed by the CI `migrate` job,
# which invokes `alembic upgrade head` with /app as the working dir).
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Re-register the project source (deps already installed above at line 61).
RUN uv pip install --no-cache --system --no-deps .

# Copy the built frontend into the location the FastAPI server expects.
COPY --from=frontend-build /app/app/static/dist/ ./app/static/dist/

# Bundled PDB samples are volume-mounted from data/agent_artifacts/bundled
# at runtime (docker-compose.yml). No COPY needed.

# Create directories the app expects, then hand everything the
# runtime will touch over to the synqlab user. /registry stays
# world-readable (it's a ConfigMap mount at runtime anyway).
RUN mkdir -p /app/data/agent_artifacts/bundled /app/data/user_media/avatars /app/data/models /app/data/knowledge /registry \
    && chown -R synqlab:synqlab /app /home/synqlab

EXPOSE 8000

# Same probe used by the compose `healthcheck:` block and the helm chart.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

# Ship the image as non-root so the default `kubectl exec` /
# `kubectl run` UID matches the deployed pod (1000) and Alembic can
# write __pycache__ + new revision files without privilege escalation.
USER synqlab
ENV HOME=/home/synqlab

# Run the FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

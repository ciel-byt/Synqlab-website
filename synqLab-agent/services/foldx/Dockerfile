# ─── FoldX Scoring Service ───────────────────────────────────────
# NOTE: FoldX requires a free academic license binary.
# The binary must be mounted or copied into /opt/foldx/foldx
# Download from: https://foldxsuite.crg.eu/
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies
COPY services/foldx/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Copy shared library code
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/foldx/ ./services/foldx/

# Create directories
RUN mkdir -p artifacts /opt/foldx

EXPOSE 8003

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

CMD ["uvicorn", "services.foldx.serve:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "1"]

# ─── Brightness Scoring Service ──────────────────────────────────
# ESM-2 embeddings + trained sklearn classifier for GFP11 brightness.
# Model weights must be available at SYNQLAB_BRIGHTNESS_MODEL_PATH.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies
COPY services/brightness/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Copy shared library code
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/brightness/ ./services/brightness/

# Create directories
RUN mkdir -p artifacts models

EXPOSE 8007

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8007/health || exit 1

CMD ["uvicorn", "services.brightness.serve:app", "--host", "0.0.0.0", "--port", "8007", "--workers", "1"]

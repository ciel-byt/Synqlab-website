# ─── Reranker Scoring Service ────────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies
COPY services/reranker/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Copy shared library code
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/reranker/ ./services/reranker/

# Create artifacts dir (reranker model.pkl will be loaded from shared volume)
RUN mkdir -p artifacts/reranker

EXPOSE 8004

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8004/health || exit 1

CMD ["uvicorn", "services.reranker.serve:app", "--host", "0.0.0.0", "--port", "8004", "--workers", "1"]

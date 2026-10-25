# ─── ProtGPT2 Inference Service ──────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies
COPY services/protgpt2/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Copy shared library code (adapters, schemas, core)
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/protgpt2/ ./services/protgpt2/

# Create artifacts dir
RUN mkdir -p artifacts

# HuggingFace cache for model weights
ENV HOME=/app
ENV HF_HOME=/app/.cache/huggingface
RUN mkdir -p ${HF_HOME} && chmod -R 777 /app/.cache \
    && echo "appuser:x:1000:1000::/app:/bin/sh" >> /etc/passwd

EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "services.protgpt2.serve:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]

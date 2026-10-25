# ─── OmegaFold Inference Service ─────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies
COPY services/omegafold/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Install OmegaFold from source with Python 3.11+ patch
COPY scripts/patch_omegafold.py /tmp/patch_omegafold.py
RUN git clone --quiet https://github.com/HeliXonProtein/OmegaFold.git /tmp/OmegaFold \
    && python3 /tmp/patch_omegafold.py /tmp/OmegaFold \
    && uv pip install --system /tmp/OmegaFold -q \
    && python3 -c "import omegafold; print('omegafold OK')"

# Copy shared library code
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/omegafold/ ./services/omegafold/

# Use /app as HOME so ~/.cache is writable (GKE runs as non-root)
ENV HOME=/app

# Create directories (chmod for GKE non-root UID)
RUN mkdir -p artifacts /app/.cache/omegafold_ckpt \
    && chmod -R 777 /app/.cache \
    && echo "appuser:x:1000:1000::/app:/bin/sh" >> /etc/passwd

EXPOSE 8002

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

CMD ["uvicorn", "services.omegafold.serve:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "1"]

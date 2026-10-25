# ─── ESMFold Inference Service ─────────────────────────────────
FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies (CPU-only torch for inference)
COPY services/esmfold/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Remove deepspeed — it's incompatible with PyTorch 2.x (uses removed torch._six)
# openfold only optionally checks for it; removing it is safe
RUN uv pip uninstall --system deepspeed && echo "deepspeed removed" || echo "deepspeed not found, skipping"

# Install dllogger (openfold runtime dep)
RUN uv pip install --no-cache-dir --system 'dllogger @ git+https://github.com/NVIDIA/dllogger.git'

# Install openfold — the official fair-esm README pins this exact commit:
# https://github.com/facebookresearch/esm#getting-started-with-this-repo
# Normal install requires nvcc (CUDA), so we clone + PYTHONPATH for CPU-only.
RUN git clone --quiet https://github.com/aqlaboratory/openfold.git /opt/openfold \
    && cd /opt/openfold && git checkout 4b41059694619831a7db195b7e0988fc4ff3a307

# Patch openfold to skip CUDA kernel import (we're CPU-only)
COPY services/esmfold/patch_openfold.py /tmp/patch_openfold.py
RUN python /tmp/patch_openfold.py \
    && PYTHONPATH=/opt/openfold python -c "import esm; print('esm import OK')"
ENV PYTHONPATH="${PYTHONPATH}:/opt/openfold"

# Copy shared library code
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/esmfold/ ./services/esmfold/

# Use /app as HOME so ~/.cache is writable (GKE runs as non-root)
ENV HOME=/app

# Create directories (chmod for GKE non-root UID)
RUN mkdir -p artifacts /app/.cache/torch/hub \
    && chmod -R 777 /app/.cache \
    && echo "appuser:x:1000:1000::/app:/bin/sh" >> /etc/passwd

EXPOSE 8005

HEALTHCHECK --interval=30s --timeout=10s --start-period=600s --retries=3 \
    CMD curl -f http://localhost:8005/health || exit 1

CMD ["uvicorn", "services.esmfold.serve:app", "--host", "0.0.0.0", "--port", "8005", "--workers", "1"]

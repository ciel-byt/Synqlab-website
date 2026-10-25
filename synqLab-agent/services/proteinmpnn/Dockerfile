# ─── ProteinMPNN Inverse Folding Service ──────────────────────
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python dependencies
COPY services/proteinmpnn/requirements.txt /tmp/requirements.txt
RUN uv pip install --no-cache-dir --system -r /tmp/requirements.txt

# Clone ProteinMPNN repo — includes weights (~25 MB total for all variants)
RUN git clone --depth 1 https://github.com/dauparas/ProteinMPNN.git /app/proteinmpnn

# Copy shared library code (adapters, schemas, core)
COPY synqlab/ ./synqlab/
COPY services/model_service.py ./services/model_service.py
COPY services/__init__.py ./services/__init__.py
COPY services/proteinmpnn/ ./services/proteinmpnn/

# Create artifacts dir
RUN mkdir -p artifacts

ENV HOME=/app
ENV SYNQLAB_PROTEINMPNN_DIR=/app/proteinmpnn
RUN echo "appuser:x:1000:1000::/app:/bin/sh" >> /etc/passwd

EXPOSE 8006

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8006/health || exit 1

CMD ["uvicorn", "services.proteinmpnn.serve:app", "--host", "0.0.0.0", "--port", "8006", "--workers", "1"]

"""ProtGPT2 microservice entrypoint.

Usage (inside container):
    uvicorn services.protgpt2.serve:app --host 0.0.0.0 --port 8001
"""

import os
import sys

# Ensure the repo root is on sys.path so `synqlab.*` imports work.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.protgpt2 import ProtGPT2Adapter

app = create_model_app(
    adapter_class=ProtGPT2Adapter,
    adapter_kwargs={
        "device": os.environ.get("DEVICE", "cuda"),
    },
    model_name="ProtGPT2",
    port=8001,
)

"""ProteinMPNN microservice entrypoint.

Usage (inside container):
    uvicorn services.proteinmpnn.serve:app --host 0.0.0.0 --port 8006
"""

import os
import sys

# Ensure the repo root is on sys.path so `synqlab.*` imports work.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.proteinmpnn import ProteinMPNNAdapter

app = create_model_app(
    adapter_class=ProteinMPNNAdapter,
    adapter_kwargs={
        "device": os.environ.get("DEVICE", "cpu"),
        "proteinmpnn_dir": os.environ.get("SYNQLAB_PROTEINMPNN_DIR", "/app/proteinmpnn"),
    },
    model_name="ProteinMPNN",
    port=8006,
)

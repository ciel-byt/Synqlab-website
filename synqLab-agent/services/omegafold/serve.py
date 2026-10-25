"""OmegaFold microservice entrypoint.

Usage (inside container):
    uvicorn services.omegafold.serve:app --host 0.0.0.0 --port 8002 
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.omegafold import OmegaFoldAdapter

app = create_model_app(
    adapter_class=OmegaFoldAdapter,
    adapter_kwargs={
        "device": os.environ.get("DEVICE", "cuda"),
    },
    model_name="OmegaFold",
    port=8002,
    eager_load=True,  # Pre-load weights on startup, not on first reques
)

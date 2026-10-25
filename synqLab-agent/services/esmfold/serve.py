"""ESMFold microservice entrypoint.

Usage (inside container):
    uvicorn services.esmfold.serve:app --host 0.0.0.0 --port 8005
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.esmfold import ESMFoldAdapter

app = create_model_app(
    adapter_class=ESMFoldAdapter,
    adapter_kwargs={
        "device": os.environ.get("DEVICE", "cuda"),
        "chunk_size": int(os.environ.get("CHUNK_SIZE", "64")),
    },
    model_name="ESMFold",
    port=8005,
    eager_load=True,  # Pre-load model on startup (~2.5 GB)
)

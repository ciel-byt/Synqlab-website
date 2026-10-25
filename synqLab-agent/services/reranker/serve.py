"""Reranker microservice entrypoint.

Usage (inside container):
    uvicorn services.reranker.serve:app --host 0.0.0.0 --port 8004
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.reranker import RerankerAdapter

app = create_model_app(
    adapter_class=RerankerAdapter,
    adapter_kwargs={
        "model_path": os.environ.get(
            "SYNQLAB_RERANKER_MODEL_PATH", "data/models/reranker/model.pkl"
        ),
    },
    model_name="Reranker",
    port=8004,
)

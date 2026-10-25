"""FoldX microservice entrypoint.

Usage (inside container):
    uvicorn services.foldx.serve:app --host 0.0.0.0 --port 8003
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.foldx import FoldXAdapter

app = create_model_app(
    adapter_class=FoldXAdapter,
    adapter_kwargs={
        "binary_path": os.environ.get("SYNQLAB_FOLDX_BINARY_PATH", ""),
    },
    model_name="FoldX",
    port=8003,
)

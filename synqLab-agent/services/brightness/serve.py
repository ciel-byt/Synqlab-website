"""Brightness model microservice entrypoint.

Usage (inside container):
    uvicorn services.brightness.serve:app --host 0.0.0.0 --port 8007
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from services.model_service import create_model_app
from synqlab.adapters.brightness_model import BrightnessModelAdapter

app = create_model_app(
    adapter_class=BrightnessModelAdapter,
    adapter_kwargs={
        "model_path": os.environ.get("SYNQLAB_BRIGHTNESS_MODEL_PATH", ""),
    },
    model_name="BrightnessModel",
    port=8007,
)

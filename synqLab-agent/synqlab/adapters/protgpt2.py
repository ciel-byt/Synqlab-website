"""ProtGPT2Adapter — unconditional protein sequence generator."""

from __future__ import annotations

import logging
from typing import Any

from synqlab.adapters.base import BaseAdapter
from synqlab.core.exceptions import AdapterError
from synqlab.core.schemas import ToolOutput, ToolRequest

logger = logging.getLogger(__name__)


class ProtGPT2Adapter(BaseAdapter):
    """Adapter for the ProtGPT2 sequence generation model.

    Loads the HuggingFace ``nferruz/ProtGPT2`` model and runs
    text-generation inference. Model weights are downloaded automatically
    on first use (~1.5 GB to ~/.cache/huggingface/).
    """

    MODEL_NAME = "nferruz/ProtGPT2"

    def __init__(
        self,
        model_name: str = MODEL_NAME,
        device: str = "cpu",
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._model_name = model_name
        self._device = device
        self._pipeline: Any = None

    def _load_model(self) -> None:
        try:
            from transformers import pipeline  # type: ignore[import]

            self._pipeline = pipeline(
                "text-generation",
                model=self._model_name,
                device=self._device,
            )
            logger.info("ProtGPT2 model loaded on device '%s'.", self._device)
        except ImportError as exc:
            raise AdapterError(
                "transformers or huggingface-hub is not installed. "
                "Run: uv pip install 'transformers>=4.40' 'huggingface-hub>=0.20'"
            ) from exc
        except Exception as exc:
            msg = str(exc)
            if "huggingface-hub" in msg and "required" in msg:
                raise AdapterError(
                    "HuggingFace Hub version conflict. "
                    "Run: uv pip install 'transformers>=4.40' 'huggingface-hub>=0.20' --upgrade"
                ) from exc
            raise AdapterError(f"Failed to load ProtGPT2 model: {exc}") from exc

    def run(self, request: ToolRequest) -> ToolOutput:
        n_sequences: int = int(request.inputs.get("n_sequences", 10))
        max_length: int = int(request.inputs.get("max_length", 100))
        temperature: float = float(request.inputs.get("temperature", 1.0))

        if self._pipeline is None:
            self._load_model()

        try:
            # Use max_new_tokens (not the deprecated max_length) so our cap
            # actually wins — otherwise HF's pipeline applies its own default
            # of max_new_tokens=256 on top of our max_length, generating far
            # longer sequences than requested and inflating CPU time.
            raw = self._pipeline(
                "<|endoftext|>",
                max_new_tokens=max_length,
                do_sample=True,
                temperature=temperature,
                num_return_sequences=n_sequences,
                return_full_text=False,
            )
            sequences = [r["generated_text"].strip() for r in raw]
        except Exception as exc:
            raise AdapterError(f"ProtGPT2 inference failed: {exc}") from exc

        metadata = {"model": self._model_name, "temperature": temperature}
        return ToolOutput(
            tool_id=request.tool_id,
            outputs={"sequences": sequences, "generation_metadata": metadata},
            success=True,
        )

    def capabilities(self) -> list[str]:
        return ["sequence_generation", "diverse_sampling"]

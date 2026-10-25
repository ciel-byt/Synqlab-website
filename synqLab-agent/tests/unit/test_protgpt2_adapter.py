"""Unit tests for ProtGPT2Adapter — patches the HuggingFace pipeline to avoid model downloads."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from synqlab.adapters.protgpt2 import ProtGPT2Adapter
from synqlab.core.schemas import ToolRequest


def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="protgpt2",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )


def _make_adapter_with_mock_pipeline(n: int = 5) -> ProtGPT2Adapter:
    """Return a ProtGPT2Adapter with the HuggingFace pipeline pre-patched."""
    adapter = ProtGPT2Adapter()
    fake_output = [{"generated_text": f"ACDEFGHIK_{i}"} for i in range(n)]
    adapter._pipeline = MagicMock(return_value=fake_output)
    return adapter


def test_returns_correct_n_sequences() -> None:
    adapter = _make_adapter_with_mock_pipeline(n=7)
    result = adapter.run(_req(n_sequences=7, max_length=20))
    assert len(result.outputs["sequences"]) == 7


def test_sequences_are_strings() -> None:
    adapter = _make_adapter_with_mock_pipeline(n=3)
    result = adapter.run(_req(n_sequences=3, max_length=30))
    for seq in result.outputs["sequences"]:
        assert isinstance(seq, str)


def test_generation_metadata_present() -> None:
    adapter = _make_adapter_with_mock_pipeline(n=1)
    result = adapter.run(_req(n_sequences=1))
    assert "generation_metadata" in result.outputs
    meta = result.outputs["generation_metadata"]
    assert "model" in meta
    assert "temperature" in meta


def test_success_flag() -> None:
    adapter = _make_adapter_with_mock_pipeline(n=2)
    result = adapter.run(_req(n_sequences=2))
    assert result.success is True


def test_pipeline_called_with_correct_args() -> None:
    adapter = _make_adapter_with_mock_pipeline(n=3)
    adapter.run(_req(n_sequences=3, max_length=50, temperature=0.8))
    call_kwargs = adapter._pipeline.call_args[1]
    assert call_kwargs["num_return_sequences"] == 3
    # max_new_tokens replaces the deprecated max_length so HF doesn't apply
    # its own max_new_tokens=256 default on top of our cap.
    assert call_kwargs["max_new_tokens"] == 50
    assert "max_length" not in call_kwargs
    assert call_kwargs["temperature"] == 0.8

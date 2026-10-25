"""Agent package -- agentic AI system for SynqLab.

Multi-provider LLM abstraction with pluggable backends
(OpenAI, Anthropic, Mock), pipeline-first tool execution engine,
CandidateTracker, and async streaming engine.
"""

from synqlab.agent.provider import (
    AnthropicProvider,
    LLMProvider,
    MockLLMProvider,
    OpenAIProvider,
    ProviderResponse,
    ScriptedTurn,
    ToolCall,
)

# Pipeline-first architecture (Phase 23)
from synqlab.agent.pipeline import (
    PipelineDefinition,
    PipelineEngine,
    PipelineEventType,
    PipelineNode,
    PIPELINE_TEMPLATES,
)
from synqlab.agent.tracker import (
    CandidateTracker,
    PipelineCandidate,
)

__all__ = [
    # Provider layer (Phase 16)
    "AnthropicProvider",
    "LLMProvider",
    "MockLLMProvider",
    "OpenAIProvider",
    "ProviderResponse",
    "ScriptedTurn",
    "ToolCall",
    # Pipeline-first architecture (Phase 23)
    "PipelineDefinition",
    "PipelineEngine",
    "PipelineEventType",
    "PipelineNode",
    "PIPELINE_TEMPLATES",
    "CandidateTracker",
    "PipelineCandidate",
]

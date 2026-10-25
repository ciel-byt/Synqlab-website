"""Tests for the pipeline DAG engine."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from synqlab.agent.pipeline import (
    PipelineDefinition,
    PipelineEngine,
    PipelineEventType,
    PipelineNode,
    PIPELINE_TEMPLATES,
)


class TestPipelineDefinition:
    def test_empty_pipeline_errors(self):
        defn = PipelineDefinition(nodes=[])
        errors = defn.validate()
        assert any("no nodes" in e.lower() for e in errors)

    def test_valid_linear_pipeline(self):
        defn = PipelineDefinition(nodes=[
            PipelineNode(id="a", tool_name="tool_a", parameters={}),
            PipelineNode(id="b", tool_name="tool_b", parameters={}, depends_on=["a"]),
        ])
        assert defn.validate() == []

    def test_unknown_dependency(self):
        defn = PipelineDefinition(nodes=[
            PipelineNode(id="a", tool_name="tool_a", parameters={}, depends_on=["nonexistent"]),
        ])
        errors = defn.validate()
        assert any("nonexistent" in e for e in errors)

    def test_cycle_detection(self):
        defn = PipelineDefinition(nodes=[
            PipelineNode(id="a", tool_name="t", parameters={}, depends_on=["b"]),
            PipelineNode(id="b", tool_name="t", parameters={}, depends_on=["a"]),
        ])
        errors = defn.validate()
        assert any("cycle" in e.lower() for e in errors)

    def test_topological_sort_waves(self):
        defn = PipelineDefinition(nodes=[
            PipelineNode(id="a", tool_name="t", parameters={}),
            PipelineNode(id="b", tool_name="t", parameters={}),
            PipelineNode(id="c", tool_name="t", parameters={}, depends_on=["a", "b"]),
        ])
        waves = defn.topological_sort()
        assert len(waves) == 2
        wave0_ids = {n.id for n in waves[0]}
        assert wave0_ids == {"a", "b"}
        assert waves[1][0].id == "c"

    def test_round_trip(self):
        defn = PipelineDefinition(
            name="Test",
            nodes=[PipelineNode(id="n1", tool_name="t", parameters={"x": 1})],
        )
        d = defn.to_dict()
        restored = PipelineDefinition.from_dict(d)
        assert restored.name == "Test"
        assert restored.nodes[0].parameters == {"x": 1}


class TestPipelineTemplates:
    def test_templates_exist(self):
        assert "gfp11" in PIPELINE_TEMPLATES
        assert "design" in PIPELINE_TEMPLATES
        assert "screening" in PIPELINE_TEMPLATES

    def test_templates_valid(self):
        for name, factory in PIPELINE_TEMPLATES.items():
            defn = factory()
            errors = defn.validate()
            assert errors == [], f"Template '{name}' has errors: {errors}"


class TestPipelineEngine:
    @pytest.mark.asyncio
    async def test_mock_execution(self):
        """Pipeline runs with mock tools provided via registry."""
        # Create a mock tool that returns success
        mock_result = MagicMock()
        mock_result.is_success = True
        mock_result.data = {"output": "test_value"}
        
        mock_tool = MagicMock()
        mock_tool.call = AsyncMock(return_value=mock_result)
        
        defn = PipelineDefinition(nodes=[
            PipelineNode(id="a", tool_name="tool_a", parameters={"x": 1}),
        ])
        engine = PipelineEngine(
            definition=defn,
            tool_registry={"tool_a": mock_tool},
        )
        events = []
        async for event in engine.execute():
            events.append(event)

        types = [e.type for e in events]
        assert PipelineEventType.PIPELINE_STARTED in types
        assert PipelineEventType.NODE_COMPLETED in types
        assert PipelineEventType.PIPELINE_DONE in types
        
        # Verify the tool was called
        mock_tool.call.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalid_pipeline_fails(self):
        defn = PipelineDefinition(nodes=[])
        engine = PipelineEngine(definition=defn)
        events = []
        async for event in engine.execute():
            events.append(event)

        assert events[0].type == PipelineEventType.PIPELINE_DONE
        assert events[0].data["status"] == "failed"

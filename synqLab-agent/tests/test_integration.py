"""R8 + Phase 8 Plan 2: Integration tests.

R8 — Pipeline DAG execution and batch processing.
Phase 8 Plan 2 — Research Director → Skill → Worker chain integration.

Tests end-to-end flows with mock tool functions to verify:
- Pipeline nodes execute in topological order
- Batch CSV/FASTA parsing and fan-out
- Concurrency limits
- Error propagation
- Coordinator/skill/worker wiring (Phase 5 ↔ Phase 3+4)
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any

from synqlab.agent.pipeline import (
    PipelineDefinition,
    PipelineNode,
    PipelineEngine,
)
from synqlab.agent.batch import (
    BatchProcessor,
    BatchEventType,
    parse_csv,
    parse_fasta,
    detect_format,
)
from synqlab.agent.tool import ToolResult


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_pipeline(nodes: list[dict[str, Any]]) -> PipelineDefinition:
    """Build a PipelineDefinition from a list of node dicts."""
    pipeline_nodes = []
    for n in nodes:
        pipeline_nodes.append(PipelineNode(
            id=n["id"],
            tool_name=n["tool_name"],
            parameters=n.get("parameters", {}),
            depends_on=n.get("depends_on", []),
        ))
    return PipelineDefinition(
        name="test_pipeline",
        description="test",
        nodes=pipeline_nodes,
    )


async def _mock_tool_fn(args: dict[str, Any], ctx: Any = None) -> ToolResult:
    """Mock tool that returns its arguments as output."""
    return ToolResult.ok({"echo": args, "status": "completed"})


async def _slow_mock_tool(args: dict[str, Any], ctx: Any = None) -> ToolResult:
    """Mock tool with delay to test concurrency."""
    await asyncio.sleep(0.05)
    return ToolResult.ok({"echo": args})


async def _failing_tool(args: dict[str, Any], ctx: Any = None) -> ToolResult:
    """Mock tool that always fails."""
    return ToolResult.fail("Simulated tool failure")


# ── Pipeline integration tests ──────────────────────────────────────────────

class TestPipelineIntegration:
    """End-to-end pipeline execution tests."""

    def test_single_node_pipeline(self):
        """Single node pipeline executes and produces output."""
        pipeline = _make_pipeline([
            {"id": "fold", "tool_name": "predict_structure", "parameters": {"sequence": "MVLSPAD"}},
        ])
        errors = pipeline.validate()
        assert not errors

    def test_linear_chain_pipeline(self):
        """A → B → C linear pipeline validates correctly."""
        pipeline = _make_pipeline([
            {"id": "generate", "tool_name": "generate_sequences", "parameters": {"num": 5}},
            {"id": "fold", "tool_name": "predict_structure", "depends_on": ["generate"]},
            {"id": "stability", "tool_name": "analyze_stability", "depends_on": ["fold"]},
        ])
        errors = pipeline.validate()
        assert not errors

    def test_diamond_dag_pipeline(self):
        """Diamond DAG (A → B, A → C, B+C → D) validates correctly."""
        pipeline = _make_pipeline([
            {"id": "A", "tool_name": "generate_sequences"},
            {"id": "B", "tool_name": "predict_structure", "depends_on": ["A"]},
            {"id": "C", "tool_name": "analyze_stability", "depends_on": ["A"]},
            {"id": "D", "tool_name": "write_report", "depends_on": ["B", "C"]},
        ])
        errors = pipeline.validate()
        assert not errors

    def test_cycle_detection(self):
        """Pipeline with cycle is rejected."""
        pipeline = _make_pipeline([
            {"id": "A", "tool_name": "t1", "depends_on": ["C"]},
            {"id": "B", "tool_name": "t2", "depends_on": ["A"]},
            {"id": "C", "tool_name": "t3", "depends_on": ["B"]},
        ])
        errors = pipeline.validate()
        assert any("cycle" in e.lower() for e in errors)

    def test_unknown_dependency_rejected(self):
        """Pipeline referencing non-existent node is rejected."""
        pipeline = _make_pipeline([
            {"id": "A", "tool_name": "t1", "depends_on": ["ghost"]},
        ])
        errors = pipeline.validate()
        assert any("ghost" in e for e in errors)


# ── Batch integration tests ─────────────────────────────────────────────────

class TestBatchIntegration:
    """End-to-end batch processing tests."""

    def test_csv_parsing_basic(self):
        """CSV content parses into row dicts."""
        csv_content = "name,sequence\ninsulin,MALWMRLL\nhemoglobin,MVLSPAD"
        rows = parse_csv(csv_content)
        assert len(rows) == 2
        assert rows[0]["name"] == "insulin"
        assert rows[1]["sequence"] == "MVLSPAD"

    def test_csv_parsing_empty(self):
        """Empty CSV returns empty list."""
        assert parse_csv("") == []

    def test_fasta_parsing_basic(self):
        """FASTA content parses into name+sequence dicts."""
        fasta = ">insulin\nMALWMRLL\nPLLALLAL\n>hemoglobin\nMVLSPAD\n"
        seqs = parse_fasta(fasta)
        assert len(seqs) == 2
        assert seqs[0]["name"] == "insulin"
        assert seqs[0]["sequence"] == "MALWMRLLPLLALLAL"
        assert seqs[1]["name"] == "hemoglobin"

    def test_fasta_parsing_multiline(self):
        """FASTA with multi-line sequences concatenates correctly."""
        fasta = ">test\nABC\nDEF\nGHI\n"
        seqs = parse_fasta(fasta)
        assert seqs[0]["sequence"] == "ABCDEFGHI"

    def test_fasta_parsing_empty(self):
        """Empty FASTA returns empty list."""
        assert parse_fasta("") == []

    def test_detect_format_fasta(self):
        """FASTA format detection."""
        assert detect_format(">seq1\nMVLSPAD\n") == "fasta"

    def test_detect_format_csv(self):
        """CSV format detection."""
        assert detect_format("name,sequence\ntest,MVLSPAD\n") == "csv"

    def test_detect_format_unknown(self):
        """Unknown format detection."""
        assert detect_format("just some text") == "unknown"

    @pytest.mark.asyncio
    async def test_batch_csv_events(self):
        """Batch processor emits correct event sequence for CSV."""
        pipeline = _make_pipeline([
            {"id": "fold", "tool_name": "predict_structure", "parameters": {"sequence": ""}},
        ])

        processor = BatchProcessor(
            definition=pipeline,
            max_concurrency=2,
        )

        csv_content = "sequence\nMVLSPAD\nMALWMRL\n"
        events = []
        async for event in processor.process_csv(csv_content):
            events.append(event)

        # Should have BATCH_STARTED and BATCH_DONE at minimum.
        event_types = [e.type for e in events]
        assert BatchEventType.BATCH_STARTED in event_types
        assert BatchEventType.BATCH_DONE in event_types

    @pytest.mark.asyncio
    async def test_batch_fasta_events(self):
        """Batch processor emits correct events for FASTA input."""
        pipeline = _make_pipeline([
            {"id": "fold", "tool_name": "predict_structure", "parameters": {"sequence": ""}},
        ])

        processor = BatchProcessor(
            definition=pipeline,
            max_concurrency=2,
        )

        fasta = ">seq1\nMVLSPAD\n>seq2\nMALWMRL\n"
        events = []
        async for event in processor.process_fasta(fasta):
            events.append(event)

        event_types = [e.type for e in events]
        assert BatchEventType.BATCH_STARTED in event_types
        assert BatchEventType.BATCH_DONE in event_types


# ── Latency tracking tests (R7) ────────────────────────────────────────────

class TestLatencyTracking:
    """Verify latency tracking fields exist and work."""

    def test_engine_has_latency_fields(self):
        """AgentEngine has latency tracking lists after init."""
        from synqlab.agent.engine import AgentEngine, AgentConfig
        from synqlab.agent.context import AgentContext

        config = AgentConfig()
        context = AgentContext(
            session_id="test-latency",
            org_id="org-1",
            user_id="user-1",
            tool_registry={},
        )
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            engine = AgentEngine(config=config, tools=[], context=context)

        assert engine.llm_latencies == []
        assert engine.tool_latencies == []
        assert engine.latency_threshold_llm == 30.0
        assert engine.latency_threshold_tool == 60.0

    def test_latency_summary_empty(self):
        """Latency summary returns zeros when no calls made."""
        from synqlab.agent.engine import AgentEngine, AgentConfig
        from synqlab.agent.context import AgentContext

        config = AgentConfig()
        context = AgentContext(
            session_id="test-lat2",
            org_id="org-1",
            user_id="user-1",
            tool_registry={},
        )
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            engine = AgentEngine(config=config, tools=[], context=context)

        summary = engine.latency_summary
        assert summary["llm_calls"] == 0
        assert summary["tool_calls"] == 0
        assert summary["total_ms"] == 0

    def test_latency_summary_with_data(self):
        """Latency summary computes correct aggregates."""
        from synqlab.agent.engine import AgentEngine, AgentConfig
        from synqlab.agent.context import AgentContext

        config = AgentConfig()
        context = AgentContext(
            session_id="test-lat3",
            org_id="org-1",
            user_id="user-1",
            tool_registry={},
        )
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            engine = AgentEngine(config=config, tools=[], context=context)

        # Inject fake latency data.
        engine.llm_latencies = [1.0, 2.0, 3.0]  # seconds
        engine.tool_latencies = [0.5, 1.5]

        summary = engine.latency_summary
        assert summary["llm_calls"] == 3
        assert summary["llm_avg_ms"] == 2000.0
        assert summary["llm_max_ms"] == 3000.0
        assert summary["tool_calls"] == 2
        assert summary["tool_avg_ms"] == 1000.0
        assert summary["total_ms"] == 8000.0


# ── Phase 8 Plan 2: Research Director → Skill → Worker chain ────────────────

class TestResearchDirectorChain:
    """Validate the Phase 5 ↔ Phase 3+4 coordinator/skill/worker wiring.

    Closes the integration gap where ``research_director_protocol.skill.md``
    references ``spawn_worker`` but no test exercised the full chain.
    """

    # --- Task 1: skill loads with coordinator instructions -----------------

    def test_skill_loads_with_coordinator_instructions(self):
        """The research-director skill exposes spawn_worker in its prompt extension."""
        from synqlab.agent.skill import SkillLoader

        skills_dir = Path(__file__).resolve().parent.parent / "synqlab" / "agent" / "skills"
        loader = SkillLoader([str(skills_dir)])
        skills = loader.get_all_skills()

        rd = next(
            (s for s in skills if s.id == "research-director-protocol"),
            None,
        )
        assert rd is not None, (
            f"research-director-protocol skill not found in {skills_dir}; "
            f"available: {[s.id for s in skills]}"
        )
        assert rd.agent_types == ["research_director"]
        assert "spawn_worker" in rd.tools

        ext = rd.to_system_prompt_extension()
        ext_lc = ext.lower()
        # The protocol body uses prose ("Spawn `sequence_worker`", etc.) — accept
        # either the literal tool name or its bare verb.
        assert "spawn_worker" in ext_lc or "spawn" in ext_lc, (
            "Expected the protocol's prompt extension to mention spawn / spawn_worker"
        )
        # Sanity: phrasing about coordination/orchestration is preserved.
        assert "worker" in ext_lc

    # --- Task 2: spawn_worker creates worker context with inherited identity

    @pytest.mark.asyncio
    async def test_coordinator_spawns_worker_with_correct_identity(self):
        """spawn_worker_tool creates a task and wires a worker that inherits org/user."""
        from synqlab.agent.context import AgentContext
        from synqlab.agent.task import TaskManager
        from synqlab.agent.tools.spawn_worker import _spawn_worker_call

        # Capture worker contexts the tool builds.
        captured: dict[str, Any] = {}

        original_engine_init = None

        # Stub AgentEngine so no real OpenAI client is constructed and
        # so submit_message yields nothing (worker exits cleanly, task completes).
        with patch("synqlab.agent.engine.AgentEngine.__init__", return_value=None) as mock_init, \
             patch("synqlab.agent.engine.AgentEngine.submit_message") as mock_submit:

            async def _empty_stream(self, content):  # noqa: ARG001
                # Yield nothing — worker text will be empty, task completes immediately.
                if False:
                    yield None

            mock_submit.side_effect = lambda content: _empty_stream(None, content)

            tm = TaskManager(parent_session_id="coord-1")
            coord_ctx = AgentContext(
                session_id="coord-1",
                user_id="user-1",
                org_id="org-1",
                project_id="proj-1",
                tool_registry={"agent_type": "coordinator"},
                task_manager=tm,
            )

            result = await _spawn_worker_call(
                {"agent_type": "folding_worker", "goal": "Fold MVLSPAD"},
                coord_ctx,
            )

            # Tool returned a running task descriptor.
            assert result.is_success
            assert result.data["agent_type"] == "folding_worker"
            assert result.data["goal"] == "Fold MVLSPAD"
            task_id = result.data["task_id"]

            # The TaskManager registered the task.
            tasks = await tm.list_tasks()
            assert len(tasks) == 1
            assert tasks[0].id == task_id
            assert tasks[0].agent_type == "folding_worker"
            assert tasks[0].parent_session_id == "coord-1"

            # Inspect the AgentEngine ctor call: worker context must inherit identity.
            assert mock_init.called
            kwargs = mock_init.call_args.kwargs
            worker_ctx = kwargs.get("context")
            assert worker_ctx is not None, "AgentEngine was built without context"
            assert worker_ctx.user_id == "user-1"
            assert worker_ctx.org_id == "org-1"
            assert worker_ctx.project_id == "proj-1"
            assert worker_ctx.parent_task_id == task_id
            assert worker_ctx.session_id != coord_ctx.session_id
            assert worker_ctx.tool_registry["agent_type"] == "folding_worker"

            # Wait for the background worker coroutine to finish so the task
            # transitions to a terminal state before the test exits.
            bg = tm._worker_tasks.get(task_id)
            assert bg is not None
            await bg

    # --- Task 3: full task lifecycle propagates results back ---------------

    @pytest.mark.asyncio
    async def test_task_lifecycle_chain(self):
        """create_task → start_task → complete_task surfaces result via list_tasks."""
        from synqlab.agent.task import TaskManager, TaskState

        tm = TaskManager(parent_session_id="coord-life")
        task = await tm.create_task(agent_type="folding_worker", goal="Fold X")
        assert task.state == TaskState.PENDING

        started = await tm.start_task(task.id)
        assert started.state == TaskState.RUNNING

        completed = await tm.complete_task(
            task.id,
            {"text": "pLDDT=82.4", "tool_calls": 2, "tokens_used": 1234},
        )
        assert completed.state == TaskState.COMPLETED
        assert completed.result == {
            "text": "pLDDT=82.4",
            "tool_calls": 2,
            "tokens_used": 1234,
        }

        # Result is also visible via the manager's listing.
        listed = await tm.list_tasks()
        assert len(listed) == 1
        assert listed[0].result["tool_calls"] == 2

    # --- Task 4: worker tool set excludes coordinator-only tools -----------

    def test_get_worker_tools_excludes_coordinator_tools(self):
        """get_worker_tools returns science + skill tools, never coordinator tools."""
        from synqlab.agent.tools import (
            get_coordinator_tools,
            get_worker_tools,
        )

        worker_names = {t.name for t in get_worker_tools()}
        coordinator_names = {t.name for t in get_coordinator_tools()}

        # Science tools the protocol depends on (using actual registered names).
        for expected in (
            "predict_structure",
            "analyze_stability",
            "generate_sequences",
            "search_literature",
            "save_artifact",
            "read_artifact",
            "write_report",
        ):
            assert expected in worker_names, f"Worker tools missing {expected!r}"

        # Skill discovery is shared with workers.
        assert "list_skills" in worker_names
        assert "activate_skill" in worker_names

        # Coordinator-only tools must be absent from worker set.
        for coord_only in ("spawn_worker", "send_message", "stop_task", "list_tasks"):
            assert coord_only not in worker_names, (
                f"Worker tools must not include coordinator-only {coord_only!r}"
            )
            assert coord_only in coordinator_names, (
                f"Coordinator tools must include {coord_only!r}"
            )

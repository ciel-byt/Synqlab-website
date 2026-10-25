"""Pipeline DAG definition, validation, and execution engine.

A pipeline is a directed acyclic graph (DAG) of tool nodes. The engine
executes nodes in topological waves — all nodes in the same wave run in
parallel, and downstream nodes receive upstream outputs automatically.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)


# ── Data model ──────────────────────────────────────────────────────────────


@dataclass
class PipelineNode:
    """A single tool invocation in a pipeline graph."""

    id: str                             # unique within pipeline, e.g. "fold_1"
    tool_name: str                      # maps to agent tool, e.g. "predict_structure"
    parameters: dict[str, Any]          # tool input parameters
    depends_on: list[str] = field(default_factory=list)
    label: str = ""                     # display label
    position: dict[str, float] | None = None  # {x, y} for visual editor
    # Embedded schemas for form generation (Langflow/ComfyUI pattern).
    input_schema: list[dict[str, Any]] = field(default_factory=list)
    output_schema: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tool_name": self.tool_name,
            "parameters": self.parameters,
            "depends_on": self.depends_on,
            "label": self.label or self.tool_name,
            "position": self.position,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
        }


@dataclass
class PipelineDefinition:
    """A complete pipeline graph."""

    id: str = ""
    name: str = ""
    description: str = ""
    nodes: list[PipelineNode] = field(default_factory=list)
    created_by: str = ""
    # ── Loop/round support (Phase 23) ────────────────────────────────
    max_rounds: int = 1
    fitness_threshold: float | None = None
    fitness_metric: str = ""  # e.g. "p_hit", "plddt_mean"
    score_all_candidates: bool = False  # Score all N variants per round
    # ── Pipeline-level configurable params (Airflow-style) ───────────
    pipeline_params: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())

    # ── Validation ──────────────────────────────────────────────────────

    def validate(self) -> list[str]:
        """Validate the pipeline DAG. Returns a list of error messages."""
        errors: list[str] = []
        node_ids = {n.id for n in self.nodes}

        if not self.nodes:
            errors.append("Pipeline has no nodes.")
            return errors

        # Check for duplicate IDs.
        if len(node_ids) != len(self.nodes):
            errors.append("Duplicate node IDs detected.")

        # Check depends_on references.
        for node in self.nodes:
            for dep in node.depends_on:
                if dep not in node_ids:
                    errors.append(f"Node '{node.id}' depends on unknown node '{dep}'.")

        # Cycle detection via Kahn's algorithm.
        in_degree: dict[str, int] = {n.id: 0 for n in self.nodes}
        adj: dict[str, list[str]] = {n.id: [] for n in self.nodes}
        for node in self.nodes:
            for dep in node.depends_on:
                if dep in adj:
                    adj[dep].append(node.id)
                    in_degree[node.id] += 1

        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        visited = 0
        while queue:
            nid = queue.pop(0)
            visited += 1
            for child in adj.get(nid, []):
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    queue.append(child)

        if visited != len(self.nodes):
            errors.append("Pipeline contains a cycle — not a valid DAG.")

        return errors

    # ── Topological sort ────────────────────────────────────────────────

    def topological_sort(self) -> list[list[PipelineNode]]:
        """Return nodes grouped into execution waves (parallel levels)."""
        node_map = {n.id: n for n in self.nodes}
        in_degree: dict[str, int] = {n.id: 0 for n in self.nodes}
        adj: dict[str, list[str]] = {n.id: [] for n in self.nodes}

        for node in self.nodes:
            for dep in node.depends_on:
                adj[dep].append(node.id)
                in_degree[node.id] += 1

        waves: list[list[PipelineNode]] = []
        queue = [nid for nid, deg in in_degree.items() if deg == 0]

        while queue:
            wave = [node_map[nid] for nid in queue]
            waves.append(wave)

            next_queue: list[str] = []
            for nid in queue:
                for child in adj[nid]:
                    in_degree[child] -= 1
                    if in_degree[child] == 0:
                        next_queue.append(child)
            queue = next_queue

        return waves

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "nodes": [n.to_dict() for n in self.nodes],
            "created_by": self.created_by,
            "max_rounds": self.max_rounds,
            "fitness_threshold": self.fitness_threshold,
            "fitness_metric": self.fitness_metric,
            "pipeline_params": self.pipeline_params,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PipelineDefinition:
        nodes = [
            PipelineNode(
                id=n["id"],
                tool_name=n["tool_name"],
                parameters=n.get("parameters", {}),
                depends_on=n.get("depends_on", []),
                label=n.get("label", ""),
                position=n.get("position"),
                input_schema=n.get("input_schema", []),
                output_schema=n.get("output_schema", []),
            )
            for n in data.get("nodes", [])
        ]
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            nodes=nodes,
            created_by=data.get("created_by", ""),
            max_rounds=data.get("max_rounds", 1),
            fitness_threshold=data.get("fitness_threshold"),
            fitness_metric=data.get("fitness_metric", ""),
            pipeline_params=data.get("pipeline_params", []),
        )


# ── Events ──────────────────────────────────────────────────────────────────


class PipelineEventType(str, Enum):
    NODE_STARTED = "node_started"
    NODE_COMPLETED = "node_completed"
    NODE_FAILED = "node_failed"
    PIPELINE_STARTED = "pipeline_started"
    PIPELINE_DONE = "pipeline_done"
    ROUND_STARTED = "round_started"
    ROUND_COMPLETED = "round_completed"


@dataclass
class PipelineEvent:
    type: PipelineEventType
    node_id: str = ""
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type.value, "node_id": self.node_id, "data": self.data}


def _has_placeholder(value: Any) -> bool:
    """Check if a value (str, dict, or list) contains {{...}} placeholders."""
    if isinstance(value, str):
        return "{{" in value
    if isinstance(value, dict):
        return any(_has_placeholder(v) for v in value.values())
    if isinstance(value, list):
        return any(_has_placeholder(v) for v in value)
    return False


@dataclass
class NodeResult:
    node_id: str
    status: str  # completed | failed
    outputs: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    duration_ms: float = 0


# ── Engine ──────────────────────────────────────────────────────────────────


class PipelineEngine:
    """Executes a pipeline by running nodes as agent tool calls."""

    def __init__(
        self,
        definition: PipelineDefinition,
        context: Any = None,
        tool_registry: dict[str, Any] | None = None,
        tracker: "CandidateTracker | None" = None,
    ):
        self.definition = definition
        self.context = context
        self.tool_registry = tool_registry or {}
        self.tracker = tracker
        self.node_results: dict[str, NodeResult] = {}
        self.node_statuses: dict[str, str] = {
            n.id: "pending" for n in definition.nodes
        }
        self.current_round: int = 0

    async def execute(self) -> AsyncGenerator[PipelineEvent, None]:
        """Execute the pipeline DAG, yielding events for each node.

        Supports multi-round execution when ``max_rounds > 1``.
        Single-pass pipelines (``max_rounds == 1``) behave identically
        to the original implementation.
        """
        errors = self.definition.validate()
        if errors:
            yield PipelineEvent(
                type=PipelineEventType.PIPELINE_DONE,
                data={"status": "failed", "errors": errors},
            )
            return

        max_rounds = self.definition.max_rounds
        yield PipelineEvent(
            type=PipelineEventType.PIPELINE_STARTED,
            data={
                "total_nodes": len(self.definition.nodes),
                "total_waves": len(self.definition.topological_sort()),
                "max_rounds": max_rounds,
            },
        )

        for round_idx in range(1, max_rounds + 1):
            self.current_round = round_idx

            # Reset node statuses for subsequent rounds.
            if round_idx > 1:
                self._reset_for_new_round()

            yield PipelineEvent(
                type=PipelineEventType.ROUND_STARTED,
                data={"round": round_idx, "max_rounds": max_rounds},
            )

            if self.definition.score_all_candidates:
                # Score-all mode: run propose once, then fold+score each variant.
                async for event in self._execute_dag_score_all():
                    yield event
            else:
                # Default: run DAG once (only best_variant gets scored).
                async for event in self._execute_dag():
                    yield event

            yield PipelineEvent(
                type=PipelineEventType.ROUND_COMPLETED,
                data={
                    "round": round_idx,
                    "results": {
                        nid: nr.outputs for nid, nr in self.node_results.items()
                    },
                },
            )

            # Fitness gate check.
            if (
                self.tracker
                and self.definition.fitness_threshold is not None
                and self.definition.fitness_metric
            ):
                best = self.tracker.best(self.definition.fitness_metric)
                if best is not None and best >= self.definition.fitness_threshold:
                    completed = sum(
                        1
                        for r in self.node_results.values()
                        if r.status == "completed"
                    )
                    yield PipelineEvent(
                        type=PipelineEventType.PIPELINE_DONE,
                        data={
                            "status": "threshold_met",
                            "fitness_metric": self.definition.fitness_metric,
                            "best_value": best,
                            "threshold": self.definition.fitness_threshold,
                            "round": round_idx,
                            "nodes_completed": completed,
                            "results": {
                                nid: nr.outputs
                                for nid, nr in self.node_results.items()
                            },
                        },
                    )
                    return

        # All rounds exhausted.
        completed = sum(
            1 for r in self.node_results.values() if r.status == "completed"
        )
        failed = sum(
            1 for r in self.node_results.values() if r.status == "failed"
        )
        yield PipelineEvent(
            type=PipelineEventType.PIPELINE_DONE,
            data={
                "status": "completed" if failed == 0 else "partial",
                "rounds_used": max_rounds,
                "nodes_completed": completed,
                "nodes_failed": failed,
                "results": {
                    nid: nr.outputs for nid, nr in self.node_results.items()
                },
            },
        )

    # ── Internal helpers ────────────────────────────────────────────────

    async def _execute_dag(self) -> AsyncGenerator[PipelineEvent, None]:
        """Run one full pass of the DAG (all waves)."""
        waves = self.definition.topological_sort()

        for wave_idx, wave in enumerate(waves):
            # Inject upstream outputs into node parameters.
            for node in wave:
                self._inject_upstream(node)

            # Run all nodes in this wave concurrently.
            tasks = [self._run_node(node) for node in wave]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for node, result in zip(wave, results):
                if isinstance(result, Exception):
                    nr = NodeResult(
                        node_id=node.id,
                        status="failed",
                        error=str(result),
                    )
                else:
                    nr = result

                self.node_results[node.id] = nr
                self.node_statuses[node.id] = nr.status

                if nr.status == "completed":
                    yield PipelineEvent(
                        type=PipelineEventType.NODE_COMPLETED,
                        node_id=node.id,
                        data={
                            "outputs": nr.outputs,
                            "duration_ms": nr.duration_ms,
                        },
                    )
                else:
                    yield PipelineEvent(
                        type=PipelineEventType.NODE_FAILED,
                        node_id=node.id,
                        data={
                            "error": nr.error,
                            "duration_ms": nr.duration_ms,
                        },
                    )

    async def _execute_dag_score_all(self) -> AsyncGenerator[PipelineEvent, None]:
        """Score-all mode: propose once, then fold+score each variant.

        Runs the propose node first, extracts all variants, then runs
        fold→stability→interaction→brightness for each variant sequentially
        (sharing the same GPU). Collects all scored candidates into results.
        """
        import copy

        waves = self.definition.topological_sort()
        propose_node = None
        scoring_nodes: list[PipelineNode] = []

        # Identify propose vs scoring nodes.
        for wave in waves:
            for node in wave:
                if node.tool_name == "propose_variants":
                    propose_node = node
                else:
                    scoring_nodes.append(node)

        if not propose_node:
            # Fallback: no propose node, just run normally.
            async for event in self._execute_dag():
                yield event
            return

        # 1. Run propose node to get all variants.
        self._inject_upstream(propose_node)
        result = await self._run_node(propose_node)
        self.node_results[propose_node.id] = result
        self.node_statuses[propose_node.id] = result.status

        if result.status == "completed":
            yield PipelineEvent(
                type=PipelineEventType.NODE_COMPLETED,
                node_id=propose_node.id,
                data={"outputs": result.outputs, "duration_ms": result.duration_ms},
            )
        else:
            yield PipelineEvent(
                type=PipelineEventType.NODE_FAILED,
                node_id=propose_node.id,
                data={"error": result.error},
            )
            return

        variants = result.outputs.get("variants", [])
        if not variants:
            return

        # Save original params for re-templating.
        if not hasattr(self, "_original_params"):
            self._original_params: dict[str, dict] = {
                n.id: copy.deepcopy(n.parameters) for n in self.definition.nodes
            }

        # 2. Score each variant sequentially (shares single GPU).
        all_candidates: list[dict] = []
        best_candidate: dict | None = None
        best_fitness: float = float("-inf")
        fitness_key = self.definition.fitness_metric or "p_hit"

        for v_idx, variant in enumerate(variants):
            candidate_results: dict[str, Any] = {"sequence": variant, "index": v_idx}

            # Override propose outputs to point to this specific variant.
            self.node_results[propose_node.id] = NodeResult(
                node_id=propose_node.id,
                status="completed",
                outputs={
                    **result.outputs,
                    "best_variant": variant,
                    "variants": [variant],
                    "n_returned": 1,
                },
            )

            # Run scoring nodes in topological order.
            scoring_waves = []
            for wave in self.definition.topological_sort():
                filtered = [n for n in wave if n.id != propose_node.id]
                if filtered:
                    scoring_waves.append(filtered)

            for wave in scoring_waves:
                for node in wave:
                    # Re-template parameters from originals.
                    if node.id in self._original_params:
                        for key, val in self._original_params[node.id].items():
                            if _has_placeholder(val):
                                node.parameters[key] = copy.deepcopy(val)
                    self._inject_upstream(node)

                tasks = [self._run_node(node) for node in wave]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for node, res in zip(wave, results):
                    if isinstance(res, Exception):
                        nr = NodeResult(node_id=node.id, status="failed", error=str(res))
                    else:
                        nr = res
                    self.node_results[node.id] = nr
                    self.node_statuses[node.id] = nr.status
                    candidate_results[node.id] = nr.outputs if nr.status == "completed" else {"error": nr.error}

            # Check fitness for this candidate.
            fitness_val = None
            for node_outputs in candidate_results.values():
                if isinstance(node_outputs, dict) and fitness_key in node_outputs:
                    fitness_val = node_outputs[fitness_key]

            candidate_results["fitness"] = fitness_val
            all_candidates.append(candidate_results)

            if fitness_val is not None and fitness_val > best_fitness:
                best_fitness = fitness_val
                best_candidate = candidate_results

            # Register with tracker if available.
            if self.tracker:
                metrics = {}
                for nid, nr in self.node_results.items():
                    if nr.status == "completed":
                        metrics.update(nr.outputs)
                self.tracker.register(variant, metrics)

        # 3. Store consolidated results.
        self.node_results[propose_node.id] = NodeResult(
            node_id=propose_node.id,
            status="completed",
            outputs={
                **result.outputs,
                "best_variant": best_candidate["sequence"] if best_candidate else variants[0],
                "all_scored_candidates": all_candidates,
                "n_scored": len(all_candidates),
            },
        )

        yield PipelineEvent(
            type=PipelineEventType.NODE_COMPLETED,
            node_id="score_all",
            data={
                "n_candidates": len(all_candidates),
                "best_sequence": best_candidate["sequence"] if best_candidate else None,
                "best_fitness": best_fitness if best_fitness > float("-inf") else None,
            },
        )

    def _reset_for_new_round(self) -> None:
        """Reset node statuses and re-template parameters for a new round.

        For the MDMI genetic algorithm to work, the ``propose_variants`` node
        must receive the top candidates from the previous round as ``parents``.
        This method injects them from the CandidateTracker before resetting
        placeholder-bearing parameters for fresh upstream resolution.
        """
        self.node_statuses = {
            n.id: "pending" for n in self.definition.nodes
        }

        # Carry forward top candidates as parents for the GA.
        if self.tracker and self.definition.fitness_metric:
            metric = self.definition.fitness_metric
            scored = [
                c for c in self.tracker.candidates.values()
                if c.metrics.get(metric) is not None
            ]
            scored.sort(key=lambda c: c.metrics.get(metric, 0.0), reverse=True)
            top_seqs = [c.sequence for c in scored[:10]]  # top 10 as parent pool

            for node in self.definition.nodes:
                if node.tool_name == "propose_variants" and top_seqs:
                    node.parameters["parents"] = top_seqs
                    # Override seed with the best candidate from previous round
                    # so the GA explores from the fittest, not the original WT.
                    node.parameters["seed"] = top_seqs[0]

        # Also check: if score-all stored a best_variant in propose results,
        # use that as seed for the next round even without a tracker.
        propose_result = self.node_results.get("propose")
        if propose_result and propose_result.status == "completed":
            best_var = propose_result.outputs.get("best_variant")
            if best_var:
                for node in self.definition.nodes:
                    if node.tool_name == "propose_variants":
                        node.parameters["seed"] = best_var

        # Re-template placeholder parameters so _inject_upstream resolves
        # them fresh from the new round's outputs. We store original
        # templates on first call and restore them each round.
        import copy
        if not hasattr(self, "_original_params"):
            self._original_params: dict[str, dict] = {
                n.id: copy.deepcopy(n.parameters) for n in self.definition.nodes
            }
        else:
            # Save seed/parents before restoring templates (they aren't placeholders).
            saved_propose: dict[str, Any] = {}
            for node in self.definition.nodes:
                if node.tool_name == "propose_variants":
                    saved_propose = {
                        k: v for k, v in node.parameters.items()
                        if k in ("seed", "parents")
                    }
            for node in self.definition.nodes:
                orig = self._original_params.get(node.id, {})
                for key, val in orig.items():
                    if _has_placeholder(val):
                        node.parameters[key] = copy.deepcopy(val)
                # Re-apply seed/parents after template restore.
                if node.tool_name == "propose_variants" and saved_propose:
                    node.parameters.update(saved_propose)

    def _inject_upstream(self, node: PipelineNode) -> None:
        """Replace {{node_id.field}} placeholders in parameters.

        Resolves from ALL completed node results (not just direct parents)
        so transitive data flows work cleanly without requiring direct
        depends_on edges for data-only references.
        """
        all_completed = list(self.node_results.keys())
        for key in list(node.parameters.keys()):
            node.parameters[key] = self._resolve_value(
                node.parameters[key], all_completed,
            )

    def _resolve_value(self, value: Any, depends_on: list[str]) -> Any:
        """Recursively resolve {{...}} placeholders in a value."""
        if isinstance(value, str) and "{{" in value:
            for dep_id in depends_on:
                dep_result = self.node_results.get(dep_id)
                if dep_result and dep_result.status == "completed":
                    for out_key, out_val in dep_result.outputs.items():
                        placeholder = "{{" + f"{dep_id}.{out_key}" + "}}"
                        if value is None:
                            break
                        if isinstance(value, str) and placeholder in value:
                            if isinstance(out_val, str):
                                value = value.replace(placeholder, out_val)
                            else:
                                value = out_val  # Direct replacement (may be None).
                    if value is None:
                        break
            return value
        if isinstance(value, dict):
            return {
                k: self._resolve_value(v, depends_on)
                for k, v in value.items()
            }
        if isinstance(value, list):
            return [self._resolve_value(v, depends_on) for v in value]
        return value

    async def _run_node(self, node: PipelineNode) -> NodeResult:
        """Execute a single node by calling the corresponding tool."""
        self.node_statuses[node.id] = "running"
        start = time.monotonic()
        print(f"[PIPELINE] Starting node '{node.id}' (tool={node.tool_name}, params={list(node.parameters.keys())})", flush=True)

        try:
            tool = self.tool_registry.get(node.tool_name)
            if tool is None:
                logger.error("Pipeline node '%s': tool '%s' not registered", node.id, node.tool_name)
                return NodeResult(
                    node_id=node.id,
                    status="failed",
                    error=f"Tool '{node.tool_name}' not found in registry",
                    duration_ms=round((time.monotonic() - start) * 1000, 1),
                )

            # Call the tool.
            result = await tool.call(node.parameters, self.context)
            duration = round((time.monotonic() - start) * 1000, 1)

            if result.is_success:
                print(f"[PIPELINE] Node '{node.id}' completed in {duration:.0f}ms", flush=True)
                return NodeResult(
                    node_id=node.id,
                    status="completed",
                    outputs=result.data,
                    duration_ms=duration,
                )
            else:
                err_msg = result.error_message or "Tool returned error"
                print(f"[PIPELINE] Node '{node.id}' failed in {duration:.0f}ms: {err_msg[:200]}", flush=True)
                return NodeResult(
                    node_id=node.id,
                    status="failed",
                    error=err_msg,
                    duration_ms=duration,
                )

        except Exception as exc:
            duration = round((time.monotonic() - start) * 1000, 1)
            print(f"[PIPELINE] Node '{node.id}' exception in {duration:.0f}ms: {exc}", flush=True)
            logger.exception("Pipeline node '%s' failed", node.id)
            return NodeResult(
                node_id=node.id,
                status="failed",
                error=str(exc),
                duration_ms=duration,
            )


# ── Schema helpers ──────────────────────────────────────────────────────────


def _json_schema_type(prop: dict[str, Any]) -> str:
    """Map JSON Schema type to our simplified type system."""
    t = prop.get("type", "string")
    if t == "integer":
        return "integer"
    if t == "number":
        return "number"
    if t == "boolean":
        return "boolean"
    if t == "array":
        return "list"
    if t == "object":
        return "object"
    return "string"


def _pydantic_to_field_schema(
    model: type,
) -> list[dict[str, Any]]:
    """Convert a Pydantic BaseModel to a list of field schema dicts.

    Follows the Airflow Param() pattern: each field carries type, label,
    description, default, and validation constraints.
    """
    schema = model.model_json_schema()
    required_set = set(schema.get("required", []))
    fields: list[dict[str, Any]] = []

    for name, prop in schema.get("properties", {}).items():
        field_def: dict[str, Any] = {
            "name": name,
            "type": _json_schema_type(prop),
            "label": name.replace("_", " ").title(),
            "description": prop.get("description", ""),
            "required": name in required_set,
        }
        if "default" in prop:
            field_def["default"] = prop["default"]
        if "minimum" in prop:
            field_def["minimum"] = prop["minimum"]
        if "maximum" in prop:
            field_def["maximum"] = prop["maximum"]
        if "exclusiveMinimum" in prop:
            field_def["minimum"] = prop["exclusiveMinimum"]
        if "enum" in prop:
            field_def["type"] = "enum"
            field_def["enum"] = prop["enum"]
        fields.append(field_def)

    return fields


def _output_schema(*names_and_types: tuple[str, str, str]) -> list[dict[str, Any]]:
    """Build output schema from (name, type, description) tuples."""
    return [
        {"name": n, "type": t, "description": d}
        for n, t, d in names_and_types
    ]


# ── Auto-wiring ────────────────────────────────────────────────────────────


_WIRE_TYPE_MAP = {
    "str": "string", "string": "string", "sequence": "string",
    "artifact_path": "string",
    "int": "integer", "integer": "integer",
    "float": "number", "number": "number",
    "bool": "boolean", "boolean": "boolean",
}


def _normalize_wire_type(t: str) -> str:
    lower = t.lower().strip()
    if lower in _WIRE_TYPE_MAP:
        return _WIRE_TYPE_MAP[lower]
    if lower.startswith("list"):
        return "list"
    if lower in ("dict", "object"):
        return "object"
    return lower


def auto_wire_nodes(
    defn: PipelineDefinition,
    tool_registry: dict[str, Any] | None = None,
) -> None:
    """Inject ``{{upstream.output}}`` placeholders into downstream node
    parameters for any un-wired inputs that match upstream outputs.

    Matching priorities:
      1. Exact name match (upstream output name == downstream input name)
      2. Type match (normalized types match)
      3. Single-output shortcut (upstream has 1 output → wire to first un-wired input)

    Mutates ``defn.nodes`` in place. Already-wired parameters (containing
    ``{{``) are left untouched. Root nodes are never modified.
    """
    node_map = {n.id: n for n in defn.nodes}

    # Build output map from embedded output_schema or tool registry.
    output_map: dict[str, list[dict[str, str]]] = {}
    for node in defn.nodes:
        outputs: list[dict[str, str]] = []
        if node.output_schema:
            outputs = [{"name": o["name"], "type": o.get("type", "string")}
                       for o in node.output_schema]
        elif tool_registry:
            tool = tool_registry.get(node.tool_name)
            if tool and hasattr(tool, "output_schema"):
                for o in (tool.output_schema or []):
                    outputs.append({"name": o.get("name", ""), "type": o.get("type", "string")})
        output_map[node.id] = outputs

    for node in defn.nodes:
        if not node.depends_on:
            continue

        # Determine input fields from embedded schema or tool registry.
        inputs: list[dict[str, str]] = []
        if node.input_schema:
            inputs = [{"name": s["name"], "type": s.get("type", "string")}
                      for s in node.input_schema]
        elif tool_registry:
            tool = tool_registry.get(node.tool_name)
            if tool:
                try:
                    schema = tool.input_schema.model_json_schema()
                    for name, prop in schema.get("properties", {}).items():
                        inputs.append({"name": name, "type": prop.get("type", "string")})
                except Exception:
                    pass
        if not inputs:
            inputs = [{"name": k, "type": "string"} for k in node.parameters]

        used: set[str] = set()

        for inp in inputs:
            val = node.parameters.get(inp["name"])
            if isinstance(val, str) and "{{" in val:
                continue
            if isinstance(val, dict) and "{{" in str(val):
                continue

            matched = False
            for upstream_id in node.depends_on:
                up_outputs = output_map.get(upstream_id, [])
                if not up_outputs:
                    continue

                # Priority 1: name match
                name_match = next(
                    (o for o in up_outputs
                     if o["name"] == inp["name"]
                     and f"{upstream_id}.{o['name']}" not in used),
                    None,
                )
                if name_match:
                    node.parameters[inp["name"]] = "{{" + f"{upstream_id}.{name_match['name']}" + "}}"
                    used.add(f"{upstream_id}.{name_match['name']}")
                    matched = True
                    break

                # Priority 2: type match
                norm_type = _normalize_wire_type(inp["type"])
                type_match = next(
                    (o for o in up_outputs
                     if _normalize_wire_type(o["type"]) == norm_type
                     and f"{upstream_id}.{o['name']}" not in used),
                    None,
                )
                if type_match:
                    node.parameters[inp["name"]] = "{{" + f"{upstream_id}.{type_match['name']}" + "}}"
                    used.add(f"{upstream_id}.{type_match['name']}")
                    matched = True
                    break

            # Priority 3: single-output shortcut
            if not matched and len(node.depends_on) == 1:
                up_outputs = output_map.get(node.depends_on[0], [])
                if len(up_outputs) == 1:
                    key = f"{node.depends_on[0]}.{up_outputs[0]['name']}"
                    if key not in used:
                        node.parameters[inp["name"]] = "{{" + f"{node.depends_on[0]}.{up_outputs[0]['name']}" + "}}"
                        used.add(key)


# ── Pipeline templates ──────────────────────────────────────────────────────


def create_gfp11_optimization_pipeline() -> PipelineDefinition:
    """GFP11 MDMI-style iterative brightness optimization.

    Replicates the predictive model from the MDMI paper (Bayat et al.,
    ICLR 2025 GEM), Figure 1b:
        propose variants → fold with AlphaFold/ESMFold →
        [Rosetta/FoldX stability + SPServer interaction] (parallel) →
        brightness prediction → gate → repeat.
    """
    from synqlab.agent.tools.propose_variants import ProposeVariantsInput
    from synqlab.agent.tools.validate_complex import ValidateComplexInput
    from synqlab.agent.tools.score_stability import ScoreStabilityInput
    from synqlab.agent.tools.score_interaction import ScoreInteractionInput
    from synqlab.agent.tools.score_brightness import ScoreBrightnessInput

    return PipelineDefinition(
        name="GFP11 Optimization",
        description=(
            "Iterative GFP11 brightness optimization aligned with the MDMI "
            "paper. Proposes variants, folds the complex, scores structural "
            "features (FoldX + SPServer in parallel), then predicts brightness. "
            "Stops when p_hit reaches fitness threshold or max rounds exhausted."
        ),
        max_rounds=5,
        fitness_threshold=0.7,
        fitness_metric="p_hit",
        pipeline_params=[
            {
                "name": "max_rounds", "type": "integer",
                "label": "Max Rounds",
                "description": "Number of iterative optimization rounds.",
                "default": 5, "minimum": 1, "maximum": 50,
                "section": "Advanced",
            },
            {
                "name": "score_all_candidates", "type": "boolean",
                "label": "Score All Candidates",
                "description": "Score every variant (not just the best) per round.",
                "default": False,
                "section": "Advanced",
            },
        ],
        nodes=[
            # Step 1: Propose/mutate candidate sequences (MDMI Fig 1c)
            PipelineNode(
                id="propose",
                tool_name="propose_variants",
                parameters={"seed": "RDHMVLHEYVNAAGIT", "n": 5, "mutation_budget": 3},
                label="Propose Variants",
                position={"x": 50, "y": 200},
                input_schema=_pydantic_to_field_schema(ProposeVariantsInput),
                output_schema=_output_schema(
                    ("variants", "list", "Generated variant sequences"),
                    ("best_variant", "string", "Top-ranked variant sequence"),
                    ("n_returned", "integer", "Number of variants produced"),
                ),
            ),
            # Step 2: Fold GFP11+GFP1-10 COMPLEX (MDMI Fig 1b: AlphaFold Multimer)
            PipelineNode(
                id="fold",
                tool_name="validate_complex",
                parameters={
                    "sequence": "{{propose.best_variant}}",
                },
                depends_on=["propose"],
                label="Fold Complex",
                position={"x": 250, "y": 200},
                input_schema=_pydantic_to_field_schema(ValidateComplexInput),
                output_schema=_output_schema(
                    ("pdb_path", "string", "Path to the folded PDB file"),
                    ("plddt_mean", "number", "Mean pLDDT confidence score"),
                    ("backend", "string", "Folding backend used"),
                ),
            ),
            # Step 3a: Rosetta/FoldX stability scoring (MDMI Fig 1b: parallel)
            PipelineNode(
                id="stability",
                tool_name="score_stability",
                parameters={"pdb_path": "{{fold.pdb_path}}"},
                depends_on=["fold"],
                label="FoldX Stability",
                position={"x": 450, "y": 150},
                input_schema=_pydantic_to_field_schema(ScoreStabilityInput),
                output_schema=_output_schema(
                    ("interface_dg", "number", "Interface ΔG (kcal/mol)"),
                    ("total_energy", "number", "Total energy from FoldX"),
                ),
            ),
            # Step 3b: SPServer interaction scoring (MDMI Fig 1b: parallel)
            PipelineNode(
                id="interaction",
                tool_name="score_interaction",
                parameters={"pdb_path": "{{fold.pdb_path}}"},
                depends_on=["fold"],
                label="FoldX Interaction",
                position={"x": 450, "y": 250},
                input_schema=_pydantic_to_field_schema(ScoreInteractionInput),
                output_schema=_output_schema(
                    ("interaction_score", "number", "Interface interaction score"),
                ),
            ),
            # Step 4: Brightness prediction from structural features (MDMI Fig 1b)
            PipelineNode(
                id="brightness",
                tool_name="score_brightness",
                parameters={
                    "sequence": "{{propose.best_variant}}",
                    "tool_scores": {
                        "ddg": "{{stability.interface_dg}}",
                        "interaction": "{{interaction.interaction_score}}",
                        "plddt": "{{fold.plddt_mean}}",
                    },
                },
                depends_on=["stability", "interaction"],
                label="Brightness Prediction",
                position={"x": 700, "y": 200},
                input_schema=_pydantic_to_field_schema(ScoreBrightnessInput),
                output_schema=_output_schema(
                    ("p_hit", "number", "Predicted probability of being bright"),
                    ("predicted_brightness", "number", "Predicted brightness score"),
                ),
            ),
        ],
    )


def create_design_pipeline() -> PipelineDefinition:
    """Generate Sequences → Fold → Analyze → Report pipeline template."""
    return PipelineDefinition(
        name="Protein Design",
        description=(
            "Generate candidate sequences, fold them, analyze stability, "
            "and produce a ranked report."
        ),
        max_rounds=1,
        nodes=[
            PipelineNode(
                id="generate",
                tool_name="generate_sequences",
                parameters={"num_sequences": 3, "max_length": 100},
                label="Generate Sequences",
                position={"x": 100, "y": 200},
                input_schema=[
                    {"name": "num_sequences", "type": "integer", "label": "Number of Sequences",
                     "description": "How many candidate sequences to generate.", "default": 3, "minimum": 1},
                    {"name": "max_length", "type": "integer", "label": "Max Length",
                     "description": "Maximum sequence length (residues).", "default": 100, "minimum": 10},
                ],
                output_schema=_output_schema(
                    ("sequences", "list", "Generated protein sequences"),
                ),
            ),
            PipelineNode(
                id="fold",
                tool_name="predict_structure",
                parameters={
                    "sequence": "{{generate.sequences}}",
                    "method": "omegafold",
                },
                depends_on=["generate"],
                label="Fold Candidates",
                position={"x": 350, "y": 200},
                input_schema=[
                    {"name": "sequence", "type": "string", "label": "Sequence",
                     "description": "Amino acid sequence to fold."},
                    {"name": "method", "type": "enum", "label": "Folding Method",
                     "description": "Structure prediction backend.", "default": "omegafold",
                     "enum": ["omegafold", "esmfold"]},
                ],
                output_schema=_output_schema(
                    ("pdb_path", "string", "Path to folded PDB file"),
                    ("confidence", "number", "pLDDT confidence score"),
                ),
            ),
            PipelineNode(
                id="analyze",
                tool_name="analyze_stability",
                parameters={"pdb_path": "{{fold.pdb_path}}"},
                depends_on=["fold"],
                label="Stability Analysis",
                position={"x": 600, "y": 200},
                input_schema=[
                    {"name": "pdb_path", "type": "string", "label": "PDB Path",
                     "description": "Path to the PDB structure to analyze."},
                ],
                output_schema=_output_schema(
                    ("summary", "string", "Stability analysis summary"),
                ),
            ),
            PipelineNode(
                id="report",
                tool_name="write_report",
                parameters={
                    "title": "Design Pipeline Results",
                    "content": "{{analyze.summary}}",
                },
                depends_on=["analyze"],
                label="Generate Report",
                position={"x": 850, "y": 200},
                input_schema=[
                    {"name": "title", "type": "string", "label": "Report Title",
                     "description": "Title for the generated report.", "default": "Design Pipeline Results"},
                    {"name": "content", "type": "string", "label": "Content",
                     "description": "Report content to format."},
                ],
            ),
        ],
    )


def create_screening_pipeline() -> PipelineDefinition:
    """Batch: multiple sequences → fold all → rank by pLDDT."""
    return PipelineDefinition(
        name="Sequence Screening",
        description=(
            "Fold multiple sequences and rank by structural quality (pLDDT)."
        ),
        max_rounds=1,
        nodes=[
            PipelineNode(
                id="fold",
                tool_name="predict_structure",
                parameters={"sequence": "", "method": "omegafold"},
                label="Fold Sequence",
                position={"x": 200, "y": 200},
                input_schema=[
                    {"name": "sequence", "type": "string", "label": "Sequence",
                     "description": "Amino acid sequence to fold.", "required": True},
                    {"name": "method", "type": "enum", "label": "Folding Method",
                     "description": "Structure prediction backend.", "default": "omegafold",
                     "enum": ["omegafold", "esmfold"]},
                ],
                output_schema=_output_schema(
                    ("pdb_path", "string", "Path to folded PDB"),
                    ("confidence", "number", "pLDDT confidence score"),
                ),
            ),
        ],
    )


PIPELINE_TEMPLATES = {
    "gfp11": create_gfp11_optimization_pipeline,
    "design": create_design_pipeline,
    "screening": create_screening_pipeline,
}



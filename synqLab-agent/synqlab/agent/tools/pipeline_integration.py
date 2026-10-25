"""Console → Pipeline integration tools.

Phase 23 — enables the console agent to query pipeline run results
and kick off new pipeline runs via tool calls.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.context import CanvasNode
from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)

# ── Allowlist: only these tool_names may be placed on the canvas ─────────
# Must match the compute services available in the sidebar (ToolsSidebar).
# Update this set when adding new compute services.
ALLOWED_CANVAS_TOOLS: frozenset[str] = frozenset({
    # Core compute adapters
    "protgpt2", "omegafold", "esmfold", "foldx", "spserver", "proteinmpnn",
    # Agent science tools (registered as tools, usable as pipeline nodes)
    "score_brightness", "propose_variants", "validate_complex",
    "score_stability", "score_interaction",
    # Generic pipeline node names (used by built-in templates)
    "generate_sequences", "predict_structure", "analyze_stability",
    "write_report", "literature_search",
})


# ── read_pipeline_results ────────────────────────────────────────────────


class ReadPipelineResultsInput(BaseModel):
    run_id: str = Field(
        default="",
        description="Specific pipeline run ID to fetch. If empty, returns the most recent run.",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of runs to return when run_id is empty.",
    )


async def _read_pipeline_results_call(
    inputs: dict, ctx,
) -> ToolResult:
    run_id = str(inputs.get("run_id", "")).strip()
    limit = int(inputs.get("limit", 5))

    db = getattr(ctx, "db_session", None)
    if db is None:
        return ToolResult.fail("No database session available in agent context")

    try:
        from synqlab.db.models import PipelineRun  # type: ignore[import]
        from sqlalchemy import desc  # type: ignore[import]

        query = db.query(PipelineRun)
        if run_id:
            run = query.filter(PipelineRun.id == run_id).first()
            if not run:
                return ToolResult.fail(f"Pipeline run '{run_id}' not found")
            return ToolResult.ok(_run_to_dict(run))
        else:
            runs = (
                query.order_by(desc(PipelineRun.created_at))
                .limit(limit)
                .all()
            )
            return ToolResult.ok({
                "runs": [_run_to_dict(r) for r in runs],
                "total_returned": len(runs),
            })
    except ImportError:
        return ToolResult.fail(
            "PipelineRun model not available — DB schema may not be migrated"
        )
    except Exception as exc:
        logger.exception("read_pipeline_results failed")
        return ToolResult.fail(str(exc))


def _run_to_dict(run: Any) -> dict[str, Any]:
    """Convert a PipelineRun ORM model to a safe dict."""
    return {
        "id": str(getattr(run, "id", "")),
        "template": getattr(run, "template", ""),
        "status": getattr(run, "status", "unknown"),
        "created_at": str(getattr(run, "created_at", "")),
        "rounds_used": getattr(run, "rounds_used", None),
        "best_fitness": getattr(run, "best_fitness", None),
        "result_summary": getattr(run, "result_summary", {}),
    }


read_pipeline_results_tool = build_tool(AgentToolDef(
    name="read_pipeline_results",
    description=(
        "Read pipeline run results from the database. "
        "Returns the most recent runs or a specific run by ID."
    ),
    input_schema=ReadPipelineResultsInput,
    call=_read_pipeline_results_call,
    is_read_only=True,
))


# ── create_pipeline ──────────────────────────────────────────────────────


class CreatePipelineInput(BaseModel):
    template: str = Field(
        ...,
        description=(
            "Pipeline template key: 'gfp11', 'design', or 'screening'."
        ),
    )
    config: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional config overrides (e.g. n_sequences, top_k).",
    )


async def _create_pipeline_call(
    inputs: dict, ctx,
) -> ToolResult:
    template_key = str(inputs.get("template", "")).strip()
    config_overrides = inputs.get("config", {})

    if not template_key:
        return ToolResult.fail("template is required (gfp11, design, screening)")

    from synqlab.agent.pipeline import PIPELINE_TEMPLATES

    factory = PIPELINE_TEMPLATES.get(template_key)
    if not factory:
        available = ", ".join(PIPELINE_TEMPLATES.keys())
        return ToolResult.fail(
            f"Unknown template '{template_key}'. Available: {available}"
        )

    try:
        definition = factory()

        # Apply config overrides to node parameters
        for node in definition.nodes:
            for key, value in config_overrides.items():
                if key in node.parameters:
                    node.parameters[key] = value

        # ── Update canvas tracker with the template nodes ─────────────
        ctx.canvas.clear()
        for node in definition.nodes:
            ctx.canvas.add_node(CanvasNode(
                id=node.id,
                tool_name=node.tool_name,
                label=node.label or node.tool_name,
                parameters=dict(node.parameters),
                depends_on=list(node.depends_on),
            ))
            for dep in node.depends_on:
                ctx.canvas.add_edge(dep, node.id)
        ctx.pipeline_canvas_state = ctx.canvas.to_text()

        return ToolResult.ok({
            "pipeline_id": definition.id,
            "template": template_key,
            "name": definition.name,
            "max_rounds": definition.max_rounds,
            "node_count": len(definition.nodes),
            "nodes": [n.to_dict() for n in definition.nodes],
            "status": "created",
            "message": (
                f"Pipeline '{definition.name}' designed with {len(definition.nodes)} "
                f"nodes. It is now visible on the canvas. "
                "Click Save to persist it, then run it from the Pipelines page."
            ),
        })
    except Exception as exc:
        logger.exception("run_pipeline failed")
        return ToolResult.fail(str(exc))


create_pipeline_tool = build_tool(AgentToolDef(
    name="create_pipeline",
    description=(
        "Design a pipeline from a template and visualize it on the canvas. "
        "Does NOT execute — the user runs it from the Pipelines page. "
        "Templates: 'gfp11' (brightness optimization), 'design' (sequence generation), "
        "'screening' (variant screening)."
    ),
    input_schema=CreatePipelineInput,
    call=_create_pipeline_call,
))


# ── save_pipeline ────────────────────────────────────────────────────────


class _NodeSpec(BaseModel):
    """A single node in the pipeline."""
    tool_name: str = Field(..., description="Computer ID (e.g. 'protgpt2', 'omegafold', 'foldx')")
    label: str = Field(default="", description="Display label for this node")
    connect_from: str = Field(default="", description="tool_name of the upstream node to connect from")


class SavePipelineInput(BaseModel):
    name: str = Field(
        default="",
        description="Name for the saved pipeline. If empty, auto-generates one.",
    )
    description: str = Field(
        default="",
        description="Optional description of the pipeline.",
    )
    nodes: list[_NodeSpec] = Field(
        default_factory=list,
        description=(
            "Pipeline nodes to save. Required when the canvas is not open. "
            "Each node needs a tool_name and optional label/connect_from. "
            "Example: [{\"tool_name\": \"protgpt2\", \"label\": \"Generate\"}, "
            "{\"tool_name\": \"omegafold\", \"label\": \"Fold\", \"connect_from\": \"protgpt2\"}]"
        ),
    )


async def _save_pipeline_call(
    inputs: dict, ctx,
) -> ToolResult:
    name = str(inputs.get("name", "")).strip()
    description = str(inputs.get("description", "")).strip()

    # If nodes were passed directly (from chat mode), populate the canvas
    raw_nodes = inputs.get("nodes", [])
    if raw_nodes and ctx.canvas.is_empty:
        import uuid
        prev_id = ""
        for raw in raw_nodes:
            tool_name = raw.get("tool_name", "").strip()
            if not tool_name:
                continue
            if tool_name not in ALLOWED_CANVAS_TOOLS:
                return ToolResult.fail(
                    f"'{tool_name}' is not a valid computer. "
                    f"Available: {', '.join(sorted(ALLOWED_CANVAS_TOOLS))}"
                )
            node_id = f"{tool_name}-{uuid.uuid4().hex[:6]}"
            label = raw.get("label", "").strip() or tool_name
            connect_from = raw.get("connect_from", "").strip()

            # Resolve connect_from by tool_name to node_id
            source_id = ""
            if connect_from:
                for existing in ctx.canvas.nodes.values():
                    if existing.tool_name == connect_from or existing.id == connect_from:
                        source_id = existing.id
                        break
            if not source_id and prev_id and not connect_from:
                # Auto-chain: connect sequentially if no explicit connection
                source_id = prev_id

            ctx.canvas.add_node(CanvasNode(
                id=node_id,
                tool_name=tool_name,
                label=label,
                depends_on=[source_id] if source_id else [],
            ))
            if source_id:
                ctx.canvas.add_edge(source_id, node_id)
            prev_id = node_id
        ctx.pipeline_canvas_state = ctx.canvas.to_text()

    # Read from the structured canvas tracker (primary) or fall back to
    # the legacy text-based canvas_state (for frontend-synced state).
    if ctx.canvas.is_empty:
        # Try parsing legacy text as a fallback
        canvas_state = getattr(ctx, "pipeline_canvas_state", "")
        if not canvas_state or "empty" in canvas_state.lower():
            return ToolResult.fail(
                "Canvas is empty \u2014 there are no nodes to save. "
                "Add computers to the canvas first, then try saving again."
            )
        # Parse legacy format into tracker
        for line in canvas_state.split("\n"):
            if line.startswith("Nodes on canvas:"):
                node_text = line.replace("Nodes on canvas:", "").strip()
                for part in node_text.split(" \u2192 "):
                    part = part.strip()
                    if "(" in part and part.endswith(")"):
                        label = part[:part.rfind("(")].strip()
                        node_id = part[part.rfind("(") + 1:part.rfind(")")]
                        tool_name = node_id.rsplit("-", 1)[0] if "-" in node_id else node_id
                        ctx.canvas.add_node(CanvasNode(
                            id=node_id, tool_name=tool_name, label=label,
                        ))
            if line.startswith("Connections:"):
                conn_text = line.replace("Connections:", "").strip()
                for conn in conn_text.split(", "):
                    parts = conn.split(" \u2192 ")
                    if len(parts) == 2:
                        ctx.canvas.add_edge(parts[0].strip(), parts[1].strip())

    if ctx.canvas.is_empty:
        return ToolResult.fail(
            "Could not parse canvas nodes. Ensure computers are on the canvas."
        )

    nodes_data = ctx.canvas.to_nodes_data()

    if not name:
        name = f"Pipeline {__import__('datetime').datetime.now().strftime('%b %d %H:%M')}"

    if not description:
        description = "Custom pipeline saved from Agent Console"

    # Persist directly to the database (no HTTP call needed)
    try:
        from synqlab.storage.db import get_session as get_db_session
        from synqlab.storage.models import Pipeline, PipelineVersion

        user_id = getattr(ctx, "user_id", "system")
        db = get_db_session()
        try:
            pipeline = Pipeline(
                name=name,
                description=description,
                created_by=user_id,
            )
            db.add(pipeline)
            db.flush()

            pv = PipelineVersion(
                pipeline_id=pipeline.id,
                version=1,
                config_jsonb={"nodes": nodes_data},
                changelog="Initial version from Agent Console",
                created_by=user_id,
            )
            db.add(pv)
            db.commit()
            db.refresh(pipeline)

            return ToolResult.ok({
                "status": "saved",
                "pipeline_id": pipeline.id,
                "name": name,
                "node_count": len(nodes_data),
                "message": (
                    f"Pipeline '{name}' saved with {len(nodes_data)} nodes. "
                    "You can find it under 'My Pipelines' on the Pipelines page."
                ),
            })
        finally:
            db.close()
    except Exception as exc:
        logger.exception("save_pipeline failed")
        return ToolResult.fail(str(exc))


save_pipeline_tool = build_tool(AgentToolDef(
    name="save_pipeline",
    description=(
        "Save a pipeline definition. Works in two modes: "
        "(1) If the pipeline canvas is open, saves the nodes currently on the canvas. "
        "(2) If in chat mode (no canvas), pass the 'nodes' parameter with a list of "
        "computers to include. Each node needs a tool_name (e.g. 'protgpt2', 'omegafold', "
        "'foldx'). Nodes are auto-chained in order unless connect_from is specified. "
        "The saved pipeline appears under 'My Pipelines' on the Pipelines page."
    ),
    input_schema=SavePipelineInput,
    call=_save_pipeline_call,
))


# ── open_canvas ──────────────────────────────────────────────────────────


class OpenCanvasInput(BaseModel):
    """No inputs needed — just opens the pipeline canvas."""
    pass


async def _open_canvas_call(
    inputs: dict, ctx,
) -> ToolResult:
    return ToolResult.ok({
        "action": "open_canvas",
        "message": "Pipeline canvas is now open. You can drag computers onto it or ask me to add nodes.",
    })


open_canvas_tool = build_tool(AgentToolDef(
    name="open_canvas",
    description=(
        "Open the pipeline canvas in split-screen mode. "
        "Call this when the user asks to open, view, or work with the pipeline canvas, "
        "or when they want to start designing a workflow. "
        "Costs nothing — just opens the visual canvas panel."
    ),
    input_schema=OpenCanvasInput,
    call=_open_canvas_call,
))


# ── add_canvas_node ──────────────────────────────────────────────────────


class AddCanvasNodeInput(BaseModel):
    tool_name: str = Field(
        ...,
        description=(
            "The computer ID to add to the canvas. Examples: "
            "'protgpt2', 'omegafold', 'foldx', 'spserver', "
            "'score_brightness', 'propose_variants', 'validate_complex'."
        ),
    )
    label: str = Field(
        default="",
        description="Display label for the node. If empty, uses the computer name.",
    )
    connect_from: str = Field(
        default="",
        description=(
            "Node ID to connect FROM (this node becomes a downstream target). "
            "Use a node ID from the current canvas state. Leave empty for no connection."
        ),
    )


async def _add_canvas_node_call(
    inputs: dict, ctx,
) -> ToolResult:
    tool_name = str(inputs.get("tool_name", "")).strip()
    label = str(inputs.get("label", "")).strip() or tool_name
    connect_from = str(inputs.get("connect_from", "")).strip()

    if not tool_name:
        return ToolResult.fail("tool_name is required")

    # Validate against the hardcoded allowlist — only real sidebar
    # computers may be placed on the canvas.
    if tool_name not in ALLOWED_CANVAS_TOOLS:
        sorted_tools = ", ".join(sorted(ALLOWED_CANVAS_TOOLS))
        return ToolResult.fail(
            f"'{tool_name}' is not a valid computer. "
            f"Available computers: {sorted_tools}"
        )

    import uuid
    node_id = f"{tool_name}-{uuid.uuid4().hex[:6]}"

    # ── Update canvas tracker ──────────────────────────────────────────
    ctx.canvas.add_node(CanvasNode(
        id=node_id,
        tool_name=tool_name,
        label=label,
        depends_on=[connect_from] if connect_from else [],
    ))
    if connect_from:
        ctx.canvas.add_edge(connect_from, node_id)
    ctx.pipeline_canvas_state = ctx.canvas.to_text()

    result: dict[str, Any] = {
        "action": "add_node",
        "node": {
            "id": node_id,
            "tool_name": tool_name,
            "label": label,
            "parameters": {},
            "depends_on": [connect_from] if connect_from else [],
        },
        "message": f"Added '{label}' to the canvas as node '{node_id}'.",
    }

    if connect_from:
        result["edge"] = {
            "id": f"{connect_from}-{node_id}",
            "source": connect_from,
            "target": node_id,
        }
        result["message"] += f" Connected from '{connect_from}'."

    return ToolResult.ok(result)


add_canvas_node_tool = build_tool(AgentToolDef(
    name="add_canvas_node",
    description=(
        "Add a single compute node to the pipeline canvas. "
        "Optionally connect it from an existing node. "
        "Use this to build pipelines incrementally — one node at a time. "
        "Check the current canvas state to know existing node IDs before connecting."
    ),
    input_schema=AddCanvasNodeInput,
    call=_add_canvas_node_call,
))


# ── connect_canvas_nodes ─────────────────────────────────────────────────


class ConnectCanvasNodesInput(BaseModel):
    source_id: str = Field(
        ...,
        description="Node ID of the source (upstream) node.",
    )
    target_id: str = Field(
        ...,
        description="Node ID of the target (downstream) node.",
    )


async def _connect_canvas_nodes_call(
    inputs: dict, ctx,
) -> ToolResult:
    source_id = str(inputs.get("source_id", "")).strip()
    target_id = str(inputs.get("target_id", "")).strip()

    if not source_id or not target_id:
        return ToolResult.fail("Both source_id and target_id are required")

    # ── Update canvas tracker ──────────────────────────────────────────
    ctx.canvas.add_edge(source_id, target_id)
    ctx.pipeline_canvas_state = ctx.canvas.to_text()

    return ToolResult.ok({
        "action": "connect_nodes",
        "edge": {
            "id": f"{source_id}-{target_id}",
            "source": source_id,
            "target": target_id,
        },
        "message": f"Connected '{source_id}' → '{target_id}'.",
    })


connect_canvas_nodes_tool = build_tool(AgentToolDef(
    name="connect_canvas_nodes",
    description=(
        "Connect two existing nodes on the pipeline canvas. "
        "Creates a directed edge from source to target. "
        "Check the current canvas state to know the node IDs."
    ),
    input_schema=ConnectCanvasNodesInput,
    call=_connect_canvas_nodes_call,
))

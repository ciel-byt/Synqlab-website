"""Agent context — session-scoped state passed to every tool call.

Mirrors Claude Code's ``ToolUseContext``: a bag of capabilities and
references that tools use to interact with the broader system without
importing it directly.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Canvas tracker — keeps the agent's view of the pipeline canvas in sync
# ---------------------------------------------------------------------------

@dataclass
class CanvasNode:
    """A single compute node on the pipeline canvas."""
    id: str
    tool_name: str
    label: str
    parameters: dict[str, Any] = field(default_factory=dict)
    depends_on: list[str] = field(default_factory=list)


@dataclass
class CanvasEdge:
    """A directed edge between two canvas nodes."""
    source: str
    target: str


@dataclass
class CanvasTracker:
    """In-memory tracker of the pipeline canvas state.

    Mutated by canvas-modifying tools (add_canvas_node, connect_canvas_nodes,
    create_pipeline). Serialized to a text summary for the LLM system prompt.
    """
    nodes: dict[str, CanvasNode] = field(default_factory=dict)
    edges: list[CanvasEdge] = field(default_factory=list)

    def add_node(self, node: CanvasNode) -> None:
        self.nodes[node.id] = node

    def add_edge(self, source: str, target: str) -> None:
        self.edges.append(CanvasEdge(source=source, target=target))
        # Also update the target node's depends_on list.
        if target in self.nodes and source not in self.nodes[target].depends_on:
            self.nodes[target].depends_on.append(source)

    def clear(self) -> None:
        self.nodes.clear()
        self.edges.clear()

    @property
    def is_empty(self) -> bool:
        return len(self.nodes) == 0

    def to_nodes_data(self) -> list[dict[str, Any]]:
        """Export nodes as dicts suitable for pipeline persistence."""
        return [
            {
                "id": n.id,
                "tool_name": n.tool_name,
                "label": n.label,
                "parameters": n.parameters,
                "depends_on": n.depends_on,
            }
            for n in self.nodes.values()
        ]

    def to_text(self) -> str:
        """Serialize to a human-readable summary for the LLM system prompt."""
        if not self.nodes:
            return "Canvas is empty — no nodes added yet."
        lines = []
        node_labels = [f"{n.label} ({n.id})" for n in self.nodes.values()]
        lines.append(f"Nodes on canvas: {' → '.join(node_labels)}")
        if self.edges:
            edge_strs = [f"{e.source} → {e.target}" for e in self.edges]
            lines.append(f"Connections: {', '.join(edge_strs)}")
        return "\n".join(lines)


@dataclass
class AgentContext:
    """Immutable-ish context bag threaded through every tool invocation.

    Inspired by Claude Code's ``ToolUseContext`` — each agent session
    gets its own context so tools can read project/org scope, access
    the DB session, and emit progress without global state.
    """

    # ── Identity ──────────────────────────────────────────────────────
    session_id: str
    user_id: str
    org_id: str
    project_id: Optional[str] = None

    # ── Runtime ───────────────────────────────────────────────────────
    db_session: Any = None  # SQLAlchemy Session (optional, lazy)
    abort: bool = False

    # ── Tool registry reference (backref for nested dispatch) ─────────
    tool_registry: dict[str, Any] = field(default_factory=dict)

    # ── Accumulated tool outputs for the current turn ─────────────────
    tool_results: list[dict[str, Any]] = field(default_factory=list)

    # ── PDB dependency tracking (ported from GFP11 ToolDispatcher) ────
    known_pdb_paths: set[str] = field(default_factory=set)

    # ── Coordinator / sub-agent support ───────────────────────────────
    task_manager: Any = None  # TaskManager (set for coordinator sessions)
    parent_task_id: Optional[str] = None  # set on worker contexts

    # ── Skill system ──────────────────────────────────────────────────
    active_skills: list[Any] = field(default_factory=list)  # list of Skill objects

    # ── Pipeline workshop mode ────────────────────────────────────────
    pipeline_mode: bool = False
    pipeline_canvas_state: str = ""  # serialized summary of canvas nodes
    canvas: CanvasTracker = field(default_factory=CanvasTracker)

    # ── Autonomy mode approval system ─────────────────────────────────
    _pending_approvals: dict[str, asyncio.Future[bool]] = field(
        default_factory=dict, repr=False,
    )

    def request_abort(self) -> None:
        """Signal cancellation to the engine loop."""
        self.abort = True
        # Resolve any pending approvals so the engine unblocks.
        for fut in self._pending_approvals.values():
            if not fut.done():
                fut.set_result(False)

    async def wait_for_approval(self, key: str, timeout: float = 300.0) -> bool:
        """Block until ``approve_tool`` or ``reject_tool`` is called for *key*.

        Returns True if approved, False if rejected or timed out.
        """
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[bool] = loop.create_future()
        self._pending_approvals[key] = fut
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("Approval timed out for %s", key)
            return False
        finally:
            self._pending_approvals.pop(key, None)

    def approve_tool(self, key: str) -> None:
        """Resolve a pending approval as approved."""
        fut = self._pending_approvals.get(key)
        if fut and not fut.done():
            fut.set_result(True)

    def reject_tool(self, key: str) -> None:
        """Resolve a pending approval as rejected."""
        fut = self._pending_approvals.get(key)
        if fut and not fut.done():
            fut.set_result(False)

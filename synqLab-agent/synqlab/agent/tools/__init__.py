"""Built-in agent tools — tool registry for the agent system.

Each tool bridges the agent's function-calling layer to SynqLab's
existing compute infrastructure (adapters, executors, APIs).
"""

from __future__ import annotations

from synqlab.agent.tool import AgentTool, build_tool

# Import individual tool builders.
from synqlab.agent.tools.protein_folding import protein_folding_tool
from synqlab.agent.tools.sequence_generation import sequence_generation_tool
from synqlab.agent.tools.stability_analysis import stability_analysis_tool
from synqlab.agent.tools.literature_search import literature_search_tool
from synqlab.agent.tools.read_artifact import read_artifact_tool
from synqlab.agent.tools.list_pdb_samples import list_pdb_samples_tool
from synqlab.agent.tools.write_report import write_report_tool
from synqlab.agent.tools.save_artifact import save_artifact_tool

# GFP11 science tools (Phase 23).
from synqlab.agent.tools.score_brightness import score_brightness_tool
from synqlab.agent.tools.validate_complex import validate_complex_tool
from synqlab.agent.tools.score_interaction import score_interaction_tool
from synqlab.agent.tools.score_stability import score_stability_tool
from synqlab.agent.tools.propose_variants import propose_variants_tool

# Console ↔ Pipeline integration tools (Phase 23).
from synqlab.agent.tools.pipeline_integration import (
    read_pipeline_results_tool,
    create_pipeline_tool,
    save_pipeline_tool,
    open_canvas_tool,
    add_canvas_node_tool,
    connect_canvas_nodes_tool,
)

# Coordinator-only tools.
from synqlab.agent.tools.spawn_worker import spawn_worker_tool
from synqlab.agent.tools.send_message import send_message_tool
from synqlab.agent.tools.stop_task import stop_task_tool
from synqlab.agent.tools.list_tasks import list_tasks_tool

# Skill discovery tools (available to all agent types).
from synqlab.agent.tools.list_skills import list_skills_tool
from synqlab.agent.tools.activate_skill import activate_skill_tool


# ── Tool sets ────────────────────────────────────────────────────────────

_SCIENCE_TOOLS: list[AgentTool] = [
    protein_folding_tool,
    sequence_generation_tool,
    stability_analysis_tool,
    literature_search_tool,
    read_artifact_tool,
    write_report_tool,
    save_artifact_tool,
    list_pdb_samples_tool,
    # GFP11 science tools (Phase 23)
    score_brightness_tool,
    validate_complex_tool,
    score_interaction_tool,
    score_stability_tool,
    propose_variants_tool,
    # Console ↔ Pipeline integration (Phase 23)
    read_pipeline_results_tool,
    create_pipeline_tool,
    save_pipeline_tool,
    open_canvas_tool,
    add_canvas_node_tool,
    connect_canvas_nodes_tool,
]

_COORDINATOR_TOOLS: list[AgentTool] = [
    spawn_worker_tool,
    send_message_tool,
    stop_task_tool,
    list_tasks_tool,
]

_SKILL_TOOLS: list[AgentTool] = [
    list_skills_tool,
    activate_skill_tool,
]

# Agent types that use coordinator (restricted) tools.
_COORDINATOR_TYPES = {"coordinator", "research_director"}


def get_all_agent_tools() -> list[AgentTool]:
    """Return the complete list of built-in agent tools.

    Mirrors Claude Code's ``getAllBaseTools()`` — the single source of truth
    for which tools are available in the system.
    """
    return _SCIENCE_TOOLS + _COORDINATOR_TOOLS + _SKILL_TOOLS


def get_worker_tools() -> list[AgentTool]:
    """Return science + skill tools for worker agents."""
    return [t for t in (_SCIENCE_TOOLS + _SKILL_TOOLS) if t.is_enabled()]


def get_coordinator_tools() -> list[AgentTool]:
    """Return coordinator tools + skill tools."""
    return [t for t in (_COORDINATOR_TOOLS + _SKILL_TOOLS) if t.is_enabled()]


def get_tools_for_agent_type(agent_type: str) -> list[AgentTool]:
    """Return tools available for a specific agent type.

    Coordinator types get management + skill tools.
    GFP11 pipeline gets science + skill tools (adapters registered in v2 registry).
    Worker/standard types get science + skill tools.
    """
    if agent_type in _COORDINATOR_TYPES:
        return get_coordinator_tools()
    # gfp11_pipeline uses the same science tools — the GFP11 adapters
    # (brightness_model, complex_stability, pyrosetta, spserver) are resolved
    # at runtime via the adapter registry when tools invoke them.
    return get_worker_tools()


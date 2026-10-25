"""activate_skill — agent tool to load a skill into the current session.

When activated, the skill's markdown body is appended to the system prompt,
giving the agent detailed workflow instructions.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class ActivateSkillInput(BaseModel):
    skill_id: str = Field(
        description="ID of the skill to activate (from list_skills results)",
    )


async def _activate_skill_call(args: dict[str, Any], context: Any) -> ToolResult:
    from synqlab.agent.context import AgentContext
    from synqlab.agent.skill import get_skill_loader

    ctx: AgentContext = context
    skill_id = args["skill_id"]

    loader = get_skill_loader()
    skill = loader.get_skill(skill_id)

    if not skill:
        return ToolResult.fail(f"Skill '{skill_id}' not found. Use list_skills to see available skills.")

    # Check if already active.
    active_ids = [s.id for s in ctx.active_skills]
    if skill_id in active_ids:
        return ToolResult.ok({
            "skill_id": skill_id,
            "name": skill.name,
            "message": f"Skill '{skill.name}' is already active.",
        })

    # Add to active skills on the context.
    ctx.active_skills.append(skill)
    logger.info("Skill activated: %s (%s)", skill.name, skill.id)

    return ToolResult.ok({
        "skill_id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "tools_needed": skill.tools,
        "message": (
            f"Skill '{skill.name}' activated. Detailed workflow instructions are now "
            f"loaded into your context. Follow the skill's phases step by step."
        ),
    })


activate_skill_tool = build_tool(AgentToolDef(
    name="activate_skill",
    description=(
        "Activate a skill to load its detailed workflow instructions. "
        "Once activated, the skill's step-by-step protocol becomes part of "
        "your instructions. Use list_skills first to find available skills."
    ),
    input_schema=ActivateSkillInput,
    call=_activate_skill_call,
))

"""list_skills — agent tool to browse available skills."""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from synqlab.agent.tool import AgentToolDef, ToolResult, build_tool

logger = logging.getLogger(__name__)


class ListSkillsInput(BaseModel):
    query: str = Field(
        default="",
        description="Optional search query to filter skills by name, description, or tags",
    )
    agent_type: str = Field(
        default="",
        description="Optional agent type to filter compatible skills",
    )


async def _list_skills_call(args: dict[str, Any], context: Any) -> ToolResult:
    from synqlab.agent.skill import get_skill_loader

    loader = get_skill_loader()
    query = args.get("query", "")
    agent_type = args.get("agent_type", "")

    if query:
        skills = loader.search_skills(query)
    elif agent_type:
        skills = loader.get_skills_for_agent_type(agent_type)
    else:
        skills = loader.get_all_skills()

    summaries = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "tags": s.tags,
            "agent_types": s.agent_types,
            "autonomy_default": s.autonomy_default,
            "source": s.source,
        }
        for s in skills
    ]

    return ToolResult.ok({
        "total_skills": len(summaries),
        "skills": summaries,
    })


list_skills_tool = build_tool(AgentToolDef(
    name="list_skills",
    description=(
        "Browse available skills (scientific workflows). "
        "Optionally filter by search query or agent type. "
        "Returns skill IDs, names, descriptions, and tags."
    ),
    input_schema=ListSkillsInput,
    call=_list_skills_call,
    is_read_only=True,
))

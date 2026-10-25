"""Skills REST API — CRUD for agent skills.

Merges core skills (filesystem) with user-created skills (DB) into a
unified API. Core skills are read-only; user skills are org-scoped.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from synqlab.agent.models import AgentSkill
from synqlab.agent.skill import Skill, get_skill_loader
from synqlab.storage.db import get_session as get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/skills", tags=["skills"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    version: str
    author: str | None
    tags: list[str]
    agent_types: list[str]
    tools: list[str]
    autonomy_default: str
    body: str
    source: str  # "core" or "user"


class CreateSkillRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    version: str = "1.0.0"
    author: str | None = None
    tags: list[str] = Field(default_factory=list)
    agent_types: list[str] = Field(default_factory=lambda: ["general"])
    tools: list[str] = Field(default_factory=list)
    autonomy_default: str = "autonomous"
    body: str = ""


class UpdateSkillRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    version: str | None = None
    author: str | None = None
    tags: list[str] | None = None
    agent_types: list[str] | None = None
    tools: list[str] | None = None
    autonomy_default: str | None = None
    body: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _db_skill_to_response(s: AgentSkill) -> SkillResponse:
    return SkillResponse(
        id=s.id,
        name=s.name,
        description=s.description,
        version=s.version,
        author=s.author,
        tags=s.tags or [],
        agent_types=s.agent_types or [],
        tools=s.tools or [],
        autonomy_default=s.autonomy_default,
        body=s.body,
        source="user",
    )


def _core_skill_to_response(s: Skill) -> SkillResponse:
    return SkillResponse(
        id=s.id,
        name=s.name,
        description=s.description,
        version=s.version,
        author=s.author,
        tags=s.tags,
        agent_types=s.agent_types,
        tools=s.tools,
        autonomy_default=s.autonomy_default,
        body=s.body,
        source="core",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[SkillResponse])
async def list_skills(request: Request, query: str = "", agent_type: str = ""):
    """List all skills (core + user), with optional search/filter."""
    loader = get_skill_loader()

    # Core skills.
    if query:
        core = loader.search_skills(query)
    elif agent_type:
        core = loader.get_skills_for_agent_type(agent_type)
    else:
        core = loader.get_all_skills()

    results = [_core_skill_to_response(s) for s in core]

    # User skills from DB.
    db = get_db_session()
    try:
        db_q = db.query(AgentSkill).filter(AgentSkill.is_active.is_(True))
        if query:
            db_q = db_q.filter(AgentSkill.name.ilike(f"%{query}%"))
        user_skills = db_q.order_by(AgentSkill.created_at.desc()).limit(100).all()
        results.extend([_db_skill_to_response(s) for s in user_skills])
    finally:
        db.close()

    return results


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: str):
    """Get a single skill by ID (checks core first, then DB)."""
    loader = get_skill_loader()
    core = loader.get_skill(skill_id)
    if core:
        return _core_skill_to_response(core)

    db = get_db_session()
    try:
        db_skill = db.query(AgentSkill).filter_by(id=skill_id).first()
        if db_skill:
            return _db_skill_to_response(db_skill)
    finally:
        db.close()

    raise HTTPException(status_code=404, detail="Skill not found")


@router.post("/", response_model=SkillResponse, status_code=201)
async def create_skill(request: Request, body: CreateSkillRequest):
    """Create a user skill (stored in DB, scoped to org)."""
    org_id = getattr(request.state, "org_id", "default")

    db = get_db_session()
    try:
        skill = AgentSkill(
            org_id=org_id,
            name=body.name,
            description=body.description,
            version=body.version,
            author=body.author,
            tags=body.tags,
            agent_types=body.agent_types,
            tools=body.tools,
            autonomy_default=body.autonomy_default,
            body=body.body,
        )
        db.add(skill)
        db.commit()
        db.refresh(skill)
        return _db_skill_to_response(skill)
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create skill")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        db.close()


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(skill_id: str, body: UpdateSkillRequest):
    """Update a user skill (core skills are read-only)."""
    # Check it's not a core skill.
    loader = get_skill_loader()
    if loader.get_skill(skill_id):
        raise HTTPException(status_code=403, detail="Core skills are read-only")

    db = get_db_session()
    try:
        skill = db.query(AgentSkill).filter_by(id=skill_id).first()
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        for field_name, value in body.model_dump(exclude_none=True).items():
            setattr(skill, field_name, value)

        db.commit()
        db.refresh(skill)
        return _db_skill_to_response(skill)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        db.close()


@router.delete("/{skill_id}", status_code=204)
async def delete_skill(skill_id: str):
    """Delete a user skill (core skills cannot be deleted)."""
    loader = get_skill_loader()
    if loader.get_skill(skill_id):
        raise HTTPException(status_code=403, detail="Core skills cannot be deleted")

    db = get_db_session()
    try:
        skill = db.query(AgentSkill).filter_by(id=skill_id).first()
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")

        db.delete(skill)
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        db.close()

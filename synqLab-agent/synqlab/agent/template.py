"""Agent template system — pre-configured agent profiles.

Bundles agent type, skill, autonomy mode, token budget, and model
into one-click deployable configurations for researchers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from synqlab.agent.budget import TokenBudget

logger = logging.getLogger(__name__)


@dataclass
class AgentTemplate:
    """Pre-configured agent profile."""

    id: str
    name: str
    description: str
    agent_type: str          # general | research_director
    skill_id: str | None     # auto-activate this skill
    autonomy_mode: str       # autonomous | supervised | copilot
    budget: TokenBudget | None = None
    model: str = "gpt-4o"
    icon: str = "🧬"
    tags: list[str] = field(default_factory=list)
    source: str = "core"     # core | user

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "agent_type": self.agent_type,
            "skill_id": self.skill_id,
            "autonomy_mode": self.autonomy_mode,
            "budget": self.budget.to_dict() if self.budget else None,
            "model": self.model,
            "icon": self.icon,
            "tags": self.tags,
            "source": self.source,
        }


# ── Core templates ──────────────────────────────────────────────────────────

CORE_TEMPLATES: list[AgentTemplate] = [
    AgentTemplate(
        id="quick-analysis",
        name="Quick Analysis",
        description="Fast, low-cost analysis using GPT-4o Mini. Great for literature searches, sequence comparisons, and quick structural assessments.",
        agent_type="general",
        skill_id=None,
        autonomy_mode="autonomous",
        budget=TokenBudget(session_limit=100_000),
        model="gpt-4o-mini",
        icon="⚡",
        tags=["fast", "low-cost", "general"],
    ),
    AgentTemplate(
        id="protein-optimization",
        name="Protein Optimization",
        description="Supervised protein engineering workflow. Fold structures, analyze stability, and suggest mutations with expert oversight.",
        agent_type="general",
        skill_id=None,
        autonomy_mode="supervised",
        budget=TokenBudget(session_limit=500_000),
        model="gpt-4o",
        icon="🔬",
        tags=["protein", "engineering", "supervised"],
    ),
    AgentTemplate(
        id="binder-design",
        name="Binder Design",
        description="Full autonomous research workflow for designing protein binders. Uses the Research Director protocol with multi-worker orchestration.",
        agent_type="research_director",
        skill_id="research-director-protocol",
        autonomy_mode="autonomous",
        budget=TokenBudget(session_limit=1_000_000),
        model="gpt-4o",
        icon="🧲",
        tags=["binder", "design", "autonomous", "multi-agent"],
    ),
    AgentTemplate(
        id="literature-review",
        name="Literature Review",
        description="Comprehensive literature search and synthesis. Searches databases, summarizes papers, and produces structured review reports.",
        agent_type="general",
        skill_id=None,
        autonomy_mode="autonomous",
        budget=TokenBudget(session_limit=200_000),
        model="gpt-4o-mini",
        icon="📚",
        tags=["literature", "review", "search"],
    ),
    AgentTemplate(
        id="custom-research",
        name="Custom Research",
        description="Flexible research director session with supervisor oversight. Configure skills and parameters as needed.",
        agent_type="research_director",
        skill_id=None,
        autonomy_mode="supervised",
        budget=TokenBudget(session_limit=500_000),
        model="gpt-4o",
        icon="🔧",
        tags=["custom", "flexible", "supervised"],
    ),
]


def get_core_templates() -> list[AgentTemplate]:
    """Return all core templates."""
    return list(CORE_TEMPLATES)


def get_template_by_id(template_id: str) -> AgentTemplate | None:
    """Find a core template by ID."""
    for t in CORE_TEMPLATES:
        if t.id == template_id:
            return t
    return None


def get_all_templates(include_db: bool = True) -> list[AgentTemplate]:
    """Return core + DB-stored templates."""
    templates = list(CORE_TEMPLATES)

    if include_db:
        try:
            from synqlab.agent.models import AgentTemplateRecord
            from synqlab.storage.db import get_session as get_db_session

            db = get_db_session()
            try:
                records = (
                    db.query(AgentTemplateRecord)
                    .filter_by(is_active=True)
                    .order_by(AgentTemplateRecord.name)
                    .all()
                )
                for rec in records:
                    budget_data = rec.budget_json
                    budget = TokenBudget.from_dict(budget_data) if budget_data else None
                    templates.append(AgentTemplate(
                        id=rec.id,
                        name=rec.name,
                        description=rec.description or "",
                        agent_type=rec.agent_type,
                        skill_id=rec.skill_id,
                        autonomy_mode=rec.autonomy_mode,
                        budget=budget,
                        model=rec.model,
                        icon=rec.icon or "🧬",
                        tags=rec.tags_json or [],
                        source="user",
                    ))
            finally:
                db.close()
        except Exception as exc:
            logger.debug("Could not load DB templates: %s", exc)

    return templates

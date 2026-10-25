"""Tests for the agent template system."""

from synqlab.agent.template import (
    AgentTemplate,
    CORE_TEMPLATES,
    get_core_templates,
    get_template_by_id,
)
from synqlab.agent.budget import TokenBudget


class TestAgentTemplate:
    def test_core_templates_exist(self):
        templates = get_core_templates()
        assert len(templates) == 5

    def test_core_template_ids(self):
        ids = {t.id for t in CORE_TEMPLATES}
        expected = {
            "quick-analysis",
            "protein-optimization",
            "binder-design",
            "literature-review",
            "custom-research",
        }
        assert ids == expected

    def test_get_template_by_id(self):
        t = get_template_by_id("quick-analysis")
        assert t is not None
        assert t.name == "Quick Analysis"
        assert t.model == "gpt-4o-mini"
        assert t.source == "core"

    def test_get_template_not_found(self):
        t = get_template_by_id("nonexistent")
        assert t is None

    def test_template_to_dict(self):
        t = get_template_by_id("protein-optimization")
        d = t.to_dict()
        assert d["id"] == "protein-optimization"
        assert d["agent_type"] == "general"
        assert d["autonomy_mode"] == "supervised"
        assert d["budget"] is not None
        assert d["budget"]["session_limit"] == 500_000

    def test_all_templates_have_budgets(self):
        for t in CORE_TEMPLATES:
            assert t.budget is not None, f"{t.id} has no budget"
            assert t.budget.session_limit > 0

    def test_all_templates_have_icons(self):
        for t in CORE_TEMPLATES:
            assert t.icon, f"{t.id} has no icon"

    def test_binder_design_has_skill(self):
        t = get_template_by_id("binder-design")
        assert t.skill_id == "research-director-protocol"
        assert t.autonomy_mode == "autonomous"
        assert t.budget.session_limit == 1_000_000

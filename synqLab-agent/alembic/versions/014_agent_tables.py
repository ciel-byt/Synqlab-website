"""Create agent subsystem tables.

Tables:
  - agent_sessions
  - agent_messages
  - agent_tasks
  - agent_skills
  - agent_artifacts
  - agent_usage
  - agent_templates

Revision ID: 014_agent_tables
Revises: 013_user_professional_profile
Create Date: 2026-04-30
"""

from alembic import op
import sqlalchemy as sa

revision = "014_agent_tables"
down_revision = "013_user_professional_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── agent_sessions ───────────────────────────────────────────────────
    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("org_id", sa.String, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("user_id", sa.String, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_type", sa.Text, nullable=False, server_default="general"),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("status", sa.Text, nullable=False, server_default="active"),
        sa.Column("autonomy_mode", sa.Text, nullable=False, server_default="autonomous"),
        sa.Column("model", sa.Text, nullable=False, server_default="gpt-4o"),
        sa.Column("total_input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_tool_calls", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_agent_sessions_org_id", "agent_sessions", ["org_id"])
    op.create_index("ix_agent_sessions_user_id", "agent_sessions", ["user_id"])

    # ── agent_messages ───────────────────────────────────────────────────
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("session_id", sa.String, sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", sa.Text, nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("tool_calls", sa.JSON, nullable=True),
        sa.Column("tool_call_id", sa.Text, nullable=True),
        sa.Column("tool_name", sa.Text, nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=True),
        sa.Column("output_tokens", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_tasks ──────────────────────────────────────────────────────
    op.create_table(
        "agent_tasks",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("parent_session_id", sa.String, sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("agent_type", sa.Text, nullable=False),
        sa.Column("goal", sa.Text, nullable=False),
        sa.Column("state", sa.Text, nullable=False, server_default="pending"),
        sa.Column("result", sa.JSON, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("worker_session_id", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_skills ─────────────────────────────────────────────────────
    op.create_table(
        "agent_skills",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("org_id", sa.String, nullable=False, index=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("version", sa.Text, nullable=False, server_default="1.0.0"),
        sa.Column("author", sa.Text, nullable=True),
        sa.Column("tags", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("agent_types", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("tools", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("autonomy_default", sa.Text, nullable=False, server_default="autonomous"),
        sa.Column("body", sa.Text, nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_artifacts ──────────────────────────────────────────────────
    op.create_table(
        "agent_artifacts",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("session_id", sa.String, sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("artifact_type", sa.Text, nullable=False),
        sa.Column("content_type", sa.Text, nullable=False),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("file_path", sa.Text, nullable=True),
        sa.Column("metadata_json", sa.JSON, nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_usage ──────────────────────────────────────────────────────
    op.create_table(
        "agent_usage",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("session_id", sa.String, sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("org_id", sa.String, nullable=True, index=True),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tool_calls", sa.Integer, nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("model", sa.Text, nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_templates ──────────────────────────────────────────────────
    op.create_table(
        "agent_templates",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("org_id", sa.String, nullable=True, index=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("agent_type", sa.Text, nullable=False, server_default="general"),
        sa.Column("skill_id", sa.String, nullable=True),
        sa.Column("autonomy_mode", sa.Text, nullable=False, server_default="supervised"),
        sa.Column("model", sa.Text, nullable=False, server_default="gpt-4o"),
        sa.Column("icon", sa.Text, nullable=True, server_default="🧬"),
        sa.Column("tags_json", sa.JSON, nullable=True),
        sa.Column("budget_json", sa.JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_by", sa.String, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("agent_templates")
    op.drop_table("agent_usage")
    op.drop_table("agent_artifacts")
    op.drop_table("agent_skills")
    op.drop_table("agent_tasks")
    op.drop_table("agent_messages")
    op.drop_index("ix_agent_sessions_user_id", "agent_sessions")
    op.drop_index("ix_agent_sessions_org_id", "agent_sessions")
    op.drop_table("agent_sessions")

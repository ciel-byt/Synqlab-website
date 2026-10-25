"""Add skill_id to agent_sessions.

Adds:
  - skill_id (String, nullable) — optional core/user skill attached at session creation

Revision ID: 016_session_skill_id
Revises: 015_agent_artifact_scope
Create Date: 2026-05-03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "016_session_skill_id"
down_revision = "015_agent_artifact_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_sessions",
        sa.Column("skill_id", sa.String, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_sessions", "skill_id")

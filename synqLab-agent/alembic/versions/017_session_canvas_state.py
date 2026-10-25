"""Add canvas_state to agent_sessions.

Revision ID: 017_session_canvas_state
Revises: 016_session_skill_id
"""

from alembic import op
import sqlalchemy as sa

revision = "017_session_canvas_state"
down_revision = "016_session_skill_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agent_sessions",
        sa.Column("canvas_state", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agent_sessions", "canvas_state")

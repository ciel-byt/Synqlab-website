"""add project_id to chat_sessions

Revision ID: 012_chat_session_project
Revises: 011_invite_rejected_at
Create Date: 2026-04-25 16:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "012_chat_session_project"
down_revision = "011_invite_rejected_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("project_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "chat_sessions_project_id_fkey",
        "chat_sessions",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_chat_sessions_project_id",
        "chat_sessions",
        ["project_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_sessions_project_id", table_name="chat_sessions")
    op.drop_constraint("chat_sessions_project_id_fkey", "chat_sessions", type_="foreignkey")
    op.drop_column("chat_sessions", "project_id")

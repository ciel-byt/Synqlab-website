"""add chat kind, sender_id, and chat_participants table

Revision ID: 007_chat_participants
Revises: 006_people_chat
Create Date: 2026-04-19
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "007_chat_participants"
down_revision = "006_people_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add kind to chat_sessions: "ai" | "dm" | "group"
    op.add_column("chat_sessions", sa.Column("kind", sa.Text(), nullable=False, server_default="ai"))

    # Add sender_id to chat_messages (nullable — AI messages have no sender)
    op.add_column("chat_messages", sa.Column("sender_id", sa.Text(), nullable=True))

    # Participants table — tracks who is in a DM or group session
    op.create_table(
        "chat_participants",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "user_id", name="uq_chat_participant"),
    )


def downgrade() -> None:
    op.drop_table("chat_participants")
    op.drop_column("chat_messages", "sender_id")
    op.drop_column("chat_sessions", "kind")

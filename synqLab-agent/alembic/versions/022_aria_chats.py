"""Add aria_chats and aria_chat_messages.

Revision ID: 022_aria_chats
Revises: 021_aria_simulated
"""

from alembic import op
import sqlalchemy as sa

revision = "022_aria_chats"
down_revision = "021_aria_simulated"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "aria_chats",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), nullable=False, index=True),
        sa.Column("version_id", sa.String(), sa.ForeignKey("aria_model_versions.id"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "aria_chat_messages",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("chat_id", sa.String(), sa.ForeignKey("aria_chats.id"), nullable=False, index=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False, server_default=""),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("aria_chat_messages")
    op.drop_table("aria_chats")

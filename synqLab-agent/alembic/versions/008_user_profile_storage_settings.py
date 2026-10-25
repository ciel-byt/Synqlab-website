"""add user sync_dir and storage_path

Revision ID: 008_user_profile_settings
Revises: 007_chat_participants
Create Date: 2026-04-24
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "008_user_profile_settings"
down_revision = "007_chat_participants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sync_dir", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("storage_path", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "storage_path")
    op.drop_column("users", "sync_dir")


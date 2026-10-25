"""add avatar_url to orgs and teams

Revision ID: 009_org_team_avatar
Revises: 008_user_profile_settings
Create Date: 2026-04-24
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "009_org_team_avatar"
down_revision = "008_user_profile_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("avatar_url", sa.Text(), nullable=True))
    op.add_column("teams", sa.Column("avatar_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("teams", "avatar_url")
    op.drop_column("organizations", "avatar_url")


"""Add users.is_admin and users.is_active for the Admin page.

Revision ID: 024_user_admin
Revises: 023_site_news
"""

from alembic import op
import sqlalchemy as sa

revision = "024_user_admin"
down_revision = "023_site_news"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("users", "is_active")
    op.drop_column("users", "is_admin")

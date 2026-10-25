"""drop user sync_dir and storage_path columns

Revision ID: 010_drop_user_storage_cols
Revises: 009_org_team_avatar
Create Date: 2026-04-25 13:08:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "010_drop_user_storage_cols"
down_revision = "009_org_team_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("users", "storage_path")
    op.drop_column("users", "sync_dir")


def downgrade() -> None:
    op.add_column("users", sa.Column("sync_dir", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("storage_path", sa.Text(), nullable=True))


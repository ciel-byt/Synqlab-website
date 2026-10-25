"""add rejected_at to org_invitations

Revision ID: 011_invite_rejected_at
Revises: 010_drop_user_storage_cols
Create Date: 2026-04-25 15:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "011_invite_rejected_at"
down_revision = "010_drop_user_storage_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("org_invitations", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("org_invitations", "rejected_at")


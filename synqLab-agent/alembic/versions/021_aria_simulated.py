"""Add simulated flag to aria_model_versions (demo rounds beyond the recorded runs).

Revision ID: 021_aria_simulated
Revises: 020_aria_models
"""

from alembic import op
import sqlalchemy as sa

revision = "021_aria_simulated"
down_revision = "020_aria_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("aria_model_versions", sa.Column("simulated", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("aria_model_versions", "simulated")

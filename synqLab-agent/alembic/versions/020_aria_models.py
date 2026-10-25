"""Add aria_models and aria_model_versions (Aria demo workspace).

Revision ID: 020_aria_models
Revises: 019_site_requests
"""

from alembic import op
import sqlalchemy as sa

revision = "020_aria_models"
down_revision = "019_site_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "aria_models",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), nullable=False, index=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("data_source", sa.String(), nullable=False),
        sa.Column("family", sa.String(), nullable=True),
        sa.Column("problem", sa.Text(), nullable=True),
        sa.Column("upload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "aria_model_versions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("model_id", sa.String(), sa.ForeignKey("aria_models.id"), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("rounds", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="ready"),
        sa.Column("metrics", sa.JSON(), nullable=True),
        sa.Column("usage", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("aria_model_versions")
    op.drop_table("aria_models")

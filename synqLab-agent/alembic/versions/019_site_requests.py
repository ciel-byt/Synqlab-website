"""Add site_requests: submissions from the marketing site.

Revision ID: 019_site_requests
Revises: 018_site_papers
"""

from alembic import op
import sqlalchemy as sa

revision = "019_site_requests"
down_revision = "018_site_papers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_requests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("org", sa.Text(), nullable=True),
        sa.Column("problem", sa.Text(), nullable=False),
        sa.Column("data_description", sa.Text(), nullable=True),
        sa.Column("family", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default="aria-demo"),
    )


def downgrade() -> None:
    op.drop_table("site_requests")

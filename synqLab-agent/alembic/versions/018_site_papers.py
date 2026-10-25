"""Add site_papers: the public research list.

Revision ID: 018_site_papers
Revises: 017_session_canvas_state
"""

from alembic import op
import sqlalchemy as sa

revision = "018_site_papers"
down_revision = "017_session_canvas_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_papers",
        sa.Column("slug", sa.String(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("authors", sa.Text(), nullable=True),
        sa.Column("venue", sa.Text(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("doi", sa.Text(), nullable=True),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("body", sa.JSON(), nullable=True),
        sa.Column("limits", sa.Text(), nullable=True),
        sa.Column("sort", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("site_papers")

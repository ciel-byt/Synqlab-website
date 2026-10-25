"""Add site_news: static copy of the latest posts shown in the News tab.

Revision ID: 023_site_news
Revises: 022_aria_chats
"""

from alembic import op
import sqlalchemy as sa

revision = "023_site_news"
down_revision = "022_aria_chats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_news",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("image", sa.LargeBinary(), nullable=True),
        sa.Column("image_type", sa.String(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("site_news")

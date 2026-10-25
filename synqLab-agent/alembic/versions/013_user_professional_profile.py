"""add user professional profile fields

Revision ID: 013_user_professional_profile
Revises: 012_chat_session_project
Create Date: 2026-04-26 09:55:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "013_user_professional_profile"
down_revision = "012_chat_session_project"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("professional_title", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("short_bio", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("linkedin_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("scholar_url", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("skills", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "skills")
    op.drop_column("users", "scholar_url")
    op.drop_column("users", "linkedin_url")
    op.drop_column("users", "short_bio")
    op.drop_column("users", "professional_title")


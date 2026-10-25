"""create pipelines and runs tables

Revision ID: 003_pipelines_runs
Revises: 002_teams_projects
Create Date: 2026-04-19
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003_pipelines_runs"
down_revision = "002_teams_projects"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {c["name"] for c in inspector.get_columns(table_name)}


def upgrade() -> None:
    op.create_table(
        "pipelines",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("current_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("forked_from_id", sa.Text(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["forked_from_id"], ["pipelines.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "pipeline_versions",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("pipeline_id", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("config_jsonb", sa.JSON(), nullable=False),
        sa.Column("changelog", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pipeline_id", "version"),
    )

    op.create_table(
        "runs",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("pipeline_id", sa.Text(), nullable=False),
        sa.Column("pipeline_version", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("round_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("config_jsonb", sa.JSON(), nullable=True),
        sa.Column("budget_jsonb", sa.JSON(), nullable=True),
        sa.Column("summary_jsonb", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "candidates",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("run_id", sa.Text(), nullable=False),
        sa.Column("sequence", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="generated"),
        sa.Column("rejection_stage", sa.Text(), nullable=True),
        sa.Column("scores_jsonb", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create `experiments` if it doesn't already exist (legacy SQLite
    # databases created it out-of-band and used to rely on the
    # `_has_table` guards below; fresh Postgres installs have nothing
    # until this migration creates it). Must come AFTER `runs` because
    # experiments.run_id → runs.id, and BEFORE `tool_runs` / `artifacts`
    # which both FK to experiments.id.
    if not _has_table("experiments"):
        op.create_table(
            "experiments",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("run_id", sa.Text(), nullable=True),
            sa.Column("name", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("config_jsonb", sa.JSON(), nullable=True),
            sa.Column("status", sa.Text(), nullable=False, server_default="running"),
            sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    if _has_table("tool_runs"):
        if not _has_column("tool_runs", "run_id"):
            op.add_column("tool_runs", sa.Column("run_id", sa.Text(), nullable=True))
        if not _has_column("tool_runs", "candidate_id"):
            op.add_column("tool_runs", sa.Column("candidate_id", sa.Text(), nullable=True))
        if not _has_column("tool_runs", "tool_version"):
            op.add_column("tool_runs", sa.Column("tool_version", sa.Text(), nullable=True))
        if not _has_column("tool_runs", "gpu_seconds"):
            op.add_column("tool_runs", sa.Column("gpu_seconds", sa.Numeric(), nullable=True))
        if not _has_column("tool_runs", "token_count"):
            op.add_column("tool_runs", sa.Column("token_count", sa.Integer(), nullable=True))
        if not _has_column("tool_runs", "input_hash"):
            op.add_column("tool_runs", sa.Column("input_hash", sa.Text(), nullable=True))
    else:
        op.create_table(
            "tool_runs",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("experiment_id", sa.Text(), nullable=False),
            sa.Column("run_id", sa.Text(), nullable=True),
            sa.Column("candidate_id", sa.Text(), nullable=True),
            sa.Column("round_id", sa.Text(), nullable=False),
            sa.Column("tool_id", sa.Text(), nullable=False),
            sa.Column("tool_version", sa.Text(), nullable=True),
            sa.Column("status", sa.Text(), nullable=False, server_default="running"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("latency_ms", sa.Float(), nullable=True),
            sa.Column("gpu_seconds", sa.Numeric(), nullable=True),
            sa.Column("token_count", sa.Integer(), nullable=True),
            sa.Column("input_hash", sa.Text(), nullable=True),
            sa.Column("request_jsonb", sa.JSON(), nullable=True),
            sa.Column("response_jsonb", sa.JSON(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if _has_table("artifacts"):
        if not _has_column("artifacts", "uri"):
            op.add_column("artifacts", sa.Column("uri", sa.Text(), nullable=True))
        if _has_column("artifacts", "path"):
            op.alter_column("artifacts", "path", nullable=True)
    else:
        op.create_table(
            "artifacts",
            sa.Column("id", sa.Text(), nullable=False),
            sa.Column("experiment_id", sa.Text(), nullable=False),
            sa.Column("tool_run_id", sa.Text(), nullable=True),
            sa.Column("artifact_type", sa.Text(), nullable=False),
            sa.Column("uri", sa.Text(), nullable=True),
            sa.Column("path", sa.Text(), nullable=True),
            sa.Column("format", sa.Text(), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("checksum", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("meta_jsonb", sa.JSON(), nullable=True),
            sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tool_run_id"], ["tool_runs.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    if _has_table("experiments") and not _has_column("experiments", "run_id"):
        op.add_column("experiments", sa.Column("run_id", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column("experiments", "run_id"):
        op.drop_column("experiments", "run_id")

    for col in ("input_hash", "token_count", "gpu_seconds", "tool_version", "candidate_id", "run_id"):
        if _has_column("tool_runs", col):
            op.drop_column("tool_runs", col)

    if _has_column("artifacts", "uri"):
        op.drop_column("artifacts", "uri")

    op.drop_table("candidates")
    op.drop_table("runs")
    op.drop_table("pipeline_versions")
    op.drop_table("pipelines")

    # Symmetric to the conditional create in upgrade(). NOTE: on legacy
    # SQLite databases the table pre-existed this migration, so a
    # downgrade will still drop it — restore from backup if that matters.
    if _has_table("experiments"):
        op.drop_table("experiments")

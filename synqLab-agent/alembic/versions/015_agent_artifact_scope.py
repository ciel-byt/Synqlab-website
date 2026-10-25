"""Add scope + project linkage to agent_artifacts.

Adds:
  - scope (Text, NOT NULL, default 'session') — 'session' | 'project' | 'global'
  - org_id (String, nullable, indexed)
  - project_id (String, nullable, indexed)
  - created_by (String, nullable)
  - content_hash (Text, nullable, indexed) — for idempotent bundled-sample ingest

Relaxes:
  - session_id NOT NULL  ->  NULLABLE (global/project rows have no session)

Backfill:
  - Existing rows: scope='session' (server_default already does this)
  - org_id, project_id joined from agent_sessions

Adds CHECK constraint:
  (scope='session' AND session_id IS NOT NULL) OR
  (scope IN ('project','global') AND session_id IS NULL)

Per Phase 13 D-04, D-08, D-10. Old `agent_messages.tool_calls` JSON
referencing pre-Phase-13 `pdb_path` strings is INTENTIONALLY left as-is
(see 13-RESEARCH.md Pitfall #3).

Revision ID: 015_agent_artifact_scope
Revises: 014_agent_tables
Create Date: 2026-05-01
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "015_agent_artifact_scope"
down_revision = "014_agent_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- New columns ----------------------------------------------------
    op.add_column(
        "agent_artifacts",
        sa.Column("scope", sa.Text, nullable=False, server_default="session"),
    )
    op.add_column(
        "agent_artifacts",
        sa.Column("org_id", sa.String, nullable=True),
    )
    op.add_column(
        "agent_artifacts",
        sa.Column("project_id", sa.String, nullable=True),
    )
    op.add_column(
        "agent_artifacts",
        sa.Column("created_by", sa.String, nullable=True),
    )
    op.add_column(
        "agent_artifacts",
        sa.Column("content_hash", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_agent_artifacts_org_id", "agent_artifacts", ["org_id"]
    )
    op.create_index(
        "ix_agent_artifacts_project_id", "agent_artifacts", ["project_id"]
    )
    op.create_index(
        "ix_agent_artifacts_content_hash", "agent_artifacts", ["content_hash"]
    )
    op.create_index(
        "ix_agent_artifacts_scope", "agent_artifacts", ["scope"]
    )

    # -- Relax session_id NOT NULL -------------------------------------
    op.alter_column(
        "agent_artifacts",
        "session_id",
        existing_type=sa.String(),
        nullable=True,
    )

    # -- Backfill org_id / project_id from agent_sessions JOIN ---------
    # All pre-Phase-13 rows have scope='session' (default). Their org_id
    # and project_id come from their parent agent_sessions row.
    op.execute("""
        UPDATE agent_artifacts AS a
        SET org_id = s.org_id,
            project_id = s.project_id
        FROM agent_sessions AS s
        WHERE a.session_id = s.id
    """)

    # -- CHECK constraint ----------------------------------------------
    op.create_check_constraint(
        "ck_agent_artifacts_scope_session",
        "agent_artifacts",
        "(scope = 'session' AND session_id IS NOT NULL) "
        "OR (scope IN ('project','global') AND session_id IS NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_agent_artifacts_scope_session",
        "agent_artifacts",
        type_="check",
    )
    # NOTE: Restoring session_id NOT NULL requires that no
    # scope IN ('project','global') rows exist. The downgrade assumes
    # the operator has either deleted those rows or accepts the failure.
    op.alter_column(
        "agent_artifacts",
        "session_id",
        existing_type=sa.String(),
        nullable=False,
    )
    op.drop_index("ix_agent_artifacts_scope", "agent_artifacts")
    op.drop_index("ix_agent_artifacts_content_hash", "agent_artifacts")
    op.drop_index("ix_agent_artifacts_project_id", "agent_artifacts")
    op.drop_index("ix_agent_artifacts_org_id", "agent_artifacts")
    op.drop_column("agent_artifacts", "content_hash")
    op.drop_column("agent_artifacts", "created_by")
    op.drop_column("agent_artifacts", "project_id")
    op.drop_column("agent_artifacts", "org_id")
    op.drop_column("agent_artifacts", "scope")

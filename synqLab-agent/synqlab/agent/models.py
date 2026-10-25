"""ORM models for the agent subsystem.

Tables:
  agent_sessions  — top-level conversation session
  agent_messages  — individual messages in a session
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from synqlab.storage.models import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class AgentSession(Base):
    """A single agent conversation session."""

    __tablename__ = "agent_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # "general" | "research_director" | ...
    agent_type = Column(Text, nullable=False, default="general")
    title = Column(Text, nullable=True)

    # "active" | "completed" | "failed" | "cancelled"
    status = Column(Text, nullable=False, default="active")

    # "copilot" | "supervised" | "autonomous"
    autonomy_mode = Column(Text, nullable=False, default="autonomous")

    # Optional skill attached at session creation (core or user-defined)
    skill_id = Column(String, nullable=True)

    # LLM model used (e.g. "gpt-4o")
    model = Column(Text, nullable=False, default="gpt-4o")

    # Running totals for cost tracking
    total_input_tokens = Column(Integer, nullable=False, default=0)
    total_output_tokens = Column(Integer, nullable=False, default=0)
    total_tool_calls = Column(Integer, nullable=False, default=0)

    # Pipeline canvas state — persisted so DAG survives page refresh.
    # Shape: {"nodes": [...], "edges": [...], "name": str} or null.
    canvas_state = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    messages = relationship(
        "AgentMessage",
        back_populates="session",
        order_by="AgentMessage.created_at",
        cascade="all, delete-orphan",
    )


class AgentMessage(Base):
    """A single message in an agent conversation.

    role values: "user" | "assistant" | "tool" | "system"
    """

    __tablename__ = "agent_messages"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(
        String,
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role = Column(Text, nullable=False)  # user | assistant | tool | system
    content = Column(Text, nullable=True)  # text content (nullable for pure tool_use)

    # OpenAI function calling fields
    tool_calls = Column(JSON, nullable=True)   # assistant's tool_use blocks
    tool_call_id = Column(Text, nullable=True)  # for role="tool" — which call this answers
    tool_name = Column(Text, nullable=True)     # for role="tool" — tool name

    # Token accounting for this specific API response
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session = relationship("AgentSession", back_populates="messages")


class AgentTask(Base):
    """A sub-agent task spawned by a coordinator session."""

    __tablename__ = "agent_tasks"

    id = Column(String, primary_key=True, default=_uuid)
    parent_session_id = Column(
        String,
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_type = Column(Text, nullable=False)
    goal = Column(Text, nullable=False)

    # "pending" | "running" | "completed" | "failed" | "killed"
    state = Column(Text, nullable=False, default="pending")

    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)

    # Optional link to the worker's own agent session.
    worker_session_id = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    parent_session = relationship("AgentSession", foreign_keys=[parent_session_id])


class AgentSkill(Base):
    """User-created skill stored in the database (per org)."""

    __tablename__ = "agent_skills"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, nullable=False, index=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=False, default="")
    version = Column(Text, nullable=False, default="1.0.0")
    author = Column(Text, nullable=True)
    tags = Column(JSON, nullable=False, default=list)
    agent_types = Column(JSON, nullable=False, default=list)
    tools = Column(JSON, nullable=False, default=list)
    autonomy_default = Column(Text, nullable=False, default="autonomous")
    body = Column(Text, nullable=False, default="")  # markdown skill content
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


class AgentArtifact(Base):
    """Agent-generated artifact (reports, PDB files, score tables, sequences)."""

    __tablename__ = "agent_artifacts"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(
        String,
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        nullable=True,            # was False; relaxed for scope='global' / 'project' (migration 015)
        index=True,
    )

    name = Column(Text, nullable=False)            # human-readable: "stability_report.md"
    artifact_type = Column(Text, nullable=False)   # markdown_report | pdb_structure | score_table | sequence_fasta
    content_type = Column(Text, nullable=False)    # MIME: text/markdown, chemical/x-pdb, text/csv, text/plain
    content = Column(Text, nullable=True)          # inline content (markdown, scores)
    file_path = Column(Text, nullable=True)        # disk path for large files
    metadata_json = Column(JSON, nullable=True)    # metrics, scores, extra data
    size_bytes = Column(Integer, nullable=True)

    # -- Phase 13: scope + project linkage (migration 015) --------------
    scope = Column(Text, nullable=False, default="session")    # 'session' | 'project' | 'global'
    org_id = Column(String, nullable=True, index=True)
    project_id = Column(String, nullable=True, index=True)
    created_by = Column(String, nullable=True)
    content_hash = Column(Text, nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session = relationship("AgentSession", backref="artifacts")


class AgentUsageRecord(Base):
    """Per-session token usage snapshot for cost tracking."""

    __tablename__ = "agent_usage"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(
        String, ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    org_id = Column(String, nullable=True, index=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    tool_calls = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    model = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session = relationship("AgentSession", backref="usage_records")


class AgentTemplateRecord(Base):
    """User-created agent templates (per-org)."""

    __tablename__ = "agent_templates"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, nullable=True, index=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    agent_type = Column(Text, nullable=False, default="general")
    skill_id = Column(String, nullable=True)
    autonomy_mode = Column(Text, nullable=False, default="supervised")
    model = Column(Text, nullable=False, default="gpt-4o")
    icon = Column(Text, nullable=True, default="🧬")
    tags_json = Column(JSON, nullable=True)
    budget_json = Column(JSON, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)


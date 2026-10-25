"""ORM models for chat sessions, messages, and participants."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import relationship

from synqlab.storage.models import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    # Creator / owner of the session
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # "ai" = LLM assistant, "dm" = direct message, "group" = multi-user
    kind = Column(Text, nullable=False, default="ai")
    title = Column(Text, nullable=True)
    # Optional association with a project — chats can be scoped to project context.
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now, nullable=False)

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        order_by="ChatMessage.created_at",
        cascade="all, delete-orphan",
    )
    participants = relationship(
        "ChatParticipant",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class ChatParticipant(Base):
    """Members of a DM or group chat session."""

    __tablename__ = "chat_participants"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session = relationship("ChatSession", back_populates="participants")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    # role: "user" | "assistant" | "tool"
    role = Column(Text, nullable=False)
    # For people chats: the user who sent the message. None for AI assistant messages.
    sender_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    tool_calls = Column(JSON, nullable=True)
    tool_results = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

    session = relationship("ChatSession", back_populates="messages")

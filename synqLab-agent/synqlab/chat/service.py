"""Service helpers for chat sessions, messages, and participants."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from synqlab.chat.models import ChatMessage, ChatParticipant, ChatSession

logger = logging.getLogger(__name__)


# ── Sessions ──────────────────────────────────────────────────────────────────


def create_session(
    session: Session,
    org_id: str,
    user_id: str,
    kind: str = "ai",
    title: str | None = None,
    participant_ids: list[str] | None = None,
    project_id: str | None = None,
) -> ChatSession:
    """Create a chat session and add the creator + any extra participants."""
    chat = ChatSession(org_id=org_id, user_id=user_id, kind=kind, title=title, project_id=project_id)
    session.add(chat)
    session.flush()

    # Always add the creator as a participant in people chats
    all_participants = set(participant_ids or [])
    if kind in ("dm", "group"):
        all_participants.add(user_id)

    for uid in all_participants:
        session.add(ChatParticipant(session_id=chat.id, user_id=uid))

    session.commit()
    session.refresh(chat)
    return chat


def list_sessions(
    session: Session,
    org_id: str,
    user_id: str,
    kind: str | None = None,
    project_id: str | None = None,
    limit: int = 50,
) -> list[ChatSession]:
    """List sessions the user owns or participates in, newest first."""
    owned = session.query(ChatSession).filter(
        ChatSession.org_id == org_id,
        ChatSession.user_id == user_id,
    )
    # Also find sessions where user is a participant but not the creator
    participated = (
        session.query(ChatSession)
        .join(ChatParticipant, ChatParticipant.session_id == ChatSession.id)
        .filter(
            ChatSession.org_id == org_id,
            ChatParticipant.user_id == user_id,
            ChatSession.user_id != user_id,
        )
    )
    combined = owned.union(participated)
    if kind:
        combined = combined.filter(ChatSession.kind == kind)
    if project_id:
        combined = combined.filter(ChatSession.project_id == project_id)
    return combined.order_by(ChatSession.updated_at.desc()).limit(limit).all()


def get_session_obj(session: Session, session_id: str, user_id: str) -> ChatSession | None:
    """Return a session only if the user owns it or is a participant."""
    chat = session.get(ChatSession, session_id)
    if chat is None:
        return None
    if chat.user_id == user_id:
        return chat
    # Check participation
    participant = (
        session.query(ChatParticipant)
        .filter(ChatParticipant.session_id == session_id, ChatParticipant.user_id == user_id)
        .first()
    )
    return chat if participant else None


def delete_session(session: Session, session_id: str, user_id: str) -> bool:
    """Delete a session — only the creator can delete."""
    chat = session.get(ChatSession, session_id)
    if chat is None or chat.user_id != user_id:
        return False
    session.delete(chat)
    session.commit()
    return True


def rename_session(session: Session, session_id: str, user_id: str, title: str) -> ChatSession | None:
    chat = get_session_obj(session, session_id, user_id)
    if chat is None:
        return None
    chat.title = title.strip()
    session.commit()
    session.refresh(chat)
    return chat


# ── Participants ───────────────────────────────────────────────────────────────


def add_participant(session: Session, session_id: str, user_id: str) -> ChatParticipant | None:
    """Add a user to a chat session (idempotent)."""
    existing = (
        session.query(ChatParticipant)
        .filter(ChatParticipant.session_id == session_id, ChatParticipant.user_id == user_id)
        .first()
    )
    if existing:
        return existing
    participant = ChatParticipant(session_id=session_id, user_id=user_id)
    session.add(participant)
    session.commit()
    session.refresh(participant)
    return participant


def list_participants(session: Session, session_id: str) -> list[ChatParticipant]:
    return (
        session.query(ChatParticipant)
        .filter(ChatParticipant.session_id == session_id)
        .order_by(ChatParticipant.joined_at.asc())
        .all()
    )


def remove_participant(session: Session, session_id: str, user_id: str) -> bool:
    p = (
        session.query(ChatParticipant)
        .filter(ChatParticipant.session_id == session_id, ChatParticipant.user_id == user_id)
        .first()
    )
    if p is None:
        return False
    session.delete(p)
    session.commit()
    return True


# ── Messages ───────────────────────────────────────────────────────────────────


def add_message(
    session: Session,
    session_id: str,
    role: str,
    content: str,
    sender_id: str | None = None,
    tool_calls: list | None = None,
    tool_results: list | None = None,
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sender_id=sender_id,
        tool_calls=tool_calls,
        tool_results=tool_results,
    )
    session.add(msg)
    # Bump session updated_at
    chat = session.get(ChatSession, session_id)
    if chat:
        chat.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(msg)
    return msg


def list_messages(session: Session, session_id: str) -> list[ChatMessage]:
    return (
        session.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

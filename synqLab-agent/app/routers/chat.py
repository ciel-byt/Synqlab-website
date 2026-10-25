"""Chat router — AI assistant sessions and people (DM/group) chat."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from synqlab.auth.dependencies import get_current_user
from synqlab.auth.models import User
from synqlab.auth.service import get_org_member, get_user_by_id, list_orgs_for_user
from synqlab.chat.llm import chat_complete
from synqlab.chat.models import ChatSession
from synqlab.chat.service import (
    add_message,
    add_participant,
    create_session,
    delete_session,
    get_session_obj,
    list_messages,
    list_participants,
    list_sessions,
    remove_participant,
    rename_session,
)
from synqlab.storage.db import get_session

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class SessionCreateRequest(BaseModel):
    org_id: str
    # "ai" | "dm" | "group"
    kind: str = "ai"
    title: str | None = None
    # User IDs to add as participants (for dm/group)
    participant_ids: list[str] = []
    # Optional project association
    project_id: str | None = None


class SessionRenameRequest(BaseModel):
    title: str


class SessionResponse(BaseModel):
    id: str
    org_id: str
    kind: str
    title: str | None
    created_at: str
    updated_at: str
    project_id: str | None = None
    project_name: str | None = None
    # For DM/group: list of participant user IDs (populated on list/get)
    participant_ids: list[str] = []


class ParticipantUser(BaseModel):
    user_id: str
    full_name: str
    email: str
    avatar_url: str | None


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    sender_id: str | None
    sender_name: str | None
    sender_avatar: str | None
    content: str
    tool_calls: list | None
    tool_results: list | None
    created_at: str


class SendMessageRequest(BaseModel):
    content: str


class AddParticipantRequest(BaseModel):
    user_id: str


# ── Helpers ──────────────────────────────────────────────────────────────────


def _require_org_member(db, org_id: str, user_id: str) -> None:
    if get_org_member(db, org_id, user_id) is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization.")


def _serialize_session(
    s: ChatSession,
    participant_ids: list[str] | None = None,
    project_name: str | None = None,
) -> SessionResponse:
    return SessionResponse(
        id=s.id,
        org_id=s.org_id,
        kind=s.kind,
        title=s.title,
        created_at=s.created_at.isoformat() if s.created_at else "",
        updated_at=s.updated_at.isoformat() if s.updated_at else "",
        project_id=s.project_id,
        project_name=project_name,
        participant_ids=participant_ids or [],
    )


def _get_participant_ids(db, session_id: str) -> list[str]:
    return [p.user_id for p in list_participants(db, session_id)]


def _auto_title_dm(db, session_id: str, creator_id: str) -> str | None:
    """For DMs, title = the other person's name."""
    ids = _get_participant_ids(db, session_id)
    other_ids = [uid for uid in ids if uid != creator_id]
    if not other_ids:
        return None
    other = get_user_by_id(db, other_ids[0])
    if other:
        return other.full_name
    return None


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("/sessions", response_model=list[SessionResponse])
def list_my_sessions(
    org_id: str | None = None,
    kind: str | None = None,
    project_id: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[SessionResponse]:
    db = get_session()
    try:
        if org_id:
            _require_org_member(db, org_id, current_user.id)
            sessions = list_sessions(db, org_id, current_user.id, kind=kind, project_id=project_id)
        else:
            orgs = list_orgs_for_user(db, current_user.id)
            sessions = []
            for org in orgs:
                sessions.extend(list_sessions(db, org.id, current_user.id, kind=kind, project_id=project_id))
            sessions.sort(key=lambda s: s.updated_at or s.created_at, reverse=True)

        # Bulk-fetch project names for sessions that have project_id
        project_names: dict[str, str] = {}
        project_ids = {s.project_id for s in sessions if s.project_id}
        if project_ids:
            from synqlab.storage.models import Project
            rows = db.query(Project.id, Project.name).filter(Project.id.in_(project_ids)).all()
            project_names = {pid: name for pid, name in rows}

        result = []
        for s in sessions:
            pids = _get_participant_ids(db, s.id) if s.kind in ("dm", "group") else []
            result.append(_serialize_session(s, pids, project_names.get(s.project_id) if s.project_id else None))
        return result
    finally:
        db.close()


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def new_session(
    body: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    if body.kind not in ("ai", "dm", "group"):
        raise HTTPException(status_code=422, detail="kind must be 'ai', 'dm', or 'group'.")
    if body.kind == "dm" and len(body.participant_ids) != 1:
        raise HTTPException(status_code=422, detail="DM requires exactly one participant.")
    if body.kind == "group" and len(body.participant_ids) < 1:
        raise HTTPException(status_code=422, detail="Group chat requires at least one other participant.")

    db = get_session()
    try:
        _require_org_member(db, body.org_id, current_user.id)
        # Verify all participants are org members
        for uid in body.participant_ids:
            if get_org_member(db, body.org_id, uid) is None:
                raise HTTPException(status_code=422, detail=f"User {uid} is not a member of this organization.")

        # Validate project (must belong to the same org)
        project_name: str | None = None
        if body.project_id:
            from synqlab.storage.models import Project
            project = db.get(Project, body.project_id)
            if project is None or project.org_id != body.org_id:
                raise HTTPException(status_code=422, detail="Project not found in this organization.")
            project_name = project.name

        chat = create_session(
            db,
            org_id=body.org_id,
            user_id=current_user.id,
            kind=body.kind,
            title=body.title,
            participant_ids=body.participant_ids,
            project_id=body.project_id,
        )

        # Auto-title DMs
        if body.kind == "dm" and not chat.title:
            title = _auto_title_dm(db, chat.id, current_user.id)
            if title:
                rename_session(db, chat.id, current_user.id, title)
                db.refresh(chat)

        pids = _get_participant_ids(db, chat.id) if chat.kind in ("dm", "group") else []
        return _serialize_session(chat, pids, project_name)
    finally:
        db.close()


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session_detail(
    session_id: str,
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    db = get_session()
    try:
        chat = get_session_obj(db, session_id, current_user.id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        pids = _get_participant_ids(db, session_id) if chat.kind in ("dm", "group") else []
        project_name: str | None = None
        if chat.project_id:
            from synqlab.storage.models import Project
            proj = db.get(Project, chat.project_id)
            project_name = proj.name if proj else None
        return _serialize_session(chat, pids, project_name)
    finally:
        db.close()


@router.get("/sessions/{session_id}/participants", response_model=list[ParticipantUser])
def get_participants(
    session_id: str,
    current_user: User = Depends(get_current_user),
) -> list[ParticipantUser]:
    db = get_session()
    try:
        chat = get_session_obj(db, session_id, current_user.id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        participants = list_participants(db, session_id)
        result = []
        for p in participants:
            u = get_user_by_id(db, p.user_id)
            if u:
                result.append(ParticipantUser(
                    user_id=u.id,
                    full_name=u.full_name,
                    email=u.email,
                    avatar_url=u.avatar_url,
                ))
        return result
    finally:
        db.close()


@router.post("/sessions/{session_id}/participants", status_code=status.HTTP_201_CREATED)
def add_session_participant(
    session_id: str,
    body: AddParticipantRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    db = get_session()
    try:
        chat = get_session_obj(db, session_id, current_user.id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        if chat.kind == "ai":
            raise HTTPException(status_code=422, detail="Cannot add participants to an AI session.")
        if chat.kind == "dm":
            raise HTTPException(status_code=422, detail="Cannot add more participants to a DM — create a group chat instead.")
        # Must be org member
        if get_org_member(db, chat.org_id, body.user_id) is None:
            raise HTTPException(status_code=422, detail="User is not a member of this organization.")
        add_participant(db, session_id, body.user_id)
        return {"session_id": session_id, "user_id": body.user_id}
    finally:
        db.close()


@router.delete("/sessions/{session_id}/participants/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_session_participant(
    session_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    db = get_session()
    try:
        chat = get_session_obj(db, session_id, current_user.id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        # Only session creator can remove others; anyone can remove themselves
        if user_id != current_user.id and chat.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the chat creator can remove participants.")
        remove_participant(db, session_id, user_id)
    finally:
        db.close()


@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    db = get_session()
    try:
        chat = get_session_obj(db, session_id, current_user.id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        msgs = list_messages(db, session_id)
        result = []
        for m in msgs:
            sender = get_user_by_id(db, m.sender_id) if m.sender_id else None
            result.append(MessageResponse(
                id=m.id,
                session_id=m.session_id,
                role=m.role,
                sender_id=m.sender_id,
                sender_name=sender.full_name if sender else None,
                sender_avatar=sender.avatar_url if sender else None,
                content=m.content,
                tool_calls=m.tool_calls,
                tool_results=m.tool_results,
                created_at=m.created_at.isoformat() if m.created_at else "",
            ))
        return result
    finally:
        db.close()


@router.post("/sessions/{session_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    session_id: str,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    db = get_session()
    try:
        chat = get_session_obj(db, session_id, current_user.id)
        if chat is None:
            raise HTTPException(status_code=404, detail="Session not found.")

        # Persist user message (with sender_id for people chats)
        add_message(db, session_id, role="user", content=body.content, sender_id=current_user.id)

        if chat.kind == "ai":
            # Build LLM history and call the model
            history = list_messages(db, session_id)
            llm_messages = [{"role": m.role, "content": m.content} for m in history if m.role in ("user", "assistant")]
            reply = chat_complete(llm_messages)

            assistant_msg = add_message(
                db,
                session_id,
                role="assistant",
                content=reply["content"],
                sender_id=None,
                tool_calls=reply.get("tool_calls"),
            )

            # Auto-title from first message
            if not chat.title:
                rename_session(db, session_id, current_user.id, body.content.strip()[:60])

            return MessageResponse(
                id=assistant_msg.id,
                session_id=assistant_msg.session_id,
                role=assistant_msg.role,
                sender_id=None,
                sender_name="SynqLab Assistant",
                sender_avatar=None,
                content=assistant_msg.content,
                tool_calls=assistant_msg.tool_calls,
                tool_results=assistant_msg.tool_results,
                created_at=assistant_msg.created_at.isoformat() if assistant_msg.created_at else "",
            )
        else:
            # People chat — return the user's own message as confirmation
            # (in a real-time system this would be delivered via WebSocket)
            msgs = list_messages(db, session_id)
            last_msg = msgs[-1]
            return MessageResponse(
                id=last_msg.id,
                session_id=last_msg.session_id,
                role=last_msg.role,
                sender_id=last_msg.sender_id,
                sender_name=current_user.full_name,
                sender_avatar=current_user.avatar_url,
                content=last_msg.content,
                tool_calls=last_msg.tool_calls,
                tool_results=last_msg.tool_results,
                created_at=last_msg.created_at.isoformat() if last_msg.created_at else "",
            )
    finally:
        db.close()


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
def update_session(
    session_id: str,
    body: SessionRenameRequest,
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    db = get_session()
    try:
        updated = rename_session(db, session_id, current_user.id, body.title)
        if updated is None:
            raise HTTPException(status_code=404, detail="Session not found.")
        pids = _get_participant_ids(db, session_id) if updated.kind in ("dm", "group") else []
        project_name: str | None = None
        if updated.project_id:
            from synqlab.storage.models import Project
            proj = db.get(Project, updated.project_id)
            project_name = proj.name if proj else None
        return _serialize_session(updated, pids, project_name)
    finally:
        db.close()


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    db = get_session()
    try:
        if not delete_session(db, session_id, current_user.id):
            raise HTTPException(status_code=404, detail="Session not found.")
    finally:
        db.close()

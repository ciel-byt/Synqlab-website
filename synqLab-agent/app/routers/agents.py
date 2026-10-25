"""Agent API router — REST endpoints + WebSocket streaming.

Endpoints:
  POST   /api/agents/sessions              → Create agent session
  GET    /api/agents/sessions              → List sessions for user
  GET    /api/agents/sessions/{id}         → Get session with messages
  DELETE /api/agents/sessions/{id}         → Cancel/delete session
  POST   /api/agents/sessions/{id}/message → Send message to agent
  WS     /ws/agent/{session_id}            → Real-time streaming
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import and_, or_

from synqlab.agent.context import AgentContext
from synqlab.agent.engine import AgentConfig, AgentEngine, AgentEvent, AgentEventType
from synqlab.agent.models import AgentArtifact, AgentMessage, AgentSession, AgentUsageRecord
from synqlab.agent.tools import get_tools_for_agent_type
from synqlab.agent.task import TaskManager
from synqlab.agent.template import get_all_templates, get_template_by_id
from synqlab.agent.budget import TokenBudget
from synqlab.storage.db import get_session as get_db_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    agent_type: str = "general"
    title: str | None = None
    project_id: str | None = None
    model: str = "gpt-4o"
    autonomy_mode: str = "autonomous"  # copilot | supervised | autonomous
    skill_id: str | None = None  # auto-activate this skill on session start


class SendMessageRequest(BaseModel):
    content: str


class SessionResponse(BaseModel):
    id: str
    agent_type: str
    title: str | None
    status: str
    autonomy_mode: str
    model: str
    total_input_tokens: int
    total_output_tokens: int
    total_tool_calls: int
    canvas_state: dict | None = None
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str | None
    tool_calls: Any | None
    tool_call_id: str | None
    tool_name: str | None
    created_at: str


# ---------------------------------------------------------------------------
# In-memory engine registry (one engine per active session)
# ---------------------------------------------------------------------------

_active_engines: dict[str, AgentEngine] = {}
_engine_lock = asyncio.Lock()


def _get_user_id(request: Request) -> str:
    """Extract user_id from JWT middleware."""
    return getattr(request.state, "user_id", None) or ""


def _get_org_id(request: Request) -> str:
    """Extract org_id from request headers."""
    return request.headers.get("X-Org-Id", "")


# ---------------------------------------------------------------------------
# Shared event persistence — used by both REST and WebSocket handlers.
# ---------------------------------------------------------------------------

async def _persist_engine_events(
    engine: AgentEngine,
    message: str,
    session_id: str,
    session: AgentSession,
    db: Any,
):
    """Iterate engine events, persist messages to DB, and yield each event.

    This is an async generator so callers can decide what to do with each
    event (REST collects them, WebSocket sends them over the wire).
    After all events are yielded, the final assistant message and session
    stats are committed.
    """
    assistant_content = ""

    async for event in engine.submit_message(message):
        yield event

        if event.type == AgentEventType.TEXT_DONE:
            assistant_content = event.data.get("content", "")

        if event.type == AgentEventType.TOOL_USE_START:
            db.add(AgentMessage(
                session_id=session_id,
                role="assistant",
                tool_calls=[{
                    "id": event.data.get("tool_call_id"),
                    "function": {
                        "name": event.data.get("tool_name"),
                        "arguments": event.data.get("arguments"),
                    },
                }],
            ))

        if event.type == AgentEventType.TOOL_USE_DONE:
            db.add(AgentMessage(
                session_id=session_id,
                role="tool",
                tool_call_id=event.data.get("tool_call_id"),
                tool_name=event.data.get("tool_name"),
                content=json.dumps(event.data.get("result", {})),
            ))

    # Persist final assistant message.
    if assistant_content:
        db.add(AgentMessage(
            session_id=session_id,
            role="assistant",
            content=assistant_content,
        ))

    # Update session stats.
    session.total_input_tokens = engine.total_input_tokens
    session.total_output_tokens = engine.total_output_tokens
    session.total_tool_calls = engine.total_tool_calls
    session.updated_at = datetime.now(timezone.utc)
    db.commit()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.post("/sessions", response_model=SessionResponse)
async def create_session(body: CreateSessionRequest, request: Request):
    """Create a new agent conversation session."""
    user_id = _get_user_id(request)
    org_id = _get_org_id(request)

    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")
    if not org_id:
        raise HTTPException(status_code=400, detail="X-Org-Id header required.")

    db = get_db_session()
    try:
        session = AgentSession(
            id=str(uuid.uuid4()),
            org_id=org_id,
            project_id=body.project_id,
            user_id=user_id,
            agent_type=body.agent_type,
            title=body.title or f"Agent Session",
            model=body.model,
            autonomy_mode=body.autonomy_mode,
            skill_id=body.skill_id,
            status="active",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        return SessionResponse(
            id=session.id,
            agent_type=session.agent_type,
            title=session.title,
            status=session.status,
            autonomy_mode=session.autonomy_mode,
            model=session.model,
            total_input_tokens=session.total_input_tokens,
            total_output_tokens=session.total_output_tokens,
            total_tool_calls=session.total_tool_calls,
            canvas_state=session.canvas_state,
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
        )
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create agent session")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.get("/sessions")
async def list_sessions(request: Request, project_id: str | None = Query(None)):
    """List agent sessions for the current user."""
    user_id = _get_user_id(request)
    org_id = _get_org_id(request)

    db = get_db_session()
    try:
        q = db.query(AgentSession).filter_by(user_id=user_id, org_id=org_id)
        # Exclude cancelled/deleted sessions
        q = q.filter(AgentSession.status != 'cancelled')
        if project_id:
            q = q.filter_by(project_id=project_id)
        sessions = q.order_by(AgentSession.updated_at.desc()).limit(50).all()

        return [
            SessionResponse(
                id=s.id,
                agent_type=s.agent_type,
                title=s.title,
                status=s.status,
                autonomy_mode=s.autonomy_mode,
                model=s.model,
                total_input_tokens=s.total_input_tokens,
                total_output_tokens=s.total_output_tokens,
                total_tool_calls=s.total_tool_calls,
                canvas_state=s.canvas_state,
                created_at=s.created_at.isoformat(),
                updated_at=s.updated_at.isoformat(),
            )
            for s in sessions
        ]
    finally:
        db.close()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    """Get session details with message history."""
    user_id = _get_user_id(request)

    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id, user_id=user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        messages = (
            db.query(AgentMessage)
            .filter_by(session_id=session_id)
            .order_by(AgentMessage.created_at)
            .all()
        )

        return {
            "session": SessionResponse(
                id=session.id,
                agent_type=session.agent_type,
                title=session.title,
                status=session.status,
                autonomy_mode=session.autonomy_mode,
                model=session.model,
                total_input_tokens=session.total_input_tokens,
                total_output_tokens=session.total_output_tokens,
                total_tool_calls=session.total_tool_calls,
                canvas_state=session.canvas_state,
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat(),
            ),
            "messages": [
                MessageResponse(
                    id=m.id,
                    role=m.role,
                    content=m.content,
                    tool_calls=m.tool_calls,
                    tool_call_id=m.tool_call_id,
                    tool_name=m.tool_name,
                    created_at=m.created_at.isoformat(),
                )
                for m in messages
            ],
        }
    finally:
        db.close()


@router.delete("/sessions/{session_id}")
async def cancel_session(session_id: str, request: Request):
    """Cancel an active session."""
    user_id = _get_user_id(request)

    # Abort the engine if running.
    async with _engine_lock:
        engine = _active_engines.get(session_id)
        if engine:
            engine.context.request_abort()
            del _active_engines[session_id]

    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id, user_id=user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        session.status = "cancelled"
        db.commit()
        return {"status": "cancelled"}
    finally:
        db.close()


class SaveCanvasRequest(BaseModel):
    canvas_state: dict


@router.patch("/sessions/{session_id}/canvas")
async def save_canvas_state(session_id: str, body: SaveCanvasRequest, request: Request):
    """Persist pipeline canvas state to the session (called by canvas Save button)."""
    user_id = _get_user_id(request)

    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id, user_id=user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        session.canvas_state = body.canvas_state
        session.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "saved"}
    finally:
        db.close()


@router.post("/sessions/{session_id}/message")
async def send_message(session_id: str, body: SendMessageRequest, request: Request):
    """Send a message to an agent session and return the full response.

    For real-time streaming, use the WebSocket endpoint instead.
    """
    user_id = _get_user_id(request)
    org_id = _get_org_id(request)

    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id, user_id=user_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        if session.status != "active":
            raise HTTPException(status_code=400, detail=f"Session is {session.status}.")

        # Persist user message.
        user_msg = AgentMessage(
            session_id=session_id,
            role="user",
            content=body.content,
        )
        db.add(user_msg)

        # Auto-title from first user message (ChatGPT-style).
        if session.title in ("Agent Session", None, ""):
            auto_title = body.content.strip().replace("\n", " ")[:60]
            if len(body.content.strip()) > 60:
                auto_title += "…"
            session.title = auto_title

        db.commit()

        # Get or create the engine.
        engine = await _get_or_create_engine(session_id, session, org_id, user_id, db)

        # Run the engine and collect events.
        events: list[dict[str, Any]] = []
        async for event in _persist_engine_events(
            engine, body.content, session_id, session, db,
        ):
            events.append(event.to_dict())

        return {"events": events}

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to process agent message")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


# ---------------------------------------------------------------------------
# WebSocket streaming endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/{session_id}")
async def agent_websocket(websocket: WebSocket, session_id: str):
    """Real-time WebSocket connection for an agent session.

    Protocol:
      Client sends: {"type": "message", "content": "..."}
      Server sends: AgentEvent JSON objects
    """
    await websocket.accept()

    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id).first()
        if not session:
            await websocket.send_json({"type": "error", "message": "Session not found."})
            await websocket.close()
            return

        # Use a temporary user_id from session (WS doesn't have JWT middleware).
        engine = await _get_or_create_engine(
            session_id, session, session.org_id, session.user_id, db,
        )

        # Wire up task event forwarding for coordinator sessions.
        if engine.context.task_manager:
            async def _forward_task_event(event_data: dict) -> None:
                try:
                    await websocket.send_json(event_data)
                except Exception:
                    pass  # WS may be closed
            engine.context.task_manager.on_task_event = _forward_task_event

        while True:
            try:
                raw = await websocket.receive_text()
                data = json.loads(raw)
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON."})
                continue

            if data.get("type") == "message":
                content = data.get("content", "")

                # Update pipeline mode from frontend state.
                engine.context.pipeline_mode = bool(data.get("pipeline_mode", False))
                engine.context.pipeline_canvas_state = str(data.get("canvas_state", ""))

                # Persist user message.
                user_msg = AgentMessage(session_id=session_id, role="user", content=content)
                db.add(user_msg)

                # Auto-title from first user message (ChatGPT-style).
                if session.title in ("Agent Session", None, ""):
                    auto_title = content.strip().replace("\n", " ")[:60]
                    if len(content.strip()) > 60:
                        auto_title += "…"
                    session.title = auto_title
                    db.commit()
                    # Notify client of the new title
                    await websocket.send_json({
                        "type": "title_updated",
                        "title": session.title,
                    })
                else:
                    db.commit()

                # Stream events and persist to DB via shared helper.
                async for event in _persist_engine_events(
                    engine, content, session_id, session, db,
                ):
                    await websocket.send_json(event.to_dict())

                # Persist canvas state at end of chat turn (if pipeline mode).
                if engine.context.pipeline_mode:
                    incoming_canvas = data.get("canvas_state_json")
                    if isinstance(incoming_canvas, dict):
                        session.canvas_state = incoming_canvas
                        db.commit()

            elif data.get("type") == "save_canvas":
                # Explicit canvas save (from the canvas Save button).
                canvas_payload = data.get("canvas_state")
                if isinstance(canvas_payload, dict):
                    session.canvas_state = canvas_payload
                    session.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    await websocket.send_json({"type": "canvas_saved", "status": "ok"})

            elif data.get("type") == "abort":
                engine.context.request_abort()
                await websocket.send_json({"type": "session_done", "reason": "aborted"})

            elif data.get("type") == "approve":
                tool_call_id = data.get("tool_call_id", "")
                engine.context.approve_tool(tool_call_id)

            elif data.get("type") == "reject":
                tool_call_id = data.get("tool_call_id", "")
                engine.context.reject_tool(tool_call_id)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("WebSocket error")
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Engine lifecycle
# ---------------------------------------------------------------------------

async def _get_or_create_engine(
    session_id: str,
    session: AgentSession,
    org_id: str,
    user_id: str,
    db: Any,
) -> AgentEngine:
    """Get an existing engine or create a new one for the session."""
    async with _engine_lock:
        if session_id in _active_engines:
            return _active_engines[session_id]

        # Build context.
        ctx = AgentContext(
            session_id=session_id,
            user_id=user_id,
            org_id=org_id,
            project_id=session.project_id,
            tool_registry={"agent_type": session.agent_type},
        )

        # Attach TaskManager for coordinator sessions.
        if session.agent_type in ("coordinator", "research_director"):
            ctx.task_manager = TaskManager(parent_session_id=session_id)

        # Get tools for agent type.
        tools = get_tools_for_agent_type(session.agent_type)

        # Build config.
        config = AgentConfig(
            model=session.model,
            system_prompt="",  # Uses default for agent_type.
            autonomy_mode=getattr(session, "autonomy_mode", "autonomous"),
        )

        # Replay existing messages into the engine.
        engine = AgentEngine(config=config, tools=tools, context=ctx)

        existing_msgs = (
            db.query(AgentMessage)
            .filter_by(session_id=session_id)
            .order_by(AgentMessage.created_at)
            .all()
        )
        for msg in existing_msgs:
            entry: dict[str, Any] = {"role": msg.role}
            if msg.content:
                entry["content"] = msg.content
            if msg.tool_calls:
                entry["tool_calls"] = msg.tool_calls
            if msg.tool_call_id:
                entry["tool_call_id"] = msg.tool_call_id
            engine.messages.append(entry)

        _active_engines[session_id] = engine

        # Auto-activate skill if session has one attached.
        if getattr(session, 'skill_id', None):
            try:
                from synqlab.agent.skill import get_skill_loader
                loader = get_skill_loader()
                skill = loader.get_skill(session.skill_id)
                if skill:
                    ctx.active_skills.append(skill)
                    logger.info("Auto-activated skill %s for session %s", skill.id, session_id)
                else:
                    # Try DB skills
                    from synqlab.agent.models import AgentSkill as AgentSkillModel
                    db_skill = db.query(AgentSkillModel).filter_by(id=session.skill_id).first()
                    if db_skill:
                        from synqlab.agent.skill import Skill
                        skill_obj = Skill(
                            id=db_skill.id,
                            name=db_skill.name,
                            description=db_skill.description,
                            version=db_skill.version,
                            author=db_skill.author,
                            tags=db_skill.tags or [],
                            agent_types=db_skill.agent_types or [],
                            tools=db_skill.tools or [],
                            autonomy_default=db_skill.autonomy_default,
                            body=db_skill.body,
                        )
                        ctx.active_skills.append(skill_obj)
                        logger.info("Auto-activated DB skill %s for session %s", db_skill.id, session_id)
            except Exception:
                logger.warning("Failed to auto-activate skill %s", session.skill_id, exc_info=True)

        return engine


# ---------------------------------------------------------------------------
# Artifact endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/artifacts")
async def list_session_artifacts(session_id: str):
    """List artifacts visible to a session.

    Visibility (Phase 13 D-08):
      - rows with session_id == :session_id
      - rows with scope='global' (bundled samples)
      - rows with scope='project' AND project_id == session.project_id
    """
    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        filters = [
            AgentArtifact.session_id == session_id,
            AgentArtifact.scope == "global",
        ]
        if session.project_id:
            filters.append(
                and_(
                    AgentArtifact.scope == "project",
                    AgentArtifact.project_id == session.project_id,
                )
            )

        artifacts = (
            db.query(AgentArtifact)
            .filter(or_(*filters))
            .order_by(
                # session > project > global (alphabetical desc lands g < p < s)
                AgentArtifact.scope.desc(),
                AgentArtifact.created_at.desc(),
            )
            .all()
        )
        return [
            {
                "id": a.id,
                "session_id": a.session_id,
                "scope": a.scope,
                "project_id": a.project_id,
                "org_id": a.org_id,
                "name": a.name,
                "artifact_type": a.artifact_type,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "metadata": a.metadata_json,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in artifacts
        ]
    finally:
        db.close()


@router.get("/sessions/{session_id}/artifacts/{artifact_id}")
async def get_session_artifact(session_id: str, artifact_id: str):
    """Get a specific artifact (with content or file path).

    Visibility (Phase 13 D-08):
      session-scoped row → must belong to :session_id
      scope='global' → always readable
      scope='project' → must match the session's project_id
    """
    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        artifact = db.query(AgentArtifact).filter_by(id=artifact_id).first()
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")

        # Visibility check.
        if artifact.scope == "session":
            if artifact.session_id != session_id:
                raise HTTPException(status_code=404, detail="Artifact not found")
        elif artifact.scope == "project":
            if artifact.project_id != session.project_id:
                raise HTTPException(status_code=404, detail="Artifact not found")
        # 'global' — always visible

        result: dict[str, Any] = {
            "id": artifact.id,
            "session_id": artifact.session_id,
            "scope": artifact.scope,
            "project_id": artifact.project_id,
            "org_id": artifact.org_id,
            "name": artifact.name,
            "artifact_type": artifact.artifact_type,
            "content_type": artifact.content_type,
            "size_bytes": artifact.size_bytes,
            "metadata": artifact.metadata_json,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
        }

        # Return content inline or read from disk.
        if artifact.content:
            result["content"] = artifact.content
        elif artifact.file_path:
            try:
                from pathlib import Path
                result["content"] = Path(artifact.file_path).read_text(encoding="utf-8")
            except OSError as exc:
                result["content"] = None
                result["error"] = f"File not readable: {exc}"

        return result
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Upload + promote endpoints (Phase 13 D-09 / D-10 / D-11)
# ---------------------------------------------------------------------------

# Phase 13 D-09 / D-11: file upload allowlist (server is the trust boundary).
_UPLOAD_ALLOWED_EXTENSIONS = {".pdb", ".fasta", ".fa", ".csv", ".json"}
_UPLOAD_TYPE_BY_EXT = {
    ".pdb": "pdb_structure",
    ".fasta": "sequence_fasta",
    ".fa": "sequence_fasta",
    ".csv": "score_table",
    ".json": "score_table",       # repurposed for small configs (D-11)
}
_UPLOAD_MAX_BYTES = 10 * 1024 * 1024   # 10 MB cap (UI-SPEC §Drag-drop)


def _ext_of(filename: str) -> str:
    """Return the file extension lowercased, including the leading dot."""
    if "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


@router.post("/sessions/{session_id}/artifacts")
async def upload_session_artifact(
    session_id: str,
    request: Request,
    file: UploadFile = File(...),
):
    """Upload a file to this session as a session-scoped artifact (D-09)."""
    ext = _ext_of(file.filename or "")
    if ext not in _UPLOAD_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File type not supported. Use one of: "
                f"{', '.join(sorted(_UPLOAD_ALLOWED_EXTENSIONS))}."
            ),
        )

    raw = await file.read()
    if len(raw) > _UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File too large. Maximum {_UPLOAD_MAX_BYTES // (1024*1024)} MB "
                f"per attachment."
            ),
        )
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File must be UTF-8 text (PDB/FASTA/CSV/JSON).",
        )

    db = get_db_session()
    try:
        session = db.query(AgentSession).filter_by(id=session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        # Cache the FK fields before closing the session — we use them
        # outside the `with` block to construct AgentContext.
        session_user_id = session.user_id
        session_org_id = session.org_id
        session_project_id = session.project_id
    finally:
        db.close()

    # Build a minimal AgentContext for the persistence helper.
    ctx = AgentContext(
        session_id=session_id,
        user_id=getattr(request.state, "user_id", None) or session_user_id,
        org_id=session_org_id,
        project_id=session_project_id,
    )

    from synqlab.agent.tools._persist import persist_artifact
    try:
        artifact_id = await persist_artifact(
            content=content,
            name=file.filename or "upload",
            artifact_type=_UPLOAD_TYPE_BY_EXT[ext],
            ctx=ctx,
            scope="session",
            metadata={"source": "user_upload", "ext": ext},
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Upload persistence failed")
        raise HTTPException(status_code=500, detail=f"Failed to persist upload: {exc}")

    return {
        "artifact_id": artifact_id,
        "name": file.filename,
        "scope": "session",
        "size_bytes": len(raw),
    }


@router.post("/artifacts/{artifact_id}/promote")
async def promote_artifact_to_dataset(artifact_id: str, request: Request):
    """Copy a session-scoped artifact to project scope (D-10).

    Pitfall #6: promote = COPY, not MOVE. The original row is preserved;
    the new row shares the same file_path (no file duplication on disk).
    """
    db = get_db_session()
    try:
        src = db.query(AgentArtifact).filter_by(id=artifact_id).first()
        if not src:
            raise HTTPException(status_code=404, detail="Artifact not found")
        if src.scope != "session":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot promote artifact with scope='{src.scope}'. "
                       f"Only session-scoped artifacts can be promoted.",
            )
        session = db.query(AgentSession).filter_by(id=src.session_id).first()
        if not session or not session.project_id:
            raise HTTPException(
                status_code=400,
                detail="This session has no project. Open a project session "
                       "to promote artifacts.",
            )

        # COPY: insert a new row with scope='project'. file_path is shared.
        new_metadata = dict(src.metadata_json or {})
        new_metadata["promoted_from"] = src.id

        new_row = AgentArtifact(
            session_id=None,
            scope="project",
            org_id=session.org_id,
            project_id=session.project_id,
            created_by=getattr(request.state, "user_id", None),
            content_hash=src.content_hash,
            name=src.name,
            artifact_type=src.artifact_type,
            content_type=src.content_type,
            content=src.content,             # safe: rows are < 100 KB if inline
            file_path=src.file_path,         # shared — no file duplication
            metadata_json=new_metadata,
            size_bytes=src.size_bytes,
        )
        db.add(new_row)
        db.commit()
        db.refresh(new_row)
        return {
            "artifact_id": new_row.id,
            "scope": "project",
            "project_id": session.project_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to promote artifact")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.get("/datasets")
async def list_project_datasets(project_id: str | None = None):
    """List all scope='project' artifacts for a given project (D-08 dedicated route).

    Phase 13 BLOCKER 1: provides the backend for AgentDatasetsPage at
    /lab/agents/datasets. Returns only rows where scope='project' and
    project_id matches the requested project. Session and global rows are
    intentionally excluded — those flows are exposed via the existing
    /sessions/{id}/artifacts endpoint.

    Auth: handled by the same JWT/X-Api-Key middleware applied via
    `app.include_router(agents_router)` — this endpoint requires no
    per-route additions.
    """
    if not project_id:
        raise HTTPException(
            status_code=400,
            detail="project_id query parameter is required.",
        )
    db = get_db_session()
    try:
        rows = (
            db.query(AgentArtifact)
            .filter_by(scope="project", project_id=project_id)
            .order_by(AgentArtifact.created_at.desc())
            .all()
        )
        return [
            {
                "id": a.id,
                "session_id": a.session_id,
                "scope": a.scope,
                "project_id": a.project_id,
                "org_id": a.org_id,
                "name": a.name,
                "artifact_type": a.artifact_type,
                "content_type": a.content_type,
                "size_bytes": a.size_bytes,
                "metadata": a.metadata_json,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in rows
        ]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Template endpoints
# ---------------------------------------------------------------------------

@router.get("/templates")
async def list_templates():
    """List available agent templates (core + user-created)."""
    templates = get_all_templates()
    return [t.to_dict() for t in templates]


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get a specific agent template."""
    template = get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template.to_dict()


# ---------------------------------------------------------------------------
# Usage endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/usage")
async def get_session_usage(session_id: str):
    """Get token usage summary for a session."""
    # Check active engines first.
    engine = _active_engines.get(session_id)
    if engine:
        return engine.budget_tracker.usage_summary

    # Fall back to DB records.
    db = get_db_session()
    try:
        records = (
            db.query(AgentUsageRecord)
            .filter_by(session_id=session_id)
            .order_by(AgentUsageRecord.recorded_at.desc())
            .all()
        )
        if not records:
            return {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "tool_calls": 0,
                "estimated_cost_usd": 0.0,
            }

        total_in = sum(r.input_tokens for r in records)
        total_out = sum(r.output_tokens for r in records)
        total_tools = sum(r.tool_calls for r in records)
        total_cost = sum(r.estimated_cost_usd for r in records)

        return {
            "input_tokens": total_in,
            "output_tokens": total_out,
            "total_tokens": total_in + total_out,
            "tool_calls": total_tools,
            "estimated_cost_usd": round(total_cost, 4),
        }
    finally:
        db.close()

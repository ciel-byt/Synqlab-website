"""Phase 8 Plan 3: Full E2E API roundtrip tests.

Validates the REST API → AgentEngine → DB flow without booting a real
HTTP server.  Uses ``httpx.ASGITransport`` against the FastAPI app, an
isolated SQLite test database (with ``synqlab.storage.db`` reconfigured
to point at it), a real signed JWT for auth, and a mocked
``AgentEngine.submit_message`` so no LLM calls hit the network.

Closes the v1 milestone audit "flow gap" — REST → engine → tool →
artifact → DB had no end-to-end test until now.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from typing import Any, AsyncGenerator
from unittest.mock import patch

import httpx
import pytest
import pytest_asyncio


# ---------------------------------------------------------------------------
# Test environment setup — must happen before any synqlab.* imports.
# ---------------------------------------------------------------------------

# Use a session-local SQLite file (in-memory ":memory:" doesn't share state
# across the multiple sessionmaker connections the API opens per request).
_TMP_DB_FILE = Path(tempfile.gettempdir()) / "synqlab_e2e_api_test.db"
if _TMP_DB_FILE.exists():
    _TMP_DB_FILE.unlink()

os.environ["SYNQLAB_DB_URL"] = f"sqlite:///{_TMP_DB_FILE.as_posix()}"
os.environ.setdefault("SYNQLAB_JWT_SECRET", "synqlab-e2e-test-secret")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-real")


# Now safe to import from synqlab.
from app.main import app  # noqa: E402
from synqlab.agent.engine import AgentEvent, AgentEventType  # noqa: E402
from synqlab.auth.jwt import create_token  # noqa: E402
from synqlab.storage.db import init_db, reset_engine  # noqa: E402


# ---------------------------------------------------------------------------
# Test fixtures (Task 1)
# ---------------------------------------------------------------------------

_TEST_USER_ID = "user-e2e"
_TEST_ORG_ID = "org-e2e"


@pytest.fixture(scope="module", autouse=True)
def _initialise_test_db():
    """Create all tables in the SQLite test DB once per module."""
    reset_engine()
    init_db()
    yield
    reset_engine()
    if _TMP_DB_FILE.exists():
        try:
            _TMP_DB_FILE.unlink()
        except OSError:
            pass  # Windows file locks — best-effort cleanup.


@pytest.fixture(scope="module")
def auth_headers() -> dict[str, str]:
    """Authenticated request headers — JWT plus the X-Org-Id the API requires."""
    token = create_token(_TEST_USER_ID, expires_in_seconds=3600)
    return {
        "Authorization": f"Bearer {token}",
        "X-Org-Id": _TEST_ORG_ID,
    }


@pytest_asyncio.fixture
async def client(auth_headers) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Async ASGI client with auth headers pre-applied."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers=auth_headers,
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_text_event_stream(text: str):
    """Build an async generator that yields a single TEXT_DONE event then TURN_DONE."""

    async def _gen(self, content: str):  # noqa: ARG001
        yield AgentEvent(type=AgentEventType.TEXT_DONE, data={"content": text})
        yield AgentEvent(type=AgentEventType.TURN_DONE, data={"reason": "stop"})

    return _gen


# ---------------------------------------------------------------------------
# Task 2: session creation and listing
# ---------------------------------------------------------------------------

class TestSessionLifecycle:
    """POST /api/agents/sessions, GET /api/agents/sessions roundtrip."""

    @pytest.mark.asyncio
    async def test_create_and_list_agent_session(self, client: httpx.AsyncClient):
        """POST creates a session, GET lists it back for the same user."""
        # Create.
        resp = await client.post(
            "/api/agents/sessions",
            json={
                "title": "E2E Test Session",
                "agent_type": "general",
                "autonomy_mode": "autonomous",
            },
        )
        assert resp.status_code == 200, resp.text
        session = resp.json()
        assert "id" in session
        assert session["title"] == "E2E Test Session"
        assert session["status"] == "active"
        assert session["autonomy_mode"] == "autonomous"
        session_id = session["id"]

        # List.
        list_resp = await client.get("/api/agents/sessions")
        assert list_resp.status_code == 200, list_resp.text
        sessions = list_resp.json()
        assert isinstance(sessions, list)
        assert any(s["id"] == session_id for s in sessions), (
            f"created session {session_id} not in listing: {[s['id'] for s in sessions]}"
        )

    @pytest.mark.asyncio
    async def test_unauthenticated_request_is_rejected(self):
        """Without a JWT the middleware returns 401."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            resp = await c.get("/api/agents/sessions")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Task 3: message submission with mocked LLM
# ---------------------------------------------------------------------------

class TestMessageSubmission:
    """POST /api/agents/sessions/{id}/message exercises the full engine path."""

    @pytest.mark.asyncio
    async def test_submit_message_returns_response(self, client: httpx.AsyncClient):
        """POST /sessions/{id}/message returns events from a (mocked) engine turn."""
        create_resp = await client.post(
            "/api/agents/sessions",
            json={"title": "Message Test"},
        )
        assert create_resp.status_code == 200, create_resp.text
        session_id = create_resp.json()["id"]

        # Patch submit_message so the engine doesn't need a real OpenAI call.
        gen_factory = _mock_text_event_stream("Hello from the agent!")
        with patch(
            "synqlab.agent.engine.AgentEngine.submit_message",
            new=gen_factory,
        ):
            resp = await client.post(
                f"/api/agents/sessions/{session_id}/message",
                json={"content": "Hello"},
            )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "events" in body
        # Two events from our mocked stream: TEXT_DONE then TURN_DONE.
        types = [e["type"] for e in body["events"]]
        assert "text_done" in types
        assert "turn_done" in types
        text_event = next(e for e in body["events"] if e["type"] == "text_done")
        assert text_event["content"] == "Hello from the agent!"

    @pytest.mark.asyncio
    async def test_message_persists_to_db(self, client: httpx.AsyncClient):
        """Submitted messages are durably stored in agent_messages."""
        create_resp = await client.post(
            "/api/agents/sessions",
            json={"title": "Persistence Test"},
        )
        session_id = create_resp.json()["id"]

        gen_factory = _mock_text_event_stream("Persisted reply.")
        with patch(
            "synqlab.agent.engine.AgentEngine.submit_message",
            new=gen_factory,
        ):
            send_resp = await client.post(
                f"/api/agents/sessions/{session_id}/message",
                json={"content": "Please remember this."},
            )
        assert send_resp.status_code == 200, send_resp.text

        # GET the session — its messages should include both turns.
        get_resp = await client.get(f"/api/agents/sessions/{session_id}")
        assert get_resp.status_code == 200, get_resp.text
        body = get_resp.json()
        messages = body["messages"]
        roles_and_text = [(m["role"], m.get("content")) for m in messages]
        assert ("user", "Please remember this.") in roles_and_text
        assert ("assistant", "Persisted reply.") in roles_and_text


# ---------------------------------------------------------------------------
# Task 4: templates endpoints
# ---------------------------------------------------------------------------

class TestAgentTemplates:
    """GET /api/agents/templates and /api/agents/templates/{id}.

    The current ``CreateSessionRequest`` schema does not yet support
    ``template_id`` — the closest E2E coverage is verifying that the
    template catalogue is reachable and exposes the IDs that researchers
    can apply on the client side. This still validates the Phase 7
    template wiring through the live FastAPI app.
    """

    @pytest.mark.asyncio
    async def test_list_templates_returns_core_set(self, client: httpx.AsyncClient):
        """GET /templates returns the bundled core templates."""
        resp = await client.get("/api/agents/templates")
        assert resp.status_code == 200, resp.text
        templates = resp.json()
        assert isinstance(templates, list)
        ids = {t["id"] for t in templates}
        # Core templates seeded in synqlab.agent.template.CORE_TEMPLATES.
        for expected in (
            "quick-analysis",
            "protein-optimization",
            "binder-design",
            "literature-review",
            "custom-research",
        ):
            assert expected in ids, f"core template {expected!r} missing from {ids}"

    @pytest.mark.asyncio
    async def test_get_template_by_id(self, client: httpx.AsyncClient):
        """GET /templates/{id} returns a fully-shaped template config."""
        resp = await client.get("/api/agents/templates/protein-optimization")
        assert resp.status_code == 200, resp.text
        tpl = resp.json()
        assert tpl["id"] == "protein-optimization"
        assert tpl["agent_type"] == "general"
        assert tpl["autonomy_mode"] == "supervised"
        assert tpl["model"] == "gpt-4o"
        assert tpl["budget"]["session_limit"] == 500_000

    @pytest.mark.asyncio
    async def test_get_unknown_template_returns_404(self, client: httpx.AsyncClient):
        """Unknown template IDs return 404 with an informative detail."""
        resp = await client.get("/api/agents/templates/this-does-not-exist")
        assert resp.status_code == 404

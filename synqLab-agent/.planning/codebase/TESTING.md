# Testing Patterns

**Analysis Date:** 2026-05-02

## Test Framework

**Runner:**
- pytest (no pinned version — from `dependency-groups.dev`)
- Config: `pyproject.toml`

**Assertion Library:**
- Built-in pytest assertions
- No additional assertion libraries

**Async Testing:**
- pytest-asyncio with `asyncio_mode = "auto"`

**Run Commands:**
```bash
pytest                    # Run unit tests (tests/unit/)
pytest tests/             # Run all tests
pytest -v                 # Verbose output
pytest --cov=synqlab      # With coverage (pytest-cov)
```

## Test Configuration

**pyproject.toml:**
```toml
[tool.pytest.ini_options]
testpaths = ["tests/unit"]
addopts = "-q"
asyncio_mode = "auto"
```

**Key settings:**
- Default test path is `tests/unit/` (unit tests only)
- Quiet mode by default
- Async tests auto-detected

## Test File Organization

**Location:**
- Unit tests: `tests/unit/test_<module>.py`
- Integration tests: `tests/test_<feature>.py`
- E2E tests: `tests/test_e2e_*.py`
- Shared fixtures: `tests/conftest.py`

**Naming:**
- Test files: `test_<module_name>.py`
- Test classes: `Test<Feature>` or `Test<ClassName>`
- Test functions: `test_<behavior_description>()`

**Structure:**
```
tests/
├── conftest.py                    # Shared fixtures
├── test_agent_engine.py           # Integration tests
├── test_e2e_api.py               # E2E API tests
├── test_guardrails.py            # Feature tests
├── test_pipeline.py
└── unit/
    ├── test_auth_service.py
    ├── test_protgpt2_adapter.py
    ├── test_registry_loader.py
    └── ... (26 more unit test files)
```

## Test Structure

### Class-Based Organization

**Pattern:** Group related tests in classes with descriptive names.

```python
class TestExtractNumbers:
    def test_integers(self):
        nums = extract_numbers("The pLDDT score is 85 and length is 120")
        assert "85" in nums
        assert "120" in nums

    def test_decimals(self):
        nums = extract_numbers("ΔΔG of -2.35 kcal/mol")
        assert "-2.35" in nums
```

### Async Test Pattern

**Mark with `@pytest.mark.asyncio`:**

```python
class TestAgentEngine:
    @pytest.mark.asyncio
    async def test_simple_text_response(self, sum_tool, agent_context):
        """Engine yields TEXT_DONE + TURN_DONE for a simple response."""
        config = AgentConfig(model="gpt-4o-test")
        
        with patch("synqlab.agent.engine.AsyncOpenAI") as MockClient:
            mock_client = AsyncMock()
            mock_client.chat.completions.create = AsyncMock(
                return_value=_make_text_response("Hello!")
            )
            MockClient.return_value = mock_client

            engine = AgentEngine(config=config, tools=[sum_tool], context=agent_context)
            events = []
            async for event in engine.submit_message("Hi"):
                events.append(event)

        assert AgentEventType.TEXT_DONE in [e.type for e in events]
```

### Function-Based Tests

**Pattern:** Simple functions for straightforward assertions.

```python
def test_create_user_hashes_password(session: Session) -> None:
    user = create_user(session, "user@example.com", "secret123", "User One")
    assert user.password_hash is not None
    assert user.password_hash != "secret123"
```

## Fixtures

### Shared Fixtures (conftest.py)

**Database session fixture:**
```python
@pytest.fixture
def agent_db_session():
    """In-memory SQLite session with all agent tables created."""
    from synqlab.storage.models import Base
    import synqlab.auth.models
    import synqlab.agent.models

    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
```

**DB session override for FastAPI:**
```python
@pytest.fixture
def patch_db_session(agent_db_session):
    """Patch all DB session getters to use the test session."""
    import synqlab.storage.db as db_module
    
    db_module.reset_engine()
    db_module.set_test_session(agent_db_session)
    
    yield agent_db_session
    
    db_module.set_test_session(None)
```

### Local Fixtures

**Test-specific fixtures in test files:**
```python
@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s

@pytest.fixture
def sum_tool():
    return build_tool(AgentToolDef(
        name="add_numbers",
        description="Add two numbers",
        input_schema=SumInput,
        call=_sum_call,
    ))
```

### Module-Scoped Fixtures (E2E)

**For expensive setup that persists across tests:**
```python
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
            pass
```

## Mocking

**Framework:** `unittest.mock` (stdlib)

**Common patterns:**

### Patching External Dependencies

```python
from unittest.mock import AsyncMock, MagicMock, patch

with patch("synqlab.agent.engine.AsyncOpenAI") as MockClient:
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(
        return_value=_make_text_response("Hello!")
    )
    MockClient.return_value = mock_client
    
    # Test code that uses AsyncOpenAI
```

### Creating Mock Response Objects

```python
def _make_text_response(content: str):
    """Create a mock OpenAI response with text content."""
    message = MagicMock()
    message.content = content
    message.tool_calls = None

    choice = MagicMock()
    choice.message = message

    usage = MagicMock()
    usage.prompt_tokens = 100
    usage.completion_tokens = 50

    response = MagicMock()
    response.choices = [choice]
    response.usage = usage
    return response
```

### Patching HuggingFace Pipeline

```python
def _make_adapter_with_mock_pipeline(n: int = 5) -> ProtGPT2Adapter:
    """Return a ProtGPT2Adapter with the HuggingFace pipeline pre-patched."""
    adapter = ProtGPT2Adapter()
    fake_output = [{"generated_text": f"ACDEFGHIK_{i}"} for i in range(n)]
    adapter._pipeline = MagicMock(return_value=fake_output)
    return adapter
```

### Mock Async Generators

```python
def _mock_text_event_stream(text: str):
    """Build an async generator that yields events."""
    async def _gen(self, content: str):
        yield AgentEvent(type=AgentEventType.TEXT_DONE, data={"content": text})
        yield AgentEvent(type=AgentEventType.TURN_DONE, data={"reason": "stop"})
    return _gen
```

**What to Mock:**
- External API clients (OpenAI, HuggingFace)
- Database sessions (use in-memory SQLite instead)
- File I/O when testing business logic
- Network requests

**What NOT to Mock:**
- The code under test
- Simple data structures
- Database queries (use test fixtures instead)

## Test Data

### Request Factory Functions

```python
def _req(**inputs) -> ToolRequest:
    return ToolRequest(
        tool_id="protgpt2",
        inputs=inputs,
        experiment_id="exp-1",
        round_id="r1",
    )
```

### Pydantic Models for Test Inputs

```python
class SumInput(BaseModel):
    a: int = Field(..., description="First number")
    b: int = Field(..., description="Second number")
```

### Environment Variable Setup

```python
# Set before importing application modules
os.environ["SYNQLAB_DB_URL"] = f"sqlite:///{_TMP_DB_FILE.as_posix()}"
os.environ.setdefault("SYNQLAB_JWT_SECRET", "synqlab-e2e-test-secret")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-real")
```

## E2E/Integration Testing

### ASGI Client Testing

**Pattern:** Use `httpx.ASGITransport` to test FastAPI without HTTP server.

```python
import httpx
import pytest_asyncio
from app.main import app

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
```

### Authentication in Tests

```python
@pytest.fixture(scope="module")
def auth_headers() -> dict[str, str]:
    """Authenticated request headers."""
    token = create_token(_TEST_USER_ID, expires_in_seconds=3600)
    return {
        "Authorization": f"Bearer {token}",
        "X-Org-Id": _TEST_ORG_ID,
    }
```

### Full Roundtrip Test Example

```python
class TestMessageSubmission:
    @pytest.mark.asyncio
    async def test_submit_message_returns_response(self, client: httpx.AsyncClient):
        """POST /sessions/{id}/message returns events from engine turn."""
        # Create session
        create_resp = await client.post(
            "/api/agents/sessions",
            json={"title": "Message Test"},
        )
        session_id = create_resp.json()["id"]

        # Mock engine and send message
        with patch("synqlab.agent.engine.AgentEngine.submit_message", ...):
            resp = await client.post(
                f"/api/agents/sessions/{session_id}/message",
                json={"content": "Hello"},
            )

        assert resp.status_code == 200
        types = [e["type"] for e in resp.json()["events"]]
        assert "text_done" in types
```

## Coverage

**Requirements:** Not enforced (no coverage threshold configured)

**Tool:** pytest-cov

**Run with coverage:**
```bash
pytest --cov=synqlab --cov-report=html
```

**View Report:**
```bash
open htmlcov/index.html   # macOS
start htmlcov/index.html  # Windows
```

## Test Types Summary

| Type | Location | Scope | DB | Network |
|------|----------|-------|-----|---------|
| Unit | `tests/unit/` | Single function/class | In-memory SQLite | Mocked |
| Integration | `tests/test_*.py` | Multiple components | In-memory SQLite | Mocked |
| E2E | `tests/test_e2e_*.py` | Full API flow | File-based SQLite | Mocked |

## Frontend Testing

**Status:** No frontend test files detected.

**Frameworks available:**
- Vitest (standard for Vite projects)
- React Testing Library

**Recommended setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

---

*Testing analysis: 2026-05-02*

"""Shared test configuration and fixtures for SynqLab unit tests."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the synqLab-agent root is on the Python path when running pytest directly.
_AGENT_ROOT = Path(__file__).resolve().parent.parent
if str(_AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(_AGENT_ROOT))

import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def agent_db_session():
    """In-memory SQLite session with all agent tables created.

    Use for unit tests of persistence, list endpoints, and any code
    that touches synqlab.agent.models.AgentArtifact / AgentSession.
    """
    # Import inside fixture so models register on Base before create_all.
    from synqlab.storage.models import Base  # noqa: F401  registers core tables
    import synqlab.auth.models  # noqa: F401  registers organizations/users/teams (FK targets)
    import synqlab.agent.models  # noqa: F401  registers agent tables

    # Use StaticPool + check_same_thread=False to share a single connection 
    # across all threads. This is necessary for TestClient which runs
    # requests in a different thread.
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


@pytest.fixture
def patch_db_session(agent_db_session):
    """Patch all DB session getters to use the test session.
    
    Use this fixture when testing FastAPI endpoints via TestClient.
    """
    import synqlab.storage.db as db_module
    
    # Reset any cached state and set the test session override
    db_module.reset_engine()
    db_module.set_test_session(agent_db_session)
    
    yield agent_db_session
    
    # Cleanup: reset the test session
    db_module.set_test_session(None)

"""PostgreSQL connection management (SQLAlchemy + psycopg2).

Connection URL is read from the SYNQLAB_DB_URL environment variable,
falling back to the value in configs/base.yaml.
"""

from __future__ import annotations

import logging
import os

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import sessionmaker, Session

from synqlab.agent import models as _agent_models  # noqa: F401
from synqlab.auth import models as _auth_models  # noqa: F401
from synqlab.chat import models as _chat_models  # noqa: F401
from synqlab.storage.models import Base

logger = logging.getLogger(__name__)

_engine: Engine | None = None
_SessionLocal: sessionmaker | None = None
_test_session_override: Session | None = None


def set_test_session(session: Session | None) -> None:
    """Set a test session override. When set, get_session() returns this session."""
    global _test_session_override
    _test_session_override = session


def _resolve_db_url() -> str:
    url = os.environ.get("SYNQLAB_DB_URL")
    if url:
        return url
    try:
        from synqlab.core.config import load_config
        cfg = load_config()
        return cfg.db_url
    except Exception:
        return "postgresql://synqlab:synqlab@localhost:5432/synqlab"


def get_engine(db_url: str | None = None) -> Engine:
    """Return the shared SQLAlchemy engine, creating it if necessary."""
    global _engine
    if _engine is None:
        url = db_url or _resolve_db_url()
        logger.info("Creating SQLAlchemy engine for %s", url.split("@")[-1])
        _engine = create_engine(url, pool_pre_ping=True, future=True)
    return _engine


def get_session_factory(db_url: str | None = None) -> sessionmaker:
    """Return the shared session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine(db_url)
        _SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return _SessionLocal


def get_session(db_url: str | None = None) -> Session:
    """Open and return a new database session.

    Callers are responsible for committing / rolling back and closing.
    If a test session is set via set_test_session(), returns that instead.
    """
    if _test_session_override is not None:
        return _test_session_override
    factory = get_session_factory(db_url)
    return factory()


def init_db(db_url: str | None = None) -> None:
    """Create all tables if they do not already exist."""
    engine = get_engine(db_url)
    Base.metadata.create_all(engine)
    logger.info("Database tables initialised.")


def reset_engine() -> None:
    """Tear down the shared engine (useful in tests)."""
    global _engine, _SessionLocal, _test_session_override
    if _engine is not None:
        _engine.dispose()
        _engine = None
    _SessionLocal = None
    _test_session_override = None


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    url = sys.argv[1] if len(sys.argv) > 1 else None
    init_db(url)
    logger.info("DB initialised successfully.")

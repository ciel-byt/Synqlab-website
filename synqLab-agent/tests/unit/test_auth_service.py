"""Unit tests for synqlab.auth.service."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from synqlab.auth.exceptions import AuthError
from synqlab.auth.service import authenticate, create_user
from synqlab.storage.models import Base


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


def test_create_user_hashes_password(session: Session) -> None:
    user = create_user(session, "user@example.com", "secret123", "User One")
    assert user.password_hash is not None
    assert user.password_hash != "secret123"


def test_create_user_duplicate_email_raises(session: Session) -> None:
    create_user(session, "duplicate@example.com", "secret123", "First")
    with pytest.raises(AuthError):
        create_user(session, "duplicate@example.com", "secret123", "Second")


def test_authenticate_correct_password(session: Session) -> None:
    created = create_user(session, "auth@example.com", "secret123", "Auth User")
    user = authenticate(session, "auth@example.com", "secret123")
    assert user is not None
    assert user.id == created.id


def test_authenticate_wrong_password_returns_none(session: Session) -> None:
    create_user(session, "wrong-pass@example.com", "secret123", "Auth User")
    assert authenticate(session, "wrong-pass@example.com", "wrong") is None


def test_authenticate_unknown_email_returns_none(session: Session) -> None:
    assert authenticate(session, "unknown@example.com", "secret123") is None

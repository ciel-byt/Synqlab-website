"""Integration tests for auth router and JWT middleware."""

from __future__ import annotations

from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from synqlab.storage.models import Base


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("SYNQLAB_JWT_SECRET", "test-secret")
    engine = create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def _get_test_session() -> Session:
        return factory()

    monkeypatch.setattr("app.routers.auth.get_session", _get_test_session)
    monkeypatch.setattr("synqlab.auth.dependencies.get_session", _get_test_session)
    monkeypatch.setattr("synqlab.storage.db.get_session", _get_test_session)

    with TestClient(app) as test_client:
        yield test_client


def _signup(client: TestClient, email: str = "alice@example.com") -> dict:
    response = client.post(
        "/auth/signup",
        json={"email": email, "password": "secret123", "full_name": "Alice"},
    )
    assert response.status_code == 201
    return response.json()


def test_signup_creates_user_and_returns_token(client: TestClient) -> None:
    body = _signup(client)
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "alice@example.com"


def test_signup_duplicate_email_returns_422(client: TestClient) -> None:
    _signup(client, "duplicate@example.com")
    response = client.post(
        "/auth/signup",
        json={"email": "duplicate@example.com", "password": "secret123", "full_name": "Alice"},
    )
    assert response.status_code == 422


def test_login_correct_credentials_returns_token(client: TestClient) -> None:
    _signup(client, "login@example.com")
    response = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "secret123"},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    _signup(client, "wrong@example.com")
    response = client.post(
        "/auth/login",
        json={"email": "wrong@example.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_me_with_valid_token_returns_user(client: TestClient) -> None:
    body = _signup(client, "me@example.com")
    token = body["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


def test_me_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_protected_api_route_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/api/tools")
    assert response.status_code == 401


def test_protected_api_route_with_valid_token_passes(client: TestClient) -> None:
    body = _signup(client, "protected@example.com")
    token = body["access_token"]
    response = client.get("/api/tools", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code != 401

"""Unit tests for synqlab.auth.jwt."""

from __future__ import annotations

import pytest

from synqlab.auth.exceptions import ExpiredTokenError, InvalidTokenError
from synqlab.auth.jwt import create_token, decode_token


def test_create_and_decode_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SYNQLAB_JWT_SECRET", "test-secret")
    token = create_token("user-123")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"


def test_expired_token_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SYNQLAB_JWT_SECRET", "test-secret")
    token = create_token("user-123", expires_in_seconds=-1)
    with pytest.raises(ExpiredTokenError):
        decode_token(token)


def test_invalid_token_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SYNQLAB_JWT_SECRET", "test-secret")
    with pytest.raises(InvalidTokenError):
        decode_token("not-a-jwt")


def test_token_contains_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SYNQLAB_JWT_SECRET", "test-secret")
    token = create_token("abc")
    payload = decode_token(token)
    assert payload["sub"] == "abc"

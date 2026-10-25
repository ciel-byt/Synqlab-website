"""Password hashing for SynqLab auth.

Uses ``bcrypt`` directly and pre-hashes the password with SHA-256 (then
base64-encodes it) so the secret fed into bcrypt is always 44 printable
ASCII bytes — safely under bcrypt's 72-byte input limit, regardless of
the original password length or Unicode content.

This is the same trick ``passlib``'s ``bcrypt_sha256`` scheme uses, just
without passlib itself. We dropped passlib because it's unmaintained
(last release 2020) and its bcrypt backend's lazy self-test trips a
hard ``ValueError`` on bcrypt>=4.1, making every signup/login fail.

Stored hash format::

    bcrypt_sha256$<bcrypt-hash-string>

Keeping a scheme prefix leaves the door open to add argon2/scrypt later
without a DB migration — ``verify_password`` dispatches by prefix.
"""

from __future__ import annotations

import base64
import hashlib

import bcrypt

_SCHEME = "bcrypt_sha256"
# 12 rounds ≈ 200 ms on modern hardware; same cost factor passlib used
# so behavior matches any pre-existing docs/expectations.
_ROUNDS = 12


def _prehash(password: str) -> bytes:
    """SHA-256 → base64, yielding 44 bytes well under bcrypt's 72-byte cap."""
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)


def hash_password(password: str) -> str:
    """Return the stored hash string for a new/changed password."""
    if not isinstance(password, str) or not password:
        raise ValueError("password must be a non-empty string")
    salted = bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=_ROUNDS))
    return f"{_SCHEME}${salted.decode('ascii')}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verify a password against a stored hash string.

    Returns ``False`` for any malformed/unknown-scheme input rather than
    raising — callers already treat a ``False`` return as "bad password",
    and we don't want to leak scheme mismatches as 500s.
    """
    if not isinstance(password, str) or not password or not stored:
        return False
    scheme, sep, payload = stored.partition("$")
    if not sep or scheme != _SCHEME:
        return False
    try:
        return bcrypt.checkpw(_prehash(password), payload.encode("ascii"))
    except (ValueError, TypeError):
        return False

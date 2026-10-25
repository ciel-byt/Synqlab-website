"""JWT utilities for SynqLab authentication."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from jose import JWTError, ExpiredSignatureError, jwt

from synqlab.auth.exceptions import ExpiredTokenError, InvalidTokenError

logger = logging.getLogger(__name__)

_ALGORITHM = "HS256"
_DEV_FALLBACK_SECRET = "synqlab-dev-insecure-secret"


def _jwt_secret() -> str:
    secret = os.environ.get("SYNQLAB_JWT_SECRET")
    if secret:
        return secret
    logger.warning("SYNQLAB_JWT_SECRET is not set; using development fallback secret.")
    return _DEV_FALLBACK_SECRET


def create_token(user_id: str, expires_in_seconds: int = 86400) -> str:
    """Create a signed JWT containing user_id in sub claim."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        decoded = jwt.decode(token, _jwt_secret(), algorithms=[_ALGORITHM])
        return dict(decoded)
    except ExpiredSignatureError as exc:
        raise ExpiredTokenError("Token expired.") from exc
    except JWTError as exc:
        raise InvalidTokenError("Invalid token.") from exc

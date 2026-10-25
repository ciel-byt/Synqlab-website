"""FastAPI auth dependencies."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from synqlab.auth.exceptions import ExpiredTokenError, InvalidTokenError
from synqlab.auth.jwt import decode_token
from synqlab.auth.models import User
from synqlab.auth.service import get_user_by_id
from synqlab.storage.db import get_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """Resolve the current user from a bearer token."""
    try:
        payload = decode_token(token)
    except (ExpiredTokenError, InvalidTokenError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc

    user_id = str(payload.get("sub", "")).strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    session = get_session()
    try:
        user = get_user_by_id(session, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
        if user.is_active is False:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled.")
        return user
    finally:
        session.close()


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Allow only platform admins."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only.")
    return user

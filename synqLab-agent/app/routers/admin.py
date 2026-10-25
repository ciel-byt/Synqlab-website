"""Admin: list, create and manage platform users."""

from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from synqlab.auth.dependencies import require_admin
from synqlab.auth.exceptions import AuthError
from synqlab.auth.models import OrgMember, User
from synqlab.auth.password import hash_password
from synqlab.auth.service import create_user, get_user_by_email
from synqlab.storage.db import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserRow(BaseModel):
    id: str
    email: str
    full_name: str
    is_admin: bool
    is_active: bool
    created_at: str | None


class CreateUser(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    is_admin: bool = False


class PatchUser(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_admin: bool | None = None
    is_active: bool | None = None


def _row(u: User) -> UserRow:
    return UserRow(
        id=u.id, email=u.email, full_name=u.full_name, is_admin=bool(u.is_admin),
        is_active=u.is_active is not False, created_at=u.created_at.isoformat() if u.created_at else None,
    )


@router.get("/users", response_model=list[UserRow])
def list_users(_: User = Depends(require_admin)) -> list[UserRow]:
    s = get_session()
    try:
        return [_row(u) for u in s.query(User).order_by(User.created_at).all()]
    finally:
        s.close()


@router.post("/users", response_model=UserRow, status_code=status.HTTP_201_CREATED)
def add_user(body: CreateUser, admin: User = Depends(require_admin)) -> UserRow:
    s = get_session()
    try:
        try:
            u = create_user(s, body.email, body.password, body.full_name)
        except AuthError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        u.is_admin = body.is_admin
        # New people join the organizations the admin belongs to, so they land in a working workspace.
        for m in s.query(OrgMember).filter(OrgMember.user_id == admin.id).all():
            s.add(OrgMember(org_id=m.org_id, user_id=u.id, role="member"))
        s.commit()
        s.refresh(u)
        return _row(u)
    finally:
        s.close()


@router.patch("/users/{user_id}", response_model=UserRow)
def edit_user(user_id: str, body: PatchUser, admin: User = Depends(require_admin)) -> UserRow:
    s = get_session()
    try:
        u = s.get(User, user_id)
        if u is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if u.id == admin.id and (body.is_active is False or body.is_admin is False):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove your own admin access or disable yourself.")
        if body.full_name is not None:
            u.full_name = body.full_name.strip()
        if body.password is not None:
            u.password_hash = hash_password(body.password)
        if body.is_admin is not None:
            u.is_admin = body.is_admin
        if body.is_active is not None:
            u.is_active = body.is_active
        s.commit()
        s.refresh(u)
        return _row(u)
    finally:
        s.close()


def ensure_bootstrap_admin() -> None:
    """Create or promote the admin named in SYNQLAB_ADMIN_EMAIL / SYNQLAB_ADMIN_PASSWORD (env, never in the repo).

    An existing account keeps its password; it is only promoted to admin.
    """
    email = os.environ.get("SYNQLAB_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("SYNQLAB_ADMIN_PASSWORD", "")
    if not email or not password:
        return
    s = get_session()
    try:
        u = get_user_by_email(s, email)
        if u is None:
            u = create_user(s, email, password, os.environ.get("SYNQLAB_ADMIN_NAME", "SynqLab Admin"))
        if not u.is_admin or u.is_active is False:
            u.is_admin, u.is_active = True, True
            s.commit()
        logger.info("Admin account ready: %s", email)
    except Exception:
        s.rollback()
        logger.exception("Could not set up the admin account")
    finally:
        s.close()

"""Authentication router."""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from synqlab.auth.dependencies import get_current_user
from synqlab.auth.exceptions import AuthError
from synqlab.auth.jwt import create_token
from synqlab.auth.models import User
from synqlab.auth.service import authenticate, create_user
from synqlab.auth.service import hash_password, verify_user_password
from synqlab.storage.db import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: str | None
    professional_title: str | None
    short_bio: str | None
    linkedin_url: str | None
    scholar_url: str | None
    skills: str | None
    is_admin: bool = False


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class LogoutResponse(BaseModel):
    ok: bool


class UpdateMeRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, min_length=3, max_length=320)
    current_password: str | None = Field(default=None, min_length=1, max_length=128)
    new_password: str | None = Field(default=None, min_length=6, max_length=128)
    avatar_url: str | None = None
    professional_title: str | None = Field(default=None, max_length=120)
    short_bio: str | None = Field(default=None, max_length=280)
    linkedin_url: str | None = Field(default=None, max_length=500)
    scholar_url: str | None = Field(default=None, max_length=500)
    skills: str | None = Field(default=None, max_length=500)


def _resolve_user_storage_root(user: User) -> Path:
    base = os.environ.get("SYNQLAB_SYNC_DIR") or os.environ.get("SYNQLAB_STORAGE_PATH")
    if base:
        return Path(base).expanduser()
    return Path(__file__).resolve().parents[2] / "artifacts" / "user_media"


def _serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        professional_title=user.professional_title,
        short_bio=user.short_bio,
        linkedin_url=user.linkedin_url,
        scholar_url=user.scholar_url,
        skills=user.skills,
        is_admin=bool(user.is_admin),
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest) -> AuthResponse:
    # Accounts are created by an admin (Admin page). Open signup is opt-in.
    if os.environ.get("SYNQLAB_ALLOW_SIGNUP", "").lower() not in {"1", "true", "yes"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sign-up is closed. Ask an admin to create your account.")
    session = get_session()
    try:
        try:
            user = create_user(session, body.email, body.password, body.full_name)
        except AuthError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
        token = create_token(user.id)
        return AuthResponse(access_token=token, token_type="bearer", user=_serialize_user(user))
    finally:
        session.close()


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    session = get_session()
    try:
        user = authenticate(session, body.email, body.password)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")
        token = create_token(user.id)
        return AuthResponse(access_token=token, token_type="bearer", user=_serialize_user(user))
    finally:
        session.close()


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return _serialize_user(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    session = get_session()
    try:
        user = session.get(User, current_user.id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        if body.new_password and not body.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password.",
            )
        if body.new_password and not verify_user_password(user, body.current_password or ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        if body.email is not None:
            next_email = body.email.strip().lower()
            if not next_email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email cannot be empty.")
            # Treat email changes as sensitive; require current password.
            if next_email != (user.email or "").strip().lower():
                if not body.current_password:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Current password is required to change email.",
                    )
                if not verify_user_password(user, body.current_password):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Current password is incorrect.",
                    )
                existing = session.query(User).filter(User.email == next_email, User.id != user.id).first()
                if existing is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="A user with this email already exists.",
                    )
                user.email = next_email

        if body.full_name is not None:
            user.full_name = body.full_name.strip()
        if body.new_password is not None:
            user.password_hash = hash_password(body.new_password)
        if body.avatar_url is not None:
            user.avatar_url = body.avatar_url.strip() or None
        if body.professional_title is not None:
            user.professional_title = body.professional_title.strip() or None
        if body.short_bio is not None:
            user.short_bio = body.short_bio.strip() or None
        if body.linkedin_url is not None:
            user.linkedin_url = body.linkedin_url.strip() or None
        if body.scholar_url is not None:
            user.scholar_url = body.scholar_url.strip() or None
        if body.skills is not None:
            user.skills = body.skills.strip() or None
        session.commit()
        session.refresh(user)
        return _serialize_user(user)
    finally:
        session.close()


@router.post("/me/avatar-upload", response_model=UserResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    session = get_session()
    try:
        user = session.get(User, current_user.id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
            if file.content_type == "image/png":
                suffix = ".png"
            elif file.content_type == "image/gif":
                suffix = ".gif"
            elif file.content_type == "image/webp":
                suffix = ".webp"
            elif file.content_type in {"image/jpg", "image/jpeg"}:
                suffix = ".jpg"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only image uploads are allowed (png, jpg, jpeg, gif, webp).",
                )

        avatar_dir = _resolve_user_storage_root(user) / "avatars" / user.id
        avatar_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{suffix}"
        target = avatar_dir / filename
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)

        user.avatar_url = f"/auth/avatar/{user.id}/{filename}"
        session.commit()
        session.refresh(user)
        return _serialize_user(user)
    finally:
        session.close()


@router.get("/avatar/{user_id}/{filename}")
def serve_avatar(user_id: str, filename: str) -> FileResponse:
    session = get_session()
    try:
        user = session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if not user.avatar_url or not user.avatar_url.endswith(f"/{filename}"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found.")
        avatar_path = (_resolve_user_storage_root(user) / "avatars" / user_id / filename).resolve()
        if not avatar_path.exists() or not avatar_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar file not found.")
        return FileResponse(str(avatar_path))
    finally:
        session.close()


@router.post("/logout", response_model=LogoutResponse)
def logout() -> LogoutResponse:
    return LogoutResponse(ok=True)

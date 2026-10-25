"""Organization and invitation router."""

from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi import File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func

from synqlab.auth.dependencies import get_current_user
from synqlab.auth.exceptions import AuthError
from synqlab.auth.models import OrgInvitation, OrgMember, Organization, User
from synqlab.auth.service import (
    create_invite,
    create_org,
    get_invite_by_token,
    get_org_member,
    list_org_members,
    list_orgs_for_user,
    list_pending_invites,
    paginate_org_members,
    redeem_invite,
    revoke_invite,
)
from synqlab.storage.db import get_session

router = APIRouter(tags=["organizations"])


class OrgCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=2, max_length=120)


class OrgRenameRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: str | None = None


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    avatar_url: str | None
    plan_tier: str
    created_at: str


class OrgMemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    joined_at: str
    auth_provider: str
    avatar_url: str | None
    professional_title: str | None = None
    short_bio: str | None = None
    linkedin_url: str | None = None
    scholar_url: str | None = None
    skills: str | None = None


class OrgMembersPageResponse(BaseModel):
    items: list[OrgMemberResponse]
    total: int
    role_counts: dict[str, int]
    limit: int
    offset: int


class MemberRoleRequest(BaseModel):
    role: str = Field(pattern="^(owner|admin|member|guest)$")


class CreateInviteRequest(BaseModel):
    email: str | None = None
    role: str = "member"


class InviteResponse(BaseModel):
    id: str
    token: str
    invite_url: str
    role: str
    email: str | None
    expires_at: str
    accepted_at: str | None


class InvitePreviewResponse(BaseModel):
    org_name: str
    role: str
    expires_at: str
    valid: bool


class InviteAcceptResponse(BaseModel):
    org_id: str
    org_name: str
    role: str


class MyInviteResponse(BaseModel):
    id: str
    org_id: str
    org_name: str
    role: str
    direction: str
    invitee_email: str | None
    invite_url: str
    created_at: str
    expires_at: str
    status: str


def _serialize_org(org: Organization) -> OrgResponse:
    return OrgResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        avatar_url=org.avatar_url,
        plan_tier=org.plan_tier,
        created_at=org.created_at.isoformat() if org.created_at else "",
    )


def _media_root() -> Path:
    base = os.environ.get("SYNQLAB_SYNC_DIR") or os.environ.get("SYNQLAB_STORAGE_PATH")
    if base:
        return Path(base).expanduser()
    return Path(__file__).resolve().parents[2] / "artifacts" / "media"


def _require_org_admin(session, org_id: str, user_id: str) -> None:
    membership = get_org_member(session, org_id, user_id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization.")
    if membership.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Admin role required.")


def _invite_base_url(request: Request) -> str:
    """Prefer frontend origin when available so invite links open UI pages."""
    configured = os.environ.get("SYNQLAB_FRONTEND_URL")
    if configured:
        return configured.rstrip("/")
    origin = request.headers.get("origin")
    if origin and origin != "null":
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    return str(request.base_url).rstrip("/")


def _normalize_invite_token(token: str) -> str:
    cleaned = (token or "").strip().strip("/")
    return "".join(ch for ch in cleaned if ch.isalnum() or ch in {"-", "_"})


def _invite_status(invite) -> str:
    if invite.accepted_at is not None:
        return "accepted"
    if getattr(invite, "rejected_at", None) is not None:
        return "rejected"
    expires_at = invite.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return "expired"
    return "pending"


@router.get("/api/orgs", response_model=list[OrgResponse])
def list_my_orgs(current_user: User = Depends(get_current_user)) -> list[OrgResponse]:
    session = get_session()
    try:
        orgs = list_orgs_for_user(session, current_user.id)
        return [_serialize_org(org) for org in orgs]
    finally:
        session.close()


@router.post("/api/orgs", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
def create_organization(body: OrgCreateRequest, current_user: User = Depends(get_current_user)) -> OrgResponse:
    session = get_session()
    try:
        try:
            org = create_org(session, body.name, body.slug, created_by=current_user.id)
        except AuthError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return _serialize_org(org)
    finally:
        session.close()


@router.get("/api/orgs/{org_id}", response_model=OrgResponse)
def get_organization(org_id: str, current_user: User = Depends(get_current_user)) -> OrgResponse:
    session = get_session()
    try:
        membership = get_org_member(session, org_id, current_user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        org = session.get(Organization, org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found.")
        return _serialize_org(org)
    finally:
        session.close()


@router.get("/api/orgs/{org_id}/members", response_model=list[OrgMemberResponse])
def get_members(org_id: str, current_user: User = Depends(get_current_user)) -> list[OrgMemberResponse]:
    session = get_session()
    try:
        membership = get_org_member(session, org_id, current_user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        rows = list_org_members(session, org_id)
        return [
            OrgMemberResponse(
                user_id=m.user_id,
                email=u.email,
                full_name=u.full_name,
                role=m.role,
                joined_at=m.joined_at.isoformat() if m.joined_at else "",
                auth_provider=u.auth_provider,
                avatar_url=u.avatar_url,
                professional_title=u.professional_title,
                short_bio=u.short_bio,
                linkedin_url=u.linkedin_url,
                scholar_url=u.scholar_url,
                skills=u.skills,
            )
            for m, u in rows
        ]
    finally:
        session.close()


@router.get("/api/orgs/{org_id}/members/page", response_model=OrgMembersPageResponse)
def page_members(
    org_id: str,
    q: str = Query(default="", description="Search by name or email"),
    role: str | None = Query(default=None, description="Filter by role"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
) -> OrgMembersPageResponse:
    """Scalable paged listing with server-side search and role filter.

    Designed for orgs up to 10k+ members. Returns a page of members plus the
    org-wide total and role_counts so dashboard widgets can render aggregate
    numbers without loading every row client-side.
    """
    session = get_session()
    try:
        membership = get_org_member(session, org_id, current_user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        rows, total, role_counts = paginate_org_members(
            session, org_id, query=q, role=role, limit=limit, offset=offset
        )
        return OrgMembersPageResponse(
            items=[
                OrgMemberResponse(
                    user_id=m.user_id,
                    email=u.email,
                    full_name=u.full_name,
                    role=m.role,
                    joined_at=m.joined_at.isoformat() if m.joined_at else "",
                    auth_provider=u.auth_provider,
                    avatar_url=u.avatar_url,
                    professional_title=u.professional_title,
                    short_bio=u.short_bio,
                    linkedin_url=u.linkedin_url,
                    scholar_url=u.scholar_url,
                    skills=u.skills,
                )
                for m, u in rows
            ],
            total=total,
            role_counts=role_counts,
            limit=limit,
            offset=offset,
        )
    finally:
        session.close()


@router.patch("/api/orgs/{org_id}", response_model=OrgResponse)
def rename_organization(
    org_id: str, body: OrgRenameRequest, current_user: User = Depends(get_current_user)
) -> OrgResponse:
    session = get_session()
    try:
        _require_org_admin(session, org_id, current_user.id)
        org = session.get(Organization, org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found.")
        if body.name is not None:
            next_name = body.name.strip()
            existing = (
                session.query(Organization)
                .filter(func.lower(Organization.name) == next_name.lower(), Organization.id != org_id)
                .first()
            )
            if existing is not None:
                raise HTTPException(
                    status_code=409,
                    detail="Organization name already exists. Choose a different name.",
                )
            org.name = next_name
        if body.avatar_url is not None:
            org.avatar_url = body.avatar_url.strip() or None
        session.commit()
        session.refresh(org)
        return _serialize_org(org)
    finally:
        session.close()


@router.post("/api/orgs/{org_id}/avatar-upload", response_model=OrgResponse)
async def upload_org_avatar(
    org_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> OrgResponse:
    session = get_session()
    try:
        _require_org_admin(session, org_id, current_user.id)
        org = session.get(Organization, org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found.")
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
            if file.content_type in {"image/jpeg", "image/jpg"}:
                suffix = ".jpg"
            elif file.content_type == "image/png":
                suffix = ".png"
            elif file.content_type == "image/gif":
                suffix = ".gif"
            elif file.content_type == "image/webp":
                suffix = ".webp"
            elif file.content_type == "image/svg+xml":
                suffix = ".svg"
            else:
                raise HTTPException(status_code=400, detail="Only image uploads are allowed.")
        target_dir = _media_root() / "org_avatars" / org_id
        target_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{suffix}"
        target = target_dir / filename
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)
        org.avatar_url = f"/api/orgs/{org_id}/avatar/{filename}"
        session.commit()
        session.refresh(org)
        return _serialize_org(org)
    finally:
        session.close()


@router.get("/api/orgs/{org_id}/avatar/{filename}")
def serve_org_avatar(org_id: str, filename: str) -> FileResponse:
    session = get_session()
    try:
        path = (_media_root() / "org_avatars" / org_id / filename).resolve()
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=404, detail="Avatar not found.")
        return FileResponse(str(path))
    finally:
        session.close()


@router.delete("/api/orgs/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(org_id: str, current_user: User = Depends(get_current_user)) -> None:
    session = get_session()
    try:
        membership = get_org_member(session, org_id, current_user.id)
        if membership is None or membership.role != "owner":
            raise HTTPException(status_code=403, detail="Only the owner can delete an organization.")
        org = session.get(Organization, org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found.")
        session.delete(org)
        session.commit()
    finally:
        session.close()


@router.patch("/api/orgs/{org_id}/members/{user_id}", response_model=OrgMemberResponse)
def update_member_role(
    org_id: str,
    user_id: str,
    body: MemberRoleRequest,
    current_user: User = Depends(get_current_user),
) -> OrgMemberResponse:
    session = get_session()
    try:
        _require_org_admin(session, org_id, current_user.id)
        member = session.get(OrgMember, (org_id, user_id))
        if member is None:
            raise HTTPException(status_code=404, detail="Member not found.")
        if member.role == "owner" and current_user.id != user_id:
            raise HTTPException(status_code=403, detail="Cannot change owner role.")
        target_user = session.get(User, user_id)
        if target_user is None:
            raise HTTPException(status_code=404, detail="User not found.")
        member.role = body.role
        session.commit()
        session.refresh(member)
        return OrgMemberResponse(
            user_id=member.user_id,
            email=target_user.email,
            full_name=target_user.full_name,
            role=member.role,
            joined_at=member.joined_at.isoformat() if member.joined_at else "",
            auth_provider=target_user.auth_provider,
            avatar_url=target_user.avatar_url,
            professional_title=target_user.professional_title,
            short_bio=target_user.short_bio,
            linkedin_url=target_user.linkedin_url,
            scholar_url=target_user.scholar_url,
            skills=target_user.skills,
        )
    finally:
        session.close()


@router.delete("/api/orgs/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(org_id: str, user_id: str, current_user: User = Depends(get_current_user)) -> None:
    session = get_session()
    try:
        current_membership = get_org_member(session, org_id, current_user.id)
        if current_membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        # Allow self-removal, otherwise require admin
        if user_id != current_user.id and current_membership.role not in {"owner", "admin"}:
            raise HTTPException(status_code=403, detail="Admin role required.")
        target = session.get(OrgMember, (org_id, user_id))
        if target is None:
            raise HTTPException(status_code=404, detail="Member not found.")
        if target.role == "owner":
            raise HTTPException(status_code=403, detail="Cannot remove the organization owner.")
        session.delete(target)
        session.commit()
    finally:
        session.close()


@router.post("/api/orgs/{org_id}/invitations", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
def create_organization_invite(
    org_id: str,
    body: CreateInviteRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> InviteResponse:
    session = get_session()
    try:
        _require_org_admin(session, org_id, current_user.id)
        invite = create_invite(
            session,
            org_id=org_id,
            invited_by=current_user.id,
            role=body.role,
            email=body.email,
        )
        base_url = _invite_base_url(request)
        return InviteResponse(
            id=invite.id,
            token=invite.token,
            invite_url=f"{base_url}/invite/{invite.token}",
            role=invite.role,
            email=invite.email,
            expires_at=invite.expires_at.isoformat(),
            accepted_at=invite.accepted_at.isoformat() if invite.accepted_at else None,
        )
    finally:
        session.close()


@router.get("/api/orgs/{org_id}/invitations", response_model=list[InviteResponse])
def get_organization_invites(org_id: str, request: Request, current_user: User = Depends(get_current_user)) -> list[InviteResponse]:
    session = get_session()
    try:
        _require_org_admin(session, org_id, current_user.id)
        invites = list_pending_invites(session, org_id)
        base_url = _invite_base_url(request)
        return [
            InviteResponse(
                id=invite.id,
                token=invite.token,
                invite_url=f"{base_url}/invite/{invite.token}",
                role=invite.role,
                email=invite.email,
                expires_at=invite.expires_at.isoformat(),
                accepted_at=invite.accepted_at.isoformat() if invite.accepted_at else None,
            )
            for invite in invites
        ]
    finally:
        session.close()


@router.delete("/api/orgs/{org_id}/invitations/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization_invite(org_id: str, invite_id: str, current_user: User = Depends(get_current_user)) -> None:
    session = get_session()
    try:
        _require_org_admin(session, org_id, current_user.id)
        try:
            revoke_invite(session, invite_id, current_user.id)
        except AuthError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        session.close()


@router.get("/api/invite/{token}", response_model=InvitePreviewResponse)
def preview_invite(token: str) -> InvitePreviewResponse:
    session = get_session()
    try:
        normalized_token = _normalize_invite_token(token)
        invite = get_invite_by_token(session, normalized_token)
        if invite is None:
            return InvitePreviewResponse(org_name="", role="", expires_at="", valid=False)
        org = session.get(Organization, invite.org_id)
        valid = _invite_status(invite) == "pending"
        return InvitePreviewResponse(
            org_name=org.name if org else "",
            role=invite.role,
            expires_at=invite.expires_at.isoformat(),
            valid=valid,
        )
    finally:
        session.close()


@router.post("/api/invite/{token}/accept", response_model=InviteAcceptResponse)
def accept_invite(token: str, current_user: User = Depends(get_current_user)) -> InviteAcceptResponse:
    session = get_session()
    try:
        normalized_token = _normalize_invite_token(token)
        invite = get_invite_by_token(session, normalized_token)
        if invite is None:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        try:
            member = redeem_invite(session, normalized_token, current_user.id)
        except AuthError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        org = session.get(Organization, member.org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found.")
        return InviteAcceptResponse(org_id=org.id, org_name=org.name, role=member.role)
    finally:
        session.close()


@router.get("/api/my/invitations", response_model=list[MyInviteResponse])
def list_my_invitations(request: Request, current_user: User = Depends(get_current_user)) -> list[MyInviteResponse]:
    session = get_session()
    try:
        my_email = (current_user.email or "").strip().lower()
        incoming = (
            session.query(OrgInvitation)
            .filter(OrgInvitation.email == my_email)
            .order_by(OrgInvitation.created_at.desc())
            .all()
        )
        outgoing = (
            session.query(OrgInvitation)
            .filter(OrgInvitation.invited_by == current_user.id)
            .order_by(OrgInvitation.created_at.desc())
            .all()
        )
        base_url = _invite_base_url(request)
        result: list[MyInviteResponse] = []
        for inv in incoming:
            org = session.get(Organization, inv.org_id)
            result.append(
                MyInviteResponse(
                    id=inv.id,
                    org_id=inv.org_id,
                    org_name=org.name if org else "",
                    role=inv.role,
                    direction="incoming",
                    invitee_email=inv.email,
                    invite_url=f"{base_url}/invite/{inv.token}",
                    created_at=inv.created_at.isoformat() if inv.created_at else "",
                    expires_at=inv.expires_at.isoformat(),
                    status=_invite_status(inv),
                )
            )
        for inv in outgoing:
            org = session.get(Organization, inv.org_id)
            status = _invite_status(inv)
            # Differentiate sender-side pending invites from receiver pending actions.
            if status == "pending":
                status = "sent"
            result.append(
                MyInviteResponse(
                    id=inv.id,
                    org_id=inv.org_id,
                    org_name=org.name if org else "",
                    role=inv.role,
                    direction="outgoing",
                    invitee_email=inv.email,
                    invite_url=f"{base_url}/invite/{inv.token}",
                    created_at=inv.created_at.isoformat() if inv.created_at else "",
                    expires_at=inv.expires_at.isoformat(),
                    status=status,
                )
            )
        result.sort(key=lambda x: x.created_at, reverse=True)
        return result
    finally:
        session.close()


@router.post("/api/my/invitations/{invite_id}/accept", response_model=InviteAcceptResponse)
def accept_my_invitation(invite_id: str, current_user: User = Depends(get_current_user)) -> InviteAcceptResponse:
    session = get_session()
    try:
        invite = session.get(OrgInvitation, invite_id)
        if invite is None:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        my_email = (current_user.email or "").strip().lower()
        if (invite.email or "").strip().lower() != my_email:
            raise HTTPException(status_code=403, detail="Not allowed to accept this invitation.")
        try:
            member = redeem_invite(session, invite.token, current_user.id)
        except AuthError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        org = session.get(Organization, member.org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found.")
        return InviteAcceptResponse(org_id=org.id, org_name=org.name, role=member.role)
    finally:
        session.close()


@router.post("/api/my/invitations/{invite_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_my_invitation(invite_id: str, current_user: User = Depends(get_current_user)) -> None:
    session = get_session()
    try:
        invite = session.get(OrgInvitation, invite_id)
        if invite is None:
            raise HTTPException(status_code=404, detail="Invitation not found.")
        my_email = (current_user.email or "").strip().lower()
        if (invite.email or "").strip().lower() != my_email:
            raise HTTPException(status_code=403, detail="Not allowed to reject this invitation.")
        if invite.accepted_at is not None:
            raise HTTPException(status_code=400, detail="Invitation already accepted.")
        if invite.rejected_at is not None:
            return
        invite.rejected_at = datetime.now(timezone.utc)
        session.commit()
    finally:
        session.close()

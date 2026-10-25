"""People / network router — search org members and user network."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from synqlab.auth.dependencies import get_current_user
from synqlab.auth.models import User
from synqlab.auth.service import list_network_for_user, search_org_members
from synqlab.storage.db import get_session

router = APIRouter(prefix="/api/people", tags=["people"])


class PersonResponse(dict):
    pass


def _user_to_dict(u: User, role: str | None = None) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "avatar_url": u.avatar_url,
        "professional_title": u.professional_title,
        "short_bio": u.short_bio,
        "linkedin_url": u.linkedin_url,
        "scholar_url": u.scholar_url,
        "skills": u.skills,
        "role": role,
    }


@router.get("")
def list_my_network(
    q: str = Query(default="", description="Search by name or email"),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Return users connected to the current user (shared org, coauthor, etc.)."""
    session = get_session()
    try:
        users = list_network_for_user(session, current_user.id, query=q, limit=limit)
        return [_user_to_dict(u) for u in users]
    finally:
        session.close()


@router.get("/org/{org_id}/search")
def search_members(
    org_id: str,
    q: str = Query(default="", description="Search fragment"),
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Search members of a specific organization by name or email."""
    from synqlab.auth.service import get_org_member
    from fastapi import HTTPException

    session = get_session()
    try:
        membership = get_org_member(session, org_id, current_user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        rows = search_org_members(session, org_id, q, limit=limit)
        return [_user_to_dict(u, role=m.role) for m, u in rows]
    finally:
        session.close()

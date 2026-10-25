"""Service helpers for user auth flows."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone


from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from synqlab.auth.exceptions import AuthError
from synqlab.auth.models import OrgInvitation, OrgMember, Organization, User, UserConnection
from synqlab.auth.password import hash_password, verify_password

logger = logging.getLogger(__name__)


def create_user(session: Session, email: str, password: str, full_name: str) -> User:
    """Create a user with a hashed password."""
    normalized_email = email.strip().lower()
    password_hash = hash_password(password)
    user = User(
        email=normalized_email,
        full_name=full_name.strip(),
        password_hash=password_hash,
        auth_provider="email",
    )
    session.add(user)
    try:
        session.commit()
        session.refresh(user)
        return user
    except IntegrityError as exc:
        session.rollback()
        raise AuthError("A user with this email already exists.") from exc
    except Exception:
        session.rollback()
        logger.exception("Failed to create user.")
        raise


def authenticate(session: Session, email: str, password: str) -> User | None:
    """Return a user when credentials are valid, otherwise None."""
    user = get_user_by_email(session, email)
    if user is None or not user.password_hash or user.is_active is False:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def verify_user_password(user: User, password: str) -> bool:
    """Validate a plain password against the stored user hash."""
    if not user.password_hash:
        return False
    return verify_password(password, user.password_hash)



def get_user_by_id(session: Session, user_id: str) -> User | None:
    """Lookup user by ID."""
    return session.get(User, user_id)


def get_user_by_email(session: Session, email: str) -> User | None:
    """Lookup user by normalized email."""
    normalized_email = email.strip().lower()
    return session.query(User).filter(User.email == normalized_email).first()


def create_org(session: Session, name: str, slug: str, created_by: str) -> Organization:
    """Create an organization and assign creator as owner."""
    normalized_name = name.strip()
    normalized_slug = slug.strip().lower()
    existing_by_name = (
        session.query(Organization)
        .filter(func.lower(Organization.name) == normalized_name.lower())
        .first()
    )
    if existing_by_name is not None:
        raise AuthError("Organization name already exists. Choose a different name.")

    org = Organization(name=normalized_name, slug=normalized_slug, created_by=created_by)
    session.add(org)
    try:
        session.flush()
        session.add(OrgMember(org_id=org.id, user_id=created_by, role="owner"))
        session.commit()
        session.refresh(org)
        return org
    except IntegrityError as exc:
        session.rollback()
        err = str(getattr(exc, "orig", exc)).lower()
        if "organizations.slug" in err or "slug" in err:
            raise AuthError("Organization already exists. Choose a different name or custom slug.") from exc
        raise AuthError("Organization could not be created due to duplicate data.") from exc
    except Exception:
        session.rollback()
        logger.exception("Failed to create organization.")
        raise


def list_orgs_for_user(session: Session, user_id: str) -> list[Organization]:
    """List organizations where user is a member."""
    return (
        session.query(Organization)
        .join(OrgMember, OrgMember.org_id == Organization.id)
        .filter(OrgMember.user_id == user_id)
        .order_by(Organization.created_at.desc())
        .all()
    )


def get_org_member(session: Session, org_id: str, user_id: str) -> OrgMember | None:
    """Get user's membership in an organization."""
    return (
        session.query(OrgMember)
        .filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id)
        .first()
    )


def list_org_members(session: Session, org_id: str) -> list[tuple[OrgMember, User]]:
    """Return organization members and their user records."""
    return (
        session.query(OrgMember, User)
        .join(User, User.id == OrgMember.user_id)
        .filter(OrgMember.org_id == org_id)
        .order_by(OrgMember.joined_at.asc())
        .all()
    )


def create_invite(
    session: Session,
    org_id: str,
    invited_by: str,
    role: str,
    email: str | None = None,
    expires_days: int = 7,
) -> OrgInvitation:
    """Create a shareable invitation token."""
    token = secrets.token_urlsafe(24)
    invite = OrgInvitation(
        org_id=org_id,
        email=email.strip().lower() if email else None,
        role=role,
        token=token,
        invited_by=invited_by,
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    return invite


def list_pending_invites(session: Session, org_id: str) -> list[OrgInvitation]:
    """List pending and non-revoked invites."""
    return (
        session.query(OrgInvitation)
        .filter(
            OrgInvitation.org_id == org_id,
            OrgInvitation.accepted_at.is_(None),
            OrgInvitation.rejected_at.is_(None),
        )
        .order_by(OrgInvitation.created_at.desc())
        .all()
    )


def get_invite_by_token(session: Session, token: str) -> OrgInvitation | None:
    """Lookup invitation by token."""
    return session.query(OrgInvitation).filter(OrgInvitation.token == token).first()


def _ensure_aware(dt: datetime) -> datetime:
    """Return a UTC-aware datetime, converting naive ones from SQLite."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def redeem_invite(session: Session, token: str, user_id: str) -> OrgMember:
    """Accept invitation and add user to org."""
    invite = get_invite_by_token(session, token)
    now = datetime.now(timezone.utc)
    if invite is None:
        raise AuthError("Invitation not found.")
    if invite.accepted_at is not None:
        raise AuthError("Invitation already used.")
    if invite.rejected_at is not None:
        raise AuthError("Invitation was rejected.")
    if _ensure_aware(invite.expires_at) < now:
        raise AuthError("Invitation has expired.")

    existing = get_org_member(session, invite.org_id, user_id)
    if existing is None:
        member = OrgMember(org_id=invite.org_id, user_id=user_id, role=invite.role)
        session.add(member)
    else:
        member = existing

    invite.accepted_at = now
    session.commit()
    session.refresh(member)
    return member


def search_org_members(session: Session, org_id: str, query: str, limit: int = 20) -> list[tuple[OrgMember, User]]:
    """Search organization members by name or email fragment."""
    q = f"%{query.strip().lower()}%"
    return (
        session.query(OrgMember, User)
        .join(User, User.id == OrgMember.user_id)
        .filter(
            OrgMember.org_id == org_id,
            (User.email.ilike(q) | User.full_name.ilike(q)),
        )
        .order_by(User.full_name.asc())
        .limit(limit)
        .all()
    )


def paginate_org_members(
    session: Session,
    org_id: str,
    *,
    query: str = "",
    role: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[tuple[OrgMember, User]], int, dict[str, int]]:
    """Return a paged slice of org members, total count, and role counts.

    The role_counts map is computed against the full org (not the filtered slice)
    so dashboard widgets reflect org-wide aggregates regardless of the current
    filter/search. This stays cheap because it's a single GROUP BY at the DB.
    """
    base = (
        session.query(OrgMember, User)
        .join(User, User.id == OrgMember.user_id)
        .filter(OrgMember.org_id == org_id)
    )

    filtered = base
    if query.strip():
        like = f"%{query.strip().lower()}%"
        filtered = filtered.filter(User.email.ilike(like) | User.full_name.ilike(like))
    if role and role.strip():
        filtered = filtered.filter(OrgMember.role == role.strip().lower())

    total = filtered.count()

    rows = (
        filtered
        .order_by(User.full_name.asc(), User.email.asc())
        .limit(max(1, min(limit, 200)))
        .offset(max(0, offset))
        .all()
    )

    from sqlalchemy import func as _func
    role_rows = (
        session.query(OrgMember.role, _func.count(OrgMember.user_id))
        .filter(OrgMember.org_id == org_id)
        .group_by(OrgMember.role)
        .all()
    )
    role_counts = {r: int(c) for r, c in role_rows}

    return rows, total, role_counts


def ensure_connection(session: Session, user_a: str, user_b: str, org_id: str, context: str = "org_member") -> None:
    """Create a user_connection edge if it does not already exist (canonical: a < b)."""
    if user_a == user_b:
        return
    lo, hi = (user_a, user_b) if user_a < user_b else (user_b, user_a)
    exists = (
        session.query(UserConnection)
        .filter(
            UserConnection.user_a_id == lo,
            UserConnection.user_b_id == hi,
            UserConnection.org_id == org_id,
        )
        .first()
    )
    if exists is None:
        session.add(UserConnection(user_a_id=lo, user_b_id=hi, org_id=org_id, context=context))
        session.commit()


def list_network_for_user(session: Session, user_id: str, query: str = "", limit: int = 50) -> list[User]:
    """Return users connected to this user, optionally filtered by name/email query."""
    connected_ids = session.query(
        (UserConnection.user_b_id).label("other_id")
    ).filter(UserConnection.user_a_id == user_id).union(
        session.query(
            (UserConnection.user_a_id).label("other_id")
        ).filter(UserConnection.user_b_id == user_id)
    ).subquery()

    q_filter = session.query(User).join(connected_ids, User.id == connected_ids.c.other_id)
    if query.strip():
        q = f"%{query.strip().lower()}%"
        q_filter = q_filter.filter(User.email.ilike(q) | User.full_name.ilike(q))
    return q_filter.order_by(User.full_name.asc()).limit(limit).all()


def revoke_invite(session: Session, invite_id: str, revoked_by: str) -> None:
    """Delete a pending invitation."""
    invite = session.get(OrgInvitation, invite_id)
    if invite is None:
        raise AuthError("Invitation not found.")
    membership = get_org_member(session, invite.org_id, revoked_by)
    if membership is None or membership.role not in {"owner", "admin"}:
        raise AuthError("Not authorized to revoke invites.")
    if invite.accepted_at is not None:
        raise AuthError("Cannot revoke an already accepted invite.")
    session.delete(invite)
    session.commit()

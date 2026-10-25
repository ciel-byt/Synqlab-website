"""Unit tests for invitation and org service helpers."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from synqlab.auth.exceptions import AuthError
from synqlab.auth.service import (
    create_invite,
    create_org,
    create_user,
    get_invite_by_token,
    get_org_member,
    list_pending_invites,
    redeem_invite,
    revoke_invite,
)
from synqlab.storage.models import Base


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    # Import auth models so they register with Base
    import synqlab.auth.models  # noqa: F401
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


@pytest.fixture
def user_and_org(session: Session):
    user = create_user(session, "owner@example.com", "pass123", "Org Owner")
    org = create_org(session, "Test Lab", "test-lab", user.id)
    return user, org


def test_create_invite_returns_token(session: Session, user_and_org):
    user, org = user_and_org
    invite = create_invite(session, org.id, invited_by=user.id, role="member", email="new@example.com")
    assert invite.token
    assert len(invite.token) > 10
    assert invite.email == "new@example.com"


def test_get_invite_by_token(session: Session, user_and_org):
    user, org = user_and_org
    invite = create_invite(session, org.id, invited_by=user.id, role="member")
    found = get_invite_by_token(session, invite.token)
    assert found is not None
    assert found.id == invite.id


def test_list_pending_invites(session: Session, user_and_org):
    user, org = user_and_org
    create_invite(session, org.id, invited_by=user.id, role="member")
    create_invite(session, org.id, invited_by=user.id, role="admin")
    pending = list_pending_invites(session, org.id)
    assert len(pending) == 2


def test_redeem_invite_adds_member(session: Session, user_and_org):
    user, org = user_and_org
    new_user = create_user(session, "newbie@example.com", "pass123", "New User")
    invite = create_invite(session, org.id, invited_by=user.id, role="member")

    member = redeem_invite(session, invite.token, new_user.id)
    assert member.user_id == new_user.id
    assert member.role == "member"

    # Invite should now be marked accepted
    refreshed = get_invite_by_token(session, invite.token)
    assert refreshed.accepted_at is not None


def test_redeem_invite_already_accepted_raises(session: Session, user_and_org):
    user, org = user_and_org
    new_user = create_user(session, "once@example.com", "pass123", "Once User")
    invite = create_invite(session, org.id, invited_by=user.id, role="member")
    redeem_invite(session, invite.token, new_user.id)
    with pytest.raises(AuthError, match="already used"):
        redeem_invite(session, invite.token, new_user.id)


def test_revoke_invite_deletes_it(session: Session, user_and_org):
    user, org = user_and_org
    invite = create_invite(session, org.id, invited_by=user.id, role="member")
    revoke_invite(session, invite.id, user.id)
    assert get_invite_by_token(session, invite.token) is None


def test_revoke_invite_non_admin_raises(session: Session, user_and_org):
    user, org = user_and_org
    member = create_user(session, "member@example.com", "pass123", "Member")
    invite = create_invite(session, org.id, invited_by=user.id, role="member")
    redeem_invite(session, invite.token, member.id)

    second_invite = create_invite(session, org.id, invited_by=user.id, role="guest")
    with pytest.raises(AuthError, match="Not authorized"):
        revoke_invite(session, second_invite.id, member.id)

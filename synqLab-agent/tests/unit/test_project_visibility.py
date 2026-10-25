"""Unit tests for project visibility enforcement."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.routers.projects import _can_update_project_status, _filter_visible_projects, _require_project_access
from synqlab.auth.models import OrgMember, Organization, User
from synqlab.storage.models import Base, Project, ProjectMember, Team, TeamMember


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    # Register auth models on Base metadata.
    import synqlab.auth.models  # noqa: F401

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


def _seed_visibility_data(session: Session) -> dict[str, object]:
    owner = User(email="owner@example.com", full_name="Owner", password_hash="x")
    member = User(email="member@example.com", full_name="Member", password_hash="x")
    lead = User(email="lead@example.com", full_name="Lead", password_hash="x")
    guest = User(email="guest@example.com", full_name="Guest", password_hash="x")
    outsider = User(email="outsider@example.com", full_name="Outsider", password_hash="x")
    session.add_all([owner, member, lead, guest, outsider])
    session.flush()

    org = Organization(name="Org", slug="org", created_by=owner.id)
    session.add(org)
    session.flush()

    session.add_all(
        [
            OrgMember(org_id=org.id, user_id=owner.id, role="owner"),
            OrgMember(org_id=org.id, user_id=member.id, role="member"),
            OrgMember(org_id=org.id, user_id=lead.id, role="member"),
            OrgMember(org_id=org.id, user_id=guest.id, role="guest"),
        ]
    )
    team = Team(org_id=org.id, name="Team 1", created_by=owner.id)
    session.add(team)
    session.flush()
    session.add_all(
        [
            TeamMember(team_id=team.id, user_id=owner.id, role="owner"),
            TeamMember(team_id=team.id, user_id=member.id, role="member"),
            TeamMember(team_id=team.id, user_id=lead.id, role="lead"),
            TeamMember(team_id=team.id, user_id=guest.id, role="member"),
        ]
    )

    private_project = Project(
        org_id=org.id,
        team_id=team.id,
        name="Private",
        visibility="private",
        created_by=owner.id,
    )
    team_project = Project(
        org_id=org.id,
        team_id=team.id,
        name="Team",
        visibility="team",
        created_by=owner.id,
    )
    org_project = Project(
        org_id=org.id,
        team_id=team.id,
        name="Org",
        visibility="org",
        created_by=owner.id,
    )
    session.add_all([private_project, team_project, org_project])
    session.flush()

    session.add(ProjectMember(project_id=private_project.id, user_id=member.id, access_level="read", granted_by=owner.id))
    session.add(ProjectMember(project_id=private_project.id, user_id=lead.id, access_level="write", granted_by=owner.id))
    session.commit()

    return {
        "owner": owner,
        "member": member,
        "lead": lead,
        "guest": guest,
        "outsider": outsider,
        "org": org,
        "private_project": private_project,
        "team_project": team_project,
        "org_project": org_project,
    }


def test_filter_visible_projects_member_gets_expected_scope(session: Session) -> None:
    data = _seed_visibility_data(session)
    projects = [data["private_project"], data["team_project"], data["org_project"]]
    membership = session.query(OrgMember).filter(
        OrgMember.org_id == data["org"].id,
        OrgMember.user_id == data["member"].id,
    ).first()
    assert membership is not None
    visible = _filter_visible_projects(session, projects, data["member"].id, membership)
    names = {p.name for p in visible}
    assert names == {"Private", "Team", "Org"}


def test_filter_visible_projects_guest_gets_nothing(session: Session) -> None:
    data = _seed_visibility_data(session)
    projects = [data["private_project"], data["team_project"], data["org_project"]]
    membership = session.query(OrgMember).filter(
        OrgMember.org_id == data["org"].id,
        OrgMember.user_id == data["guest"].id,
    ).first()
    assert membership is not None
    visible = _filter_visible_projects(session, projects, data["guest"].id, membership)
    assert visible == []


def test_require_project_access_blocks_guest_even_for_org_visibility(session: Session) -> None:
    data = _seed_visibility_data(session)
    with pytest.raises(HTTPException, match="do not have access"):
        _require_project_access(session, data["org_project"], data["guest"].id)


def test_require_project_access_blocks_non_member(session: Session) -> None:
    data = _seed_visibility_data(session)
    with pytest.raises(HTTPException, match="Not a member"):
        _require_project_access(session, data["org_project"], data["outsider"].id)


def test_can_update_status_allows_team_lead(session: Session) -> None:
    data = _seed_visibility_data(session)
    assert _can_update_project_status(session, data["team_project"], data["lead"].id) is True


def test_can_update_status_denies_regular_member_without_editor_access(session: Session) -> None:
    data = _seed_visibility_data(session)
    assert _can_update_project_status(session, data["team_project"], data["member"].id) is False

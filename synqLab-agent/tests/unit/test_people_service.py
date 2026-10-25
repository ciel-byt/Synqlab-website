"""Unit tests for people/network service helpers."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from synqlab.auth.service import (
    create_org,
    create_user,
    ensure_connection,
    list_network_for_user,
    search_org_members,
)
from synqlab.storage.models import Base


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    import synqlab.auth.models  # noqa: F401
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


def test_search_org_members_by_name(session: Session) -> None:
    owner = create_user(session, "owner@lab.com", "pass", "Alice Smith")
    org = create_org(session, "Lab", "lab", owner.id)
    bob = create_user(session, "bob@lab.com", "pass", "Bob Jones")
    from synqlab.auth.models import OrgMember
    session.add(OrgMember(org_id=org.id, user_id=bob.id, role="member"))
    session.commit()

    results = search_org_members(session, org.id, "alice")
    names = [u.full_name for _, u in results]
    assert "Alice Smith" in names

    results_bob = search_org_members(session, org.id, "bob")
    assert len(results_bob) == 1


def test_search_org_members_by_email(session: Session) -> None:
    owner = create_user(session, "owner2@lab.com", "pass", "Owner Two")
    org = create_org(session, "Lab2", "lab2", owner.id)
    results = search_org_members(session, org.id, "owner2@lab.com")
    assert len(results) == 1
    assert results[0][1].email == "owner2@lab.com"


def test_ensure_connection_creates_edge(session: Session) -> None:
    import synqlab.auth.models  # noqa: F401
    u1 = create_user(session, "u1@net.com", "pass", "User One")
    u2 = create_user(session, "u2@net.com", "pass", "User Two")
    org = create_org(session, "Netorg", "netorg", u1.id)

    ensure_connection(session, u1.id, u2.id, org.id, context="org_member")

    from synqlab.auth.models import UserConnection
    edge = session.query(UserConnection).first()
    assert edge is not None
    lo, hi = (u1.id, u2.id) if u1.id < u2.id else (u2.id, u1.id)
    assert edge.user_a_id == lo
    assert edge.user_b_id == hi


def test_ensure_connection_idempotent(session: Session) -> None:
    u1 = create_user(session, "idem1@net.com", "pass", "Idem One")
    u2 = create_user(session, "idem2@net.com", "pass", "Idem Two")
    org = create_org(session, "Idemorg", "idemorg", u1.id)

    ensure_connection(session, u1.id, u2.id, org.id)
    ensure_connection(session, u1.id, u2.id, org.id)  # should not raise or duplicate

    from synqlab.auth.models import UserConnection
    count = session.query(UserConnection).count()
    assert count == 1


def test_list_network_for_user_returns_connected(session: Session) -> None:
    alice = create_user(session, "alice@net.com", "pass", "Alice")
    bob = create_user(session, "bob@net.com", "pass", "Bob")
    charlie = create_user(session, "charlie@net.com", "pass", "Charlie")
    org = create_org(session, "NetLab", "netlab", alice.id)

    ensure_connection(session, alice.id, bob.id, org.id)
    ensure_connection(session, alice.id, charlie.id, org.id)

    network = list_network_for_user(session, alice.id)
    ids = {u.id for u in network}
    assert bob.id in ids
    assert charlie.id in ids
    assert alice.id not in ids


def test_list_network_query_filter(session: Session) -> None:
    alice = create_user(session, "a@net.com", "pass", "Alice")
    bob = create_user(session, "b@net.com", "pass", "Bob Filter")
    carol = create_user(session, "c@net.com", "pass", "Carol Other")
    org = create_org(session, "FilterOrg", "filterorg", alice.id)

    ensure_connection(session, alice.id, bob.id, org.id)
    ensure_connection(session, alice.id, carol.id, org.id)

    results = list_network_for_user(session, alice.id, query="filter")
    names = [u.full_name for u in results]
    assert "Bob Filter" in names
    assert "Carol Other" not in names

"""Unit tests for the chat service layer."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from synqlab.auth.service import create_org, create_user
from synqlab.chat.service import (
    add_message,
    add_participant,
    create_session,
    delete_session,
    get_session_obj,
    list_messages,
    list_participants,
    list_sessions,
    rename_session,
)
from synqlab.storage.models import Base


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite:///:memory:", future=True)
    import synqlab.auth.models  # noqa: F401
    import synqlab.chat.models  # noqa: F401
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with factory() as s:
        yield s


@pytest.fixture
def user_and_org(session: Session):
    user = create_user(session, "scientist@lab.com", "pass123", "Scientist One")
    org = create_org(session, "Chat Lab", "chat-lab", user.id)
    return user, org


def test_create_session(session: Session, user_and_org) -> None:
    user, org = user_and_org
    chat = create_session(session, org.id, user.id, title="My first chat")
    assert chat.id
    assert chat.title == "My first chat"
    assert chat.org_id == org.id
    assert chat.user_id == user.id


def test_list_sessions_for_user(session: Session, user_and_org) -> None:
    user, org = user_and_org
    create_session(session, org.id, user.id, title="Chat A")
    create_session(session, org.id, user.id, title="Chat B")
    sessions = list_sessions(session, org.id, user.id)
    assert len(sessions) == 2


def test_add_and_list_messages(session: Session, user_and_org) -> None:
    user, org = user_and_org
    chat = create_session(session, org.id, user.id)
    add_message(session, chat.id, role="user", content="Hello")
    add_message(session, chat.id, role="assistant", content="Hi there!")
    msgs = list_messages(session, chat.id)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"


def test_get_session_obj_wrong_user_returns_none(session: Session, user_and_org) -> None:
    user, org = user_and_org
    other = create_user(session, "other@lab.com", "pass", "Other User")
    chat = create_session(session, org.id, user.id)
    result = get_session_obj(session, chat.id, other.id)
    assert result is None


def test_delete_session(session: Session, user_and_org) -> None:
    user, org = user_and_org
    chat = create_session(session, org.id, user.id)
    deleted = delete_session(session, chat.id, user.id)
    assert deleted is True
    assert get_session_obj(session, chat.id, user.id) is None


def test_rename_session(session: Session, user_and_org) -> None:
    user, org = user_and_org
    chat = create_session(session, org.id, user.id)
    updated = rename_session(session, chat.id, user.id, "GFP11 Analysis")
    assert updated is not None
    assert updated.title == "GFP11 Analysis"


def test_add_message_with_tool_calls(session: Session, user_and_org) -> None:
    user, org = user_and_org
    chat = create_session(session, org.id, user.id, kind="ai")
    tool_calls = [{"id": "tc1", "name": "list_experiments", "arguments": {"limit": 5}}]
    msg = add_message(session, chat.id, role="assistant", content="", tool_calls=tool_calls)
    assert msg.tool_calls is not None
    assert msg.tool_calls[0]["name"] == "list_experiments"


def test_create_dm_adds_participants(session: Session, user_and_org) -> None:
    user, org = user_and_org
    other = create_user(session, "dm-user@lab.com", "pass", "DM User")
    chat = create_session(session, org.id, user.id, kind="dm", participant_ids=[other.id])
    participants = list_participants(session, chat.id)
    pids = {p.user_id for p in participants}
    assert user.id in pids
    assert other.id in pids


def test_add_participant_idempotent(session: Session, user_and_org) -> None:
    user, org = user_and_org
    other = create_user(session, "extra@lab.com", "pass", "Extra User")
    chat = create_session(session, org.id, user.id, kind="group", participant_ids=[other.id])
    add_participant(session, chat.id, other.id)  # duplicate — should not raise
    participants = list_participants(session, chat.id)
    assert len(participants) == 2  # creator + other, not 3


def test_people_session_accessible_by_participant(session: Session, user_and_org) -> None:
    user, org = user_and_org
    other = create_user(session, "peer@lab.com", "pass", "Peer")
    chat = create_session(session, org.id, user.id, kind="dm", participant_ids=[other.id])
    # other user should be able to access the session
    found = get_session_obj(session, chat.id, other.id)
    assert found is not None
    assert found.id == chat.id

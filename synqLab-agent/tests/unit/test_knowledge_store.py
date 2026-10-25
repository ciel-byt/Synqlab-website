"""Unit tests for synqlab.knowledge_store.store.KnowledgeStore."""

from __future__ import annotations

import pytest

from synqlab.knowledge_store.store import KnowledgeStore
from synqlab.knowledge_store.schemas import KnowledgeArtifact


@pytest.fixture
def store() -> KnowledgeStore:
    return KnowledgeStore()  # in-memory, no persistence


def test_register_returns_id(store: KnowledgeStore) -> None:
    aid = store.register(
        kind="dataset",
        name="Test Dataset",
        scope="project:test",
        task_type="gfp11_brightness",
        payload={"n_total": 5},
    )
    assert aid


def test_register_stores_artifact(store: KnowledgeStore) -> None:
    aid = store.register(
        kind="target",
        name="GFP Target",
        scope="global",
        task_type="gfp11_brightness",
        payload={"molecule": "GFP11"},
    )
    artifact = store.get(aid)
    assert artifact is not None
    assert artifact.name == "GFP Target"
    assert artifact.kind == "target"


def test_retrieve_by_task_type(store: KnowledgeStore) -> None:
    store.register(kind="dataset", name="D1", scope="global", task_type="gfp11_brightness", payload={})
    store.register(kind="dataset", name="D2", scope="global", task_type="other_task", payload={})
    results = store.retrieve(task_type="gfp11_brightness")
    assert len(results) == 1
    assert results[0].name == "D1"


def test_retrieve_scope_filtering(store: KnowledgeStore) -> None:
    store.register(kind="dataset", name="global-ds", scope="global", task_type="t", payload={})
    store.register(kind="dataset", name="team-ds", scope="team:synqlab", task_type="t", payload={})
    store.register(kind="dataset", name="project-ds", scope="project:myproj", task_type="t", payload={})

    # Only global visible when no project/team specified
    results = store.retrieve(task_type="t")
    names = {a.name for a in results}
    assert "global-ds" in names
    assert "team-ds" not in names
    assert "project-ds" not in names

    # Team + global visible
    results = store.retrieve(task_type="t", team_id="synqlab")
    names = {a.name for a in results}
    assert "global-ds" in names
    assert "team-ds" in names

    # Project + team + global all visible
    results = store.retrieve(task_type="t", project_id="myproj", team_id="synqlab")
    names = {a.name for a in results}
    assert len(names) == 3


def test_retrieve_by_kind(store: KnowledgeStore) -> None:
    store.register(kind="dataset", name="DS", scope="global", task_type="t", payload={})
    store.register(kind="prompt", name="PR", scope="global", task_type="t", payload={})
    results = store.retrieve(kinds=["prompt"])
    assert all(a.kind == "prompt" for a in results)


def test_promote_changes_scope(store: KnowledgeStore) -> None:
    aid = store.register(kind="finding", name="F1", scope="project:p1", task_type="t", payload={})
    store.promote(aid, "team:synqlab")
    artifact = store.get(aid)
    assert artifact is not None
    assert artifact.scope == "team:synqlab"
    assert artifact.version == 2


def test_list_all(store: KnowledgeStore) -> None:
    store.register(kind="dataset", name="A", scope="global", task_type="t", payload={})
    store.register(kind="target", name="B", scope="global", task_type="t", payload={})
    all_artifacts = store.list_all()
    assert len(all_artifacts) == 2


def test_persistence(tmp_path) -> None:
    db_path = str(tmp_path / "ks.json")
    s1 = KnowledgeStore(db_path=db_path)
    aid = s1.register(kind="dataset", name="Persisted", scope="global", task_type="t", payload={"x": 1})

    s2 = KnowledgeStore(db_path=db_path)
    artifact = s2.get(aid)
    assert artifact is not None
    assert artifact.name == "Persisted"
    assert artifact.payload == {"x": 1}

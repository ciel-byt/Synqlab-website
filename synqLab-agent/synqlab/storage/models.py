"""ORM models for SynqLab storage layer (SQLAlchemy declarative)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    LargeBinary,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String, primary_key=True, default=_uuid)
    run_id = Column(String, ForeignKey("runs.id"), nullable=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    config_jsonb = Column(JSON, nullable=True)
    status = Column(String, default="running", nullable=False)

    runs = relationship("ToolRun", back_populates="experiment", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="experiment", cascade="all, delete-orphan")


class ToolRun(Base):
    __tablename__ = "tool_runs"

    id = Column(String, primary_key=True, default=_uuid)
    experiment_id = Column(String, ForeignKey("experiments.id"), nullable=False)
    run_id = Column(String, ForeignKey("runs.id"), nullable=True)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    round_id = Column(String, nullable=False)
    tool_id = Column(String, nullable=False)
    tool_version = Column(String, nullable=True)
    status = Column(String, default="running", nullable=False)
    started_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    latency_ms = Column(Float, nullable=True)
    gpu_seconds = Column(Numeric, nullable=True)
    token_count = Column(Integer, nullable=True)
    input_hash = Column(Text, nullable=True)
    request_jsonb = Column(JSON, nullable=True)
    response_jsonb = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)

    experiment = relationship("Experiment", back_populates="runs")
    artifacts = relationship("Artifact", back_populates="tool_run", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(String, primary_key=True, default=_uuid)
    experiment_id = Column(String, ForeignKey("experiments.id"), nullable=False)
    tool_run_id = Column(String, ForeignKey("tool_runs.id"), nullable=True)
    artifact_type = Column(String, nullable=False)
    uri = Column(Text, nullable=True)
    path = Column(Text, nullable=True)
    format = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    checksum = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    meta_jsonb = Column(JSON, nullable=True)

    experiment = relationship("Experiment", back_populates="artifacts")
    tool_run = relationship("ToolRun", back_populates="artifacts")
    tags = relationship("Tag", back_populates="artifact", cascade="all, delete-orphan")


class Tag(Base):
    """Legacy artifact tags table (renamed from tags -> artifact_tags)."""

    __tablename__ = "artifact_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    artifact_id = Column(String, ForeignKey("artifacts.id"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(String, nullable=True)

    artifact = relationship("Artifact", back_populates="tags")


class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(String, primary_key=True, default=_uuid)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(Text, nullable=False, default="member")
    joined_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class UserGroup(Base):
    __tablename__ = "user_groups"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    name = Column(Text, nullable=False)
    kind = Column(Text, nullable=False)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class UserGroupMember(Base):
    __tablename__ = "user_group_members"

    id = Column(String, primary_key=True, default=_uuid)
    group_id = Column(String, ForeignKey("user_groups.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="active")
    visibility = Column(Text, nullable=False, default="private")
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    group_id = Column(String, ForeignKey("user_groups.id"), nullable=True)
    access_level = Column(Text, nullable=False, default="read")
    granted_by = Column(String, ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    current_version = Column(Integer, nullable=False, default=1)
    forked_from_id = Column(String, ForeignKey("pipelines.id"), nullable=True)
    is_public = Column(Boolean, nullable=False, default=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class PipelineVersion(Base):
    __tablename__ = "pipeline_versions"

    id = Column(String, primary_key=True, default=_uuid)
    pipeline_id = Column(String, ForeignKey("pipelines.id"), nullable=False)
    version = Column(Integer, nullable=False)
    config_jsonb = Column(JSON, nullable=False)
    changelog = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True, default=_uuid)
    pipeline_id = Column(String, ForeignKey("pipelines.id"), nullable=False)
    pipeline_version = Column(Integer, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    name = Column(Text, nullable=True)
    round_number = Column(Integer, nullable=False, default=1)
    status = Column(Text, nullable=False, default="pending")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    config_jsonb = Column(JSON, nullable=True)
    budget_jsonb = Column(JSON, nullable=True)
    summary_jsonb = Column(JSON, nullable=True)


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True, default=_uuid)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False)
    sequence = Column(Text, nullable=False)
    status = Column(Text, nullable=False, default="generated")
    rejection_stage = Column(Text, nullable=True)
    scores_jsonb = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    domain = Column(Text, nullable=True)
    visibility = Column(Text, nullable=False, default="private")
    schema_version = Column(Integer, nullable=False, default=1)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class DatasetEntry(Base):
    __tablename__ = "dataset_entries"

    id = Column(String, primary_key=True, default=_uuid)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    sequence = Column(Text, nullable=False)
    label = Column(Integer, nullable=False)
    score = Column(Numeric, nullable=True)
    source = Column(Text, nullable=True)
    metadata_jsonb = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class DatasetAccessLog(Base):
    __tablename__ = "dataset_access_log"

    id = Column(String, primary_key=True, default=_uuid)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=True)
    access_type = Column(Text, nullable=False)
    ip_address = Column(Text, nullable=True)
    accessed_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class SitePaper(Base):
    """Public research list shown on the marketing site (separate from project-scoped `publications`)."""

    __tablename__ = "site_papers"

    slug = Column(String, primary_key=True)
    title = Column(Text, nullable=False)
    authors = Column(Text, nullable=True)
    venue = Column(Text, nullable=True)
    year = Column(Integer, nullable=False)
    kind = Column(String, nullable=False)  # Paper, Preprint, Thesis, Chapter, Book, Patent
    topic = Column(String, nullable=False)
    url = Column(Text, nullable=True)
    doi = Column(Text, nullable=True)
    abstract = Column(Text, nullable=True)
    body = Column(JSON, nullable=True)  # optional longer write-up: list of paragraphs
    limits = Column(Text, nullable=True)
    sort = Column(Integer, nullable=False, default=0)


class SiteRequest(Base):
    """A "describe your problem" / request-a-family submission from the marketing site."""

    __tablename__ = "site_requests"

    id = Column(String, primary_key=True, default=_uuid)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    email = Column(Text, nullable=False)
    name = Column(Text, nullable=True)
    org = Column(Text, nullable=True)
    problem = Column(Text, nullable=False)
    data_description = Column(Text, nullable=True)
    family = Column(String, nullable=True)  # Pfam id picked in the Aria demo, if any
    source = Column(String, nullable=False, default="aria-demo")


class AriaModel(Base):
    """A user-designed Aria model (a lineage of versions). Demo: results replay recorded runs."""

    __tablename__ = "aria_models"

    id = Column(String, primary_key=True, default=_uuid)
    owner_id = Column(String, nullable=False, index=True)
    name = Column(Text, nullable=False)
    data_source = Column(String, nullable=False)  # "our-data" | "upload"
    family = Column(String, nullable=True)  # Pfam id when data_source == "our-data"
    problem = Column(Text, nullable=True)
    upload = Column(JSON, nullable=True)  # {filename, rows, columns, seq_col, label_col, path}
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class AriaModelVersion(Base):
    __tablename__ = "aria_model_versions"

    id = Column(String, primary_key=True, default=_uuid)
    model_id = Column(String, ForeignKey("aria_models.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    rounds = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="ready")  # ready | queued
    metrics = Column(JSON, nullable=True)  # {metric_key: value}
    usage = Column(String, nullable=True)  # None | "standalone" | "agent"
    simulated = Column(Boolean, nullable=False, default=False)  # demo: metrics beyond the recorded rounds are illustrative
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class AriaChat(Base):
    """A chat with one Aria model version (demo: replies replay recorded generations)."""

    __tablename__ = "aria_chats"

    id = Column(String, primary_key=True, default=_uuid)
    owner_id = Column(String, nullable=False, index=True)
    version_id = Column(String, ForeignKey("aria_model_versions.id"), nullable=False)
    title = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class AriaChatMessage(Base):
    __tablename__ = "aria_chat_messages"

    id = Column(String, primary_key=True, default=_uuid)
    chat_id = Column(String, ForeignKey("aria_chats.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # user | assistant
    text = Column(Text, nullable=False, default="")
    payload = Column(JSON, nullable=True)  # assistant: result cards
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class SiteNews(Base):
    """A post shown in the News tab of the marketing site. Static: replaced only by scripts/refresh_news.py."""

    __tablename__ = "site_news"

    id = Column(String, primary_key=True)  # X post id
    position = Column(Integer, nullable=False, default=0)  # 0 = newest
    text = Column(Text, nullable=False)
    created_at = Column(String, nullable=True)  # ISO time of the post
    url = Column(Text, nullable=False)
    image = Column(LargeBinary, nullable=True)  # first photo (or video preview) of the post
    image_type = Column(String, nullable=True)
    fetched_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Publication(Base):
    __tablename__ = "publications"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(Text, nullable=False)
    abstract = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="draft")
    doi = Column(Text, nullable=True)
    journal = Column(Text, nullable=True)
    preprint_url = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class PubAuthor(Base):
    __tablename__ = "pub_authors"

    id = Column(String, primary_key=True, default=_uuid)
    publication_id = Column(String, ForeignKey("publications.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    external_name = Column(Text, nullable=True)
    external_email = Column(Text, nullable=True)
    orcid = Column(Text, nullable=True)
    affiliation = Column(Text, nullable=True)
    author_order = Column(Integer, nullable=False, default=1)
    is_corresponding = Column(Boolean, nullable=False, default=False)


class PubRun(Base):
    __tablename__ = "pub_runs"

    id = Column(String, primary_key=True, default=_uuid)
    publication_id = Column(String, ForeignKey("publications.id"), nullable=False)
    run_id = Column(String, ForeignKey("runs.id"), nullable=False)


class PubCandidate(Base):
    __tablename__ = "pub_candidates"

    id = Column(String, primary_key=True, default=_uuid)
    publication_id = Column(String, ForeignKey("publications.id"), nullable=False)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)


class PubDataset(Base):
    __tablename__ = "pub_datasets"

    id = Column(String, primary_key=True, default=_uuid)
    publication_id = Column(String, ForeignKey("publications.id"), nullable=False)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)


class PubReview(Base):
    __tablename__ = "pub_reviews"

    id = Column(String, primary_key=True, default=_uuid)
    publication_id = Column(String, ForeignKey("publications.id"), nullable=False)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(Text, nullable=False, default="pending")
    comments = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class GlobalTag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    name = Column(Text, nullable=False)
    color = Column(Text, nullable=True)


class ResourceTag(Base):
    __tablename__ = "resource_tags"

    id = Column(String, primary_key=True, default=_uuid)
    tag_id = Column(String, ForeignKey("tags.id"), nullable=False)
    resource_type = Column(Text, nullable=False)
    resource_id = Column(String, nullable=False)
    tagged_by = Column(String, ForeignKey("users.id"), nullable=False)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, default=_uuid)
    resource_type = Column(Text, nullable=False)
    resource_id = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    parent_id = Column(String, ForeignKey("comments.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class SharingToken(Base):
    __tablename__ = "sharing_tokens"

    id = Column(String, primary_key=True, default=_uuid)
    resource_type = Column(Text, nullable=False)
    resource_id = Column(String, nullable=False)
    token = Column(Text, unique=True, nullable=False)
    access_level = Column(Text, nullable=False, default="read")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

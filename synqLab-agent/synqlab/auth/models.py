"""ORM models for identity and organization auth tables."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.types import JSON

from synqlab.storage.models import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(Text, unique=True, nullable=False)
    full_name = Column(Text, nullable=False)
    avatar_url = Column(Text, nullable=True)
    professional_title = Column(Text, nullable=True)
    short_bio = Column(Text, nullable=True)
    linkedin_url = Column(Text, nullable=True)
    scholar_url = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)
    password_hash = Column(Text, nullable=True)
    auth_provider = Column(Text, nullable=False, default="email")
    auth_sub = Column(Text, unique=True, nullable=True)
    is_admin = Column(Boolean, nullable=False, default=False, server_default="false")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(Text, nullable=False)
    slug = Column(Text, unique=True, nullable=False)
    avatar_url = Column(Text, nullable=True)
    plan_tier = Column(Text, nullable=False, default="free")
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class OrgMember(Base):
    __tablename__ = "org_members"

    org_id = Column(String, ForeignKey("organizations.id"), primary_key=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True, nullable=False)
    role = Column(Text, nullable=False, default="member")
    joined_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class OrgInvitation(Base):
    __tablename__ = "org_invitations"

    id = Column(String, primary_key=True, default=_uuid)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    email = Column(Text, nullable=True)
    role = Column(Text, nullable=False, default="member")
    token = Column(Text, unique=True, nullable=False)
    invited_by = Column(String, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class UserConnection(Base):
    """Implicit network edge: two users who share an org, are coauthors, or were explicitly connected."""

    __tablename__ = "user_connections"

    id = Column(String, primary_key=True, default=_uuid)
    user_a_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_b_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Comma-separated contexts: org_member, collaborator, coauthor
    context = Column(Text, nullable=False, default="org_member")
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    org_id = Column(String, ForeignKey("organizations.id"), nullable=False)
    key_hash = Column(Text, unique=True, nullable=False)
    name = Column(Text, nullable=False)
    scopes = Column(
        MutableList.as_mutable(JSON().with_variant(ARRAY(Text), "postgresql")),
        nullable=False,
        default=list,
    )
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now, nullable=False)

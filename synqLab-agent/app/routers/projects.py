"""Projects router — CRUD for projects, members, and pipelines within an org."""

from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DbSession

from synqlab.auth.dependencies import get_current_user
from synqlab.auth.models import OrgMember, User
from synqlab.auth.service import get_org_member
from synqlab.storage.db import get_session
from synqlab.storage.models import Pipeline, Project, ProjectMember, Team, TeamMember

router = APIRouter(prefix="/api/projects", tags=["projects"])

_STANDARD_ORG_ROLES = {"owner", "admin", "member"}


# ── Schemas ─────────────────────────────────────────────────────────────────


class ProjectCreateRequest(BaseModel):
    org_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    visibility: str = "private"
    team_id: str | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: str | None = None
    visibility: str | None = None


class TeamResponse(BaseModel):
    id: str
    org_id: str
    name: str
    description: str | None
    avatar_url: str | None
    created_at: str
    member_count: int


class ProjectResponse(BaseModel):
    id: str
    org_id: str
    team_id: str | None
    team_name: str | None
    name: str
    description: str | None
    status: str
    visibility: str
    created_by: str
    created_at: str
    updated_at: str


class PipelineResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None
    current_version: int
    is_public: bool
    created_by: str
    created_at: str


class PipelineCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class AddMemberRequest(BaseModel):
    user_id: str
    access_level: str = "read"


class ProjectMemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    avatar_url: str | None
    access_level: str
    granted_at: str


# ── Helpers ──────────────────────────────────────────────────────────────────


def _get_team_name(db, team_id: str | None) -> str | None:
    if not team_id:
        return None
    team = db.get(Team, team_id)
    return team.name if team else None


def _serialize_project(p: Project, team_name: str | None = None) -> ProjectResponse:
    return ProjectResponse(
        id=p.id,
        org_id=p.org_id,
        team_id=p.team_id,
        team_name=team_name,
        name=p.name,
        description=p.description,
        status=p.status,
        visibility=p.visibility,
        created_by=p.created_by,
        created_at=p.created_at.isoformat() if p.created_at else "",
        updated_at=p.updated_at.isoformat() if p.updated_at else "",
    )


def _require_org_member(db: DbSession, org_id: str, user_id: str) -> None:
    if get_org_member(db, org_id, user_id) is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization.")


def _get_project_or_404(db: DbSession, project_id: str) -> Project:
    p = db.get(Project, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return p


def _require_project_access(db: DbSession, project: Project, user_id: str) -> None:
    """Ensure the user can read the project by visibility policy."""
    membership = get_org_member(db, project.org_id, user_id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization.")
    if not _can_view_project(db, project, user_id, membership):
        raise HTTPException(status_code=403, detail="You do not have access to this project.")


def _can_view_project(
    db: DbSession,
    project: Project,
    user_id: str,
    membership: OrgMember | None = None,
) -> bool:
    if membership is None:
        membership = get_org_member(db, project.org_id, user_id)
    if membership is None:
        return False
    if membership.role in {"owner", "admin"}:
        return True
    if membership.role == "guest":
        return False
    visibility = (project.visibility or "private").lower()
    if visibility == "org":
        return membership.role in _STANDARD_ORG_ROLES
    if visibility == "team":
        if not project.team_id:
            return False
        return (
            db.query(TeamMember)
            .filter(TeamMember.team_id == project.team_id, TeamMember.user_id == user_id)
            .first()
            is not None
        )
    # private (default): explicit project access only for non-guest org users.
    if project.created_by == user_id:
        return True
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user_id)
        .first()
        is not None
    )


def _filter_visible_projects(
    db: DbSession,
    projects: list[Project],
    user_id: str,
    membership: OrgMember,
) -> list[Project]:
    if membership.role in {"owner", "admin"}:
        return projects
    if membership.role == "guest":
        return []
    project_ids = [p.id for p in projects]
    if not project_ids:
        return []
    member_project_ids = {
        row[0]
        for row in (
            db.query(ProjectMember.project_id)
            .filter(
                ProjectMember.user_id == user_id,
                ProjectMember.project_id.in_(project_ids),
            )
            .all()
        )
    }
    team_ids = [p.team_id for p in projects if p.team_id]
    member_team_ids = {
        row[0]
        for row in (
            db.query(TeamMember.team_id)
            .filter(
                TeamMember.user_id == user_id,
                TeamMember.team_id.in_(team_ids),
            )
            .all()
        )
    }
    visible: list[Project] = []
    for p in projects:
        visibility = (p.visibility or "private").lower()
        if visibility == "org":
            visible.append(p)
            continue
        if visibility == "team":
            if p.team_id and p.team_id in member_team_ids:
                visible.append(p)
            continue
        # private (default)
        if p.created_by == user_id or p.id in member_project_ids:
            visible.append(p)
    return visible


def _can_update_project_status(
    db: DbSession,
    project: Project,
    user_id: str,
    membership: OrgMember | None = None,
) -> bool:
    if membership is None:
        membership = get_org_member(db, project.org_id, user_id)
    if membership is None:
        return False
    if membership.role in {"owner", "admin"}:
        return True
    if membership.role == "guest":
        return False
    if project.created_by == user_id:
        return True
    member_access = (
        db.query(ProjectMember.access_level)
        .filter(ProjectMember.project_id == project.id, ProjectMember.user_id == user_id)
        .first()
    )
    if member_access and (member_access[0] or "").lower() in {"admin", "write"}:
        return True
    if project.team_id:
        team_membership = (
            db.query(TeamMember.role)
            .filter(TeamMember.team_id == project.team_id, TeamMember.user_id == user_id)
            .first()
        )
        if team_membership and (team_membership[0] or "").lower() in {"owner", "lead"}:
            return True
    return False


def _require_project_status_update_access(db: DbSession, project: Project, user_id: str) -> None:
    membership = get_org_member(db, project.org_id, user_id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of this organization.")
    if not _can_update_project_status(db, project, user_id, membership):
        raise HTTPException(status_code=403, detail="Only org admins, project editors, or team leads can change status.")


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("/org/{org_id}/teams", response_model=list[TeamResponse])
def list_org_teams(
    org_id: str,
    current_user: User = Depends(get_current_user),
) -> list[TeamResponse]:
    db = get_session()
    try:
        _require_org_member(db, org_id, current_user.id)
        teams = (
            db.query(Team)
            .filter(Team.org_id == org_id)
            .order_by(Team.created_at.asc())
            .all()
        )
        result = []
        for t in teams:
            count = db.query(TeamMember).filter(TeamMember.team_id == t.id).count()
            result.append(TeamResponse(
                id=t.id,
                org_id=t.org_id,
                name=t.name,
                description=t.description,
                avatar_url=t.avatar_url,
                created_at=t.created_at.isoformat() if t.created_at else "",
                member_count=count,
            ))
        return result
    finally:
        db.close()


class TeamCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


@router.post("/org/{org_id}/teams", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    org_id: str,
    body: TeamCreateRequest,
    current_user: User = Depends(get_current_user),
) -> TeamResponse:
    db = get_session()
    try:
        _require_org_member(db, org_id, current_user.id)
        team = Team(org_id=org_id, name=body.name.strip(), description=body.description, created_by=current_user.id)
        db.add(team)
        db.flush()
        db.add(TeamMember(team_id=team.id, user_id=current_user.id, role="owner"))
        db.commit()
        db.refresh(team)
        return TeamResponse(
            id=team.id,
            org_id=team.org_id,
            name=team.name,
            description=team.description,
            avatar_url=team.avatar_url,
            created_at=team.created_at.isoformat() if team.created_at else "",
            member_count=1,
        )
    finally:
        db.close()


class TeamUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    avatar_url: str | None = None


@router.patch("/teams/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: str,
    body: TeamUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> TeamResponse:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        _require_org_member(db, team.org_id, current_user.id)
        if body.name is not None:
            team.name = body.name.strip()
        if body.description is not None:
            team.description = body.description or None
        if body.avatar_url is not None:
            team.avatar_url = body.avatar_url.strip() or None
        db.commit()
        db.refresh(team)
        count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
        return TeamResponse(
            id=team.id,
            org_id=team.org_id,
            name=team.name,
            description=team.description,
            avatar_url=team.avatar_url,
            created_at=team.created_at.isoformat() if team.created_at else "",
            member_count=count,
        )
    finally:
        db.close()


@router.post("/teams/{team_id}/avatar-upload", response_model=TeamResponse)
async def upload_team_avatar(
    team_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> TeamResponse:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        _require_org_member(db, team.org_id, current_user.id)
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
        target_dir = _media_root() / "team_avatars" / team_id
        target_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{suffix}"
        target = target_dir / filename
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)
        team.avatar_url = f"/api/projects/teams/{team_id}/avatar/{filename}"
        db.commit()
        db.refresh(team)
        count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
        return TeamResponse(
            id=team.id,
            org_id=team.org_id,
            name=team.name,
            description=team.description,
            avatar_url=team.avatar_url,
            created_at=team.created_at.isoformat() if team.created_at else "",
            member_count=count,
        )
    finally:
        db.close()


@router.get("/teams/{team_id}/avatar/{filename}")
def serve_team_avatar(
    team_id: str,
    filename: str,
) -> FileResponse:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        path = (_media_root() / "team_avatars" / team_id / filename).resolve()
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=404, detail="Avatar not found.")
        return FileResponse(str(path))
    finally:
        db.close()


@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        _require_org_member(db, team.org_id, current_user.id)
        db.query(TeamMember).filter(TeamMember.team_id == team_id).delete()
        db.query(Project).filter(Project.team_id == team_id).update({Project.team_id: None})
        db.delete(team)
        db.commit()
    finally:
        db.close()


class TeamMemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    joined_at: str
    avatar_url: str | None


def _media_root() -> Path:
    base = os.environ.get("SYNQLAB_SYNC_DIR") or os.environ.get("SYNQLAB_STORAGE_PATH")
    if base:
        return Path(base).expanduser()
    return Path(__file__).resolve().parents[2] / "artifacts" / "media"


class TeamMemberAddRequest(BaseModel):
    user_id: str
    role: str = "member"


@router.get("/teams/{team_id}/members", response_model=list[TeamMemberResponse])
def list_team_members(
    team_id: str,
    current_user: User = Depends(get_current_user),
) -> list[TeamMemberResponse]:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        _require_org_member(db, team.org_id, current_user.id)
        memberships = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == team_id)
            .order_by(TeamMember.joined_at.asc())
            .all()
        )
        result: list[TeamMemberResponse] = []
        for tm in memberships:
            user = db.get(User, tm.user_id)
            if user is None:
                continue
            result.append(TeamMemberResponse(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name or "",
                role=tm.role,
                joined_at=tm.joined_at.isoformat() if tm.joined_at else "",
                avatar_url=user.avatar_url,
            ))
        return result
    finally:
        db.close()


@router.post("/teams/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: str,
    body: TeamMemberAddRequest,
    current_user: User = Depends(get_current_user),
) -> TeamMemberResponse:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        _require_org_member(db, team.org_id, current_user.id)
        # Ensure target user belongs to the same org
        target = db.get(User, body.user_id)
        if target is None:
            raise HTTPException(status_code=404, detail="User not found.")
        org_membership = db.query(OrgMember).filter(
            OrgMember.org_id == team.org_id,
            OrgMember.user_id == body.user_id,
        ).first()
        if org_membership is None:
            raise HTTPException(status_code=400, detail="User must be an organization member first.")
        existing = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == body.user_id,
        ).first()
        if existing is not None:
            raise HTTPException(status_code=409, detail="Already a team member.")
        tm = TeamMember(team_id=team_id, user_id=body.user_id, role=body.role)
        db.add(tm)
        db.commit()
        db.refresh(tm)
        return TeamMemberResponse(
            user_id=target.id,
            email=target.email,
            full_name=target.full_name or "",
            role=tm.role,
            joined_at=tm.joined_at.isoformat() if tm.joined_at else "",
            avatar_url=target.avatar_url,
        )
    finally:
        db.close()


@router.delete("/teams/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    db = get_session()
    try:
        team = db.get(Team, team_id)
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found.")
        _require_org_member(db, team.org_id, current_user.id)
        tm = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        ).first()
        if tm is None:
            raise HTTPException(status_code=404, detail="Team membership not found.")
        db.delete(tm)
        db.commit()
    finally:
        db.close()


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    org_id: str,
    team_id: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    db = get_session()
    try:
        membership = get_org_member(db, org_id, current_user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        q = db.query(Project).filter(Project.org_id == org_id)
        if team_id == "__none__":
            q = q.filter(Project.team_id.is_(None))
        elif team_id:
            q = q.filter(Project.team_id == team_id)
        projects = q.order_by(Project.updated_at.desc()).all()
        projects = _filter_visible_projects(db, projects, current_user.id, membership)
        # Build team name cache
        team_names: dict[str, str] = {}
        for p in projects:
            if p.team_id and p.team_id not in team_names:
                team_names[p.team_id] = _get_team_name(db, p.team_id) or ""
        return [_serialize_project(p, team_names.get(p.team_id or "")) for p in projects]
    finally:
        db.close()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    db = get_session()
    try:
        _require_org_member(db, body.org_id, current_user.id)
        project = Project(
            org_id=body.org_id,
            team_id=body.team_id,
            name=body.name.strip(),
            description=body.description,
            visibility=body.visibility,
            created_by=current_user.id,
        )
        db.add(project)
        db.flush()
        db.add(ProjectMember(project_id=project.id, user_id=current_user.id, access_level="admin", granted_by=current_user.id))
        db.commit()
        db.refresh(project)
        return _serialize_project(project, _get_team_name(db, project.team_id))
    finally:
        db.close()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        return _serialize_project(p, _get_team_name(db, p.team_id))
    finally:
        db.close()


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str,
    body: ProjectUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        if body.status is not None:
            _require_project_status_update_access(db, p, current_user.id)
        if body.name is not None:
            p.name = body.name.strip()
        if body.description is not None:
            p.description = body.description
        if body.status is not None:
            p.status = body.status
        if body.visibility is not None:
            p.visibility = body.visibility
        p.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(p)
        return _serialize_project(p, _get_team_name(db, p.team_id))
    finally:
        db.close()


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        if p.created_by != current_user.id:
            _require_org_member(db, p.org_id, current_user.id)
            member = get_org_member(db, p.org_id, current_user.id)
            if member and member.role not in {"owner", "admin"}:
                raise HTTPException(status_code=403, detail="Only the project creator or org admin can delete.")
        db.delete(p)
        db.commit()
    finally:
        db.close()


@router.get("/{project_id}/pipelines", response_model=list[PipelineResponse])
def list_pipelines(
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> list[PipelineResponse]:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        pipelines = (
            db.query(Pipeline)
            .filter(Pipeline.project_id == project_id)
            .order_by(Pipeline.created_at.desc())
            .all()
        )
        return [
            PipelineResponse(
                id=pl.id,
                project_id=pl.project_id,
                name=pl.name,
                description=pl.description,
                current_version=pl.current_version,
                is_public=pl.is_public,
                created_by=pl.created_by,
                created_at=pl.created_at.isoformat() if pl.created_at else "",
            )
            for pl in pipelines
        ]
    finally:
        db.close()


@router.post("/{project_id}/pipelines", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    project_id: str,
    body: PipelineCreateRequest,
    current_user: User = Depends(get_current_user),
) -> PipelineResponse:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        pipeline = Pipeline(
            project_id=project_id,
            name=body.name.strip(),
            description=body.description,
            created_by=current_user.id,
        )
        db.add(pipeline)
        db.commit()
        db.refresh(pipeline)
        return PipelineResponse(
            id=pipeline.id,
            project_id=pipeline.project_id,
            name=pipeline.name,
            description=pipeline.description,
            current_version=pipeline.current_version,
            is_public=pipeline.is_public,
            created_by=pipeline.created_by,
            created_at=pipeline.created_at.isoformat() if pipeline.created_at else "",
        )
    finally:
        db.close()


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_project_member(
    project_id: str,
    body: AddMemberRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        target_membership = get_org_member(db, p.org_id, body.user_id)
        if target_membership is None:
            raise HTTPException(status_code=400, detail="User must be an organization member first.")
        existing = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == body.user_id)
            .first()
        )
        if existing:
            existing.access_level = body.access_level
        else:
            db.add(ProjectMember(project_id=project_id, user_id=body.user_id, access_level=body.access_level, granted_by=current_user.id))
        db.commit()
        return {"project_id": project_id, "user_id": body.user_id, "access_level": body.access_level}
    finally:
        db.close()


@router.get("/{project_id}/members", response_model=list[ProjectMemberResponse])
def list_project_members(
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> list[ProjectMemberResponse]:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        rows = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id.isnot(None))
            .order_by(ProjectMember.granted_at.asc())
            .all()
        )
        result: list[ProjectMemberResponse] = []
        for row in rows:
            if not row.user_id:
                continue
            user = db.get(User, row.user_id)
            if user is None:
                continue
            result.append(
                ProjectMemberResponse(
                    user_id=user.id,
                    email=user.email,
                    full_name=user.full_name or "",
                    avatar_url=user.avatar_url,
                    access_level=row.access_level,
                    granted_at=row.granted_at.isoformat() if row.granted_at else "",
                )
            )
        return result
    finally:
        db.close()


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member(
    project_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
) -> None:
    db = get_session()
    try:
        p = _get_project_or_404(db, project_id)
        _require_project_access(db, p, current_user.id)
        membership = get_org_member(db, p.org_id, current_user.id)
        if membership is None:
            raise HTTPException(status_code=403, detail="Not a member of this organization.")
        # Only org admins/owners, project creator, or project admins can remove members
        is_org_admin = membership.role in {"owner", "admin"}
        is_creator = p.created_by == current_user.id
        caller_project_access = (
            db.query(ProjectMember.access_level)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
            .first()
        )
        is_project_admin = caller_project_access and (caller_project_access[0] or "").lower() == "admin"
        if not (is_org_admin or is_creator or is_project_admin):
            raise HTTPException(status_code=403, detail="Only project admins or org admins can remove members.")
        pm = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
            .first()
        )
        if pm is None:
            raise HTTPException(status_code=404, detail="Project membership not found.")
        db.delete(pm)
        db.commit()
    finally:
        db.close()

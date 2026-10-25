# Component Spec — Database Schema (Multi-Tenant V2)

**Status:** Design complete — implementation pending
**Supersedes:** The flat `experiments` / `tool_runs` / `artifacts` schema in `storage/models.py`

---

## Responsibility

Define the canonical PostgreSQL schema for the full SynqLab multi-tenant platform. This schema supports organizations, teams, projects, pipelines, design rounds, candidates, datasets, publications, and access control — across academic labs, pharma companies, and individual researchers.

## Location

- ORM models: `synqlab/storage/models.py` (extended) + `synqlab/auth/models.py` (new)
- Migrations: `alembic/versions/`
- Auth services: `synqlab/auth/`
- DB connection: `synqlab/storage/db.py` (unchanged interface)

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Multi-tenancy | Row-level (`org_id` on all tenant tables) + RLS | Single database, SaaS-friendly, cross-org analytics later |
| Auth | Self-contained JWT — `password_hash` (bcrypt) on `users`, tokens issued by FastAPI | No external dependency; OAuth can be added later via `auth_provider` + `auth_sub` |
| Teams | Optional (`team_id` nullable on `projects`) | Solo researchers and large groups both supported |
| Access control | Simple `project_members` roles now; `user_groups` + `access_profiles` tables present from day one | Start simple, upgrade to group-based without migration |
| Pipeline model | Pipeline = versioned template; Run = instantiation of a specific `pipeline_version` | Reproducibility: every run references a frozen config snapshot |
| Publications | First-class DB objects with internal org review before external submission | Enables paper-traceable science and data provenance |
| Dataset access | Audited via `dataset_access_log` | Required for commercial licensing and scientific attribution |
| API keys | `api_keys` table alongside JWT | Python wheel / programmatic commercial mode |

---

## Schema Groups

### Group 1 — Identity

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | text UNIQUE | |
| `full_name` | text | |
| `avatar_url` | text | nullable |
| `password_hash` | text | bcrypt; null if OAuth-only user |
| `auth_provider` | text | `'email'` \| `'google'` \| `'orcid'` |
| `auth_sub` | text UNIQUE | OAuth subject ID; null for email users |
| `created_at` | timestamptz | |

#### `organizations`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | text | |
| `slug` | text UNIQUE | URL-safe: `'mit-protein-lab'` |
| `plan_tier` | text | `'free'` \| `'academic'` \| `'pro'` \| `'enterprise'` |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |

#### `org_members`
| Column | Type | Notes |
|---|---|---|
| `org_id` | UUID FK → organizations | PK component |
| `user_id` | UUID FK → users | PK component |
| `role` | text | `'owner'` \| `'admin'` \| `'member'` \| `'guest'` |
| `joined_at` | timestamptz | |

#### `org_invitations`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | UUID FK → organizations | |
| `email` | text | invitee email |
| `role` | text | role they will receive on acceptance |
| `token` | text UNIQUE | sent in invite link |
| `invited_by` | UUID FK → users | |
| `expires_at` | timestamptz | |
| `accepted_at` | timestamptz | null = pending |
| `created_at` | timestamptz | |

#### `api_keys`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `org_id` | UUID FK → organizations | |
| `key_hash` | text UNIQUE | SHA-256 of the raw key; raw key shown once at creation |
| `name` | text | human label |
| `scopes` | text[] | e.g. `['runs:read', 'tools:invoke']` |
| `last_used_at` | timestamptz | nullable |
| `expires_at` | timestamptz | nullable = no expiry |
| `created_at` | timestamptz | |

---

### Group 2 — Teams & Groups

#### `teams`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | UUID FK → organizations | |
| `name` | text | |
| `description` | text | nullable |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |

#### `team_members`
| Column | Type | Notes |
|---|---|---|
| `team_id` | UUID FK → teams | PK component |
| `user_id` | UUID FK → users | PK component |
| `role` | text | `'lead'` \| `'member'` |
| `joined_at` | timestamptz | |

#### `user_groups`
Every user gets an implicit group. Teams also map to groups. Explicit groups for cross-cutting access.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | UUID FK → organizations | |
| `name` | text | |
| `kind` | text | `'implicit'` \| `'team'` \| `'explicit'` |
| `team_id` | UUID FK → teams | set when `kind = 'team'`; null otherwise |
| `created_at` | timestamptz | |

#### `user_group_members`
| Column | Type | Notes |
|---|---|---|
| `group_id` | UUID FK → user_groups | PK component |
| `user_id` | UUID FK → users | PK component |

---

### Group 3 — Projects

#### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | UUID FK → organizations | |
| `team_id` | UUID FK → teams | nullable; null = solo project |
| `name` | text | |
| `description` | text | nullable |
| `status` | text | `'active'` \| `'archived'` \| `'completed'` |
| `visibility` | text | `'private'` \| `'team'` \| `'org'` \| `'public'` |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `project_members`
Grantee is either a `user_id` OR a `group_id` (not both).

| Column | Type | Notes |
|---|---|---|
| `project_id` | UUID FK → projects | PK component |
| `user_id` | UUID FK → users | nullable; PK component when set |
| `group_id` | UUID FK → user_groups | nullable; PK component when set |
| `access_level` | text | `'owner'` \| `'admin'` \| `'write'` \| `'read'` \| `'view'` |
| `granted_by` | UUID FK → users | |
| `granted_at` | timestamptz | |

---

### Group 3b — People Network

#### `user_connections`
Auto-populated when two users interact (same org, co-authorship, shared project). No manual friend requests — connections are implicit from platform activity.

| Column | Type | Notes |
|---|---|---|
| `user_id_a` | UUID FK → users | PK component; lower UUID alphabetically to avoid duplicates |
| `user_id_b` | UUID FK → users | PK component |
| `connection_type` | text | `'org_member'` \| `'collaborator'` \| `'coauthor'` — strongest type wins |
| `org_id` | UUID FK → organizations | nullable; set for `org_member` connections |
| `created_at` | timestamptz | when the connection was first established |
| UNIQUE | `(user_id_a, user_id_b)` | always store with `user_id_a < user_id_b` (lexicographic) |

Connection creation rules (triggered automatically by the backend):
- Two users join the same org → `org_member` connection
- Two users are both `project_members` on the same project → `collaborator`
- Two users are both `pub_authors` on the same publication → `coauthor`
- `connection_type` is upgraded if a stronger type is established later (coauthor > collaborator > org_member)

---

### Group 4 — Pipelines (Versioned Templates)

#### `pipelines`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID FK → projects | |
| `name` | text | |
| `description` | text | nullable |
| `current_version` | int | latest version number |
| `forked_from_id` | UUID FK → pipelines | nullable; set if forked from another pipeline |
| `is_public` | bool | available to other orgs as a template |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |

#### `pipeline_versions`
Immutable snapshots. Runs reference a specific version — this snapshot is never modified.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `pipeline_id` | UUID FK → pipelines | |
| `version` | int | monotonically increasing |
| `config_jsonb` | jsonb | full pipeline config at this version |
| `changelog` | text | nullable |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |
| UNIQUE | `(pipeline_id, version)` | |

---

### Group 5 — Runs (Design Rounds)

#### `runs`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `pipeline_id` | UUID FK → pipelines | |
| `pipeline_version` | int | which version snapshot was used |
| `project_id` | UUID FK → projects | denormalized for query convenience |
| `name` | text | nullable |
| `round_number` | int | 1-indexed iteration within a project |
| `status` | text | `'pending'` \| `'running'` \| `'completed'` \| `'failed'` |
| `started_at` | timestamptz | nullable |
| `completed_at` | timestamptz | nullable |
| `created_by` | UUID FK → users | |
| `config_jsonb` | jsonb | run-level overrides on top of pipeline config |
| `budget_jsonb` | jsonb | n_generated, gate pass rates, gpu_seconds, etc. |
| `summary_jsonb` | jsonb | top-k sequences, scores, artifact paths |

---

### Group 6 — Candidates & Tool Executions

#### `candidates`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `run_id` | UUID FK → runs | |
| `sequence` | text | amino acid sequence |
| `status` | text | `'generated'` \| `'gate1_pass'` \| `'gate2_pass'` \| `'gate3_pass'` \| `'top_k'` \| `'rejected'` |
| `rejection_stage` | text | nullable; which gate rejected it |
| `scores_jsonb` | jsonb | `{plddt, ddg, brightness_score, reranker_score}` |
| `created_at` | timestamptz | |

#### `tool_runs`
Extended from existing schema to include `run_id` and `candidate_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `run_id` | UUID FK → runs | |
| `candidate_id` | UUID FK → candidates | nullable (stage-level tools apply to the whole run) |
| `tool_name` | text | matches registry id |
| `tool_version` | text | nullable |
| `status` | text | `'pending'` \| `'running'` \| `'completed'` \| `'failed'` |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz | nullable |
| `latency_ms` | float | nullable |
| `cpu_seconds` | numeric | nullable |
| `gpu_seconds` | numeric | nullable |
| `token_count` | int | nullable |
| `error_code` | text | nullable |
| `input_hash` | text | deterministic hash of request (for dedup) |
| `request_jsonb` | jsonb | |
| `response_jsonb` | jsonb | |

#### `artifacts`
Extended from existing schema — `path` renamed to `uri` to support both filesystem and object storage.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tool_run_id` | UUID FK → tool_runs | |
| `artifact_type` | text | `'structure'` \| `'trajectory'` \| `'scores'` \| `'log'` \| `'checkpoint'` |
| `uri` | text | filesystem path or `s3://bucket/key` |
| `format` | text | `'pdb'` \| `'json'` \| `'csv'` \| `'pt'` etc. |
| `size_bytes` | bigint | nullable |
| `checksum` | text | nullable |
| `created_at` | timestamptz | |

---

### Group 7 — Datasets (Knowledge Store)

#### `datasets`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | UUID FK → organizations | |
| `project_id` | UUID FK → projects | nullable; null = org-wide dataset |
| `name` | text | |
| `description` | text | nullable |
| `domain` | text | e.g. `'gfp11'`, `'protein_stability'` |
| `visibility` | text | `'private'` \| `'team'` \| `'org'` \| `'public'` |
| `schema_version` | int | for future format changes |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |

#### `dataset_entries`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets | |
| `sequence` | text | |
| `label` | int | binary: 1 = positive, 0 = negative |
| `score` | numeric | nullable; continuous measurement |
| `source` | text | `'experimental'` \| `'simulated'` \| `'literature'` |
| `metadata_jsonb` | jsonb | assay conditions, batch, instrument, etc. |
| `created_at` | timestamptz | |

#### `dataset_access_log`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `dataset_id` | UUID FK → datasets | |
| `user_id` | UUID FK → users | nullable for public/unauthenticated access |
| `api_key_id` | UUID FK → api_keys | nullable |
| `access_type` | text | `'view'` \| `'download'` \| `'query'` |
| `ip_address` | text | nullable |
| `accessed_at` | timestamptz | |

---

### Group 8 — Scientific Publishing

#### `publications`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID FK → projects | |
| `title` | text | |
| `abstract` | text | nullable |
| `status` | text | `'draft'` \| `'in_review'` \| `'preprint'` \| `'submitted'` \| `'published'` \| `'rejected'` |
| `doi` | text | nullable; set after journal acceptance |
| `journal` | text | nullable |
| `preprint_url` | text | nullable |
| `submitted_at` | timestamptz | nullable |
| `published_at` | timestamptz | nullable |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `pub_authors`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `publication_id` | UUID FK → publications | |
| `user_id` | UUID FK → users | nullable for external (non-platform) authors |
| `external_name` | text | nullable |
| `external_email` | text | nullable |
| `orcid` | text | nullable |
| `affiliation` | text | nullable |
| `author_order` | int | 1-indexed display order |
| `is_corresponding` | bool | |

#### `pub_runs`
| Column | Type | Notes |
|---|---|---|
| `publication_id` | UUID FK → publications | PK component |
| `run_id` | UUID FK → runs | PK component |

#### `pub_candidates`
| Column | Type | Notes |
|---|---|---|
| `publication_id` | UUID FK → publications | PK component |
| `candidate_id` | UUID FK → candidates | PK component |

#### `pub_datasets`
| Column | Type | Notes |
|---|---|---|
| `publication_id` | UUID FK → publications | PK component |
| `dataset_id` | UUID FK → datasets | PK component |

#### `pub_reviews`
Internal org review before a publication moves to `submitted`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `publication_id` | UUID FK → publications | |
| `reviewer_id` | UUID FK → users | must be an `org_member` of the project's org |
| `status` | text | `'pending'` \| `'approved'` \| `'revision_requested'` |
| `comments` | text | nullable |
| `reviewed_at` | timestamptz | nullable |
| `assigned_by` | UUID FK → users | |
| `assigned_at` | timestamptz | |

---

### Group 9 — Collaboration & Sharing

#### `tags`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `org_id` | UUID FK → organizations | |
| `name` | text | |
| `color` | text | nullable; hex color |
| UNIQUE | `(org_id, name)` | |

#### `resource_tags`
| Column | Type | Notes |
|---|---|---|
| `tag_id` | UUID FK → tags | PK component |
| `resource_type` | text | `'project'` \| `'run'` \| `'candidate'` \| `'pipeline'` \| `'publication'` \| `'dataset'` |
| `resource_id` | UUID | PK component |
| `tagged_by` | UUID FK → users | |

#### `comments`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `resource_type` | text | same set as `resource_tags` |
| `resource_id` | UUID | |
| `user_id` | UUID FK → users | |
| `body` | text | |
| `parent_id` | UUID FK → comments | nullable; for threaded replies |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `sharing_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `resource_type` | text | |
| `resource_id` | UUID | |
| `token` | text UNIQUE | random opaque token |
| `access_level` | text | `'read'` \| `'view'` |
| `expires_at` | timestamptz | null = permanent (used for published papers) |
| `created_by` | UUID FK → users | |
| `created_at` | timestamptz | |

---

## Migration Order

```
alembic/versions/
  001_users_orgs.py          → users, organizations, org_members, org_invitations, api_keys
  002_teams_projects.py      → teams, team_members, user_groups, user_group_members,
                               projects, project_members
  003_pipelines_runs.py      → pipelines, pipeline_versions, runs, candidates,
                               tool_runs (extended), artifacts (extended)
  004_datasets_publications.py → datasets, dataset_entries, dataset_access_log,
                                 publications, pub_authors, pub_runs, pub_candidates,
                                 pub_datasets, pub_reviews
  005_collaboration.py       → tags, resource_tags, comments, sharing_tokens
```

Each migration is additive. The existing `experiments` table remains and gains a FK to `runs` in migration 003.

---

## Auth Layer (`synqlab/auth/`)

```python
# synqlab/auth/service.py
create_user(session, email, password, full_name) -> User
authenticate(session, email, password) -> User | None   # returns None on bad credentials
get_user_by_id(session, user_id) -> User | None
create_api_key(session, user_id, org_id, name, scopes) -> tuple[ApiKey, str]  # (record, raw_key)

# synqlab/auth/jwt.py
create_token(user_id: str, expires_in_seconds: int = 86400) -> str
decode_token(token: str) -> dict   # raises ExpiredTokenError | InvalidTokenError

# synqlab/auth/dependencies.py  (FastAPI)
get_current_user(token: str = Depends(oauth2_scheme)) -> User
require_org_member(org_id: str, min_role: str = "member") -> User
```

## API Routes (`app/routers/auth.py`)

```
POST /auth/signup   → { access_token, token_type, user }
POST /auth/login    → { access_token, token_type, user }
GET  /auth/me       → { id, email, full_name, avatar_url }
POST /auth/logout   → { ok: true }   (client deletes token)
```

All `/api/*` routes require `Authorization: Bearer <token>` or `X-Api-Key: <key>`. `/auth/*` and `/api/health` are public.

---

## Connections

- Used by `app/main.py` — JWT middleware gates all `/api/*` routes
- Used by `app/routers/auth.py` — signup / login / me endpoints
- Used by `synqlab/storage/service.py` — all pipeline CRUD references `runs`, `candidates`
- Used by `synqlab/query/api.py` — queries scoped by `project_id` / `org_id`
- Used by `synqlab/orchestrator/pipeline.py` — `run_experiment()` creates `runs` + `candidates` rows
- Referenced by `synqlab/adapters/experiment_store.py` — thin wrapper now references `runs` not `experiments`

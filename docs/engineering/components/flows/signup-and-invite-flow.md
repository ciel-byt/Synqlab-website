# Flow: Signup, Org Creation, and Invite

This document traces the exact database operations for the core onboarding flows:
user signup → org creation → invite → project creation.

---

## Flow 1 — First user signs up and creates an org

### Step 1: User submits signup form (`name`, `email`, `password`)

```sql
INSERT INTO users (id, email, full_name, password_hash, auth_provider, created_at)
VALUES ('uuid-alice', 'alice@mit.edu', 'Alice', 'bcrypt($password)', 'email', now());
```

→ Server issues a JWT token for `uuid-alice`.

### Step 2: User creates their organization (`name`, `slug`)

```sql
INSERT INTO organizations (id, name, slug, plan_tier, created_by, created_at)
VALUES ('uuid-mit', 'MIT Protein Lab', 'mit-protein-lab', 'academic', 'uuid-alice', now());

-- Alice becomes the org owner
INSERT INTO org_members (org_id, user_id, role, joined_at)
VALUES ('uuid-mit', 'uuid-alice', 'owner', now());

-- Every user gets an implicit group (used for access control)
INSERT INTO user_groups (id, org_id, name, kind, team_id, created_at)
VALUES ('uuid-grp-alice', 'uuid-mit', 'Alice', 'implicit', null, now());

INSERT INTO user_group_members (group_id, user_id)
VALUES ('uuid-grp-alice', 'uuid-alice');
```

**State after Flow 1:**

| Table | New rows |
|---|---|
| `users` | Alice |
| `organizations` | MIT Protein Lab |
| `org_members` | Alice → MIT Protein Lab (owner) |
| `user_groups` | Alice's implicit group |
| `user_group_members` | Alice → her group |

---

## Flow 2 — Alice invites Bob

### Step 3: Alice enters Bob's email in Settings → Team → "Invite Member", picks role `member`

```sql
INSERT INTO org_invitations (id, org_id, email, role, token, invited_by, expires_at, created_at)
VALUES ('uuid-inv-1', 'uuid-mit', 'bob@pharma.com', 'member',
        'abc123xyz', 'uuid-alice', now() + interval '7 days', now());
```

→ UI gives Alice a copyable link: `https://app.synqlab.ai/invite/abc123xyz`

Alice pastes this into Slack / email manually. No email server needed.

---

## Flow 3A — Bob clicks the link (new user, no account)

### Step 4: Bob opens `/invite/abc123xyz`

```sql
SELECT oi.*, o.name AS org_name
FROM org_invitations oi
JOIN organizations o ON o.id = oi.org_id
WHERE oi.token = 'abc123xyz'
  AND oi.accepted_at IS NULL
  AND oi.expires_at > now();
```

→ Returns `{org_name: "MIT Protein Lab", role: "member", expires_at: ...}`

UI shows: *"You've been invited to join MIT Protein Lab as Member"* + **Sign Up** / **Sign In** buttons.

### Step 5: Bob clicks Sign Up → `/signup?invite=abc123xyz`

Signup form shows: *"Joining MIT Protein Lab as Member"*

### Step 6: Bob submits signup form

```sql
-- Create Bob's user record
INSERT INTO users (id, email, full_name, password_hash, auth_provider, created_at)
VALUES ('uuid-bob', 'bob@pharma.com', 'Bob', 'bcrypt($password)', 'email', now());

-- Redeem the invite token
UPDATE org_invitations
SET accepted_at = now()
WHERE token = 'abc123xyz';

-- Add Bob to the org
INSERT INTO org_members (org_id, user_id, role, joined_at)
VALUES ('uuid-mit', 'uuid-bob', 'member', now());

-- Create Bob's implicit group in the org
INSERT INTO user_groups (id, org_id, name, kind, team_id, created_at)
VALUES ('uuid-grp-bob', 'uuid-mit', 'Bob', 'implicit', null, now());

INSERT INTO user_group_members (group_id, user_id)
VALUES ('uuid-grp-bob', 'uuid-bob');
```

→ JWT issued for Bob. Bob lands directly on the dashboard as a member of MIT Protein Lab.

---

## Flow 3B — Bob clicks the link (existing user, already has an account)

### Step 4: Same — Bob sees the invite preview page.

### Step 5: Bob clicks Sign In → logs in normally → JWT issued.

### Step 6: Frontend detects the pending `?invite=abc123xyz` and auto-redeems:

```sql
-- Redeem token
UPDATE org_invitations
SET accepted_at = now()
WHERE token = 'abc123xyz';

-- Add Bob to the org
INSERT INTO org_members (org_id, user_id, role, joined_at)
VALUES ('uuid-mit', 'uuid-bob', 'member', now());

-- Create Bob's implicit group (only if Bob isn't already in this org)
INSERT INTO user_groups (id, org_id, name, kind, team_id, created_at)
VALUES ('uuid-grp-bob', 'uuid-mit', 'Bob', 'implicit', null, now())
ON CONFLICT DO NOTHING;

INSERT INTO user_group_members (group_id, user_id)
VALUES ('uuid-grp-bob', 'uuid-bob')
ON CONFLICT DO NOTHING;
```

→ Bob lands on the dashboard as a member of Alice's org.

---

## Flow 4 — Alice creates a project and adds Bob

### Step 7: Alice creates a new project

```sql
INSERT INTO projects (id, org_id, team_id, name, description,
                      status, visibility, created_by, created_at, updated_at)
VALUES ('uuid-proj-gfp', 'uuid-mit', null, 'GFP11 Brightness',
        'Design GFP11 variants that maximize fluorescence.',
        'active', 'private', 'uuid-alice', now(), now());

-- Alice is automatically the project owner
INSERT INTO project_members (project_id, user_id, group_id, access_level, granted_by, granted_at)
VALUES ('uuid-proj-gfp', 'uuid-alice', null, 'owner', 'uuid-alice', now());
```

### Step 8: Alice adds Bob to the project from the Members tab

```sql
INSERT INTO project_members (project_id, user_id, group_id, access_level, granted_by, granted_at)
VALUES ('uuid-proj-gfp', 'uuid-bob', null, 'write', 'uuid-alice', now());
```

Now both Alice and Bob can see and work on the GFP11 Brightness project.

---

## Complete database state after all four flows

| Table | Rows |
|---|---|
| `users` | Alice, Bob |
| `organizations` | MIT Protein Lab |
| `org_members` | Alice (owner), Bob (member) |
| `org_invitations` | token `abc123xyz` (accepted_at = now) |
| `user_groups` | Alice's implicit group, Bob's implicit group |
| `user_group_members` | Alice → her group, Bob → his group |
| `projects` | GFP11 Brightness |
| `project_members` | Alice (owner), Bob (write) |

**8 tables touched. Nothing else is written until a pipeline run is triggered.**

---

## What happens next (when a run is triggered)

For reference — the tables written when Alice runs a pipeline:

```sql
INSERT INTO pipelines (...)           -- if not already created
INSERT INTO pipeline_versions (...)   -- frozen config snapshot
INSERT INTO runs (...)                -- the design round
INSERT INTO candidates (...)          -- one row per generated sequence
INSERT INTO tool_runs (...)           -- one row per tool execution per candidate
INSERT INTO artifacts (...)           -- one row per output file (PDB, scores, etc.)
```

See `docs/engineering/components/database-schema.md` → Groups 4, 5, 6 for full column specs.

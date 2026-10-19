ALTER TABLE workspaces DROP CONSTRAINT workspaces_owner_id_key;
ALTER TABLE workspaces ADD COLUMN kind text NOT NULL DEFAULT 'personal' CHECK(kind IN ('personal','shared'));
ALTER TABLE workspaces ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision > 0);
ALTER TABLE workspaces ADD COLUMN creation_key text;
CREATE UNIQUE INDEX workspaces_one_personal ON workspaces(owner_id) WHERE kind='personal';
CREATE UNIQUE INDEX workspaces_creation_key ON workspaces(owner_id,creation_key);
ALTER TABLE members ALTER COLUMN role SET DEFAULT 'viewer';
ALTER TABLE members ADD CONSTRAINT members_role_check CHECK(role IN ('owner','member','viewer'));
CREATE UNIQUE INDEX members_one_owner ON members(workspace_id) WHERE role='owner';
CREATE TABLE workspace_invites (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, role text NOT NULL CHECK(role IN ('member','viewer')),
 issued_by text NOT NULL REFERENCES auth_user(id), expires_at timestamptz NOT NULL,
 used_by text REFERENCES auth_user(id), used_at timestamptz, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invites_workspace_idx ON workspace_invites(workspace_id);
ALTER TABLE run_events ALTER COLUMN run_id DROP NOT NULL;
CREATE UNIQUE INDEX events_workspace_revision ON run_events(workspace_id,seq) WHERE run_id IS NULL;

ALTER TABLE runs ADD COLUMN simulated_started_at timestamptz;
CREATE TABLE presence_rooms (
 workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 0
);
CREATE TABLE presence_clients (
 workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 session_id text NOT NULL, client_id text NOT NULL,
 user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, closed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(workspace_id,session_id,client_id)
);
CREATE INDEX presence_clients_session ON presence_clients(session_id);
CREATE TABLE presence_status (
 workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 name text NOT NULL, online boolean NOT NULL,
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE presence_events (
 workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 seq integer NOT NULL, user_id text NOT NULL, name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('joined','left')),
 reason text NOT NULL CHECK(reason IN ('page','timeout','logout','revoked')),
 happened_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,seq)
);

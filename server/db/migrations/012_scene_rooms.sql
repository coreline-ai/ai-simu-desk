CREATE TABLE scene_rooms (
 workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 epoch integer NOT NULL DEFAULT 0,
 seq integer NOT NULL DEFAULT 0,
 controller_user_id text,
 controller_session_id text,
 client_id text,
 token_hash text,
 lease_until timestamptz,
 packet jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);

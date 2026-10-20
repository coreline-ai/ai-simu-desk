CREATE TABLE project_settings (
 workspace_id text PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 goal text NOT NULL DEFAULT '', audience text NOT NULL DEFAULT '',
 technology text NOT NULL DEFAULT '', exclusions text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);

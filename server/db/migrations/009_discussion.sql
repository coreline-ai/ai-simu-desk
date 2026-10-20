CREATE TABLE task_comments (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 author_id text NOT NULL REFERENCES auth_user(id), body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
 request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(run_id,author_id,request_key)
);
CREATE INDEX task_comments_page ON task_comments(run_id,created_at,id);
CREATE TABLE notifications (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('approval_requested','completed','failed','comment')),
 source_key text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,source_key)
);
CREATE INDEX notifications_inbox ON notifications(workspace_id,user_id,created_at);

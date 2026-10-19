CREATE TABLE workspaces (
 id text PRIMARY KEY, owner_id text NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE CASCADE,
 name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE members (
 workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'owner',
 PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE tasks (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), author_id text NOT NULL REFERENCES auth_user(id),
 prompt text NOT NULL CHECK(char_length(trim(prompt)) BETWEEN 2 AND 2000), agent_id text NOT NULL CHECK(agent_id IN ('nara','jun')),
 approval_required boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE runs (
 id text PRIMARY KEY, workspace_id text NOT NULL REFERENCES workspaces(id), task_id text NOT NULL REFERENCES tasks(id),
 requested_by text NOT NULL REFERENCES auth_user(id), request_key text NOT NULL, request_hash text NOT NULL,
 status text NOT NULL CONSTRAINT runs_status_check CHECK(status IN ('awaiting_approval','queued','running','cancel_requested','succeeded','failed','cancelled')),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0), output text NOT NULL DEFAULT '', stage text NOT NULL DEFAULT '요청 접수', note text NOT NULL DEFAULT '',
 provider text NOT NULL DEFAULT 'fake' CHECK(provider='fake'), external_ref text,
 scenario text NOT NULL CHECK(scenario IN ('normal','failure')), finished_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX runs_request_key ON runs(workspace_id,request_key);
CREATE UNIQUE INDEX runs_one_active ON runs(workspace_id) WHERE status IN ('awaiting_approval','queued','running','cancel_requested');
CREATE INDEX runs_queue_idx ON runs(status,created_at);
CREATE TABLE approvals (
 id text PRIMARY KEY, run_id text NOT NULL UNIQUE REFERENCES runs(id), workspace_id text NOT NULL REFERENCES workspaces(id),
 status text NOT NULL CHECK(status IN ('pending','approved','declined')), decided_by text REFERENCES auth_user(id),
 decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE run_events (
 cursor bigserial PRIMARY KEY, id text NOT NULL UNIQUE, workspace_id text NOT NULL REFERENCES workspaces(id), run_id text NOT NULL REFERENCES runs(id),
 seq integer NOT NULL CHECK(seq > 0), kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX events_run_seq ON run_events(run_id,seq);
CREATE INDEX events_workspace_cursor ON run_events(workspace_id,cursor);

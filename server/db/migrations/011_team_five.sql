ALTER TABLE tasks DROP CONSTRAINT tasks_agent_id_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_agent_id_check CHECK(agent_id IN ('nara','sora','jun','min','leo'));
ALTER TABLE tasks ADD COLUMN team boolean NOT NULL DEFAULT false;

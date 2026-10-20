ALTER TABLE runs ADD COLUMN generated_answer jsonb;
ALTER TABLE runs ADD COLUMN phase text NOT NULL DEFAULT 'analyze';
ALTER TABLE runs ADD CONSTRAINT runs_phase_check CHECK (phase IN ('analyze','compose','review'));

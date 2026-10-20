-- Retire shared public sessions, preserving the old user's work and account.
-- All new guests receive a fresh identity; no old workspace is reassigned.
DELETE FROM auth_session WHERE user_id='simu-desk-public-guest';
CREATE INDEX auth_session_expiry ON auth_session(expires_at);

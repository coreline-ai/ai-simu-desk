CREATE TABLE auth_rate_limit (
 id text PRIMARY KEY,
 key text NOT NULL UNIQUE,
 count integer NOT NULL,
 last_request bigint NOT NULL
);

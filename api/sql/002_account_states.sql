-- Account states and roles (astro-tbb.2; docs/DESIGN.md §5a).
-- status: pending | active | paused | frozen | deleting
-- role:   user | admin
-- Accounts made before this migration (by the command line) become active users.
-- One column per ALTER, so it also runs on SQLite.

ALTER TABLE users ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN status_changed_at BIGINT NULL;
ALTER TABLE users ADD COLUMN delete_after BIGINT NULL;
ALTER TABLE users ADD COLUMN state_before_delete VARCHAR(16) NULL;
CREATE INDEX users_status ON users (status);

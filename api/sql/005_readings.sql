-- Ask Claude readings synced to the account (astro-cbi; docs/DESIGN.md §5a).
-- id: the reading's UUID, made in the browser; unique per account (the key is
--   (user_id, id), so one account can never write over another's reading).
-- rev: when the row last changed, in microseconds (server time); the sync
--   cursor. created_at is the browser's creation time in milliseconds.
-- A deleted reading keeps only id, rev and deleted = 1 (its content is
--   cleared), so the deletion reaches the account's other devices.
-- Rows go with the account (ON DELETE CASCADE).

CREATE TABLE readings (
  user_id CHAR(36) NOT NULL,
  id CHAR(36) NOT NULL,
  rkey TEXT NULL,
  grp TEXT NULL,
  tab VARCHAR(20) NULL,
  title TEXT NULL,
  question TEXT NULL,
  preset VARCHAR(40) NULL,
  anonymised INT NOT NULL DEFAULT 1,
  body MEDIUMTEXT NULL,
  stopped INT NOT NULL DEFAULT 0,
  interrupted INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  rev BIGINT NOT NULL,
  deleted INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) /*TABLE_OPTIONS*/;

CREATE INDEX readings_user_rev ON readings (user_id, rev);

-- One-use passes for Ask Claude (astro-tbb.7, astro-bk6; docs/DESIGN.md §5a).
-- The app asks for a pass before each reading (ask_pass.php); the relay Worker
-- checks it back with the server (ask_consume.php), which marks it used.
-- Only a hash of each pass is stored. A used pass is one reading: the daily
-- limit counts used passes in the last 24 hours. Rows older than two days are
-- deleted by housekeeping (they hold only the account and times, no content).

CREATE TABLE ask_passes (
  id_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) /*TABLE_OPTIONS*/;

CREATE INDEX ask_passes_user ON ask_passes (user_id, used_at);

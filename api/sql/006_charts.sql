-- Saved charts synced to the account (astro-ag1; docs/DESIGN.md §5a).
-- Birth data only (data: JSON of name, date, time, accuracy, place, notes,
--   set); positions are always recomputed, never stored.
-- id: the chart's UUID, made in the browser; the key is (user_id, id).
-- updated_at: when the chart was last edited, in the browser's milliseconds;
--   the later edit wins. rev: server time in microseconds, the sync cursor.
-- A deleted chart keeps only id, times and deleted = 1 (data cleared).

CREATE TABLE charts (
  user_id CHAR(36) NOT NULL,
  id CHAR(36) NOT NULL,
  data TEXT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  rev BIGINT NOT NULL,
  deleted INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) /*TABLE_OPTIONS*/;

CREATE INDEX charts_user_rev ON charts (user_id, rev);

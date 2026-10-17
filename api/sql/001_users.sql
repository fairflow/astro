-- Logins (astro-yal). Portable SQL: runs on MariaDB/MySQL and on SQLite (local
-- dev and tests). Times are Unix seconds in BIGINT; ids are UUID strings made
-- in PHP. migrate.php replaces TABLE_OPTIONS (in a comment) per driver.

CREATE TABLE users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  pass_hash VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL
) /*TABLE_OPTIONS*/;

CREATE TABLE sessions (
  id_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) /*TABLE_OPTIONS*/;

CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE login_failures (
  k VARCHAR(190) NOT NULL,
  at BIGINT NOT NULL
) /*TABLE_OPTIONS*/;

CREATE INDEX login_failures_k_at ON login_failures (k, at);

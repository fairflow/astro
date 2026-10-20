-- Two-step sign-in, registration and the admin panel (astro-tbb.10, .3, .4).
-- users.two_step: the user asked for an emailed code at every sign-in (admins always get one).
-- users.email_confirmed: 0 for a registration whose emailed code has not been entered yet;
--   accounts made before this migration or by the command line count as confirmed.
-- users.last_seen_at: last sign-in or daily session renewal, for the admin panel.
-- sessions.second_step_at: when this session passed the email-code step (NULL if it did not).
-- admin_log: every admin action (who, what, to whom, when); target_email is cleared
--   when the account is removed. Its id begins with the time in microseconds, so
--   it sorts in the order the actions happened.

ALTER TABLE users ADD COLUMN two_step INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_confirmed INT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN last_seen_at BIGINT NULL;
ALTER TABLE sessions ADD COLUMN second_step_at BIGINT NULL;

CREATE TABLE admin_log (
  id CHAR(36) NOT NULL PRIMARY KEY,
  admin_id CHAR(36) NOT NULL,
  admin_email VARCHAR(190) NOT NULL,
  action VARCHAR(32) NOT NULL,
  target_id CHAR(36) NULL,
  target_email VARCHAR(190) NULL,
  detail VARCHAR(190) NULL,
  at BIGINT NOT NULL
) /*TABLE_OPTIONS*/;

CREATE INDEX admin_log_at ON admin_log (at);

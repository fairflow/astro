-- One-time email codes (astro-tbb.8): registration, two-step sign-in, password reset.
-- Only a hash of each code is stored (sha256 of "id:code"); codes last 10 minutes.

CREATE TABLE email_codes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  email VARCHAR(190) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  tries INT NOT NULL DEFAULT 0,
  used_at BIGINT NULL
) /*TABLE_OPTIONS*/;

CREATE INDEX email_codes_lookup ON email_codes (email, purpose, used_at);

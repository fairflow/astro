-- Usage monitoring for the admin panel (astro-6yh).
-- ask_daily: how many Ask Claude readings each account started per UTC day and
--   model preset; counts only, no content. Kept 13 months (housekeeping).
-- ask_passes.preset: the model preset a pass was issued for (counted when used).

ALTER TABLE ask_passes ADD COLUMN preset VARCHAR(40) NULL;

CREATE TABLE ask_daily (
  user_id CHAR(36) NOT NULL,
  day CHAR(10) NOT NULL,
  preset VARCHAR(40) NOT NULL,
  n INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, preset),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) /*TABLE_OPTIONS*/;

CREATE INDEX ask_daily_day ON ask_daily (day);

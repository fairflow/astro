#!/bin/sh
# Local server API for development (npm run api): PHP's built-in server on
# :8323 over a SQLite database in .local/ (git-ignored), never the live one.
# The Vite dev server (:8322) proxies /api/ here. First run creates the
# database; add an account with:
#   ASTRO_DB_INI=.local/dev.ini php api/cli/user.php add you@example.com
set -e
mkdir -p .local
if [ ! -f .local/dev.ini ]; then
  printf '[db]\ndriver = sqlite\npath = "%s/.local/dev.sqlite"\n' "$(pwd)" > .local/dev.ini
fi
export ASTRO_DB_INI="$(pwd)/.local/dev.ini"
php api/cli/migrate.php
exec php -S 127.0.0.1:8323 -t . tools/api-dev-router.php

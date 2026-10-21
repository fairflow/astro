"""Set up the staging site's database on the host (astro-7gn), without typing its SSH details.

Uses the SSH login in the [ssh] table of ~/.config/fairflow/hosting.toml, as
tools/deploy_sftp.py does, and cPanel's own command line (uapi) on the host.
The subdomain itself (staging.fairflow.co.uk, folder
/home/fairtlou/staging.fairflow.co.uk) is made by Matthew in cPanel first.

  .venv/bin/python tools/host_staging.py check   (reads only: what exists)
  .venv/bin/python tools/host_staging.py setup   (makes what is missing; safe to run again)

setup, each step skipped when already done:
  1. checks the subdomain's folder is there, beside the live site's;
  2. a second MariaDB database and user for staging, with a password made on the
     host from /dev/urandom;
  3. ~/astro-config/staging.ini (600): that database in [db], and the live
     db.ini's other tables ([mail] and so on) copied on the host. Written only
     after a test login with it works.
No password or config value is printed, here or on the host: uapi's replies are
reduced to ok/failed with cPanel's error text. Run from the repo root.
"""
import argparse
import sys

sys.path.insert(0, 'tools')
from deploy_sftp import DEFAULT_SECRETS, connect  # noqa: E402

COMMON = r'''
set -u
umask 077
DIR="$HOME/staging.fairflow.co.uk"
DB=fairtlou_astrostaging
DBUSER=fairtlou_astrostg
LIVE_INI="$HOME/astro-config/db.ini"
INI="$HOME/astro-config/staging.ini"
# uapi's JSON reply as "ok" or "failed: <cPanel's errors>"; nothing else of it is shown
ok() { php -r '$j = json_decode(stream_get_contents(STDIN), true); $r = $j["result"] ?? [];
  if (!empty($r["status"])) { echo "ok\n"; exit(0); }
  echo "failed: ", implode("; ", (array)($r["errors"] ?? ["no reply"])), "\n"; exit(1);'; }
has_db() { uapi --output=json Mysql list_databases | grep -q "\"$DB\""; }
'''

CHECK = COMMON + r'''
[ -d "$DIR" ] && echo "folder $DIR: yes" || echo "folder $DIR: no"
has_db && echo "database $DB: yes" || echo "database $DB: no"
[ -f "$INI" ] && echo "staging.ini: yes ($(stat -c %a "$INI"))" || echo "staging.ini: no"
[ -f "$DIR/astro/api/lib/STAGING" ] && echo "staging build deployed: yes" || echo "staging build deployed: no"
'''

SETUP = COMMON + r'''
[ -d "$DIR" ] || { echo "1. no folder $DIR: make the subdomain staging.fairflow.co.uk in cPanel first, with that folder"; exit 1; }
echo "1. folder $DIR: there"
mkdir -p "$DIR/astro"

if [ -f "$INI" ]; then echo "2-3. staging.ini already there: database steps skipped"; exit 0; fi
[ -f "$LIVE_INI" ] || { echo "no $LIVE_INI to copy the [mail] and other tables from"; exit 1; }
PW=$(head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)
if has_db; then echo "2. database $DB: already there"
else printf '2. database %s: ' "$DB"; uapi --output=json Mysql create_database name="$DB" | ok || exit 1
fi
printf '   user %s: ' "$DBUSER"
# a user left by an earlier, unfinished run gets the new password instead
uapi --output=json Mysql create_user name="$DBUSER" password="$PW" | ok \
  || { printf '   setting its password instead: '; uapi --output=json Mysql set_password user="$DBUSER" password="$PW" | ok || exit 1; }
printf '   privileges on %s: ' "$DB"
uapi --output=json Mysql set_privileges_on_database user="$DBUSER" database="$DB" privileges='ALL PRIVILEGES' | ok || exit 1

# the live [db] host (usually localhost), then every other table of db.ini, copied here, never shown
HOST=$(awk -F' *= *' '/^\[/ { s = $0 } s == "[db]" && $1 == "host" { gsub(/"/, "", $2); print $2 }' "$LIVE_INI")
{ printf '[db]\nhost = "%s"\nname = "%s"\nuser = "%s"\npass = "%s"\n\n' "${HOST:-localhost}" "$DB" "$DBUSER" "$PW"
  awk '/^\[/ { keep = ($0 != "[db]") } keep' "$LIVE_INI"; } > "$INI.new"
chmod 600 "$INI.new"
printf '3. test login with the new config: '
INI_NEW="$INI.new" php -r '$c = parse_ini_file(getenv("INI_NEW"), true)["db"];
  try { new PDO("mysql:host={$c["host"]};dbname={$c["name"]}", $c["user"], $c["pass"]); echo "ok\n"; }
  catch (Throwable $e) { echo "failed\n"; exit(1); }' || { rm -f "$INI.new"; exit 1; }
mv "$INI.new" "$INI"
echo "   wrote $INI ($(stat -c %a "$INI"))"
'''


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--secrets', default=DEFAULT_SECRETS, help=f'file with an [ssh] table (default {DEFAULT_SECRETS})')
    ap.add_argument('command', choices=['check', 'setup'])
    a = ap.parse_args()
    client = connect(a.secrets)
    try:
        chan_in, out, err = client.exec_command('bash -s', timeout=180)
        chan_in.write(CHECK if a.command == 'check' else SETUP)
        chan_in.channel.shutdown_write()
        print(out.read().decode(), end='')
        errs = err.read().decode()
        if errs:
            print(errs, end='', file=sys.stderr)
        code = out.channel.recv_exit_status()
    finally:
        client.close()
    sys.exit(code)


if __name__ == '__main__':
    main()

#!/usr/bin/env bash
# Check that a deployed site serves one consistent build, made from the
# expected commit:
#   - version.json: hash = expected commit, version = package.json, not dirty
#   - retrograde/ (standalone page) carries the same build id
#   - sw.js cache key carries the same 5-hex hash
#   - privacy/ (the privacy notice) is served
#   - http:// and www. redirect to this site's own https address, which sends HSTS
#   - api/lib (incl. the staging build's STAGING marker), api/cli and api/sql are not served
#
# Usage: tools/check_live.sh [SITE] [COMMIT]
#   SITE    default https://fairflow.co.uk/astro/; use https://staging.fairflow.co.uk/astro/ for staging
#   COMMIT  default origin/main (the deploy workflow passes $GITHUB_SHA)
# Exit 0 when aligned; 1 with a list of mismatches otherwise.
set -euo pipefail

site="${1:-https://fairflow.co.uk/astro/}"; site="${site%/}/"
want=$(git rev-parse "${2:-origin/main}")
short=${want:0:5}
version=$(node -p "require('./package.json').version")
id="$version+$short"

fail=0
bad() { echo "MISMATCH: $*"; fail=1; }

vj=$(curl -fsS "${site}version.json?nocache=$RANDOM") || { echo "MISMATCH: no ${site}version.json"; exit 1; }
field() { node -e "process.stdout.write(String(JSON.parse(process.argv[1])[process.argv[2]]))" "$vj" "$1"; }
[ "$(field hash)" = "$want" ]       || bad "version.json hash $(field hash), want $want"
[ "$(field version)" = "$version" ] || bad "version.json version $(field version), want $version (package.json)"
[ "$(field dirty)" = "false" ]       || bad "version.json says the build had uncommitted changes"

curl -fsS "${site}retrograde/?nocache=$RANDOM" | grep -qF "$id" \
  || bad "retrograde/ does not carry build id $id"
curl -fsS "${site}sw.js?nocache=$RANDOM" | grep -qF "astrodynamics-$short" \
  || bad "sw.js cache key is not astrodynamics-$short"

curl -fsS "${site}privacy/?nocache=$RANDOM" | grep -qF "Privacy notice" \
  || bad "privacy/ does not serve the privacy notice"

# one address per site: http and www redirect (301) to the site's own https address, and https sends HSTS
rest=${site#*://}; host=${rest%%/*}; path=/${rest#*/}
for u in "http://$host$path" "https://www.$host$path" "http://www.$host$path"; do
  loc=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$u" || true)
  # a www. name with no DNS record (staging has none) has nothing to redirect
  if [ "${loc%% *}" = "000" ] && [[ "$u" == *//www.* ]]; then echo "note: $u does not resolve; skipped"; continue; fi
  [ "$loc" = "301 https://$host$path" ] || bad "$u answered '$loc' (want 301 to https://$host$path)"
done
curl -sI "${site}" | grep -qi '^strict-transport-security:' || bad "${site} sends no Strict-Transport-Security header"

# the API's internal folders must never be served
for p in api/lib/bootstrap.php api/lib/STAGING api/cli/user.php api/sql/001_users.sql; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${site}$p")
  case "$code" in 403|404) ;; *) bad "${site}$p answered HTTP $code (want 403 or 404)";; esac
done

if [ "$fail" = 0 ]; then echo "Aligned: $site serves build $id ($want)"; fi
exit "$fail"

#!/usr/bin/env bash
# Check that a deployed site serves one consistent build, made from the
# expected commit:
#   - version.json: hash = expected commit, version = package.json, not dirty
#   - retrograde/ (standalone page) carries the same build id
#   - sw.js cache key carries the same 5-hex hash
#   - privacy/ (the privacy notice) is served
#   - http:// and www. redirect to https://fairflow.co.uk/astro/, which sends HSTS
#   - api/lib, api/cli and api/sql are not served
#
# Usage: tools/check_live.sh [SITE] [COMMIT]
#   SITE    default https://fairflow.co.uk/astro/
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

# one address: http and www redirect (301) to https://fairflow.co.uk/astro/, and https sends HSTS
for u in "http://fairflow.co.uk/astro/" "https://www.fairflow.co.uk/astro/" "http://www.fairflow.co.uk/astro/"; do
  loc=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$u")
  [ "$loc" = "301 https://fairflow.co.uk/astro/" ] || bad "$u answered '$loc' (want 301 to https://fairflow.co.uk/astro/)"
done
curl -sI "${site}" | grep -qi '^strict-transport-security:' || bad "${site} sends no Strict-Transport-Security header"

# the API's internal folders must never be served
for p in api/lib/bootstrap.php api/cli/user.php api/sql/001_users.sql; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${site}$p")
  case "$code" in 403|404) ;; *) bad "${site}$p answered HTTP $code (want 403 or 404)";; esac
done

if [ "$fail" = 0 ]; then echo "Aligned: $site serves build $id ($want)"; fi
exit "$fail"

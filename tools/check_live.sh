#!/usr/bin/env bash
# Check that a deployed site serves one consistent build, made from the
# expected commit:
#   - version.json: hash = expected commit, version = package.json, not dirty
#   - retrograde/ (standalone page) carries the same build id
#   - sw.js cache key carries the same 5-hex hash
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

if [ "$fail" = 0 ]; then echo "Aligned: $site serves build $id ($want)"; fi
exit "$fail"

#!/usr/bin/env python3
"""Build the offline place gazetteer from GeoNames cities500 (CC-BY 4.0,
https://www.geonames.org; attribution kept in the app's About), with region
names from admin1CodesASCII and county names from admin2Codes (astro-brv).

Two tiers, so the search starts at once and stays light on a phone:

  data/gazetteer.json      places of 15,000 people or more, fetched at start:
    { "attribution", "zones": [iana...], "regions": ["", "England", ...],
      "cities": [[name, country, lat, lon, zoneIdx, regionIdx, county, alt?], ...] }
  data/places/<key>.json   every smaller place (down to 500 people, and every
    seat of local government), split by the first two letters of its name
    (key, e.g. "ne"), or three for the prefixes listed in gazetteer.json's
    "split" (e.g. "san"), so no file is large; fetched only when a search
    starts with them:
    { "cities": [[name, country, lat, lon, zoneIdx, regionIdx, county, alt?], ...] }

Rows are sorted by population, largest first. zoneIdx and regionIdx index the
lists in gazetteer.json. county is the GeoNames admin2 name (a county in the
UK and US, a département in France), "" when there is none or it is the
place's own name; it tells same-named places apart (Newport, Pembrokeshire). `alt` is GeoNames' plain-letter spelling, given only
when folding the name (below) does not already produce it (e.g. Łódź → Lodz);
a place whose alt starts with other letters is also filed under them.

Names are compared folded: Unicode NFD, combining marks dropped, lower case, a
few letters with no decomposition mapped (ł→l, ø→o, æ→ae, ß→ss, ...), then
everything but a-z and 0-9 removed. src/store/gazetteer.ts folds the same way;
test/gazetteer.spec.ts checks every file against it.

Run:  .venv/bin/python tools/make_gazetteer.py   (downloads into tools/cache/)
"""
import collections
import csv
import io
import json
import pathlib
import re
import shutil
import unicodedata
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache"
OUT = ROOT / "data" / "gazetteer.json"
SHARDS = ROOT / "data" / "places"
BASE = "https://download.geonames.org/export/dump/"
TIER1_POP = 15000
SPLIT_BYTES = 120_000   # a two-letter file larger than this is split by three letters

# letters that NFD does not decompose (keep in step with FOLD in src/store/gazetteer.ts)
FOLD = {"ł": "l", "ø": "o", "æ": "ae", "œ": "oe", "ß": "ss", "đ": "d", "ð": "d",
        "þ": "th", "ı": "i", "ħ": "h", "ŀ": "l", "ŧ": "t"}


def fold(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.category(c).startswith("M"))
    s = "".join(FOLD.get(c, c) for c in s.lower())
    return re.sub(r"[^a-z0-9]", "", s)


def key(s: str, n: int = 2) -> str:
    """The shard a folded name is filed under: its first n characters, padded with _."""
    return (s[:n] + "___")[:n]


def fetch(name: str) -> pathlib.Path:
    path = CACHE / name
    if not path.exists():
        print(f"downloading {name} ...")
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE + name, timeout=300) as r:
            path.write_bytes(r.read())
    return path


admin1 = {}
for line in fetch("admin1CodesASCII.txt").read_text(encoding="utf-8").splitlines():
    code, name, *_ = line.split("\t")
    admin1[code] = name

admin2 = {}
for line in fetch("admin2Codes.txt").read_text(encoding="utf-8").splitlines():
    code, name, *_ = line.split("\t")
    admin2[code] = name

with zipfile.ZipFile(fetch("cities500.zip")) as z:
    raw = z.read("cities500.txt").decode("utf-8")

zones: dict[str, int] = {}
regions: dict[str, int] = {"": 0}
rows = []
for rec in csv.reader(io.StringIO(raw), delimiter="\t", quoting=csv.QUOTE_NONE):
    name, ascii_name, lat, lon = rec[1], rec[2], float(rec[4]), float(rec[5])
    country, adm1, adm2, pop, tz = rec[8], rec[10], rec[11], int(rec[14] or 0), rec[17]
    if not tz:
        continue
    zi = zones.setdefault(tz, len(zones))
    ri = regions.setdefault(admin1.get(f"{country}.{adm1}", ""), len(regions))
    county = admin2.get(f"{country}.{adm1}.{adm2}", "")
    if fold(county) == fold(name):
        county = ""             # Newport in Newport: the name says it already
    row = [name, country, round(lat, 3), round(lon, 3), zi, ri, county]
    f, fa = fold(name), fold(ascii_name)
    if fa and fa != f:
        row.append(ascii_name)
    rows.append((pop, f, fa, row))

rows.sort(key=lambda r: -r[0])
tier1 = [r for p, _, _, r in rows if p >= TIER1_POP]
small = [(f, fa, r) for p, f, fa, r in rows if p < TIER1_POP]
size2 = collections.Counter()
for f, fa, r in small:
    for k in {key(f)} | ({key(fa)} if len(r) > 7 else set()):
        size2[k] += len(json.dumps(r, ensure_ascii=False)) + 1
split = sorted(k for k, n in size2.items() if n > SPLIT_BYTES)
shards: dict[str, list] = collections.defaultdict(list)
for f, fa, r in small:
    names = [f] + ([fa] if len(r) > 7 else [])
    for k in {key(n, 3) if key(n) in split else key(n) for n in names}:
        shards[k].append(r)

OUT.write_text(json.dumps({
    "attribution": "GeoNames cities500, admin1 and admin2 codes (CC-BY 4.0, geonames.org)",
    "zones": [z for z, _ in sorted(zones.items(), key=lambda kv: kv[1])],
    "regions": [r for r, _ in sorted(regions.items(), key=lambda kv: kv[1])],
    "split": split,
    "cities": tier1,
}, ensure_ascii=False, separators=(",", ":")))
if SHARDS.exists():
    shutil.rmtree(SHARDS)
SHARDS.mkdir(parents=True)
for k, rs in shards.items():
    (SHARDS / f"{k}.json").write_text(json.dumps({"cities": rs}, ensure_ascii=False, separators=(",", ":")))

sizes = sorted((p.stat().st_size for p in SHARDS.iterdir()), reverse=True)
print(f"{OUT.name}: {len(tier1)} places, {len(zones)} zones, {len(regions)} regions, "
      f"{OUT.stat().st_size // 1024} KB")
print(f"split by three letters: {' '.join(split)}")
print(f"places/: {len(sizes)} files, {sum(len(v) for v in shards.values())} rows, "
      f"{sum(sizes) // 1024} KB; largest {sizes[0] // 1024} KB, median {sizes[len(sizes) // 2] // 1024} KB")

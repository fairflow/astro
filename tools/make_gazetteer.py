#!/usr/bin/env python3
"""Build the offline place gazetteer from GeoNames cities15000
(CC-BY 4.0, https://www.geonames.org — attribution kept in app About).

Output data/gazetteer.json:
  { "zones": [iana...], "cities": [[name, country, lat, lon, zoneIdx], ...] }
Cities are sorted by population (desc) so the first substring match is the
most likely intended place.

Run:  .venv/bin/python tools/make_gazetteer.py
"""
import csv
import io
import json
import pathlib
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache" / "cities15000.zip"
OUT = ROOT / "data" / "gazetteer.json"
URL = "https://download.geonames.org/export/dump/cities15000.zip"

if not CACHE.exists():
    print("downloading cities15000.zip ...")
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(URL, timeout=300) as r:
        CACHE.write_bytes(r.read())

with zipfile.ZipFile(CACHE) as z:
    raw = z.read("cities15000.txt").decode("utf-8")

zones: dict[str, int] = {}
rows = []
for rec in csv.reader(io.StringIO(raw), delimiter="\t", quoting=csv.QUOTE_NONE):
    name, lat, lon = rec[1], float(rec[4]), float(rec[5])
    country, pop, tz = rec[8], int(rec[14] or 0), rec[17]
    if not tz:
        continue
    zi = zones.setdefault(tz, len(zones))
    rows.append((pop, [name, country, round(lat, 3), round(lon, 3), zi]))

rows.sort(key=lambda r: -r[0])
out = {
    "attribution": "GeoNames cities15000 (CC-BY 4.0, geonames.org)",
    "zones": [z for z, _ in sorted(zones.items(), key=lambda kv: kv[1])],
    "cities": [r for _, r in rows],
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(f"{OUT.name}: {len(rows)} cities, {len(zones)} zones, "
      f"{OUT.stat().st_size // 1024} KB")

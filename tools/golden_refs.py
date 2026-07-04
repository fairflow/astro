#!/usr/bin/env python3
"""Generate golden reference values for the TypeScript compute core.

Uses pyswisseph (AGPL — dev tooling only, never bundled) with the built-in
Moshier model (SEFLG_MOSEPH), so no Swiss Ephemeris data files are required.
Output: test/golden/planets.json, test/golden/houses.json

Run:  .venv/bin/python tools/golden_refs.py
"""
import json
import pathlib
import random

import swisseph as swe

OUT = pathlib.Path(__file__).resolve().parent.parent / "test" / "golden"
OUT.mkdir(parents=True, exist_ok=True)

FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED

BODIES = {
    "sun": swe.SUN, "moon": swe.MOON, "mercury": swe.MERCURY,
    "venus": swe.VENUS, "mars": swe.MARS, "jupiter": swe.JUPITER,
    "saturn": swe.SATURN, "uranus": swe.URANUS, "neptune": swe.NEPTUNE,
    "pluto": swe.PLUTO, "meanNode": swe.MEAN_NODE, "lilith": swe.MEAN_APOG,
}

JD_1900 = 2415020.5
JD_2100 = 2488069.5


def planets() -> None:
    rng = random.Random(20260704)
    samples = []
    for _ in range(60):
        jd = rng.uniform(JD_1900, JD_2100)
        entry = {"jdUt": jd, "bodies": {}}
        for key, ipl in BODIES.items():
            (lon, lat, _dist, dlon, _dlat, _ddist), _ = swe.calc_ut(jd, ipl, FLAGS)
            entry["bodies"][key] = {"lon": lon, "lat": lat, "speed": dlon}
        samples.append(entry)
    (OUT / "planets.json").write_text(json.dumps(samples, indent=1))
    print(f"planets.json: {len(samples)} samples")


PLACES = [
    ("london", 51.5074, -0.1278),
    ("new-york", 40.7128, -74.0060),
    ("quito", 0.0, -78.5),
    ("sydney", -33.87, 151.21),
    ("helsinki", 60.17, 24.94),
    ("reykjavik", 64.15, -21.94),
]
DATES = [
    (1962, 2, 5, 0, 0),
    (1990, 7, 15, 12, 34),
    (2026, 7, 4, 9, 0),
]


def houses() -> None:
    cases = []
    for (name, lat, lon) in PLACES:
        for (y, mo, d, h, mi) in DATES:
            jd = swe.julday(y, mo, d, h + mi / 60.0)
            cusps, ascmc = swe.houses_ex(jd, lat, lon, b"P", FLAGS)
            cases.append({
                "place": name, "lat": lat, "lon": lon, "jdUt": jd,
                "cusps": list(cusps)[:12],
                "asc": ascmc[0], "mc": ascmc[1], "armc": ascmc[2],
            })
    (OUT / "houses.json").write_text(json.dumps(cases, indent=1))
    print(f"houses.json: {len(cases)} cases")


if __name__ == "__main__":
    planets()
    houses()

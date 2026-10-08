#!/usr/bin/env python3
"""Golden reference station times for the planets (Retrograde tab).

A station is the instant geocentric ecliptic-longitude speed changes sign:
SR (station retrograde, + to -) or SD (station direct, - to +). Uses
pyswisseph's Moshier model (AGPL — dev tooling only, never bundled), the
same reference as tools/golden_refs.py.
Output: test/golden/stations.json

Run:  .venv/bin/python tools/golden_stations.py
"""
import json
import pathlib

import swisseph as swe

OUT = pathlib.Path(__file__).resolve().parent.parent / "test" / "golden" / "stations.json"
FLAGS = swe.FLG_MOSEPH | swe.FLG_SPEED
BODIES = {
    "mercury": swe.MERCURY, "venus": swe.VENUS, "mars": swe.MARS,
    "jupiter": swe.JUPITER, "saturn": swe.SATURN, "uranus": swe.URANUS,
    "neptune": swe.NEPTUNE, "pluto": swe.PLUTO,
}
JD_FROM = 2447892.5  # 1990-01-01
JD_TO = 2466154.5    # 2040-01-01


def speed(jd: float, ipl: int) -> float:
    return swe.calc_ut(jd, ipl, FLAGS)[0][3]


def stations(ipl: int) -> list[dict]:
    out = []
    step = 1.0
    ta, sa = JD_FROM, speed(JD_FROM, ipl)
    while ta < JD_TO:
        tb = ta + step
        sb = speed(tb, ipl)
        if (sa > 0) != (sb > 0):
            lo, hi = ta, tb
            for _ in range(40):
                mid = (lo + hi) / 2
                if (speed(mid, ipl) > 0) == (sa > 0):
                    lo = mid
                else:
                    hi = mid
            jd = (lo + hi) / 2
            lon = swe.calc_ut(jd, ipl, FLAGS)[0][0]
            out.append({"kind": "SR" if sa > 0 else "SD", "jdUt": jd, "lon": lon})
        ta, sa = tb, sb
    return out


def main() -> None:
    data = {key: stations(ipl) for key, ipl in BODIES.items()}
    OUT.write_text(json.dumps(data, indent=1))
    print(f"stations.json: " + ", ".join(f"{k} {len(v)}" for k, v in data.items()))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build compact piecewise-Chebyshev ephemeris packs for the asteroids and
Eris from JPL Horizons (public-domain data), plus a held-out validation set.

Frame: geocentric, mean-ecliptic-of-date longitude/latitude, light-time
corrected (Horizons observer-table quantity 31). Differences vs apparent
positions (aberration+nutation, as Swiss Ephemeris reports) are <0.01 deg,
far below astrological relevance; the frame is recorded in pack metadata.

Outputs:
  data/packs/<body>.json        piecewise Chebyshev coefficients
  test/golden/asteroids.json    off-grid holdout samples from Horizons

Raw Horizons responses are cached in tools/cache/ (gitignored).

Run:  .venv/bin/python tools/make_packs.py
"""
import json
import pathlib
import urllib.parse
import urllib.request

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "cache"
PACKS = ROOT / "data" / "packs"
GOLDEN = ROOT / "test" / "golden"
for p in (CACHE, PACKS, GOLDEN):
    p.mkdir(parents=True, exist_ok=True)

API = "https://ssd.jpl.nasa.gov/api/horizons.api"

BODIES = {          # Horizons small-body COMMAND codes
    "ceres": "1;", "pallas": "2;", "juno": "3;", "vesta": "4;",
    "chiron": "2060;", "eris": "136199;",
}

START = "1900-01-01"
STOP = "2100-06-30"
JD_START = 2415020.5  # 1900-01-01 00:00 UT
SEGMENT_DAYS = 128
DEGREE = 16
FIT_ERR_LIMIT = 0.005  # degrees; abort if any segment fits worse


def fetch(body: str, command: str, step: str, tag: str) -> str:
    cache_file = CACHE / f"{body}-{tag}.txt"
    if cache_file.exists():
        return cache_file.read_text()
    params = {
        "format": "text", "OBJ_DATA": "NO", "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER", "CENTER": "'500@399'",
        "COMMAND": f"'{command}'", "START_TIME": f"'{START}'",
        "STOP_TIME": f"'{STOP}'", "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'31'", "ANG_FORMAT": "'DEG'", "CSV_FORMAT": "'YES'",
    }
    url = API + "?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    print(f"  fetching {body} ({tag}) ...")
    with urllib.request.urlopen(url, timeout=600) as r:
        text = r.read().decode()
    if "$$SOE" not in text:
        raise RuntimeError(f"Horizons error for {body}:\n{text[:2000]}")
    cache_file.write_text(text)
    return text


def parse(text: str) -> np.ndarray:
    """Rows of (lon, lat) between $$SOE and $$EOE."""
    rows = []
    inside = False
    for line in text.splitlines():
        if line.startswith("$$SOE"):
            inside = True
            continue
        if line.startswith("$$EOE"):
            break
        if not inside or not line.strip():
            continue
        fields = [f.strip() for f in line.split(",")]
        # CSV: date, sun-flag, moon-flag, ObsEcLon, ObsEcLat, (trailing empty)
        vals = [f for f in fields if f]
        lon, lat = float(vals[-2]), float(vals[-1])
        rows.append((lon, lat))
    return np.array(rows)


def fit_pack(body: str, daily: np.ndarray) -> dict:
    n_days = len(daily) - 1
    count = n_days // SEGMENT_DAYS
    lon = np.degrees(np.unwrap(np.radians(daily[:, 0])))
    lat = daily[:, 1]
    lon_coeffs, lat_coeffs, worst = [], [], 0.0
    for s in range(count):
        i0, i1 = s * SEGMENT_DAYS, s * SEGMENT_DAYS + SEGMENT_DAYS
        x = np.linspace(-1.0, 1.0, SEGMENT_DAYS + 1)
        cl = np.polynomial.chebyshev.chebfit(x, lon[i0:i1 + 1], DEGREE)
        cb = np.polynomial.chebyshev.chebfit(x, lat[i0:i1 + 1], DEGREE)
        worst = max(
            worst,
            float(np.max(np.abs(np.polynomial.chebyshev.chebval(x, cl) - lon[i0:i1 + 1]))),
            float(np.max(np.abs(np.polynomial.chebyshev.chebval(x, cb) - lat[i0:i1 + 1]))),
        )
        lon_coeffs.append([round(float(c), 7) for c in cl])
        lat_coeffs.append([round(float(c), 7) for c in cb])
    if worst > FIT_ERR_LIMIT:
        raise RuntimeError(f"{body}: fit residual {worst:.6f} deg exceeds limit")
    return {
        "body": body,
        "source": "JPL Horizons, quantity 31, fetched via api.horizons",
        "frame": "geocentric mean-ecliptic-of-date, light-time corrected",
        "jdStart": JD_START,
        "segmentDays": SEGMENT_DAYS,
        "count": count,
        "degree": DEGREE,
        "fitMaxErrDeg": round(worst, 7),
        "lon": lon_coeffs,
        "lat": lat_coeffs,
    }


def main() -> None:
    holdout: dict[str, list] = {}
    for body, command in BODIES.items():
        print(body)
        daily = parse(fetch(body, command, "1 d", "daily"))
        pack = fit_pack(body, daily)
        out = PACKS / f"{body}.json"
        out.write_text(json.dumps(pack, separators=(",", ":")))
        print(f"  {out.name}: {pack['count']} segments, "
              f"fitMaxErr {pack['fitMaxErrDeg']} deg, {out.stat().st_size//1024} KB")

        # Off-grid holdout: 3271 h steps never land on the daily fit grid.
        ho = parse(fetch(body, command, "3271 h", "holdout"))
        step_days = 3271 / 24.0
        holdout[body] = [
            {"jdUt": JD_START + i * step_days,
             "lon": float(r[0]), "lat": float(r[1])}
            for i, r in enumerate(ho)
        ]
    (GOLDEN / "asteroids.json").write_text(json.dumps(holdout, indent=1))
    print(f"asteroids.json: holdout for {len(holdout)} bodies")


if __name__ == "__main__":
    main()

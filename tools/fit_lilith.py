#!/usr/bin/env python3
"""Fit a polynomial in TT-centuries to Swiss Ephemeris' mean lunar apogee
(SE_MEAN_APOG), so the TypeScript closed form matches the astrology
reference. Prints coefficients for src/ephemeris/points.ts.

Run:  .venv/bin/python tools/fit_lilith.py
"""
import numpy as np
import swisseph as swe

JD_1900 = 2415020.5
JD_2100 = 2488069.5

jds = np.arange(JD_1900, JD_2100, 5.0)
lons = np.array([
    swe.calc_ut(jd, swe.MEAN_APOG, swe.FLG_MOSEPH)[0][0] for jd in jds
])
# TT centuries since J2000 (deltat gives seconds? pyswisseph: days)
T = np.array([(jd + swe.deltat(jd) - 2451545.0) / 36525.0 for jd in jds])

unwrapped = np.degrees(np.unwrap(np.radians(lons)))
coeffs = np.polynomial.polynomial.polyfit(T, unwrapped, 4)
resid = unwrapped - np.polynomial.polynomial.polyval(T, coeffs)
print("coeffs (c0..c4):", ", ".join(f"{c!r}" for c in coeffs))
print(f"max |residual| = {np.max(np.abs(resid)):.6f} deg")

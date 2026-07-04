#!/usr/bin/env python3
"""Inspect the periodic part of swisseph SE_MEAN_APOG minus the Meeus
mean-apogee polynomial, to reproduce it in TypeScript."""
import numpy as np
import swisseph as swe

jds = np.arange(2415020.5, 2488069.5, 5.0)
lons = np.array([
    swe.calc_ut(jd, swe.MEAN_APOG, swe.FLG_MOSEPH)[0][0] for jd in jds
])
T = np.array([(jd + swe.deltat(jd) - 2451545.0) / 36525.0 for jd in jds])

# Meeus mean apogee = mean perigee + 180
meeus = (83.3532465 + 4069.0137287 * T - 0.01032 * T**2
         - T**3 / 80053 + T**4 / 18999000 + 180.0)
resid = (lons - meeus + 180.0) % 360.0 - 180.0
print(f"resid: mean={resid.mean():.6f} min={resid.min():.6f} max={resid.max():.6f}")

# dominant frequency via FFT (detrended)
r = resid - resid.mean()
freqs = np.fft.rfftfreq(len(r), d=5.0)  # cycles per day
amps = np.abs(np.fft.rfft(r))
k = np.argmax(amps[1:]) + 1
print(f"dominant period: {1/freqs[k]:.3f} days, amplitude~{2*amps[k]/len(r):.6f} deg")

# candidate: 2*(moon mean elongation from apogee)? test lstsq against
# common lunar arguments (degrees):
D_arg = 297.8501921 + 445267.1114034 * T      # mean elongation moon-sun
F_arg = 93.2720950 + 483202.0175233 * T       # argument of latitude
Lp = 218.3164477 + 481267.88123421 * T        # moon mean longitude
apo = meeus                                    # apogee longitude
node = (125.0445479 - 1934.1362891 * T + 0.0020754 * T**2
        + T**3 / 467441 - T**4 / 60616000)
for name, arg in [("2D", 2 * D_arg), ("2F", 2 * F_arg),
                  ("2(Lp-apo)", 2 * (Lp - apo)), ("Lp-apo", Lp - apo),
                  ("2(apo-node)", 2 * (apo - node)),
                  ("apo-node", apo - node)]:
    a = np.radians(arg % 360.0)
    A = np.column_stack([np.cos(a), np.sin(a), np.ones_like(a)])
    sol, res2, *_ = np.linalg.lstsq(A, resid, rcond=None)
    fit = A @ sol
    print(f"{name}: cos={sol[0]:+.6f} sin={sol[1]:+.6f} const={sol[2]:+.6f} "
          f"max|left|={np.max(np.abs(resid-fit)):.6f}")

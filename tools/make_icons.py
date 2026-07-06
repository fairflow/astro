#!/usr/bin/env python3
"""Generate the PWA icon set: the app's Sun glyph (ring + centre dot)
in gold on the app's navy, matching the wheel's visual language.

Run:  .venv/bin/python tools/make_icons.py   (needs pillow)
"""
import pathlib

from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

NAVY = (14, 18, 32, 255)       # --bg
GOLD = (212, 175, 106, 255)    # --gold
LINE = (40, 48, 77, 255)       # --line


def sun_icon(size: int, pad_frac: float, fname: str, rounded: bool) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=NAVY)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=NAVY)

    c = size / 2
    r_outer = size * (0.5 - pad_frac)
    # faint zodiac ring
    d.ellipse([c - r_outer, c - r_outer, c + r_outer, c + r_outer],
              outline=LINE, width=max(2, size // 96))
    # sun ring
    r = r_outer * 0.72
    w = max(4, round(size * 0.055))
    d.ellipse([c - r, c - r, c + r, c + r], outline=GOLD, width=w)
    # centre dot
    rd = r * 0.28
    d.ellipse([c - rd, c - rd, c + rd, c + rd], fill=GOLD)
    img.save(OUT / fname)
    print(f"{fname}: {size}x{size}")


sun_icon(192, 0.10, "icon-192.png", rounded=True)
sun_icon(512, 0.10, "icon-512.png", rounded=True)
# maskable: full-bleed background, artwork inside the 80% safe zone
sun_icon(512, 0.18, "icon-maskable-512.png", rounded=False)
sun_icon(180, 0.10, "apple-touch-icon.png", rounded=False)

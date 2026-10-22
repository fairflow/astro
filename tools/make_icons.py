#!/usr/bin/env python3
"""Generate the PWA icon sets: the app's Sun glyph (ring + centre dot).

- live:    gold on the app's navy, matching the wheel's visual language
           (data/icons/, served by every build)
- local:   navy on a light blue, for the dev server on localhost:8322
           (branding/local/, served in place of data/icons/ by `npm run dev`)
- staging: navy on the staging orange (branding/staging/, copied over
           dist/icons/ by `npm run build:staging`)

The same glyph in each, so a home-screen icon says which copy it opens.

Run:  .venv/bin/python tools/make_icons.py   (needs pillow)
"""
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent

NAVY = (14, 18, 32, 255)       # --bg
GOLD = (212, 175, 106, 255)    # --gold
LINE = (40, 48, 77, 255)       # --line

# (output folder, background, glyph, faint ring)
SETS = {
    "live": (ROOT / "data" / "icons", NAVY, GOLD, LINE),
    "local": (ROOT / "branding" / "local", (150, 192, 238, 255), NAVY, (98, 140, 196, 255)),
    "staging": (ROOT / "branding" / "staging", (217, 130, 43, 255), NAVY, (160, 88, 22, 255)),
}


def sun_icon(out: pathlib.Path, colours, size: int, pad_frac: float, fname: str, rounded: bool) -> None:
    bg, glyph, line = colours
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=bg)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=bg)

    c = size / 2
    r_outer = size * (0.5 - pad_frac)
    # faint zodiac ring
    d.ellipse([c - r_outer, c - r_outer, c + r_outer, c + r_outer],
              outline=line, width=max(2, size // 96))
    # sun ring
    r = r_outer * 0.72
    w = max(4, round(size * 0.055))
    d.ellipse([c - r, c - r, c + r, c + r], outline=glyph, width=w)
    # centre dot
    rd = r * 0.28
    d.ellipse([c - rd, c - rd, c + rd, c + rd], fill=glyph)
    img.save(out / fname)
    print(f"{out.relative_to(ROOT)}/{fname}: {size}x{size}")


for out, *colours in SETS.values():
    out.mkdir(parents=True, exist_ok=True)
    sun_icon(out, colours, 192, 0.10, "icon-192.png", rounded=True)
    sun_icon(out, colours, 512, 0.10, "icon-512.png", rounded=True)
    # maskable: full-bleed background, artwork inside the 80% safe zone
    sun_icon(out, colours, 512, 0.18, "icon-maskable-512.png", rounded=False)
    sun_icon(out, colours, 180, 0.10, "apple-touch-icon.png", rounded=False)

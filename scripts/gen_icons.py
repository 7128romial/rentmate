"""Generate RentMate PWA icons (192 + 512 px) — run once or whenever branding changes.

Usage:
    python scripts/gen_icons.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

CORAL = (255, 68, 88)


def make_icon(size):
    img = Image.new("RGB", (size, size), CORAL)
    draw = ImageDraw.Draw(img)
    # Draw a rounded "house" glyph. Simple enough to not require font files.
    pad = size // 8
    roof = [
        (size // 2, pad),
        (size - pad, size // 2),
        (pad, size // 2),
    ]
    draw.polygon(roof, fill=(255, 255, 255))
    body = [(pad + size // 10, size // 2), (size - pad - size // 10, size - pad)]
    draw.rectangle(body, fill=(255, 255, 255))
    door_w = size // 6
    door_x = size // 2 - door_w // 2
    draw.rectangle(
        [(door_x, size - pad - size // 3), (door_x + door_w, size - pad)],
        fill=CORAL,
    )
    return img


for s in (192, 512):
    path = os.path.join(OUT_DIR, f"icon-{s}.png")
    make_icon(s).save(path, "PNG")
    print(f"wrote {path}")

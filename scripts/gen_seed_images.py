"""Generate placeholder property photos for seed data.

Writes 10 branded property images + 10 thumbs under static/uploads/properties/.
Each property gets 2-3 images with different gradient themes. Run once after
seeding to populate the swipe cards.
"""

import os
import random

from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "properties"
)
THUMB_DIR = os.path.join(OUT_DIR, "thumbs")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

GRADIENTS = [
    ((255, 94, 98), (255, 153, 102)),    # sunset coral
    ((106, 17, 203), (37, 117, 252)),    # purple-blue
    ((67, 206, 162), (24, 90, 157)),     # teal
    ((255, 175, 189), (255, 195, 160)),  # peach
    ((168, 192, 255), (63, 43, 150)),    # night
    ((214, 232, 219), (76, 168, 204)),   # mint sky
    ((255, 216, 155), (25, 84, 123)),    # amber night
    ((238, 156, 167), (255, 221, 225)),  # rose
    ((0, 70, 127), (0, 128, 128)),       # deep ocean
    ((255, 126, 95), (254, 180, 123)),   # warm sand
]


def gradient(size, c1, c2):
    img = Image.new("RGB", size, c1)
    pixels = img.load()
    w, h = size
    for y in range(h):
        t = y / h
        pixels_row = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        for x in range(w):
            pixels[x, y] = pixels_row
    return img


def house_silhouette(img, color=(255, 255, 255, 90)):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    # Rooftop + body of a stylized house on the lower right
    base_x = int(w * 0.55)
    base_y = int(h * 0.55)
    size = int(w * 0.35)
    pad = int(size * 0.1)

    # Roof triangle
    draw.polygon([
        (base_x + size // 2, base_y - int(size * 0.2)),
        (base_x + size + pad, base_y + int(size * 0.2)),
        (base_x - pad, base_y + int(size * 0.2)),
    ], fill=color)
    # Body
    draw.rectangle([
        (base_x, base_y + int(size * 0.2)),
        (base_x + size, base_y + int(size * 0.85))
    ], fill=color)
    # Door
    dw = int(size * 0.18)
    dh = int(size * 0.35)
    draw.rectangle([
        (base_x + size // 2 - dw // 2, base_y + size - dh),
        (base_x + size // 2 + dw // 2, base_y + size),
    ], fill=(255, 255, 255, 140))

    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def make(path, w, h, c1, c2):
    img = gradient((w, h), c1, c2)
    img = house_silhouette(img)
    img = img.filter(ImageFilter.SMOOTH)
    img.save(path, "WEBP", quality=82, method=6)


if __name__ == "__main__":
    random.seed(42)
    for i, grad in enumerate(GRADIENTS):
        # Main + thumb
        name = f"seed_{i:02d}.webp"
        make(os.path.join(OUT_DIR, name), 1600, 1066, *grad)
        make(os.path.join(THUMB_DIR, name), 400, 266, *grad)
        print("wrote", name)
    print(f"done — {len(GRADIENTS)} property photos generated")

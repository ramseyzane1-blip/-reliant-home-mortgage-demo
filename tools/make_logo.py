"""Makes the logo, the icons and the link preview logo from tools/brand/logo-source.webp.

The source is the client's logo on a transparent background. The two header logos are cropped to the
artwork and sized for the 44px header at 3x. In the dark copy the emblem is unchanged (it reads
on the warm charcoal) and the wordmark is recolored light.

    pip install pillow numpy && python3 tools/make_logo.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/brand/logo-source.webp'
OUT = ROOT / 'demo/site/images'
HEIGHT = 132  # 44px header logo at 3x

im = Image.open(SRC).convert('RGBA')
a = np.array(im)
ys, xs = np.where(a[..., 3] > 8)
pad = 4
im = im.crop((xs.min() - pad, ys.min() - pad, xs.max() + 1 + pad, ys.max() + 1 + pad))
im = im.resize((round(im.width * HEIGHT / im.height), HEIGHT), Image.LANCZOS)
im.save(OUT / 'logo.webp', quality=90, method=6)

# The wordmark starts at the first empty column right of the duck's beak.
a = np.array(im)
cols = (a[..., 3] > 8).any(0)
start = next(x for x in range(im.width // 4, im.width) if not cols[x])
d = a.copy()
word = d[:, start:]
split = int(HEIGHT * 0.63)  # between RELIANT and HOME MORTGAGE
word[:split, :, :3] = (208, 224, 210)  # RELIANT, pale green
word[split:, :, :3] = (232, 229, 222)  # HOME MORTGAGE, warm off-white
Image.fromarray(d).save(OUT / 'logo-dark.webp', quality=90, method=6)
print(im.size, 'wordmark from x =', start)

# Icons: the duck and swoosh alone. The favicon is transparent and cropped tight so the duck is
# as large as possible in a tab (it reads on light and dark tab bars); the apple-touch-icon is
# opaque white, since iOS fills transparency with black.
BRAND = ROOT / 'demo/site/brand'
src = Image.open(SRC).convert('RGBA')
s = np.array(src)
emblem_cols = (s[..., 3] > 8).any(0)
gap = next(x for x in range(src.width // 4, src.width) if not emblem_cols[x])
ys, xs = np.where(s[:, :gap, 3] > 8)
emblem = src.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
side = max(emblem.size)


def square(pad, bg):
    n = round(side * (1 + 2 * pad))
    sq = Image.new('RGBA', (n, n), bg)
    sq.alpha_composite(emblem, ((n - emblem.width) // 2, (n - emblem.height) // 2))
    return sq


fav = square(0.0, (0, 0, 0, 0))
for n in (32, 192):
    fav.resize((n, n), Image.LANCZOS).save(BRAND / f'favicon-{n}.png', optimize=True)
square(0.12, (255, 255, 255, 255)).convert('RGB').resize((180, 180), Image.LANCZOS).save(
    BRAND / 'apple-touch-icon.png', optimize=True)

# The link preview (share.png) is green: swap its old logo for the dark-mode copy. The old logo's
# box is refilled with the background gradient, fitted as a plane to the pixels around it.
share = Image.open(BRAND / 'share.png').convert('RGB')
p = np.array(share).astype(np.float64)
box = (76, 55, 565, 205)  # x0, y0, x1, y1 around the logo (old or new, so a re-run is safe)
ring = np.zeros(p.shape[:2], bool)
ring[box[1] - 15:box[3] + 15, box[0] - 15:box[2] + 15] = True
ring[box[1]:box[3], box[0]:box[2]] = False
yy, xx = np.nonzero(ring)
A = np.c_[xx, yy, np.ones_like(xx)]
coef = np.linalg.lstsq(A, p[yy, xx], rcond=None)[0]
gy, gx = np.mgrid[box[1]:box[3], box[0]:box[2]]
p[box[1]:box[3], box[0]:box[2]] = np.c_[gx.ravel(), gy.ravel(), np.ones(gx.size)].dot(coef).reshape(gy.shape + (3,))
share = Image.fromarray(np.clip(p.round(), 0, 255).astype(np.uint8)).convert('RGBA')
mark = Image.open(OUT / 'logo-dark.webp').convert('RGBA')
mark = mark.resize((round(mark.width * 128 / mark.height), 128), Image.LANCZOS)
share.alpha_composite(mark, (86, 68))
share.convert('RGB').save(BRAND / 'share.png', optimize=True)

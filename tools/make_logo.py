"""Makes demo/site/images/logo.webp and logo-dark.webp from tools/brand/logo-source.webp.

The source is the client's logo on a transparent background. Both outputs are cropped to the
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

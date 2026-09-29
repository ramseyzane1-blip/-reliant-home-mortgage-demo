"""Cut the 12 turntable renders out of their cream studio background.

    python3 tools/house_views.py        (needs numpy, opencv-python-headless, pillow)

Reads tools/house-src/house-NN.jpg and writes demo/site/images/house-NN.webp: 1024x1024 with
an alpha channel, so the house, lawn, plinth and ring float on the page in light and dark mode.

How: fit a smooth polynomial to the background, measure each pixel's color distance from it,
and turn that into alpha. The island (house, trees, lawn, plinth) is the one large thick shape.
Outside it only thin structures survive (the ring), which drops the soft floor shadows. Holes
inside the island (bright window glass) are filled. Edge colors are un-mixed from the
background so there is no cream fringe on a dark page.

Then it writes demo/site/images/house-flow.bin: dense optical flow between each pair of
neighboring views, which the turntable uses to morph one view into the next instead of
cross-dissolving (see flows()).
"""
import os
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'house-src')
OUT = os.path.join(ROOT, 'demo', 'site', 'images')
N_VIEWS = 12
SIZE = 1024
el = lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))


def bgfit(a):
    H, W, _ = a.shape
    ys, xs = np.mgrid[0:H, 0:W]
    X = xs / W - .5; Y = ys / H - .5
    B = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y, X ** 3, Y ** 3, X * X * Y, X * Y * Y], -1).reshape(-1, 10)
    f = a.reshape(-1, 3)
    e = np.zeros((H, W), bool); e[:20] = e[-20:] = True; e[:, :20] = e[:, -20:] = True
    m = e.reshape(-1) & (f.sum(1) > 650)
    for it in range(4):
        c, *_ = np.linalg.lstsq(B[m][::7], f[m][::7], rcond=None)
        bg = B @ c
        d = np.linalg.norm(f - bg, axis=1)
        m = d < (6 if it < 3 else 4)
    return bg.reshape(H, W, 3)


def fill_small_holes(m, maxa):
    n, lab, st, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), connectivity=4)
    small = np.zeros(n, bool); small[1:] = st[1:, 4] < maxa
    return m | small[lab]


def keep_big(m, mina):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, 4] >= mina
    return keep[lab]


def cutout(a, lo=9, hi=34, core=30):
    bg = bgfit(a)
    d = cv2.GaussianBlur(np.linalg.norm(a - bg, axis=2), (0, 0), .7)
    thick = cv2.morphologyEx((d > core).astype(np.uint8), cv2.MORPH_OPEN, el(41))
    n, lab, st, _ = cv2.connectedComponentsWithStats(thick, connectivity=8)
    island = lab == (1 + np.argmax(st[1:, 4]))
    islandR = cv2.dilate(island.astype(np.uint8), el(31)) > 0
    tophat = d - cv2.morphologyEx(d, cv2.MORPH_OPEN, el(45))
    d = np.where(islandR, d, np.maximum(tophat - 6, 0))
    obj = keep_big(d > core, 1500)
    n, lab, st, _ = cv2.connectedComponentsWithStats(obj.astype(np.uint8), connectivity=8)
    hit = np.unique(lab[island & obj]); hit = hit[hit > 0]
    obj = obj | fill_small_holes(np.isin(lab, hit) & islandR, 6000)
    reg = cv2.GaussianBlur(cv2.dilate(obj.astype(np.uint8), el(9)).astype(np.float32), (0, 0), 1.2)
    t = np.clip((d - lo) / (hi - lo), 0, 1)
    al = np.where(cv2.erode(obj.astype(np.uint8), np.ones((3, 3))) > 0, 1, t * t * (3 - 2 * t)) * reg
    # the renders crop the top of the ring; fade it out instead of a hard cut
    H = a.shape[0]; ramp = np.clip(np.arange(H) / (H * .06), 0, 1); al *= (ramp * ramp * (3 - 2 * ramp))[:, None]
    A = al[..., None]
    F = np.where(A > .02, (a - (1 - A) * bg) / np.maximum(A, .02), a).clip(0, 255)
    return np.dstack([F, al * 255]).round().clip(0, 255).astype(np.uint8)


R = 512    # flow is computed at this resolution
GRID = 41  # and stored on a GRID x GRID vertex grid (the turntable mesh uses the same grid)
FLOW_SCALE = 16384  # int16 value = displacement in texture units * FLOW_SCALE


def _dis(A, B):
    d = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    d.setFinestScale(0); d.setGradientDescentIterations(25); d.setVariationalRefinementIterations(5)
    d.setPatchSize(12); d.setPatchStride(4)
    return d.calc(A, B, None)


def _sample(img, X, Y):
    return cv2.remap(img, X.astype(np.float32), Y.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def _warp(F, img):
    ys, xs = np.mgrid[0:R, 0:R].astype(np.float32)
    return cv2.remap(img, xs + F[..., 0], ys + F[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def _smooth(F, w, sig):
    num = cv2.GaussianBlur(F * w[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(w, (0, 0), sig)
    return num / np.maximum(den, 1e-4)[..., None], den


def pair_flow(a, b, fab, fba):
    """Flow a->b in pixels, trusted only where it is forward-backward consistent and on the
    house. Poorly matched areas (the far views are ~45 degrees apart) fall back to a much
    smoother field, so the morph never tears; there the blend does the rest."""
    err = np.linalg.norm(fab + _warp(fab, fba), axis=2)
    w = np.exp(-(err / 3) ** 2) * np.clip(a[..., 3] * 2, 0, 1) * np.clip(_warp(fab, b[..., 3]), 0, 1) + 1e-3
    fine, den = _smooth(fab, w, R / GRID * 1.5)
    coarse, _ = _smooth(fab, w, R / GRID * 6)
    c = np.clip(den / .35, 0, 1)[..., None]
    return fine * c + coarse * (1 - c)


def flows(views):
    """For each k: flow k->k+1 then k+1->k, sampled at the mesh vertices, int16."""
    small = [cv2.resize(v, (R, R), interpolation=cv2.INTER_AREA).astype(np.float32) / 255 for v in views]
    gray = [cv2.cvtColor(((s[..., :3] * s[..., 3:] + np.array([.93, .9, .86]) * (1 - s[..., 3:])) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY) for s in small]
    g = (np.arange(GRID) / (GRID - 1)) * R - .5
    X, Y = np.meshgrid(g, g)
    out = []
    for k in range(len(views)):
        j = (k + 1) % len(views)
        fab, fba = _dis(gray[k], gray[j]), _dis(gray[j], gray[k])
        for a, b, f1, f2 in ((small[k], small[j], fab, fba), (small[j], small[k], fba, fab)):
            F = pair_flow(a, b, f1, f2)
            v = np.dstack([_sample(F[..., 0], X, Y), _sample(F[..., 1], X, Y)]) / R
            out.append(np.round(v * FLOW_SCALE).clip(-32767, 32767).astype('<i2'))
        print('flow', k, '->', j, 'mean px', round(float(np.abs(fab).mean()), 1))
    return np.stack(out)


def main():
    views = []
    for i in range(N_VIEWS):
        a = np.asarray(Image.open(os.path.join(SRC, f'house-{i:02d}.jpg')).convert('RGB')).astype(np.float32)
        rgba = cutout(a)
        im = Image.fromarray(rgba, 'RGBA').resize((SIZE, SIZE), Image.LANCZOS)
        im.save(os.path.join(OUT, f'house-{i:02d}.webp'), quality=86, method=6, alpha_quality=90)
        views.append(np.asarray(im))
        print('wrote', f'house-{i:02d}.webp')
    flows(views).tofile(os.path.join(OUT, 'house-flow.bin'))
    print('wrote house-flow.bin')


if __name__ == '__main__':
    main()

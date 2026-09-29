"""Turn the Blender turntable renders into what the hero loads.

    python3 tools/blender/fetch_assets.py
    python3 tools/blender/house_scene.py frames 36 /tmp/turn 896 40     (about an hour on 4 CPU cores)
    python3 tools/house_views.py /tmp/turn                              (needs numpy, opencv-python-headless, pillow)

One step: writes demo/site/images/turn/turn-NNN.webp (one per 360/N degrees, transparent
background; the browser resizes them to the canvas), sets HOUSE_VIEWS in demo/site/js/app.js to
match, and writes
demo/site/images/turn/flow.bin: dense optical flow between each pair of neighboring frames, which
the turntable uses to morph one frame into the next so the turn looks continuous at any speed.
"""
import os, re, sys, glob
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'demo', 'site', 'images')
R = 512    # flow is computed at this resolution
GRID = 33  # and stored on a GRID x GRID vertex grid (the turntable reads GRID from the file size)
FLOW_SCALE = 16384  # int16 value = displacement in texture units * FLOW_SCALE


def _dis(A, B):
    d = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    d.setFinestScale(0); d.setGradientDescentIterations(25); d.setVariationalRefinementIterations(5)
    d.setPatchSize(12); d.setPatchStride(4)
    return d.calc(A, B, None)


def _warp(F, img):
    ys, xs = np.mgrid[0:R, 0:R].astype(np.float32)
    return cv2.remap(img, xs + F[..., 0], ys + F[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def _smooth(F, w, sig):
    num = cv2.GaussianBlur(F * w[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(w, (0, 0), sig)
    return num / np.maximum(den, 1e-4)[..., None], den


def pair_flow(a, b, fab, fba):
    """Flow a->b in pixels, trusted only where it is forward-backward consistent and on the model;
    elsewhere it falls back to a smoother field so the morph never tears."""
    err = np.linalg.norm(fab + _warp(fab, fba), axis=2)
    w = np.exp(-(err / 3) ** 2) * np.clip(a[..., 3] * 2, 0, 1) * np.clip(_warp(fab, b[..., 3]), 0, 1) + 1e-3
    fine, den = _smooth(fab, w, R / GRID * 1.5)
    coarse, _ = _smooth(fab, w, R / GRID * 6)
    c = np.clip(den / .35, 0, 1)[..., None]
    return fine * c + coarse * (1 - c)


def flows(views):
    """For each k: flow k->k+1 then k+1->k, sampled at the mesh vertices, int16."""
    small = [cv2.resize(v, (R, R), interpolation=cv2.INTER_AREA).astype(np.float32) / 255 for v in views]
    gray = [cv2.cvtColor(((s[..., :3] * s[..., 3:] + .9 * (1 - s[..., 3:])) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY) for s in small]
    g = (np.arange(GRID) / (GRID - 1)) * R - .5
    X, Y = [m.astype(np.float32) for m in np.meshgrid(g, g)]
    out = []
    for k in range(len(views)):
        j = (k + 1) % len(views)
        fab, fba = _dis(gray[k], gray[j]), _dis(gray[j], gray[k])
        for a, b, f1, f2 in ((small[k], small[j], fab, fba), (small[j], small[k], fba, fab)):
            F = pair_flow(a, b, f1, f2)
            v = np.dstack([cv2.remap(F[..., c], X, Y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE) for c in (0, 1)]) / R
            out.append(np.round(v * FLOW_SCALE).clip(-32767, 32767).astype('<i2'))
        print('flow', k, '->', j, 'mean px', round(float(np.abs(fab).mean()), 1))
    return np.stack(out)


def main(src):
    files = sorted(glob.glob(os.path.join(src, 'turn-*.png')))
    # Blender turns the house counter-clockwise by i*step; the site numbers views the other way so
    # that dragging to the right turns the house to the right
    files = [files[(len(files) - j) % len(files)] for j in range(len(files))]
    os.makedirs(os.path.join(OUT, 'turn'), exist_ok=True)
    views = []
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGBA')
        im.save(os.path.join(OUT, 'turn', 'turn-%03d.webp' % i), quality=80, method=6, alpha_quality=80)
        views.append(np.asarray(im))
    for old in glob.glob(os.path.join(OUT, 'turn', 'turn-*.webp')):   # stale frames from a longer set
        if int(re.findall(r'(\d+)\.webp$', old)[0]) >= len(files): os.remove(old)
    print('wrote', len(files), 'frames')
    flows(views).tofile(os.path.join(OUT, 'turn', 'flow.bin'))
    print('wrote turn/flow.bin')
    app = os.path.join(ROOT, 'demo', 'site', 'js', 'app.js')
    js = open(app).read()
    views = "const HOUSE_VIEWS=Array.from({length:%d},(_,i)=>({f:`images/turn/turn-${String(i).padStart(3,'0')}.webp`,a:i*%s}));" % (
        len(files), ('%g' % (360 / len(files))))
    js, k = re.subn(r"const HOUSE_VIEWS=[^\n]*;", lambda m: views, js, count=1)
    assert k == 1, 'HOUSE_VIEWS not found in app.js'
    open(app, 'w').write(js)
    print('set HOUSE_VIEWS to', len(files), 'views')


if __name__ == '__main__':
    main(sys.argv[1])

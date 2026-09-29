"""Turn the Blender turntable renders into what the hero loads.

    python3 tools/blender/fetch_assets.py
    python3 tools/blender/house_scene.py frames 36 /tmp/turn 960 64     (about 80 minutes on 4 CPU cores)
    python3 tools/house_views.py /tmp/turn                              (needs numpy, opencv-python-headless, pillow)

One step, into demo/site/images/turn/:
- fixed.webp: everything that looks the same in every frame (most of the ring and the front of the
  round plinth). The page draws it on top, still, so the morph never drags it along.
- turn-NNN.webp: the frames with those fixed pixels cut out, one per 360/N degrees, 960px, plus
  sm/ copies at 768px for phones (the browser resizes either to the canvas).
- flow.bin: dense optical flow between each pair of neighboring frames (computed on the moving
  parts only), which the turntable uses to morph one frame into the next.
Then it stamps a content version (?v=) on every turn/ URL in index.html and js/app.js, so browsers
never mix cached frames from an older render, and sets HOUSE_VIEWS to the frame count.
"""
import os, re, sys, glob, hashlib
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'demo', 'site', 'images')
R = 512    # flow is computed at this resolution
SMALL = 768  # phone copies in turn/sm/
FIXED_TOL = 6 / 255  # a pixel is fixed if it never differs from the median frame by more than this
GRID = int(os.environ.get('GRID', 33))  # stored on a GRID x GRID vertex grid (in the file header). 49 and 65 morph a
# little better (ghosting 12.8 and 12.0 vs 14.1; a plain cross-fade is ~22) but the extra triangles cost frame time
# flow.bin: b'FLW1', uint16 field count, uint16 GRID, one float32 scale per field, then int8 values:
# displacement in texture units = value * scale. Fields: for each k, k->k+1 then k+1->k.


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


def pair_flow(a, b, fab, fba, still=None):
    """Flow a->b in pixels, trusted only where it is forward-backward consistent and on the model;
    elsewhere it falls back to a smoother field so the morph never tears. Pixels in `still` (the
    fixed layer) count as known zero motion, so nothing next to them gets pulled away from them."""
    err = np.linalg.norm(fab + _warp(fab, fba), axis=2)
    w = np.exp(-(err / 3) ** 2) * np.clip(a[..., 3] * 2, 0, 1) * np.clip(_warp(fab, b[..., 3]), 0, 1) + 1e-3
    if still is not None:
        fab = np.where(still[..., None], 0, fab); w = np.where(still, 1.0, w)
    fine, den = _smooth(fab, w, R / GRID * 1.5)
    coarse, _ = _smooth(fab, w, R / GRID * 6)
    c = np.clip(den / .35, 0, 1)[..., None]
    return fine * c + coarse * (1 - c)


def flows(views, fixed=None):
    """For each k: flow k->k+1 then k+1->k, sampled at the mesh vertices (float32, texture units)."""
    still = cv2.resize(fixed.astype(np.uint8), (R, R), interpolation=cv2.INTER_NEAREST) > 0 if fixed is not None else None
    small = [cv2.resize(v, (R, R), interpolation=cv2.INTER_AREA).astype(np.float32) / 255 for v in views]
    gray = [cv2.cvtColor(((s[..., :3] * s[..., 3:] + .9 * (1 - s[..., 3:])) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY) for s in small]
    g = (np.arange(GRID) / (GRID - 1)) * R - .5
    X, Y = [m.astype(np.float32) for m in np.meshgrid(g, g)]
    out = []
    for k in range(len(views)):
        j = (k + 1) % len(views)
        fab, fba = _dis(gray[k], gray[j]), _dis(gray[j], gray[k])
        for a, b, f1, f2 in ((small[k], small[j], fab, fba), (small[j], small[k], fba, fab)):
            F = pair_flow(a, b, f1, f2, still)
            v = np.dstack([cv2.remap(F[..., c], X, Y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE) for c in (0, 1)]) / R
            out.append(v.astype(np.float32))
        print('flow', k, '->', j, 'mean px', round(float(np.abs(fab).mean()), 1))
    return np.stack(out)


def write_flow(fields, path):
    scales = np.maximum(np.abs(fields).reshape(len(fields), -1).max(1), 1e-6) / 127
    q = np.round(fields / scales[:, None, None, None]).clip(-127, 127).astype(np.int8)
    with open(path, 'wb') as f:
        f.write(b'FLW1'); f.write(np.array([len(fields), GRID], '<u2').tobytes())
        f.write(scales.astype('<f4').tobytes()); f.write(q.tobytes())
    err = np.abs(q * scales[:, None, None, None] - fields).max() * 960
    print('flow.bin: %d fields, grid %d, %d bytes, max rounding error %.2f px at 960' % (len(fields), GRID, os.path.getsize(path), err))


def save(im, name, alpha=(80, 70)):
    im.save(os.path.join(OUT, 'turn', name), quality=80, method=6, alpha_quality=alpha[0])
    # a 768px copy for phones, whose canvas is at most ~720 device pixels wide (36% smaller; at
    # that size quality 72 looks the same as 80)
    im.resize((SMALL, SMALL), Image.LANCZOS).save(os.path.join(OUT, 'turn', 'sm', name), quality=72, method=6, alpha_quality=alpha[1])


def main(src):
    files = sorted(glob.glob(os.path.join(src, 'turn-*.png')))
    # Blender turns the house counter-clockwise by i*step; the site numbers views the other way so
    # that dragging to the right turns the house to the right
    files = [files[(len(files) - j) % len(files)] for j in range(len(files))]
    os.makedirs(os.path.join(OUT, 'turn', 'sm'), exist_ok=True)
    F = np.stack([np.asarray(Image.open(f).convert('RGBA')) for f in files])
    med = np.median(F, 0)
    fixed = (F[..., 3] > 5).all(0) & (np.abs(F.astype(np.float32) - med).max(0).max(-1) <= FIXED_TOL * 255)
    print('fixed pixels (ring, plinth front):', int(fixed.sum()))
    # exact alpha on the fixed layer: a soft edge there would show as a seam against the frames
    save(Image.fromarray(np.where(fixed[..., None], med, 0).astype(np.uint8), 'RGBA'), 'fixed.webp', alpha=(100, 100))
    # the frames keep their own pixels in a 2px band inside the fixed area, so the two layers overlap
    # and no seam opens where they meet after compression and resizing
    # (but not where the fixed layer is itself semi-transparent, like the ring's outer edge, where
    # two stacked layers would come out too opaque)
    cut = (cv2.erode(fixed.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) > 0) | (fixed & (med[..., 3] < 250))
    views = []
    for i in range(len(F)):
        fr = np.where(cut[..., None], 0, F[i]).astype(np.uint8)
        save(Image.fromarray(fr, 'RGBA'), 'turn-%03d.webp' % i)
        views.append(fr)
    for old in glob.glob(os.path.join(OUT, 'turn', 'turn-*.webp')) + glob.glob(os.path.join(OUT, 'turn', 'sm', 'turn-*.webp')):   # stale frames from a longer set
        if int(re.findall(r'(\d+)\.webp$', old)[0]) >= len(files): os.remove(old)
    print('wrote', len(files), 'frames')
    write_flow(flows(views, fixed), os.path.join(OUT, 'turn', 'flow.bin'))
    # content version for cache busting
    h = hashlib.sha1()
    for f in sorted(glob.glob(os.path.join(OUT, 'turn', '**', '*.*'), recursive=True)):
        h.update(open(f, 'rb').read())
    ver = h.hexdigest()[:8]
    app = os.path.join(ROOT, 'demo', 'site', 'js', 'app.js')
    js = open(app, encoding='utf-8').read()
    line = ("const HOUSE_VIEWS=Array.from({length:%d},(_,i)=>{const p=String(i).padStart(3,'0');"
            "return {f:`images/turn/turn-${p}.webp`,s:`images/turn/sm/turn-${p}.webp`,a:i*%s};});") % (len(files), '%g' % (360 / len(files)))
    js, k = re.subn(r"const HOUSE_VIEWS=[^\n]*;", lambda m: line, js, count=1)
    assert k == 1, 'HOUSE_VIEWS not found in app.js'
    for path, text in ((app, js), (os.path.join(ROOT, 'demo', 'site', 'index.html'), None)):
        text = text if text is not None else open(path, encoding='utf-8').read()
        text = re.sub(r"(images/turn/[^\"'`?\s,]+?\.(?:webp|bin))(\?v=[0-9a-f]+)?", lambda m: m.group(1) + '?v=' + ver, text)
        open(path, 'w', encoding='utf-8').write(text)
    print('set HOUSE_VIEWS to', len(files), 'views; version', ver)


if __name__ == '__main__':
    main(sys.argv[1])

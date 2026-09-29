"""Turn the Blender turntable renders into what the hero loads.

    python3 tools/blender/fetch_assets.py
    python3 tools/blender/house_scene.py frames 36 /tmp/turn 960 64     (about 80 minutes on 4 CPU cores)
    python3 tools/blender/house_scene.py depth 960 /tmp/depth ROT1 ROT2 ...   (every frame's rotation, about 40 s each)
    python3 tools/blender/house_scene.py ringdepth 960 /tmp/depth/ring.exr   (the ring alone: it stays still)
    python3 tools/house_views.py /tmp/turn /tmp/mid /tmp/depth          (needs numpy, opencv-python-headless, pillow, OpenEXR)
    python3 tools/house_views.py depth /tmp/depth                       (only the depth, for the frames already on the site)

/tmp/mid holds optional in-between renders (house_scene.py angles mode, files *_ROT.png) for the
sides and back; HOUSE_VIEWS angles need not be evenly spaced.

One step, into demo/site/images/turn/:
- fixed.webp: everything that looks the same in every frame (most of the ring and the front of the
  round plinth). The page draws it on top, still, so turning never drags it along.
- turn-NNN.webp: the frames with those fixed pixels cut out, one per 360/N degrees, 960px, plus
  sm/ copies at 768px for phones (the browser resizes either to the canvas).
- depth-front.bin, depth-rest.bin: each frame's depth from Blender on a DGRID x DGRID mesh, so the
  page can turn a frame in 3D to any angle between frames. The front file holds the views within
  FRONT degrees of the front (the idle sway and a first drag) and loads with the front frames.
Then it stamps a content version (?v=) on every turn/ URL in index.html and js/app.js, so browsers
never mix cached frames from an older render, and sets HOUSE_VIEWS to the frame count.
"""
import os, re, sys, glob, hashlib
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'demo', 'site', 'images')
SMALL = 768  # phone copies in turn/sm/
FIXED_TOL = 6 / 255  # a pixel is fixed if it never differs from the median frame by more than this
FRONT = 40  # degrees: views this close to the front go in depth-front.bin (loaded with the front frames)
DGRID = 161  # depth mesh: DGRID x DGRID vertices over the frame (about 6px apart at 960)
# depth-*.bin: b'DEP1', uint16 view count, uint16 DGRID, then per view uint16 index, float32 near,
# float32 far (meters along the camera axis), then uint8 depth per vertex per view (0 = near,
# 254 = far, 255 = the ring, which does not turn). Background (no surface) takes the depth of the
# nearest surface, so silhouettes against the page never tear.


def exr_depth(path):
    import OpenEXR
    f = OpenEXR.File(path)
    part = next(p for p in f.parts if 'Depth' in str(p.name))
    Z = np.array(part.channels[next(k for k in part.channels if k.endswith('.Z'))].pixels, np.float32)
    return Z.reshape(Z.shape[-2:]) if Z.ndim > 2 else Z


def view_depth(exr, ring=None):
    """planar depth (Cycles Z pass) of one render, cleaned and sampled at the mesh vertices, and
    which vertices show the ring (ring: the depth of the ring rendered alone)"""
    Z = exr_depth(exr)
    bg = Z > 1e4
    st = np.zeros(Z.shape, bool) if ring is None else (ring < 1e4) & (np.abs(Z - ring) < .05)
    # background: depth (and ring or not) of the nearest surface
    _, lab = cv2.distanceTransformWithLabels(bg.astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    src = np.zeros(lab.max() + 1, np.float32); sst = np.zeros(lab.max() + 1, bool)
    src[lab[~bg]] = Z[~bg]; sst[lab[~bg]] = st[~bg]
    Z = np.where(bg, src[lab], Z); st = np.where(bg, sst[lab], st)
    # one-sample depth is noisy in leaves and grass: a median, then sample at the vertices
    Z = cv2.medianBlur(Z, 5)
    W = Z.shape[0]; g = np.clip(np.round(np.linspace(0, W - 1, DGRID)).astype(int), 0, W - 1)
    return Z[np.ix_(g, g)], st[np.ix_(g, g)]


def write_depth(angles, ddir):
    """depth-front.bin (views within FRONT degrees of the front) and depth-rest.bin"""
    near = lambda a: abs((a + 180) % 360 - 180) <= FRONT
    rp = os.path.join(ddir, 'ring.exr'); ring = exr_depth(rp) if os.path.exists(rp) else None
    D = [view_depth(os.path.join(ddir, 'depth_%g.exr' % ((360 - a) % 360)), ring) for a in angles]
    for name, idx in (('front', [i for i, a in enumerate(angles) if near(a)]), ('rest', [i for i, a in enumerate(angles) if not near(a)])):
        path = os.path.join(OUT, 'turn', 'depth-%s.bin' % name)
        with open(path, 'wb') as f:
            f.write(b'DEP1'); f.write(np.array([len(idx), DGRID], '<u2').tobytes())
            q = []
            for i in idx:
                z, st = D[i]; lo, hi = float(z[~st].min()), float(z[~st].max())
                f.write(np.array([i], '<u2').tobytes()); f.write(np.array([lo, hi], '<f4').tobytes())
                q.append(np.where(st, 255, np.round((np.clip(z, lo, hi) - lo) / max(hi - lo, 1e-6) * 254)).astype(np.uint8))
            f.write(np.stack(q).tobytes())
        print('%s: %d views, grid %d, %d bytes' % (os.path.basename(path), len(idx), DGRID, os.path.getsize(path)))


def save(im, name, alpha=(80, 70)):
    im.save(os.path.join(OUT, 'turn', name), quality=80, method=6, alpha_quality=alpha[0])
    # a 768px copy for phones, whose canvas is at most ~720 device pixels wide (36% smaller; at
    # that size quality 72 looks the same as 80)
    im.resize((SMALL, SMALL), Image.LANCZOS).save(os.path.join(OUT, 'turn', 'sm', name), quality=72, method=6, alpha_quality=alpha[1])


def main(src, extra=None, ddir=None):
    """src: Blender frames turn-NNN.png, evenly spaced. extra: optional folder of in-between renders
    named *_ROT.png (ROT = Blender rotation in degrees, from house_scene.py angles mode), added
    on the sides and back. ddir: depth renders (house_scene.py depth mode), depth_ROT.exr."""
    uni = sorted(glob.glob(os.path.join(src, 'turn-*.png')))
    shots = [((360 - i * 360 / len(uni)) % 360, f) for i, f in enumerate(uni)]
    # Blender turns the house counter-clockwise; the site angle runs the other way so that
    # dragging to the right turns the house to the right
    if extra:
        for f in glob.glob(os.path.join(extra, '*_*.png')):
            shots.append(((360 - float(re.findall(r'_([\d.]+)\.png$', f)[0])) % 360, f))
    shots.sort()
    angles = [a for a, _ in shots]; files = [f for _, f in shots]
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
    if ddir: write_depth(angles, ddir)
    for old in ('flow.bin', 'flow-front.bin', 'flow-rest.bin'):   # the optical flow these replaced
        if os.path.exists(os.path.join(OUT, 'turn', old)): os.remove(os.path.join(OUT, 'turn', old))
    stamp(angles)


def stamp(angles):
    """Content version (?v=) on every turn/ URL for cache busting, and HOUSE_VIEWS in app.js."""
    h = hashlib.sha1()
    for f in sorted(glob.glob(os.path.join(OUT, 'turn', '**', '*.*'), recursive=True)):
        h.update(open(f, 'rb').read())
    ver = h.hexdigest()[:8]
    app = os.path.join(ROOT, 'demo', 'site', 'js', 'app.js')
    js = open(app, encoding='utf-8').read()
    line = ("const HOUSE_VIEWS=[%s].map((a,i)=>{const p=String(i).padStart(3,'0');"
            "return {f:`images/turn/turn-${p}.webp`,s:`images/turn/sm/turn-${p}.webp`,a};});") % ','.join('%g' % a for a in angles)
    js, k = re.subn(r"const HOUSE_VIEWS=[^\n]*;", lambda m: line, js, count=1)
    assert k == 1, 'HOUSE_VIEWS not found in app.js'
    for path, text in ((app, js), (os.path.join(ROOT, 'demo', 'site', 'index.html'), None)):
        text = text if text is not None else open(path, encoding='utf-8').read()
        text = re.sub(r"(images/turn/[^\"'`?\s,]+?\.(?:webp|bin))(\?v=[0-9a-f]+)?", lambda m: m.group(1) + '?v=' + ver, text)
        open(path, 'w', encoding='utf-8').write(text)
    print('set HOUSE_VIEWS to', len(angles), 'views; version', ver)


def current_angles():
    js = open(os.path.join(ROOT, 'demo', 'site', 'js', 'app.js'), encoding='utf-8').read()
    return [float(a) for a in re.search(r'HOUSE_VIEWS=\[([^\]]+)\]', js).group(1).split(',')]


if __name__ == '__main__':
    if sys.argv[1] == 'depth':   # only the depth files, for the frames already on the site
        write_depth(current_angles(), sys.argv[2]); stamp(current_angles())
    else:
        main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None, sys.argv[3] if len(sys.argv) > 3 else None)

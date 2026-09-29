"""Depth for the hero turntable: replaces the hand-made depth model (house plane + sloped lawn)
with a real relief per view, so trees, the porch and the roof turn with correct parallax.

Runs Depth Anything V2 (Base, ONNX) on house-00..12, normalizes each so the house facade sits at
z = 0 and the front rim of the plinth at z = ZR (the model's lawn height), and samples z on the
turntable's (N+1) x (N+1) mesh. Output: demo/site/images/house-depth.bin, Uint8 per vertex,
z = q / 255 * (ZMAX - ZMIN) + ZMIN, one grid per view in HOUSE_VIEWS order.

Usage (from the repo root), with the model from tools/walk_depth.py:
    python3 tools/turntable_depth.py /tmp/da2b.onnx
"""
import os, sys
import cv2, numpy as np, onnxruntime as ort

IMG = os.path.join(os.path.dirname(__file__), '..', 'demo', 'site', 'images')
N = 90                  # mesh cells per side (Turntable N in js/engines.js)
ZR, ZMIN, ZMAX = 0.62, -0.4, 0.8
BACK = -0.1      # nothing is pushed further back than this (the backdrop stays near the house plane: no streaks behind trees)

if __name__ == '__main__':
    sess = ort.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider'])
    blob = bytearray()
    for k in range(13):
        im = cv2.imread(os.path.join(IMG, 'house-%02d.jpg' % k))
        x = cv2.resize(im[:, :, ::-1].astype(np.float32) / 255, (644, 644), interpolation=cv2.INTER_CUBIC)
        x = ((x - [.485, .456, .406]) / [.229, .224, .225]).transpose(2, 0, 1)[None].astype(np.float32)
        d = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
        h, w = d.shape
        ref = np.median(d[int(h * .22):int(h * .5), int(w * .3):int(w * .7)])      # the house
        near = np.percentile(d[int(h * .55):int(h * .68), int(w * .15):int(w * .85)], 97)  # plinth front rim
        z = np.clip(ZR * (d - ref) / max(near - ref, 1e-3), BACK, ZMAX)
        # real relief only on the house and its plinth; the decorative ring and backdrop stay flat
        yy, xx = np.mgrid[0:h, 0:w] / np.array([h, w])[:, None, None]
        r = np.hypot((xx - .5) / .41, (yy - .43) / .33)
        z *= np.clip((1.12 - r) / .2, 0, 1)
        z = cv2.GaussianBlur(z, (0, 0), 3.5)
        g = cv2.resize(z, (N + 1, N + 1), interpolation=cv2.INTER_AREA)
        blob += np.round((g - ZMIN) / (ZMAX - ZMIN) * 255).clip(0, 255).astype(np.uint8).tobytes()
        print('house-%02d' % k, 'z range %.2f..%.2f' % (g.min(), g.max()), file=sys.stderr)
    open(os.path.join(IMG, 'house-depth.bin'), 'wb').write(bytes(blob))

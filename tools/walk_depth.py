"""Depth for the walk-through: turns each render into a 3D relief the camera can move through.

Runs Depth Anything V2 (Base, ONNX) on every walk image, normalizes it so the shot's anchor
object (the door or the fireplace, Walk.SHOTS in js/engines.js) sits at depth 1, and samples
1/depth on a mesh grid. The site draws each shot as that mesh, so moving the camera forward is a
real dolly (near things sweep past faster) and moving the head gives real parallax.

Output: demo/site/images/walk-depth.bin (Uint8 = 1/depth * 40, one grid per shot, in SHOTS order)
and the JSON index for engines.js on stdout.

Usage (from the repo root):
    pip install onnxruntime opencv-python-headless numpy
    curl -L -o /tmp/da2b.onnx https://huggingface.co/onnx-community/depth-anything-v2-base/resolve/main/onnx/model.onnx
    python3 tools/walk_depth.py /tmp/da2b.onnx
"""
import json, os, sys
import cv2, numpy as np, onnxruntime as ort

IMG = os.path.join(os.path.dirname(__file__), '..', 'demo', 'site', 'images')
SHOTS = [  # name, anchor rectangle (same as Walk.SHOTS)
    ('approach-2', [640, 302, 809, 693]), ('approach-3', [628, 255, 817, 719]),
    ('approach-4', [562, 167, 875, 839]), ('door', [503, 97, 899, 969]), ('door-open', [711, 499, 826, 598]),
    ('inside-1', [721, 369, 849, 479]), ('inside-2', [696, 431, 852, 565]), ('inside-3', [729, 457, 919, 620]),
    ('inside-4', [660, 461, 853, 627])]
CELL = 9          # image pixels per mesh cell
NEAR = 0.42       # the nearest things (98th percentile) sit at this depth; the anchor is at 1
FAR = 1 / 0.15    # nothing is farther than this
BACK = 0.4        # depth behind the anchor is scaled by this
SOFT = 5          # blur (image pixels) on 1/depth

def disparity(sess, im):
    h, w = im.shape[:2]; H = 644; W = int(round(w / h * H / 14)) * 14
    x = cv2.resize(im[:, :, ::-1].astype(np.float32) / 255, (W, H), interpolation=cv2.INTER_CUBIC)
    x = ((x - [.485, .456, .406]) / [.229, .224, .225]).transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    return cv2.resize(d, (w, h), interpolation=cv2.INTER_CUBIC)

if __name__ == '__main__':
    sess = ort.InferenceSession(sys.argv[1], providers=['CPUExecutionProvider'])
    blob, index = bytearray(), {}
    for name, a in SHOTS:
        im = cv2.imread(os.path.join(IMG, name + '.jpg')); h, w = im.shape[:2]
        d = disparity(sess, im)
        da = float(np.median(d[a[1]:a[3], a[0]:a[2]]))
        lo, hi = np.percentile(d, [1, 98])
        k = (1 / NEAR - 1) / max((hi - da) / (hi - lo), 0.05)
        inv = np.clip(1 + k * (d - da) / (hi - lo), 1 / FAR, 1 / 0.12)
        # behind the anchor, flatten the relief: little parallax there, and no tearing at window edges
        z = 1 / inv; z = np.where(z > 1, 1 + (z - 1) * BACK, z); inv = 1 / z
        inv = cv2.GaussianBlur(inv, (0, 0), SOFT)  # a relief that bends instead of tearing at sharp depth edges
        gx, gy = w // CELL + 1, h // CELL + 1
        g = cv2.resize(inv, (gx, gy), interpolation=cv2.INTER_AREA)
        index[name] = [len(blob), gx, gy]
        blob += np.clip(np.round(g * 40), 0, 255).astype(np.uint8).tobytes()
        print(name, gx, gy, 'k=%.2f' % k, file=sys.stderr)
    open(os.path.join(IMG, 'walk-depth.bin'), 'wb').write(bytes(blob))
    print(json.dumps(index))

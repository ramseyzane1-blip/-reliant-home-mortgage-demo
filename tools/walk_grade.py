"""Exposure grade for the walk-through: one camera look across renders that differ in brightness
and color. Prints CORR and NATIVE for Walk in js/engines.js.

CORR[b]: per-channel gain and offset (on 0..1 RGB) that makes shot b match the shot before it,
fit over the area they share when aligned by their anchor rectangles (10th/50th/90th
percentiles). NATIVE[k]: the grade each shot settles into. Outside is chained from the first
approach shot, inside from the last room, and the two are met halfway at the threshold
(door-open -> inside-1), so the whole walk shares one grade.

Usage (from the repo root): python3 tools/walk_grade.py
"""
import json, os
import cv2, numpy as np

IMG = os.path.join(os.path.dirname(__file__), '..', 'demo', 'site', 'images')
R = {'approach-2': [640, 302, 809, 693], 'approach-3': [628, 255, 817, 719], 'approach-4': [562, 167, 875, 839],
     'door': [503, 97, 899, 969], 'door-open@door': [505, 92, 915, 925], 'inside-1': [721, 369, 849, 479],
     'inside-2': [696, 431, 852, 565], 'inside-3': [729, 457, 919, 620], 'inside-4': [660, 461, 853, 627],
     'door-open': [711, 499, 826, 598]}
SEQ = ['approach-2', 'approach-3', 'approach-4', 'door', 'door-open', 'inside-1', 'inside-2', 'inside-3', 'inside-4']

def fit(a, b):
    ra, rb = (R['door'], R['door-open@door']) if b == 'door-open' else (R[a], R[b])
    A = cv2.imread(os.path.join(IMG, a + '.jpg'))[:, :, ::-1] / 255.
    B = cv2.imread(os.path.join(IMG, b + '.jpg'))[:, :, ::-1] / 255.
    s = (ra[2] - ra[0]) / (rb[2] - rb[0])
    M = np.float32([[s, 0, (ra[0] + ra[2]) / 2 - s * (rb[0] + rb[2]) / 2], [0, s, (ra[1] + ra[3]) / 2 - s * (rb[1] + rb[3]) / 2]])
    Bw = cv2.warpAffine(B, M, (A.shape[1], A.shape[0]))
    V = cv2.erode(cv2.warpAffine(np.ones(B.shape[:2], np.uint8), M, (A.shape[1], A.shape[0])), np.ones((15, 15))) > 0
    if b == 'door-open':  # the doorway shows different things (closed door vs. the room)
        r = R['door']; V[r[1]:r[3], r[0]:r[2]] = False
    g, o = [], []
    for c in range(3):
        pa = np.percentile(A[..., c][V], [10, 50, 90]); pb = np.percentile(Bw[..., c][V], [10, 50, 90])
        k = float(np.clip((pa[2] - pa[0]) / max(pb[2] - pb[0], 1e-3), .75, 1.35))
        g.append(k); o.append(float(np.clip(pa[1] - k * pb[1], -.25, .25)))
    return np.array(g), np.array(o)

def comp(A, B): return (A[0] * B[0], A[0] * B[1] + A[1])      # apply B, then A
def inv(A): return (1 / A[0], -A[1] / A[0])
def half(A): r = np.sqrt(A[0]); return (r, A[1] / (1 + r))       # h with h(h(x)) = A(x)

if __name__ == '__main__':
    C = {b: fit(a, b) for a, b in zip(SEQ, SEQ[1:])}
    I = (np.ones(3), np.zeros(3)); N = {'approach-2': I}
    for a, b in zip(SEQ[:4], SEQ[1:5]): N[b] = comp(N[a], C[b])
    N['inside-4'] = I
    for k in ['inside-3', 'inside-2', 'inside-1']:
        nxt = SEQ[SEQ.index(k) + 1]; N[k] = comp(N[nxt], inv(C[nxt]))
    h = half(comp(comp(N['door-open'], C['inside-1']), inv(N['inside-1'])))
    for k in N: N[k] = comp(inv(h), N[k]) if k.startswith(('approach', 'door')) else comp(h, N[k])
    r3 = lambda v: [round(float(x), 3) for x in v]
    print('CORR=' + json.dumps({k: r3(g) + r3(o) for k, (g, o) in C.items()}, separators=(',', ':')) + ';')
    print('NATIVE=' + json.dumps({k: r3(np.clip(g, .75, 1.3)) + r3(np.clip(o, -.15, .15)) for k, (g, o) in N.items()}, separators=(',', ':')) + ';')

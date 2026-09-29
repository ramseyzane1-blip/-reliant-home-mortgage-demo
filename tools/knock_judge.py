"""Look at a knock clip frame by frame: contact sheets and zoomed crops, plus how far its first and
last frames are from the keyframes it was given.

Usage: python3 tools/knock_judge.py clip.mp4 [start.png end.png] [fps]
Writes <clip>_sheet.jpg (every frame at fps, 6 across) and <clip>_crops.jpg (hinge, glass,
lanterns, lower right where the hand comes in, one row per frame at 4 fps).
"""
import atexit, glob, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
clip = sys.argv[1]
keys = sys.argv[2:4] if len(sys.argv) > 3 else None
fps = float(sys.argv[4]) if len(sys.argv) > 4 else 12
base = os.path.splitext(clip)[0]

TMP = []
def tmp():  # frame dumps are removed when the script ends
    d = tempfile.mkdtemp(prefix='knock-judge-'); TMP.append(d); return d
atexit.register(lambda: [shutil.rmtree(d, ignore_errors=True) for d in TMP])

def frames(rate, w):
    d = tmp()
    subprocess.run([FF, '-v', 'error', '-i', clip, '-vf', f'fps={rate},scale={w}:-2', f'{d}/%04d.png'], check=True)
    return [Image.open(f).convert('RGB') for f in sorted(glob.glob(d + '/*.png'))]

def sheet(ims, cols, label):
    w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * h), 'black'); dr = ImageDraw.Draw(S)
    for i, im in enumerate(ims):
        x, y = i % cols * w, i // cols * h; S.paste(im, (x, y)); dr.text((x + 4, y + 4), label(i), fill='yellow')
    return S

F = frames(fps, 320)
sheet(F, 6, lambda i: f'{i / fps:.2f}s').save(base + '_sheet.jpg', quality=85)
# crops, in fractions of the frame: hinge side, door glass, left lantern, right lantern, lower right (the hand)
BOX = {'hinge': (.30, .25, .45, .75), 'glass': (.38, 0, .66, .22), 'lantL': (0, 0, .14, .16), 'lantR': (.86, 0, 1, .16), 'hand': (.55, .45, .95, 1)}
G = frames(4, 1920)
rows = []
for im in G:
    W, H = im.size
    cs = [im.crop((int(a * W), int(b * H), int(c * W), int(d * H))).resize((300, int(300 * (d - b) * H / ((c - a) * W)))) for a, b, c, d in BOX.values()]
    hh = max(c.size[1] for c in cs); row = Image.new('RGB', (300 * len(cs), hh))
    for k, c in enumerate(cs): row.paste(c, (300 * k, 0))
    rows.append(row)
S = Image.new('RGB', (rows[0].size[0], sum(r.size[1] for r in rows)))
y = 0; dr = ImageDraw.Draw(S)
for i, r in enumerate(rows): S.paste(r, (0, y)); dr.text((4, y + 4), f'{i / 4:.2f}s', fill='yellow'); y += r.size[1]
S.save(base + '_crops.jpg', quality=85)
if keys:
    d = tmp()
    subprocess.run([FF, '-v', 'error', '-i', clip, '-vf', 'scale=1920:-2', '-frames:v', '1', f'{d}/first.png'], check=True)
    subprocess.run([FF, '-v', 'error', '-sseof', '-0.3', '-i', clip, '-vf', 'scale=1920:-2', '-update', '1', f'{d}/last.png'], check=True)
    for name, k in (('first', keys[0]), ('last', keys[1])):
        im = Image.open(f'{d}/{name}.png').convert('RGB')
        a = np.asarray(Image.open(k).convert('RGB').resize(im.size), float); b = np.asarray(im, float)
        print(f'{name} frame vs keyframe: mean abs diff {np.abs(a - b).mean():.2f} / 255')
print('frames', len(F), 'at', fps, 'fps ->', base + '_sheet.jpg', base + '_crops.jpg')

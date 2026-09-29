"""Measure the two handoffs of the knock clip, at each screen size (mean absolute difference, 0-255,
over the canvas pixels):

  into      the last walk frame before the clip against the clip's first frame
  out       the clip's last frame against the walk as it takes over (before the .3s dissolve)
  steps     the largest frame-to-frame change at 60fps through each handoff, next to the walk's own
            frame-to-frame change just before or after it (a handoff is invisible when its steps are
            no bigger than the walk's)

Saves the pairs side by side in tools/out/handoff-<size>.png.
Usage (site served on :8765): python3 tools/knock_handoff.py [WxH ...]
"""
import asyncio, base64, io, os, sys
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from walk_perf import start_walk, ARGS

SIZES = sys.argv[1:] or ['1280x800', '1440x900', '1920x1080', '390x844', '412x915']
OUT = os.path.join(os.path.dirname(__file__), 'out')
GRAB = """async ([c, seek]) => { if (seek) await __walk.seek(c); else __walk.render(c);
  return document.querySelector('.wk-canvas').toDataURL('image/png'); }"""

def img(d): return np.asarray(Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGB'), float)
diff = lambda a, b: float(np.abs(a - b).mean())

async def one(b, size):
    W, H = map(int, size.split('x'))
    pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    await pg.goto('http://127.0.0.1:8765/demo/site/#start'); await pg.wait_for_timeout(2500)  # the clip preloads here
    await start_walk(pg); await pg.wait_for_timeout(1500)
    if not await pg.evaluate('__walk.stop(); __walk.scale(1); __walk.clip(true)'):
        print(f'{size:>9}  clip not available'); await pg.close(); return
    info = await pg.evaluate('__walk.clipInfo()'); c0, c1 = info['t0'], info['t0'] + info['dur']
    run = 'async ([a, b, s]) => { for (let x = a; x < b - 1e-6; x += s) { if (x >= %f && x < %f) await __walk.seek(x); else __walk.render(x); } }' % (c0, c1)
    await pg.evaluate(run, [0, c0 - .2, 1 / 30])                     # the walk up to just before the clip
    F = [img(await pg.evaluate(GRAB, [c0 - .2 + k / 60, c0 - .2 + k / 60 >= c0])) for k in range(24)]   # .2s before to .2s into the clip
    into = diff(F[11], F[12]); s_in = [diff(F[k], F[k - 1]) for k in range(1, 24)]
    await pg.evaluate(run, [c0 + .2, c1 - .2, 1 / 30])               # the walk runs on behind the clip
    G = [img(await pg.evaluate(GRAB, [c1 - .2 + k / 60, c1 - .2 + k / 60 < c1])) for k in range(48)]    # .2s before the end to .6s after
    out = diff(G[11], G[12]); s_out = [diff(G[k], G[k - 1]) for k in range(1, 48)]
    walk_in, walk_out = np.median(s_in[:10]), np.median(s_out[32:])
    print(f'{size:>9}  lean {info["Z"]:.3f}  into {into:5.2f}  out {out:5.2f}   largest step: into {max(s_in[9:14]):5.2f} '
          f'(walk {walk_in:4.2f}), out {max(s_out[10:31]):5.2f} (walk {walk_out:4.2f})')
    pair = np.concatenate([np.concatenate([F[11], F[12]], 1), np.concatenate([G[11], G[30]], 1)], 0).astype(np.uint8)
    Image.fromarray(pair).save(os.path.join(OUT, f'handoff-{size}.png'))
    await pg.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        for s in SIZES: await one(b, s)
        await b.close()

asyncio.run(main())

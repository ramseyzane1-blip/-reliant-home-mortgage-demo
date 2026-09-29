"""Capture the knock clip's first and last frames from the walk itself.

Usage (repo root, site served on :8765; pip install playwright==1.56.0 pillow):
    python3 tools/knock_keyframes.py [WxH] [t0 t1]     # default 1920x1080, 6.75 12.2

The walk is replayed from 0 at 30fps (so the grade, the springs and every handoff are in the same
state as in a real run) in clip mode (the head holds still at both ends) with the finishing look
off (raw: the site adds the vignette and spill on top of the clip). Writes tools/knock/start-WxH.jpg
and end-WxH.jpg.
"""
import asyncio, base64, io, os, sys
from PIL import Image
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from walk_perf import start_walk

size = sys.argv[1] if len(sys.argv) > 1 else '1920x1080'
W, H = map(int, size.split('x'))
T0, T1 = (float(sys.argv[2]), float(sys.argv[3])) if len(sys.argv) > 3 else (6.75, 12.2)
OUT = os.path.join(os.path.dirname(__file__), 'knock')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': W, 'height': H})
        await start_walk(pg); await pg.wait_for_timeout(1500)
        await pg.evaluate('__walk.stop();__walk.scale(1/Math.min(2,devicePixelRatio||1));__walk.keyframes(true);__walk.raw(true)')
        for name, t in (('start', T0), ('end', T1)):
            d = await pg.evaluate("""t=>{for(let x=0;x<t;x+=1/30)__walk.render(x);__walk.render(t);
              return document.querySelector('.wk-canvas').toDataURL('image/png');}""", t)
            f = os.path.join(OUT, f'{name}-{W}x{H}.jpg')  # JPEG 95: what tools/knock_video.py sends anyway
            Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGB').save(f, quality=95); print(f)
        await b.close()

asyncio.run(main())

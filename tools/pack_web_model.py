"""Compress the web model (tools/blender/web_model.py output) into demo/site/images/model/.

    python3 tools/pack_web_model.py /tmp/web        (needs pillow, and node with npx for @gltf-transform/cli)

Geometry: Meshopt compression with quantized positions and UVs (the page decodes it with the
meshopt decoder in js/vendor/three-hero.min.js). Textures: WebP. Then it photographs the live model
on the page at the front (still.webp, 960px, and sm/still.webp, 768px: the picture shown until the
model is ready and without WebGL, so the hand-over is invisible; needs playwright) and stamps a
content version (?v=) in js/app.js and index.html, so browsers never mix old and new parts.
"""
import os, re, sys, glob, hashlib, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, 'demo', 'site', 'images', 'model')


def glb(src, dst):
    # 14-bit UVs: under half a texel on the 2048px atlases
    subprocess.run(['npx', '--yes', '@gltf-transform/cli@4', 'meshopt', src, dst, '--level', 'high',
                    '--quantize-position', '16', '--quantize-texcoord', '14', '--quantize-color', '8'], check=True)


def webp(src, dst, q, alpha=False):
    im = Image.open(src).convert('RGBA' if alpha else 'RGB')
    im.save(dst, 'WEBP', quality=q, method=6, **({'alpha_quality': 100} if alpha else {}))


def main(src):
    os.makedirs(DEST, exist_ok=True)
    for f in ('house', 'cards', 'ring', 'panes'):
        glb(os.path.join(src, f + '.glb'), os.path.join(DEST, f + '.glb'))
    webp(os.path.join(src, 'house.png'), os.path.join(DEST, 'house.webp'), 88)
    webp(os.path.join(src, 'ring.png'), os.path.join(DEST, 'ring.webp'), 88)
    webp(os.path.join(src, 'ground.png'), os.path.join(DEST, 'ground.webp'), 85, alpha=True)
    webp(os.path.join(src, 'twigs.png'), os.path.join(DEST, 'twigs.webp'), 88, alpha=True)
    stamp(version())   # the page must load the new files before it is photographed
    still()
    stamp(version())


def version():
    h = hashlib.sha1()
    for f in sorted(glob.glob(os.path.join(DEST, '**', '*'), recursive=True)):
        if os.path.isfile(f) and 'still' not in f: h.update(open(f, 'rb').read())
    return h.hexdigest()[:8]


def still():
    """the front view as the page draws it, 960px and 768px"""
    import asyncio, threading, functools, http.server, io
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, 'demo', 'site')))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from playwright.async_api import async_playwright
    async def shoot():
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            pg = await b.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=2, reduced_motion='reduce')
            await pg.goto('http://127.0.0.1:%d/index.html' % srv.server_address[1])
            await pg.wait_for_function('window.__turntable&&__turntable.ready()', timeout=180000)
            # only the canvas, on a transparent page
            await pg.add_style_tag(content='*{background:transparent!important;box-shadow:none!important}body *{visibility:hidden!important}#hcanvas{visibility:visible!important}')
            await pg.evaluate('__turntable.set(0)'); await pg.wait_for_timeout(500)
            png = await (await pg.query_selector('#hcanvas')).screenshot(omit_background=True)
            await b.close(); return png
    png = asyncio.run(shoot()); srv.shutdown()
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    os.makedirs(os.path.join(DEST, 'sm'), exist_ok=True)
    for size, path in ((960, 'still.webp'), (768, os.path.join('sm', 'still.webp'))):
        im.resize((size, size), Image.LANCZOS).save(os.path.join(DEST, path), 'WEBP', quality=82, method=6, alpha_quality=90)


def stamp(ver):
    app = os.path.join(ROOT, 'demo', 'site', 'js', 'app.js')
    js = open(app, encoding='utf-8').read()
    js, k = re.subn(r"(MODEL_V=')[0-9a-f]*(')", lambda m: m.group(1) + ver + m.group(2), js)
    assert k == 1, 'MODEL_V not found in app.js'
    open(app, 'w', encoding='utf-8').write(js)
    idx = os.path.join(ROOT, 'demo', 'site', 'index.html')
    html = open(idx, encoding='utf-8').read()
    html = re.sub(r"(images/model/[^\"'?\s,]+?\.webp)(\?v=[0-9a-f]+)?", lambda m: m.group(1) + '?v=' + ver, html)
    open(idx, 'w', encoding='utf-8').write(html)
    for f in sorted(glob.glob(os.path.join(DEST, '**', '*'), recursive=True)):
        if os.path.isfile(f): print('%-16s %6d KB' % (os.path.relpath(f, DEST), os.path.getsize(f) // 1024))
    print('version', ver)


if __name__ == '__main__':
    main(sys.argv[1])

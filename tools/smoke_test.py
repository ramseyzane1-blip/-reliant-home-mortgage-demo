"""End-to-end smoke test for the demo site.

Usage (from the repo root):
    python3 -m http.server 8765 &        # serve the repo
    python3 tools/smoke_test.py          # needs: pip install playwright && playwright install chromium

Checks every page at phone width for sideways scrolling, walks the full pre-qualification
(including an Edit from the review step), plays the walk-through, and saves screenshots to
tools/out/. WebGL runs through SwiftShader so it works headless.
"""
import asyncio, os
from playwright.async_api import async_playwright

URL = os.environ.get('SITE_URL', 'http://127.0.0.1:8765/demo/site/')
OUT = os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
PAGES = ['home', 'buy', 'refinance', 'learn', 'rates', 'calculator', 'glossary', 'local-help',
         'about', 'loans', 'start', 'contact', 'apply']

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        errs = []
        pg = await b.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: errs.append('page: ' + str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        # hermetic: no third-party fonts (the page falls back to system fonts)
        await pg.route('**fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        # keep test submissions out of the real Supabase tables (set SMOKE_REAL_DB=1 to send them)
        if not os.environ.get('SMOKE_REAL_DB'):
            await pg.route('**/rest/v1/**', lambda r: r.fulfill(status=201, body=''))
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        print('turntable:', await pg.evaluate("document.getElementById('hphoto').className"))
        await pg.screenshot(path=f'{OUT}/home.png')
        # pre-qualification: buying path
        await pg.evaluate("location.hash='#start'"); await pg.wait_for_timeout(400)
        for sel in ['.opt'] * 3 + ['[data-w=next]'] * 2 + ['.opt'] * 4:
            await pg.click(f'#wiz {sel}'); await pg.wait_for_timeout(260)
        await pg.fill('#pq-name', 'Test'); await pg.fill('#pq-phone', '513-555-0100')
        await pg.click('#wiz [data-w=toreview]'); await pg.wait_for_timeout(300)
        await pg.click('#wiz [data-edit=credit]'); await pg.wait_for_timeout(200)
        await pg.click('#wiz .opt >> nth=0'); await pg.wait_for_timeout(400)
        assert 'Check your answers' in await pg.evaluate("document.querySelector('#wiz .wiz-q').textContent")
        await pg.screenshot(path=f'{OUT}/review.png', full_page=True)
        await pg.click('#wiz [data-w=submit]'); await pg.wait_for_timeout(2500)
        if await pg.evaluate('!!window.__walk'):
            await pg.evaluate('__walk.stop()')
            for t in [1.0, 4.5, 7.3, 9.8, 10.6, 13.6, 18.0]:
                await pg.evaluate(f'__walk.render({t})'); await pg.wait_for_timeout(250)
                await pg.screenshot(path=f'{OUT}/walk_{t}.png')
        await pg.click('.ds [data-ds=go]'); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=f'{OUT}/results.png', full_page=True)
        # phone width: no page may scroll sideways
        m = await b.new_page(viewport={'width': 390, 'height': 844})
        m.on('pageerror', lambda e: errs.append('mobile: ' + str(e)))
        m.on('console', lambda x: errs.append('mobile: ' + x.text) if x.type == 'error' else None)
        await m.route('**fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        await m.goto(URL); await m.wait_for_timeout(1500)
        for h in PAGES:
            await m.evaluate(f"location.hash='#{h}'"); await m.wait_for_timeout(250)
            w = await m.evaluate('document.documentElement.scrollWidth')
            if w > 390: errs.append(f'{h} scrolls sideways ({w}px)')
        print('errors:', errs or 'none')
        await b.close()
        if errs: raise SystemExit(1)

asyncio.run(main())

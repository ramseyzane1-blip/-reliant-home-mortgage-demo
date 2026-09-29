"""Behaviour checks for the short walk-through after the pre-qualification (run with the site served on :8765).

  reduced motion  prefers-reduced-motion skips it and goes straight to the results
  focus, Escape   the dialog has focus from the start; Escape ends it and the results show
  route change    Back or a link mid-walk ends it, and the results still show
  audio           the sound toggle mutes live; the audio context closes when it ends
  keyboard        "See my results" gets focus with a visible ring, and Enter goes to the results
  layout          390x844 and 1280x800, light and dark: screenshots to tools/out/

Usage: python3 tools/walk_checks.py        (pip install playwright==1.56.0)
"""
import asyncio, os
from playwright.async_api import async_playwright

URL = os.environ.get('SITE_URL', 'http://127.0.0.1:8765/demo/site/')
ARGS = ['--autoplay-policy=no-user-gesture-required']
OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
AUDIO = """() => { const A = window.AudioContext; window.__acs = []; window.__gains = [];
  window.AudioContext = function (...a) { const c = new A(...a); __acs.push(c); const g = c.createGain.bind(c);
    c.createGain = () => { const n = g(); __gains.push(n); return n; }; return c; }; }"""

async def start_walk(pg):
    """Complete the pre-qualification (buying path) and submit it."""
    await pg.route('**/rest/v1/**', lambda r: r.fulfill(status=201, body=''))
    await pg.route('**fonts.googleapis.com**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    await pg.goto(URL + '#start'); await pg.wait_for_timeout(600)
    for sel in ['.opt'] * 3 + ['[data-w=next]'] * 2 + ['.opt'] * 4 + ['[data-w=next]'] * 2:
        await pg.click(f'#wiz {sel}'); await pg.wait_for_timeout(280)
    await pg.fill('#pq-name', 'Test'); await pg.fill('#pq-phone', '513-555-0100')
    await pg.click('#wiz [data-w=toreview]'); await pg.wait_for_timeout(200)
    await pg.click('#wiz [data-w=submit]')
    await pg.wait_for_function('!!window.__walk', timeout=20000)

async def main():
    res, errs = {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        async def page(size, **kw):
            ctx = await b.new_context(viewport=size, **kw); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            return ctx, pg
        # reduced motion: no walk, results shown
        ctx, pg = await page({'width': 390, 'height': 844}, reduced_motion='reduce')
        try: await start_walk(pg); res['reduced_motion_skips_walk'] = False
        except Exception: res['reduced_motion_skips_walk'] = await pg.evaluate("!window.__walk && !document.querySelector('.ds') && !document.getElementById('pqResults').hidden")
        await ctx.close()
        # the dialog has focus from the start, and Escape closes it early
        ctx, pg = await page({'width': 1280, 'height': 800})
        await start_walk(pg); await pg.wait_for_timeout(1500)
        res['dialog_has_focus'] = await pg.evaluate("document.activeElement === document.querySelector('.ds')")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(1300)
        res['escape_closes'] = await pg.evaluate("!document.querySelector('.ds') && !document.getElementById('pqResults').hidden && window.__walk === null")
        await ctx.close()
        # Back or a link mid-walk ends it, and the results still show
        ctx, pg = await page({'width': 1280, 'height': 800})
        await start_walk(pg); await pg.wait_for_timeout(1500)
        await pg.evaluate("location.hash = '#about'"); await pg.wait_for_timeout(1500)
        res['route_change_ends_walk'] = await pg.evaluate("!document.querySelector('.ds') && location.hash === '#start' && !document.getElementById('pqResults').hidden")
        await ctx.close()
        for w, h in [(390, 844), (1280, 800)]:
            for scheme in ['light', 'dark']:
                ctx, pg = await page({'width': w, 'height': h}, color_scheme=scheme)
                await pg.add_init_script('(' + AUDIO + ')()')
                await start_walk(pg); tag = f'{w}_{scheme}'
                if tag == '1280_light':   # audio: mute live, then unmute
                    await pg.wait_for_timeout(1200)
                    await pg.click('.ds [data-ds=sound]'); await pg.wait_for_timeout(400)
                    res['sound_off_gain'] = round(await pg.evaluate('__gains[0].gain.value'), 4)
                    await pg.click('.ds [data-ds=sound]'); await pg.wait_for_timeout(400)
                    res['sound_on_gain'] = round(await pg.evaluate('__gains[0].gain.value'), 4)
                await pg.wait_for_function('__walk.time() > 3.6', timeout=30000); await pg.wait_for_timeout(900)
                for _ in range(6):   # reach it by keyboard, as a keyboard user would (the ring shows after key presses)
                    await pg.keyboard.press('Tab')
                    if (await pg.evaluate('document.activeElement.textContent')).startswith('See my results'): break
                res[f'focus_{tag}'] = await pg.evaluate("""(() => { const a = document.activeElement, s = getComputedStyle(a);
                  return {text: a.textContent.trim(), focus_visible: a.matches(':focus-visible'), outline: s.outlineStyle + ' ' + s.outlineWidth}; })()""")
                await pg.screenshot(path=os.path.join(OUT, f'walk_welcome_{tag}.png'))
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1600)
                res[f'enter_goes_to_results_{tag}'] = await pg.evaluate("!document.getElementById('pqResults').hidden && !document.querySelector('.ds')")
                if tag == '1280_light': res['audio_context_state_after'] = await pg.evaluate('__acs.map(c => c.state).join(",")')
                await ctx.close()
        await b.close()
    res['errors'] = errs
    for k, v in res.items(): print(f'{k}: {v}')

asyncio.run(main())

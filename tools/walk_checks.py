"""Behaviour checks for the walk-through (run with the site served on :8765).

  reduced motion  prefers-reduced-motion skips the walk and goes straight to the results
  audio           the sound toggle mutes live; the audio context closes when the walk ends
  keyboard        arrow keys turn the look-around; "See my results" has focus, a visible
                  focus ring, and Enter goes to the results
  layout          390x844 and 1280x800, light and dark: screenshots to tools/out/

Usage: python3 tools/walk_checks.py
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from playwright.async_api import async_playwright
import walk_perf as wp

OUT = os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(OUT, exist_ok=True)
AUDIO = """() => { const A = window.AudioContext; window.__acs = []; window.__gains = [];
  window.AudioContext = function (...a) { const c = new A(...a); __acs.push(c); const g = c.createGain.bind(c);
    c.createGain = () => { const n = g(); __gains.push(n); return n; }; return c; }; }"""

async def main():
    res, errs = {}, []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=wp.ARGS)
        # reduced motion: no walk, results shown
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        try: await wp.start_walk(pg); res['reduced_motion_skips_walk'] = False
        except Exception: res['reduced_motion_skips_walk'] = await pg.evaluate("!window.__walk && !document.querySelector('.ds') && !document.getElementById('pqResults').hidden")
        await ctx.close()
        for w, h in [(390, 844), (1280, 800)]:
            for scheme in ['light', 'dark']:
                ctx = await b.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme)
                pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
                await pg.add_init_script('(' + AUDIO + ')()')
                await wp.start_walk(pg)
                tag = f'{w}_{scheme}'
                if tag == '1280_light':   # audio: mute live, then unmute
                    await pg.wait_for_timeout(1500)
                    await pg.click('.ds [data-ds=sound]'); await pg.wait_for_timeout(400)
                    res['sound_off_gain'] = round(await pg.evaluate('__gains[0].gain.value'), 4)
                    await pg.click('.ds [data-ds=sound]'); await pg.wait_for_timeout(400)
                    res['sound_on_gain'] = round(await pg.evaluate('__gains[0].gain.value'), 4)
                await pg.wait_for_function('__walk.time() > 18.2', timeout=120000)   # the look-around
                await pg.wait_for_timeout(900)
                await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Tab')   # reach it by keyboard
                focus = await pg.evaluate("""(() => { const a = document.activeElement, s = getComputedStyle(a);
                  return {text: a.textContent.trim(), focus_visible: a.matches(':focus-visible'), outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor}; })()""")
                await pg.screenshot(path=os.path.join(OUT, f'walk_focus_{tag}.png'))
                res[f'focus_{tag}'] = focus
                p0 = (await pg.evaluate('__walk.look()'))['p']
                for _ in range(4): await pg.keyboard.press('ArrowRight')
                await pg.wait_for_timeout(1000)
                res[f'arrow_keys_turn_{tag}'] = f"look {p0:.2f} -> {(await pg.evaluate('__walk.look()'))['p']:.2f}"
                await pg.screenshot(path=os.path.join(OUT, f'walk_look_{tag}.png'))
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1600)
                res[f'enter_goes_to_results_{tag}'] = await pg.evaluate("!document.getElementById('pqResults').hidden")
                if tag == '1280_light':
                    res['audio_context_state_after'] = await pg.evaluate('__acs.map(c => c.state).join(",")')
                res[f'overlay_removed_{tag}'] = await pg.evaluate("!document.querySelector('.ds')")
                await pg.screenshot(path=os.path.join(OUT, f'walk_results_{tag}.png'))
                await ctx.close()
        await b.close()
    res['errors'] = errs
    for k, v in res.items(): print(f'{k}: {v}')

asyncio.run(main())

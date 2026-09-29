"""Behaviour checks for the walk-through (run with the site served on :8765).

  reduced motion  prefers-reduced-motion skips the walk and goes straight to the results
  audio           the sound toggle mutes live; the audio context closes when the walk ends
  keyboard        arrow keys turn the look-around; "See my results" has focus, a visible
                  focus ring, and Enter goes to the results
  knock clip      plays on wide and tall screens; a square screen, a missing or late video and a
                  video that will not start all fall back to the walk's own knock (three knocks either way)
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
        # Escape closes the walk early (the dialog has focus from the start)
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await wp.start_walk(pg); await pg.wait_for_timeout(2000)
        res['dialog_has_focus'] = await pg.evaluate("document.activeElement === document.querySelector('.ds')")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(1300)
        res['escape_closes'] = await pg.evaluate("!document.querySelector('.ds') && !document.getElementById('pqResults').hidden && window.__walk === null")
        await ctx.close()
        # turning the phone mid-walk rebuilds it at the same moment, without replaying sounds
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('window.__cues = []')
        await pg.goto(wp.URL + '#start'); await pg.wait_for_timeout(300)
        await pg.evaluate("(() => { const real = window.doorAudio; window.doorAudio = ac => { const a = real(ac); const c = a.cue; a.cue = (n, i, d) => { __cues.push(n); c(n, i, d); }; return a; }; })()")
        await pg.route('**/rest/v1/**', lambda r: r.fulfill(status=201, body=''))
        await pg.route('**fonts.googleapis.com**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
        for sel in ['.opt'] * 3 + ['[data-w=next]'] * 2 + ['.opt'] * 4:
            await pg.click(f'#wiz {sel}'); await pg.wait_for_timeout(280)
        await pg.fill('#pq-name', 'Test'); await pg.fill('#pq-phone', '513-555-0100')
        await pg.click('#wiz [data-w=toreview]'); await pg.wait_for_timeout(200)
        await pg.click('#wiz [data-w=submit]')
        await pg.wait_for_function('window.__walk && __walk.time() > 8.3', timeout=120000)
        await pg.evaluate('window.__w0 = __walk'); await pg.set_viewport_size({'width': 400, 'height': 800}); await pg.wait_for_timeout(300)
        res['resize_same_shape_keeps_walk'] = await pg.evaluate('window.__walk === window.__w0')   # e.g. a phone's address bar showing or hiding
        t0 = await pg.evaluate('__walk.time()'); tall0 = await pg.evaluate('__walk.tall')
        await pg.set_viewport_size({'width': 844, 'height': 390}); await pg.wait_for_timeout(1200)
        tall1 = await pg.evaluate('__walk.tall'); t1 = await pg.evaluate('__walk.time()'); nc = await pg.evaluate("document.querySelectorAll('.wk-canvas').length")
        top = await pg.evaluate('__walk.shots()')
        res['rotate_rebuilds'] = f'tall {tall0} -> {tall1}, walk time {t0:.1f} -> {t1:.1f}, canvases {nc}, showing {top}'
        res['rotate_keeps_the_door'] = top.startswith('door:')   # not the approach replayed from the far shot
        await pg.wait_for_function('__walk.time() > 12.5', timeout=120000)
        res['knocks_heard_once'] = (await pg.evaluate('__cues')).count('knock') == 3
        await ctx.close()
        # Back or a link mid-walk ends it, and the results still show
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await wp.start_walk(pg); await pg.wait_for_timeout(2500)
        await pg.evaluate("location.hash = '#about'"); await pg.wait_for_timeout(1500)
        res['route_change_ends_walk'] = await pg.evaluate("!document.querySelector('.ds') && location.hash === '#start' && !document.getElementById('pqResults').hidden && !document.querySelector('.page[data-page=start]').hidden")
        await ctx.close()
        # a lost WebGL context ends the walk instead of leaving a black screen
        ctx = await b.new_context(viewport={'width': 390, 'height': 844})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await wp.start_walk(pg); await pg.wait_for_function('__walk.time() > 3', timeout=120000)
        await pg.evaluate("(() => { const c = document.querySelector('.wk-canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); g.getExtension('WEBGL_lose_context').loseContext(); })()")
        await pg.wait_for_timeout(1500)
        res['context_loss_ends_walk'] = await pg.evaluate("!document.querySelector('.ds') && !window.__walk && !document.getElementById('pqResults').hidden && !document.body.classList.contains('ds-covered')")
        await ctx.close()
        # a mute carries over to the next walk, and the button says so
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await wp.start_walk(pg); await pg.click('.ds [data-ds=sound]'); await pg.click('.ds [data-ds=go]'); await pg.wait_for_timeout(1200)
        res['page_visible_after_walk'] = await pg.evaluate("!document.body.classList.contains('ds-covered')")
        await pg.wait_for_timeout(1000); await pg.click('#modalBtns button')   # the demo notice
        await pg.click('#results details summary'); await pg.click('#redo'); await pg.wait_for_timeout(400)
        for sel in ['.opt'] * 3 + ['[data-w=next]'] * 2 + ['.opt'] * 4:
            await pg.click(f'#wiz {sel}'); await pg.wait_for_timeout(280)
        await pg.click('#wiz [data-w=toreview]'); await pg.wait_for_timeout(200)
        await pg.click('#wiz [data-w=submit]'); await pg.wait_for_function('!!window.__walk', timeout=20000)
        res['second_walk_sound_button'] = await pg.evaluate("document.querySelector('.ds [data-ds=sound]').textContent")
        await ctx.close()
        # the knock clip: plays where it should, and every way it can fail falls back to the walk's own knock
        async def knock(size, setup=None, until=14):
            ctx = await b.new_context(viewport=size); pg = await ctx.new_page(); e2 = []
            pg.on('pageerror', lambda e: e2.append(str(e)))
            await pg.add_init_script('window.__cues = []')
            if setup: await setup(ctx, pg)
            await pg.goto(wp.URL + '#start'); await pg.wait_for_timeout(300)
            await pg.evaluate("(() => { const real = window.doorAudio; window.doorAudio = ac => { const a = real(ac); const c = a.cue; a.cue = (n, i, d) => { __cues.push(n); c(n, i, d); }; return a; }; })()")
            await wp.start_walk(pg); states = set()
            while await pg.evaluate('__walk.time()') < until:
                states.add(str((await pg.evaluate('__walk.clipInfo()'))['state'])); await pg.wait_for_timeout(200)
            cues = await pg.evaluate('__cues'); await ctx.close(); errs.extend(e2)
            return f"clip states {sorted(states)}, knocks heard {cues.count('knock')}, door sounds {cues.count('latch')}/{cues.count('swing')}"
        res['knock_clip_1920x1080'] = await knock({'width': 1920, 'height': 1080})
        res['knock_clip_390x844'] = await knock({'width': 390, 'height': 844})
        res['knock_square_screen_falls_back'] = await knock({'width': 1000, 'height': 1000})
        async def missing(ctx, pg): await ctx.route('**/images/knock/**', lambda r: r.fulfill(status=404, body=''))
        res['knock_video_missing_falls_back'] = await knock({'width': 1280, 'height': 800}, missing)
        async def slow(ctx, pg):   # the clip arrives after the walk has decided (throttled network)
            async def later(r): await asyncio.sleep(12); await r.continue_()
            await ctx.route('**/images/knock/**', later)
        res['knock_slow_network_falls_back'] = await knock({'width': 1280, 'height': 800}, slow)
        async def stuck(ctx, pg):  # the video will not start
            await pg.add_init_script('HTMLMediaElement.prototype.play = function () { return new Promise(() => {}); }')
        res['knock_video_wont_play_falls_back'] = await knock({'width': 1280, 'height': 800}, stuck, 15)
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
                for _ in range(6):   # reach it by keyboard, from wherever focus is
                    await pg.keyboard.press('Tab')
                    if (await pg.evaluate('document.activeElement.textContent')).startswith('See my results'): break
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

"""Measure the walk-through: frame pacing, pops between frames, stray blends and audio sync.

Usage (from the repo root, with the site served on :8765):
    python3 tools/walk_perf.py [--size 1280x800] [--out tools/out/walk_perf.json]

  pacing  requestAnimationFrame deltas over the whole walk, played in real time, unthrottled
          and with 4x CPU throttling (CDP Emulation.setCPUThrottlingRate): p50, p95, max,
          frames over 33ms and over 50ms after the first painted walk frame.
  audio   when each sound cue is scheduled to play vs. when the frame showing its beat runs.
  scrub   __walk.render(t) at 30fps: mean absolute pixel difference between consecutive frames
          (spikes are pops or cuts) and every stretch where a shot is partly blended.

Headless Chromium draws WebGL with SwiftShader (software), so pacing numbers are pessimistic
compared with any real GPU.
"""
import argparse, asyncio, io, json, os
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

URL = os.environ.get('SITE_URL', 'http://127.0.0.1:8765/demo/site/')
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
CUES = {'knock0': 7.2, 'knock1': 7.41, 'knock2': 7.6, 'step0': 8.25, 'bolt': 9.18, 'latch': 9.47, 'swing': 9.85, 'inside': 11.45}

async def start_walk(pg):
    await pg.route('**/rest/v1/**', lambda r: r.fulfill(status=201, body=''))
    await pg.route('**fonts.googleapis.com**', lambda r: r.fulfill(status=200, body='', content_type='text/css'))
    await pg.goto(URL + '#start'); await pg.wait_for_timeout(600)
    if await pg.evaluate('!!window.__perf'): await pg.evaluate(WRAP)
    for sel in ['.opt'] * 3 + ['[data-w=next]'] * 2 + ['.opt'] * 4:
        await pg.click(f'#wiz {sel}'); await pg.wait_for_timeout(280)
    await pg.fill('#pq-name', 'Test'); await pg.fill('#pq-phone', '513-555-0100')
    await pg.click('#wiz [data-w=toreview]'); await pg.wait_for_timeout(200)
    await pg.click('#wiz [data-w=submit]')
    await pg.wait_for_function('!!window.__walk', timeout=20000)

INSTRUMENT = """() => {
  const f = [], cues = [];
  (function tick(ts) { f.push([ts, window.__walk ? __walk.time() : -1, window.__walk ? __walk.scale() : 0, window.__walk && __walk.mem ? __walk.mem().now : 0]); if (f.length < 20000) requestAnimationFrame(tick); })(performance.now());
  window.__perf = {f, cues};
}"""
# wrap the cue hand-off (after app.js has defined doorAudio) to log when each sound will play
WRAP = """() => { const real = window.doorAudio; window.doorAudio = ac => { const a = real(ac); if (!a) return a; const cue = a.cue;
  a.cue = (n, i, d) => { __perf.cues.push({n: n + (n === 'knock' || n === 'step' ? i : ''), at: performance.now() + (d || 0) * 1000 +
    (ac.outputLatency || ac.baseLatency || 0) * 1000}); cue(n, i, d); }; return a; }; }"""

async def pacing(b, size, rate):
    pg = await b.new_page(viewport=size)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    cdp = await pg.context.new_cdp_session(pg)
    await pg.add_init_script('(' + INSTRUMENT + ')()')
    await start_walk(pg)
    if rate > 1: await cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
    await pg.wait_for_function('window.__walk.time() > 19', timeout=120000)
    data = await pg.evaluate('window.__perf')
    await pg.close()
    f = [x for x in data['f'] if x[1] > 0]            # frames after the first painted walk frame
    ts = np.array([x[0] for x in f]); d = np.diff(ts)
    out = {'cpu_throttle': rate, 'frames': int(len(d)), 'p50_ms': round(float(np.percentile(d, 50)), 1),
           'p95_ms': round(float(np.percentile(d, 95)), 1), 'max_ms': round(float(d.max()), 1),
           'over_33ms': int((d > 33.4).sum()), 'over_50ms': int((d > 50).sum()), 'errors': errs}
    worst = np.argsort(d)[::-1][:5]
    out['worst'] = [[round(float(d[i]), 1), round(f[i + 1][1], 2)] for i in worst]   # [ms, walk time]
    slow = {}                                   # frames over 20ms, per second of the walk
    for i, dd in enumerate(d):
        if dd > 20: k = int(f[i + 1][1]); slow[k] = slow.get(k, 0) + 1
    out['slow_by_second'] = dict(sorted(slow.items()))
    mb = [x[3] / 2**20 for x in f]
    out['texture_mb'] = {'peak': round(max(mb), 1), 'at_start': round(mb[0], 1), 'at_end': round(mb[-1], 1),
                         'by_second': {int(x[1]): round(x[3] / 2**20, 1) for x in f[::30]}}
    sc = [x[2] for x in f]; out['render_scale'] = [round(min(sc), 2), round(max(sc), 2), round(sc[-1], 2)]  # min, max, final
    sync = {}
    for c in data['cues']:
        if c['n'] in CUES:
            beat = next((x[0] for x in f if x[1] >= CUES[c['n']]), None)
            if beat: sync[c['n']] = round(c['at'] - beat, 1)      # + means the sound is after the frame
    out['audio_minus_visual_ms'] = sync
    return out

async def scrub(b, size):
    pg = await b.new_page(viewport=size)
    await start_walk(pg); await pg.evaluate('__walk.stop()')
    await pg.evaluate("document.querySelector('.ds-top').style.visibility='hidden'")
    prev, diffs, blends = None, [], []
    for k in range(int(19.5 * 30)):
        t = k / 30
        shots = await pg.evaluate(f'(__walk.render({t}), __walk.shots())')
        part = [s.split('@')[0] for s in shots.split(' ') if s and 0 < float(s.split(':')[1].split('@')[0]) < 1]
        blends.append((t, part))
        img = np.asarray(Image.open(io.BytesIO(await pg.screenshot(type='jpeg', quality=80))).convert('L').resize((320, 200)), np.float32)
        if prev is not None: diffs.append(float(np.abs(img - prev).mean()))
        prev = img
    await pg.close()
    d = np.array(diffs)
    spans, cur = [], None                      # stretches where some shot is partly blended
    for t, part in blends:
        key = ','.join(part)
        if part and (cur is None or cur[2] != key): cur = [t, t, key]; spans.append(cur)
        elif part: cur[1] = t
        else: cur = None
    return {'median_diff': round(float(np.median(d)), 2), 'p99_diff': round(float(np.percentile(d, 99)), 2),
            'max_diff': round(float(d.max()), 2), 'max_at_s': round((int(d.argmax()) + 1) / 30, 2),
            'spikes': [[round((i + 1) / 30, 2), round(float(d[i]), 1)] for i in np.where(d > 3 * np.median(d) + 8)[0]],
            'max_simultaneous_partial': max(len(p) for _, p in blends),
            'blend_spans': [[round(a, 2), round(b2 - a + 1 / 30, 2), k] for a, b2, k in spans]}

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--size', default='1280x800'); ap.add_argument('--out', default='tools/out/walk_perf.json')
    ap.add_argument('--skip', default='')
    a = ap.parse_args(); w, h = map(int, a.size.split('x')); size = {'width': w, 'height': h}
    res = {'size': a.size}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        if 'pacing' not in a.skip:
            res['pacing'] = [await pacing(b, size, 1), await pacing(b, size, 4)]
        if 'scrub' not in a.skip:
            res['scrub'] = await scrub(b, size)
        await b.close()
    os.makedirs(os.path.dirname(a.out), exist_ok=True); json.dump(res, open(a.out, 'w'), indent=1)
    print(json.dumps(res, indent=1))

if __name__ == '__main__':
    asyncio.run(main())

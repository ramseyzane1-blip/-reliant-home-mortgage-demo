"""Record the whole walk-through in real time, as a visitor sees it, with its sound.

Playwright records the page but not its audio, so every sound cue is logged as it is scheduled, then
the site's own doorAudio() renders them offline at the same moments and the track is muxed in. Also
reports, for each cue during the knock clip, when it lands in the clip's time against when it was meant
to (the frames it belongs to: the raps, the light, the latch as the door first moves).

Usage (site served on :8765): python3 tools/knock_record.py WxH [out.mp4] [--scale S] [--film]
  --scale  the walk's render scale (headless Chromium renders with SwiftShader, a software GPU, which
           the walk otherwise draws at .3; 1 is what a real GPU draws)
  --film   instead of recording live (which a software GPU makes slow and choppy), step the walk at
           exactly 30fps at full scale and screenshot every frame, captions and buttons included: the
           frames a visitor's screen shows, with the same sound
"""
import asyncio, base64, os, subprocess, sys, tempfile, time
import imageio_ffmpeg as ff
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(__file__))
from walk_perf import start_walk, ARGS

size = sys.argv[1]; W, H = map(int, size.split('x'))
dst = next((a for a in sys.argv[2:] if a.endswith('.mp4')), os.path.join(os.path.dirname(__file__), 'out', f'walk-{size}.mp4'))
scale = float(sys.argv[sys.argv.index('--scale') + 1]) if '--scale' in sys.argv else None
FF = ff.get_ffmpeg_exe()

LOG = """() => { window.__rec = {cues: [], frames: 0}; const real = window.doorAudio;
  window.doorAudio = ac => { const a = real(ac); if (!a) return a; const cue = a.cue;
    a.cue = (n, i, d) => { const v = document.querySelector('.wk-video'), w = window.__walk;
      __rec.cues.push({n, i, at: Date.now() + (d || 0) * 1000, clip: w && w.clipInfo().state === 'play' && v ? v.currentTime + (d || 0) : null,
                       walk: window.__ft != null ? __ft + (d || 0) : w ? w.clock() + (d || 0) : null});   // __ft: the frame being drawn (film)
      cue(n, i, d); }; return a; };
  (function f() { __rec.frames++; requestAnimationFrame(f); })(); }"""
# render the logged cues with the site's own synthesizer, offline, from t=0 (seconds after `origin`)
RENDER = """async ([cues, origin, dur]) => { const sr = 44100, oac = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const a = doorAudio(oac); for (const c of cues) a.cue(c.n, c.i, Math.max(0, (c.at - origin) / 1000));
  const buf = await oac.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const wav = new DataView(new ArrayBuffer(44 + n * 4)), s = (o, t) => [...t].forEach((ch, k) => wav.setUint8(o + k, ch.charCodeAt(0)));
  s(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); s(36, 'data'); wav.setUint32(40, n * 4, true);
  for (let k = 0; k < n; k++) { wav.setInt16(44 + k * 4, Math.max(-1, Math.min(1, L[k])) * 32767, true); wav.setInt16(46 + k * 4, Math.max(-1, Math.min(1, R[k])) * 32767, true); }
  let bin = ''; const u = new Uint8Array(wav.buffer); for (let k = 0; k < u.length; k += 32768) bin += String.fromCharCode.apply(null, u.subarray(k, k + 32768));
  return btoa(bin); }"""

async def film():
    tmp = tempfile.mkdtemp(prefix='walkfilm-')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width': W, 'height': H})
        await pg.route('**/rest/v1/**', lambda r: r.fulfill(status=201, body=''))
        await pg.goto('http://127.0.0.1:8765/demo/site/#start'); await pg.wait_for_timeout(2500)
        await pg.evaluate(LOG); await start_walk(pg); await pg.wait_for_timeout(1300)   # the overlay has faded in
        await pg.evaluate('__walk.stop(); __walk.scale(1)')
        n = int(21.5 * 30)
        for k in range(n):
            await pg.evaluate(f'window.__ft = {k / 30}; __walk.seek({k / 30})')
            await pg.screenshot(path=os.path.join(tmp, f'{k:04d}.jpg'), type='jpeg', quality=92)
        rec = await pg.evaluate('__rec'); info = await pg.evaluate('__walk.clipInfo()')
        cues = [dict(c, at=c['walk'] * 1000) for c in rec['cues'] if c['walk'] is not None]
        wav = base64.b64decode(await pg.evaluate(RENDER, [cues, 0, n / 30 + 1]))
        await b.close()
    open(os.path.join(tmp, 'a.wav'), 'wb').write(wav)
    subprocess.run([FF, '-v', 'error', '-y', '-framerate', '30', '-i', os.path.join(tmp, '%04d.jpg'), '-i', os.path.join(tmp, 'a.wav'),
                    '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
                    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', dst], check=True)
    import shutil; shutil.rmtree(tmp, ignore_errors=True)
    print(f'{size}: {dst}  clip: {info["state"]}  (film, 30fps)')

async def main():
    tmp = tempfile.mkdtemp(prefix='walkrec-')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': W, 'height': H}, record_video_dir=tmp, record_video_size={'width': W, 'height': H})
        pg = await ctx.new_page(); t_page = time.time() * 1000
        await pg.route('**/rest/v1/**', lambda r: r.fulfill(status=201, body=''))
        await pg.goto('http://127.0.0.1:8765/demo/site/#start'); await pg.wait_for_timeout(1500)
        await pg.evaluate(LOG)
        await start_walk(pg)
        if scale: await pg.evaluate(f'__walk.scale({scale})')
        t0 = await pg.evaluate('Date.now()'); f0 = await pg.evaluate('__rec.frames')
        await pg.wait_for_function('window.__walk && __walk.time() > 21', timeout=120000)
        t1 = await pg.evaluate('Date.now()'); f1 = await pg.evaluate('__rec.frames')
        info = await pg.evaluate('__walk.clipInfo()'); rec = await pg.evaluate('__rec')
        dur = (t1 - t_page) / 1000 + 1
        wav = base64.b64decode(await pg.evaluate(RENDER, [rec['cues'], t_page, dur]))
        await ctx.close(); await b.close()
    vid = [os.path.join(tmp, f) for f in os.listdir(tmp) if f.endswith('.webm')][0]
    open(os.path.join(tmp, 'a.wav'), 'wb').write(wav)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run([FF, '-v', 'error', '-y', '-i', vid, '-i', os.path.join(tmp, 'a.wav'), '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', dst], check=True)
    print(f'{size}: {dst}  clip: {info["state"]}  page frame rate {(f1 - f0) / ((t1 - t0) / 1000):.0f} fps')
    for c in rec['cues']:
        if c['clip'] is not None: print(f"   {c['n']}{c['i'] if c['n'] in ('knock', 'step') else ''}: at {c['clip']:.3f}s in the clip")
    return rec

asyncio.run(film() if '--film' in sys.argv else main())

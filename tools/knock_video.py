"""Generate the knock-and-door clip for the walk-through with AI video on Replicate.

The clip starts and ends on exact frames of the walk (first and last frame conditioning), so the
walk can hand over to the video and take it back without a visible cut.

Usage (from the repo root; needs REPLICATE_API_TOKEN in the environment, never commit it):
    python3 tools/knock_video.py schema bytedance/seedance-2.0     # print the input schema
    python3 tools/knock_video.py run <model> <start.png> <end.png> <variant> [--seed N] [--duration S]
    python3 tools/knock_video.py fetch <prediction id> <variant>   # pick up a run whose watcher was lost
                                                                   # variant: A (hand) or B (no hand)

Every run is appended to tools/out/knock_ledger.json (model, inputs, seconds, price, running
total) and the run stops before HARD_CAP dollars. Keyframes come from the walk itself: serve the
site, complete the pre-qualification, then __walk.stop() and __walk.render(t) and read the canvas
(see tools/knock_keyframes.py).
"""
import base64, json, os, sys, time, urllib.error, urllib.request

API = 'https://api.replicate.com/v1'
HARD_CAP = 38.0  # the account holds $40
OUT = os.path.join(os.path.dirname(__file__), 'out')
LEDGER = os.path.join(OUT, 'knock_ledger.json')
# dollars per output second, from each model's Replicate page; checked again before every run
PRICE = {'bytedance/seedance-2.0': {'720p': .18, '1080p': .45}, 'google/veo-3.1': {'720p': .20, '1080p': .20}}  # images in, no audio

COMMON = ('The camera holds still, locked off on a tripod with a barely perceptible handheld drift. '
          'The door, its glass panes, the sidelights, the trim and both lanterns keep exactly their '
          'shape and position and never warp. No people or faces are visible. No text, no watermark. '
          'Golden-hour exterior light, warm interior light. Natural, real-time timing. '
          'The final frame matches the end image exactly.')
NEGATIVE = ('people, faces, text, watermark, warping, morphing, melting, the door changing shape or color, '
            'the door opening outward or hinged on the right, camera movement, zoom, cut, extra fingers')
PROMPTS = {
    'A': ('First-person view standing at a green front door at dusk. A visitor\'s hand with natural '
          'knuckles and a shirt sleeve comes in from the lower right and raps three times on the door '
          'beside the glass, then withdraws out of frame. A beat later the warm hall light comes on '
          'behind the glass, then the deadbolt turns. Someone unseen behind the door pulls it inward; '
          'it is hinged on the LEFT and swings open smoothly over about one and a half seconds, '
          'revealing a warm living room with a lit fireplace. ' + COMMON),
    'B': ('First-person view standing at a green front door at dusk. Three knocks are felt as a tiny '
          'rattle of the door in its frame; no hand is visible. A beat later the warm hall light comes '
          'on behind the glass, then the deadbolt turns. Someone unseen behind the door pulls it inward; '
          'it is hinged on the LEFT and swings open smoothly over about one and a half seconds, '
          'revealing a warm living room with a lit fireplace. ' + COMMON),
    # round 3: A's framing of the hand (low, knuckles), with three crisp raps
    'A3': ('First-person view standing at a green front door at dusk; the camera holds still. A visitor\'s right hand '
           'in a light blue shirt cuff comes in low from the lower right, curls into a loose fist and raps the door three '
           'times with the knuckles, quick and crisp, knock, knock, knock, each rap a short, clear strike, then the hand '
           'withdraws out of frame. A beat later the warm hall light comes on behind the glass, then the deadbolt turns. '
           'Someone unseen behind the door pulls it inward; it is hinged on the LEFT and swings open smoothly over about '
           'one and a half seconds, revealing a warm living room with a lit fireplace. ' + COMMON),
    # round 2: the same scene, timed beat by beat
    'A2': ('Static first-person shot of a green front door at dusk, the camera does not move. '
           '0.6s: a man\'s right hand in a light blue shirt cuff enters from the lower right and makes a loose fist. '
           '1.0s, 1.35s, 1.7s: three firm, distinct knocks with the knuckles on the door panel beside the glass; '
           'between knocks the fist pulls back a few centimeters and strikes again, the door does not move. '
           '2.0s: the hand withdraws out of frame to the lower right. '
           '2.5s: a warm light comes on inside, glowing through the door glass. 3.3s: the deadbolt turns. '
           '3.6s: someone unseen inside pulls the door open inward; it is hinged on the LEFT side and swings '
           'smoothly into the house over one and a half seconds, revealing a warm living room with a lit fireplace, '
           'and comes to rest at 5.2s. 5.2s to the end: everything is still. ' + COMMON),
    # phones: the porch shot, and the camera steps up to the door while it opens (as the walk does there)
    'B2T': ('Vertical first-person shot at a green front door on a porch at dusk. '
           '1.0s, 1.35s, 1.7s: three knocks are felt as tiny rattles of the door in its frame; no hand or person is visible. '
           '2.3s: the warm light inside glows brighter through the door glass. From 2.5s the camera takes one slow, '
           'steady step forward toward the door. 3.3s: the deadbolt turns. 3.6s: someone unseen inside pulls the door '
           'open inward; it is hinged on the LEFT side and swings smoothly into the house over one and a half seconds, '
           'revealing a warm living room with a lit fireplace, and comes to rest at 5.2s. 5.2s to the end: everything '
           'is still. ' + COMMON),
    'B2': ('Static first-person shot of a green front door at dusk, the camera does not move. '
           '1.0s, 1.35s, 1.7s: three knocks are felt as tiny rattles of the door in its frame; no hand or person is visible. '
           '2.5s: a warm light comes on inside, glowing through the door glass. 3.3s: the deadbolt turns. '
           '3.6s: someone unseen inside pulls the door open inward; it is hinged on the LEFT side and swings '
           'smoothly into the house over one and a half seconds, revealing a warm living room with a lit fireplace, '
           'and comes to rest at 5.2s. 5.2s to the end: everything is still. ' + COMMON),
}


def req(method, path, body=None):
    tok = os.environ.get('REPLICATE_API_TOKEN')
    if not tok: raise SystemExit('REPLICATE_API_TOKEN is not set')
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json', 'User-Agent': 'knock-video/1'})
    for i in range(6):  # a new account is rate limited: back off on 429
        try:
            with urllib.request.urlopen(r, timeout=120) as f: return json.load(f)
        except urllib.error.HTTPError as e:
            if not (e.code == 429 or (e.code >= 500 and method == 'GET')) or i == 5: raise
            time.sleep(2 ** i * 3)
        except (urllib.error.URLError, OSError):  # a dropped connection: try again (GETs only)
            if method != 'GET' or i == 5: raise
            time.sleep(2 ** i * 3)


def schema(model):
    m = req('GET', '/models/' + model)
    s = m['latest_version']['openapi_schema']['components']['schemas']['Input']
    return m['latest_version']['id'], s


def data_uri(path):
    from PIL import Image
    import io
    b = io.BytesIO(); Image.open(path).convert('RGB').save(b, 'JPEG', quality=95)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def ledger():
    return json.load(open(LEDGER)) if os.path.exists(LEDGER) else []


def run(model, start, end, variant, seed=None, duration=None):
    _, s = schema(model)
    props = s['properties']
    inp = {'prompt': PROMPTS[variant]}
    # the first and last frame fields differ per model; pick them from the schema
    first = next(k for k in ('image', 'start_image', 'first_frame_image', 'first_frame') if k in props)
    last = next(k for k in ('last_frame', 'end_image', 'last_frame_image', 'tail_image') if k in props)
    inp[first], inp[last] = data_uri(start), data_uri(end)
    dur = duration or 6
    if 'duration' in props: inp['duration'] = dur
    if 'generate_audio' in props: inp['generate_audio'] = False
    if 'aspect_ratio' in props:  # from the keyframes
        from PIL import Image
        w, h = Image.open(start).size; inp['aspect_ratio'] = '16:9' if w > h else '9:16'
    inp['resolution'] = '1080p'
    if seed is not None and 'seed' in props: inp['seed'] = seed
    if 'negative_prompt' in props: inp['negative_prompt'] = NEGATIVE
    price = PRICE[model][inp['resolution']]
    cost = price * dur
    spent = sum(x['price'] for x in ledger())
    if spent + cost > HARD_CAP: raise SystemExit(f'would pass the ${HARD_CAP} cap (spent ${spent:.2f}, this run ${cost:.2f})')
    p = req('POST', f'/models/{model}/predictions', {'input': inp})
    print('prediction', p['id'], flush=True)
    finish(p, {'model': model, 'variant': variant, 'seed': seed, 'seconds': dur, 'cost': cost, 'start': start, 'end': end, 'prompt': inp['prompt']})


def fetch(pid, variant):
    """Pick up a prediction whose watcher was lost (it keeps running on Replicate)."""
    p = req('GET', '/predictions/' + pid); i = p['input']; model = p['model']
    dur = i.get('duration', 6)
    finish(p, {'model': model, 'variant': variant, 'seed': i.get('seed'), 'seconds': dur,
               'cost': PRICE[model][i.get('resolution', '1080p')] * dur, 'prompt': i['prompt']})


def finish(p, meta):
    while p['status'] not in ('succeeded', 'failed', 'canceled'):
        time.sleep(5); p = req('GET', '/predictions/' + p['id'])
    model, variant = meta['model'], meta['variant']
    entry = {**{k: v for k, v in meta.items() if k != 'cost'}, 'price': meta['cost'] if p['status'] == 'succeeded' else 0,
             'id': p['id'], 'status': p['status']}
    out = p.get('output'); url = out[0] if isinstance(out, list) else out
    if url:
        os.makedirs(OUT, exist_ok=True)
        f = os.path.join(OUT, f"knock_{model.split('/')[1]}_{variant}_{p['id'][:8]}.mp4")
        rq = urllib.request.Request(url, headers={'User-Agent': 'knock-video/1'})
        with urllib.request.urlopen(rq, timeout=300) as r, open(f, 'wb') as o: o.write(r.read())
        entry['file'] = f
    import fcntl
    lk = open(LEDGER + '.lock', 'w'); fcntl.flock(lk, fcntl.LOCK_EX)
    L = ledger(); L.append(entry); entry['total'] = round(sum(x['price'] for x in L), 2)
    json.dump(L, open(LEDGER, 'w'), indent=1)
    print(json.dumps({k: entry[k] for k in ('model', 'variant', 'status', 'price', 'total', 'file') if k in entry}))


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['schema']:
        v, s = schema(a[1]); print('version', v)
        for k, p in s['properties'].items(): print(' ', k, {x: p.get(x) for x in ('type', 'default', 'enum', 'minimum', 'maximum') if p.get(x) is not None})
    elif a[:1] == ['fetch']:
        fetch(a[1], a[2])
    elif a[:1] == ['run']:
        kw = {}
        if '--seed' in a: kw['seed'] = int(a[a.index('--seed') + 1])
        if '--duration' in a: kw['duration'] = int(a[a.index('--duration') + 1])
        run(a[1], a[2], a[3], a[4], **kw)
    else:
        print(__doc__)

"""Generate the knock-and-door clip for the walk-through with AI video on Replicate.

The clip starts and ends on exact frames of the walk (first and last frame conditioning), so the
walk can hand over to the video and take it back without a visible cut.

Usage (from the repo root; needs REPLICATE_API_TOKEN in the environment, never commit it):
    python3 tools/knock_video.py schema bytedance/seedance-2.0     # print the input schema
    python3 tools/knock_video.py run <model> <start.png> <end.png> <variant> [--seed N] [--duration S]
                                                                   # variant: A (hand) or B (no hand)

Every run is appended to tools/out/knock_ledger.json (model, inputs, seconds, price, running
total) and the run stops before HARD_CAP dollars. Keyframes come from the walk itself: serve the
site, complete the pre-qualification, then __walk.stop() and __walk.render(t) and read the canvas
(see tools/knock_keyframes.py).
"""
import base64, json, os, sys, time, urllib.request

API = 'https://api.replicate.com/v1'
HARD_CAP = 34.0
OUT = os.path.join(os.path.dirname(__file__), 'out')
LEDGER = os.path.join(OUT, 'knock_ledger.json')
# dollars per output second, from each model's Replicate page; checked again before every run
PRICE = {'bytedance/seedance-2.0': None, 'google/veo-3.1': None}

COMMON = ('The camera holds still, locked off on a tripod with a barely perceptible handheld drift. '
          'The door, its glass panes, the sidelights, the trim and both lanterns keep exactly their '
          'shape and position and never warp. No people or faces are visible. No text, no watermark. '
          'Golden-hour exterior light, warm interior light. Natural, real-time timing. '
          'The final frame matches the end image exactly.')
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
}


def req(method, path, body=None):
    tok = os.environ.get('REPLICATE_API_TOKEN')
    if not tok: raise SystemExit('REPLICATE_API_TOKEN is not set')
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=120) as f: return json.load(f)


def schema(model):
    m = req('GET', '/models/' + model)
    s = m['latest_version']['openapi_schema']['components']['schemas']['Input']
    return m['latest_version']['id'], s


def data_uri(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


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
    if 'aspect_ratio' in props: inp['aspect_ratio'] = '16:9'
    if 'resolution' in props: inp['resolution'] = '1080p' if '1080p' in str(props['resolution']) else props['resolution'].get('default')
    if seed is not None and 'seed' in props: inp['seed'] = seed
    price = PRICE.get(model)
    if price is None: raise SystemExit(f'set PRICE[{model!r}] from the model page before running')
    cost = price * dur
    spent = sum(x['price'] for x in ledger())
    if spent + cost > HARD_CAP: raise SystemExit(f'would pass the ${HARD_CAP} cap (spent ${spent:.2f}, this run ${cost:.2f})')
    p = req('POST', f'/models/{model}/predictions', {'input': inp})
    while p['status'] not in ('succeeded', 'failed', 'canceled'):
        time.sleep(5); p = req('GET', '/predictions/' + p['id'])
    entry = {'model': model, 'variant': variant, 'seed': seed, 'seconds': dur, 'price': cost if p['status'] == 'succeeded' else 0,
             'id': p['id'], 'status': p['status'], 'start': start, 'end': end, 'prompt': inp['prompt']}
    out = p.get('output'); url = out[0] if isinstance(out, list) else out
    if url:
        os.makedirs(OUT, exist_ok=True)
        f = os.path.join(OUT, f"knock_{model.split('/')[1]}_{variant}_{p['id'][:8]}.mp4")
        urllib.request.urlretrieve(url, f); entry['file'] = f
    L = ledger(); L.append(entry); entry['total'] = round(sum(x['price'] for x in L), 2)
    json.dump(L, open(LEDGER, 'w'), indent=1)
    print(json.dumps({k: entry[k] for k in ('model', 'variant', 'status', 'price', 'total', 'file') if k in entry}))


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['schema']:
        v, s = schema(a[1]); print('version', v)
        for k, p in s['properties'].items(): print(' ', k, {x: p.get(x) for x in ('type', 'default', 'enum', 'minimum', 'maximum') if p.get(x) is not None})
    elif a[:1] == ['run']:
        kw = {}
        if '--seed' in a: kw['seed'] = int(a[a.index('--seed') + 1])
        if '--duration' in a: kw['duration'] = int(a[a.index('--duration') + 1])
        run(a[1], a[2], a[3], a[4], **kw)
    else:
        print(__doc__)

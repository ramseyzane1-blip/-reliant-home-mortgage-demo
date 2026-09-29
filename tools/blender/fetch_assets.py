"""Download the CC0 Poly Haven assets the house scene uses into tools/blender/assets/ (not committed).

    python3 tools/blender/fetch_assets.py
"""
import json, os, subprocess, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'assets')
MODELS = ['jacaranda_tree', 'tree_small_02', 'island_tree_01', 'outdoor_table_chair_set_01', 'planter_pot_clay', 'shrub_02', 'shrub_04']
TEXTURES = {'grey_roof_01': '2k', 'weathered_plank_siding': '2k', 'stone_wall_04': '1k', 'concrete_pavers': '1k',
            'leafy_grass': '2k', 'bark_brown_02': '1k'}
HDRI = 'belfast_sunset_puresky'


def get(url, dest):
    if os.path.exists(dest): return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    subprocess.run(['curl', '-sSfL', '--retry', '5', '-C', '-', '-o', dest + '.part', url], check=True)
    os.replace(dest + '.part', dest)
    print('got', os.path.relpath(dest, OUT))


def files(aid):
    req = urllib.request.Request('https://api.polyhaven.com/files/' + aid, headers={'User-Agent': 'reliant-demo-asset-fetch'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    for m in MODELS:
        g = files(m)['gltf']['1k']['gltf']
        d = os.path.join(OUT, 'models', m)
        get(g['url'], os.path.join(d, os.path.basename(g['url'])))
        for rel, inc in g.get('include', {}).items():
            get(inc['url'], os.path.join(d, rel))
    for t, res in TEXTURES.items():
        f = files(t)
        for key, name in (('Diffuse', 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough'), ('AO', 'ao'), ('Displacement', 'disp')):
            if key in f and res in f[key]:
                fmt = 'jpg' if 'jpg' in f[key][res] else 'png'
                get(f[key][res][fmt]['url'], os.path.join(OUT, 'textures', t, f'{name}.{fmt}'))
    h = files(HDRI)['hdri']['2k']['hdr']
    get(h['url'], os.path.join(OUT, 'hdri', HDRI + '.hdr'))


if __name__ == '__main__':
    main()

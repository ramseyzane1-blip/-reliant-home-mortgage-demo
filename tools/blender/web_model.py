"""The house as a live 3D model for the web page (hero turntable).

    python3 tools/blender/web_model.py OUTDIR [atlas_px] [samples]

Builds the scene with house_scene.py and writes a light model the browser can draw in real time:
the house and grounds are joined, unwrapped into one texture atlas, and Blender's own lighting
(Cycles: the sun, the sky, bounce light, soft shadows, the lit rooms) is baked into that atlas. The
page then only paints the baked result, so it looks close to the renders and costs little to draw.
The lighting turns with the house (like walking around a real house on a sunny afternoon).

Writes into OUTDIR: house.glb + house.png (house, trunks, crown cores: one baked atlas), ground.png
(the lawn disc, baked flat, alpha = where grass grows), cards.glb + twigs.png (the leafy twigs as
cards with baked light per corner), ring.glb + ring.png. tools/pack_web_model.py compresses them
into demo/site/images/model/.
"""
import os, sys, math, time
import bpy, bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.argv, ARGS = ['house_scene.py'], sys.argv[1:]
import house_scene as hs

D, C = bpy.data, bpy.context


def is_veg(o):
    """vegetation is handled separately (cards): scatter carriers and the scanned trees"""
    return any(m.type == 'NODES' for m in o.modifiers) or o.name.startswith('evg')   # (the dark crown cores are baked with the house)


GROUND = ('lawn',)   # baked flat (its grass blades are too heavy for the page, which grows shell grass on it)
R = 11.25                          # the lawn disc's radius
CURTAIN_GLOW = float(os.environ.get('CURTAIN_GLOW', '2.0'))   # matched to the renders' lit curtains


def house_objects():
    out = []; vl = C.scene.objects   # (view_layer.objects misses some objects in Blender 5.0, like the walk)
    for o in D.objects:
        # only what the render shows (not the hidden templates the scatter and tree instances copy)
        if o.type != 'MESH' or o.hide_render or o.name not in vl or is_veg(o) or o.name.startswith('ring') or o.name in GROUND:
            continue
        if any(s.material and s.material.name == 'pane' for s in o.material_slots):
            continue   # window glass: drawn on the page as a faint reflection, not baked
        out.append(o)
    return out


def instancers(tree):
    """collection instances (empties): the scanned trees (tree=True) or everything else, like the patio set"""
    return [o for o in D.objects if o.type == 'EMPTY' and o.instance_type == 'COLLECTION' and o.instance_collection
            and not o.hide_render and o.name in C.scene.objects and ('tree' in o.instance_collection.name) == tree]


def joined_copy(objs, name, empties=()):
    """one mesh with every modifier applied, in world space (the house at rotation 0); empties: collection
    instances whose meshes are added too"""
    dg = C.evaluated_depsgraph_get()
    bm = bmesh.new(); mats = []
    def add(ev, mw):
        me = ev.to_mesh(); me.transform(mw)
        idx = []
        for s in ev.material_slots:
            m = s.material
            if m not in mats: mats.append(m)
            idx.append(mats.index(m))
        for p in me.polygons:
            if idx: p.material_index = idx[p.material_index] if p.material_index < len(idx) else idx[0]
        bm.from_mesh(me); ev.to_mesh_clear()
    for o in objs: add(o.evaluated_get(dg), o.matrix_world)
    names = {e.name for e in empties}
    for oi in dg.object_instances:
        if oi.is_instance and oi.parent and oi.parent.name in names and oi.object.type == 'MESH':
            add(oi.object, oi.matrix_world.copy())
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = D.objects.new(name, me); C.scene.collection.objects.link(ob)
    return ob


def unwrap(ob, margin):
    for o in C.view_layer.objects: o.select_set(False)
    C.view_layer.objects.active = ob; ob.select_set(True)
    me = ob.data
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='bake')
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=1.0)
    bpy.ops.uv.pack_islands(margin=margin, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake(ob, px, samples, path):
    # bake in float (sunlit walls go above 1.0), then save through the scene's view transform (AgX,
    # its look and exposure), exactly like the renders: the page shows the texture as is
    img = D.images.new(os.path.basename(path), px, px, alpha=False, float_buffer=True)
    for m in ob.data.materials:
        if not m or not m.use_nodes: continue
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; n.name = 'BAKE'
        for x in m.node_tree.nodes: x.select = False
        n.select = True; m.node_tree.nodes.active = n
    sc = C.scene; sc.cycles.samples = samples; sc.cycles.use_denoising = False
    sc.render.bake.margin = 6; sc.render.bake.use_selected_to_active = False
    for o in C.view_layer.objects: o.select_set(False)
    C.view_layer.objects.active = ob; ob.select_set(True)
    t = time.time(); bpy.ops.object.bake(type='COMBINED'); print('baked %dpx in %.0fs' % (px, time.time() - t), flush=True)
    st = sc.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGB'; st.color_depth = '8'
    img.save_render(path, scene=sc)
    return img


BLADE = (.15, .21, .045)   # mean albedo of the grass blades (house_scene.py 'blade')
LAWN_K = float(os.environ.get('LAWN_K', '2.4'))   # blades catch more of the low sun than flat ground: matched to the renders


def bake_float(ob, px, samples, typ, color=True):
    """bake into a float image with a single UV layer; returns linear pixels (px x px x 3, rows bottom-up)"""
    import numpy as np
    img = D.images.new('bk_' + typ, px, px, alpha=False, float_buffer=True)
    for m in ob.data.materials:
        if not m or not m.use_nodes: continue
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img
        for x in m.node_tree.nodes: x.select = False
        n.select = True; m.node_tree.nodes.active = n
    sc = C.scene; b = sc.render.bake; b.target = 'IMAGE_TEXTURES'; b.margin = 6
    b.use_pass_direct = True; b.use_pass_indirect = True; b.use_pass_color = color; sc.cycles.samples = samples
    for o in C.view_layer.objects: o.select_set(False)
    C.view_layer.objects.active = ob; ob.select_set(True)
    t = time.time(); bpy.ops.object.bake(type=typ); print('%s %dpx in %.0fs' % (typ, px, time.time() - t), flush=True)
    a = np.empty(px * px * 4, np.float32); img.pixels.foreach_get(a)
    # (the image and its node stay: removing them mid-run crashes Blender; the next bake adds its own active node)
    return a.reshape(px, px, 4)[..., :3]


def ground(out, px, samples):
    """The lawn disc baked flat, with a top-down UV (u = x, v = y over the disc). Where grass grows,
    the grass blades' green under the light that falls on the lawn (the blades themselves are too
    heavy for the page, which grows shell grass there); elsewhere (under the walk, the house, the
    beds, the patio) the ground as it is. Alpha marks where grass grows."""
    import numpy as np
    G = joined_copy([D.objects[n] for n in GROUND], 'ground_web')
    me = G.data
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    uvl = me.uv_layers.new(name='bake')
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (co.x / (2 * R) + .5, co.y / (2 * R) + .5)
    grass = D.objects['lawn_grass']
    for o in [D.objects[n] for n in GROUND] + [grass]: o.hide_render = True
    comb = bake_float(G, px, samples, 'COMBINED')
    # the light alone: the same bake with the disc painted plain matte white (a lighting-only
    # DIFFUSE bake right after this one crashes Blender 5.0)
    white = D.materials.new('white'); white.use_nodes = True; bs = white.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (1, 1, 1, 1); bs.inputs['Roughness'].default_value = 1.0
    bs.inputs['Specular IOR Level'].default_value = 0.0
    for i in range(len(me.materials)): me.materials[i] = white
    light = bake_float(G, px, samples, 'COMBINED')
    # where the grass grows: the faces of the grass carrier (its faces were cleared off the walk,
    # the beds, the patio and from under the house)
    mask = np.zeros((px, px), bool); gm = grass.data; M = grass.matrix_world
    for poly in gm.polygons:
        vs = [M @ gm.vertices[i].co for i in poly.vertices]
        xs = [(v.x / (2 * R) + .5) * px for v in vs]; ys = [(v.y / (2 * R) + .5) * px for v in vs]
        mask[max(0, int(min(ys))):min(px, int(np.ceil(max(ys))) + 1), max(0, int(min(xs))):min(px, int(np.ceil(max(xs))) + 1)] = True
    lin = np.where(mask[..., None], np.array(BLADE) * light * LAWN_K, comb)
    disp = view_transform(lin.reshape(-1, 3), C.scene, os.path.join(out, '_vt.png')).reshape(px, px, 3)
    rgba = np.concatenate([np.clip(disp, 0, 1), mask[..., None].astype(np.float32)], -1)
    from PIL import Image
    Image.fromarray((np.flipud(rgba) * 255 + .5).astype(np.uint8), 'RGBA').save(os.path.join(out, 'ground.png'))
    grass.hide_render = False
    D.objects.remove(G)


def srgb_to_lin(c):
    import numpy as np
    c = np.asarray(c, np.float32)
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def view_transform(lin, sc, tmp):
    """scene-linear colors (N x 3) through the scene's view transform, as the renders show them (0..1)"""
    import numpy as np
    n = len(lin); w = 1024; h = (n + w - 1) // w
    im = D.images.new('vt', w, h, alpha=True, float_buffer=True)
    px = np.ones((h * w, 4), np.float32); px[:n, :3] = lin; im.pixels.foreach_set(px.ravel())
    st = sc.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGB'; st.color_depth = '16'
    im.save_render(tmp, scene=sc); D.images.remove(im)
    back = D.images.load(tmp); out = np.empty(h * w * 4, np.float32); back.pixels.foreach_get(out); D.images.remove(back)
    # loaded 16-bit PNG pixels come back linearized from sRGB: re-encode to display values
    out = out.reshape(-1, 4)[:n, :3]
    return np.where(out <= .0031308, out * 12.92, 1.055 * np.power(np.clip(out, 0, None), 1 / 2.4) - .055)


def twig_atlas(out, n=10, cell=256):
    """Each twig template photographed from its outward side, on a transparent background, into one
    atlas (5 x 2 cells). Returns per twig: the square it covers in its own space and its atlas cell."""
    import numpy as np
    twigs = [D.objects['twig%d' % k] for k in range(n)]
    sc = D.scenes.new('imp'); sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32
    sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = cell
    vs, ms = sc.view_settings, C.scene.view_settings
    vs.view_transform = ms.view_transform; vs.look = ms.look; vs.exposure = ms.exposure
    w = D.worlds.new('impw'); w.use_nodes = True; bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 1.4; sc.world = w
    cam = D.cameras.new('impcam'); cam.type = 'ORTHO'; co = D.objects.new('impcam', cam); sc.collection.objects.link(co); sc.camera = co
    atlas = np.zeros((2 * cell, 5 * cell, 4), np.float32); info = {}
    for k, t in enumerate(twigs):
        sc.collection.objects.link(t); t.hide_render = False
        v = np.empty(len(t.data.vertices) * 3, np.float32); t.data.vertices.foreach_get('co', v); v = v.reshape(-1, 3)
        x0, y0 = np.percentile(v[:, 0], 1), np.percentile(v[:, 1], 1); x1, y1 = np.percentile(v[:, 0], 99), np.percentile(v[:, 1], 99)
        cx, cy, side = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) * 1.05
        co.location = (cx, cy, v[:, 2].max() + 5); cam.ortho_scale = side
        fp = os.path.join(out, '_twig%d.png' % k); sc.render.filepath = fp
        st = sc.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGBA'
        bpy.ops.render.render(write_still=True, scene=sc.name)
        sc.collection.objects.unlink(t)
        im = D.images.load(fp); a = np.empty(cell * cell * 4, np.float32); im.pixels.foreach_get(a); D.images.remove(im); os.remove(fp)
        a = a.reshape(cell, cell, 4)   # rows bottom-up, linear
        r, c = divmod(k, 5)
        atlas[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell] = a
        info['twig%d' % k] = dict(cx=cx, cy=cy, s=side, z=float(np.median(v[:, 2])), cell=(c, r))
    D.scenes.remove(sc)
    return atlas, info


def veg_cards(out, cell=256, samples=32):
    """The leafy twigs of every crown and shrub, and the scanned trees' own leaves, as flat cards:
    one quad per twig showing its photo, lit by light baked at the card's corners."""
    import numpy as np, random
    atlas, info = twig_atlas(out, cell=cell)
    dg = C.evaluated_depsgraph_get()
    V, UV, F = [], [], []
    def card(M, tw):
        t = info[tw]; h = t['s'] / 2; c, r = t['cell']
        loc = [(t['cx'] - h, t['cy'] - h), (t['cx'] + h, t['cy'] - h), (t['cx'] + h, t['cy'] + h), (t['cx'] - h, t['cy'] + h)]
        uv = [(c / 5, r / 2), ((c + 1) / 5, r / 2), ((c + 1) / 5, (r + 1) / 2), (c / 5, (r + 1) / 2)]
        i = len(V)
        for (x, y), u in zip(loc, uv):
            V.append(tuple(M @ Vector((x, y, t['z'])))); UV.append(u)
        F.append((i, i + 1, i + 2, i + 3))
    from mathutils import Vector, Matrix
    n_twig = 0
    trees = []
    for oi in dg.object_instances:
        if not oi.is_instance: continue
        nm = oi.object.name
        if nm in info:
            card(oi.matrix_world.copy(), nm); n_twig += 1
        elif nm.startswith('tree_small_02') and oi.object.type == 'MESH':
            trees.append((oi.object.data.copy(), oi.matrix_world.copy()))
    print('twig cards', n_twig, flush=True)
    # the scanned trees' own leaves: one card per 0.4 m cell of leaves, facing out from the trunk
    rnd = random.Random(7); n_leaf = 0
    for me, M in trees:
        lm = [i for i, m in enumerate(me.materials) if m and 'leaves' in m.name]
        cen = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get('center', cen); cen = cen.reshape(-1, 3)
        mi = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('material_index', mi)
        pts = np.array([tuple(M @ Vector(p)) for p in cen[np.isin(mi, lm)][::7]])
        if not len(pts): continue
        sc_ = M.to_scale()[0]; vox = .45 * sc_ * 1.6
        keys = {}
        for p in pts: keys.setdefault(tuple((p // vox).astype(int)), []).append(p)
        axis = np.array(M.translation)
        for ps in keys.values():
            p = np.mean(ps, 0); d = p - axis; d[2] = (p[2] - axis[2] - 3 * sc_) * .5
            d = Vector(d.tolist()).normalized()
            R = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4() @ Matrix.Rotation(rnd.uniform(0, 6.283), 4, 'Z')
            tw = 'twig%d' % rnd.randrange(10); s = rnd.uniform(1.1, 1.6) * sc_ * 1.2
            card(Matrix.Translation(Vector(p.tolist())) @ R @ Matrix.Scale(s, 4), tw); n_leaf += 1
        D.meshes.remove(me)
    print('tree leaf cards', n_leaf, flush=True)
    me = D.meshes.new('veg_cards'); me.from_pydata(V, [], F)
    uvl = me.uv_layers.new(name='uv')
    for poly in me.polygons:
        for li in poly.loop_indices: uvl.data[li].uv = UV[me.loops[li].vertex_index]
    ob = D.objects.new('veg_cards', me); C.scene.collection.objects.link(ob)
    # the atlas as a material, so the cards cast and catch leafy shadows in the bake
    img = D.images.new('twig_atlas', 5 * cell, 2 * cell, alpha=True, float_buffer=True); img.pixels.foreach_set(atlas.ravel())
    m = D.materials.new('cards'); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img; ti.interpolation = 'Closest'
    nt.links.new(ti.outputs['Color'], bs.inputs['Base Color']); nt.links.new(ti.outputs['Alpha'], bs.inputs['Alpha'])
    me.materials.append(m)
    return ob, atlas, info


def trunks(ratio=.03):
    """the scanned trees' trunks and branches (leaves become cards), simplified, as plain objects"""
    dg = C.evaluated_depsgraph_get(); out = []
    for oi in dg.object_instances:
        if not (oi.is_instance and oi.object.type == 'MESH' and oi.object.name.startswith('tree_small_02')): continue
        me = oi.object.data.copy(); bm = bmesh.new(); bm.from_mesh(me)
        lm = {i for i, m in enumerate(me.materials) if m and 'leaves' in m.name}
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in lm], context='FACES')
        bm.to_mesh(me); bm.free()
        ob = D.objects.new('trunk', me); C.scene.collection.objects.link(ob); ob.matrix_world = oi.matrix_world.copy()
        md = ob.modifiers.new('d', 'DECIMATE'); md.ratio = ratio
        out.append(ob)
    return out


def bake_cards(cards, atlas, out, samples):
    """Light at every card corner (Cycles, the cards shading each other and the house), times the
    leaves' color, through the view transform: the cards' vertex colors. Each card gets its own
    4 x 4 px cell in a lighting image (image bakes are reliable where vertex-color bakes are not);
    each corner reads its own texel. The atlas is stored as detail around its mean, so on the page
    color = vertex color x texture x 2 (in display values)."""
    import numpy as np
    sc = C.scene; me = cards.data; nc = len(me.polygons)
    g = int(np.ceil(np.sqrt(nc))); cell = 4; px = g * cell
    lm = me.uv_layers.new(name='lm')
    k = np.arange(nc); cx, cy = k % g, k // g
    # each card fills its cell; each corner reads the inner texel nearest to it (the bake only fills
    # texels whose centers are inside the card, so the cell's edge texels may stay empty)
    uvs = np.zeros((nc, 4, 2), np.float32); read = np.zeros((nc, 4, 2), np.int64)
    for j, (u, v) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uvs[:, j, 0] = (cx + u) * cell / px; uvs[:, j, 1] = (cy + v) * cell / px
        read[:, j, 0] = cx * cell + 1 + u; read[:, j, 1] = cy * cell + 1 + v
    lm.data.foreach_set('uv', uvs.ravel())      # every card is a quad, loops in order
    me.uv_layers.active = lm
    m = me.materials[0]; nt = m.node_tree
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'uv'
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE': nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
    # solid where the light is measured (a transparent point has no diffuse light to bake: the card
    # corners are outside the leaves), see-through by the photo's alpha for the shadows cards cast
    bs = nt.nodes['Principled BSDF']; lk = [l for l in nt.links if l.to_socket == bs.inputs['Alpha']]
    alpha_src = lk[0].from_socket
    for l in lk: nt.links.remove(l)
    outn = nt.nodes['Material Output']; lp = nt.nodes.new('ShaderNodeLightPath'); tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(alpha_src, mx.inputs['Fac']); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(bs.outputs[0], mx.inputs[2])
    sh = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(lp.outputs['Is Shadow Ray'], sh.inputs['Fac'])
    nt.links.new(bs.outputs[0], sh.inputs[1]); nt.links.new(mx.outputs[0], sh.inputs[2]); nt.links.new(sh.outputs[0], outn.inputs['Surface'])
    img = D.images.new('card_light', px, px, alpha=False, float_buffer=True)
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img
    for x in nt.nodes: x.select = False
    tn.select = True; nt.nodes.active = tn
    b = sc.render.bake; b.target = 'IMAGE_TEXTURES'; b.margin = 0
    b.use_pass_direct = True; b.use_pass_indirect = True; b.use_pass_color = False; sc.cycles.samples = samples
    for o in C.view_layer.objects: o.select_set(False)
    C.view_layer.objects.active = cards; cards.select_set(True)
    t = time.time(); bpy.ops.object.bake(type='DIFFUSE'); print('card light %dpx in %.0fs' % (px, time.time() - t), flush=True)
    L = np.empty(px * px * 4, np.float32); img.pixels.foreach_get(L); L = L.reshape(px, px, 4)[..., :3]
    light = L[read[..., 1], read[..., 0]].reshape(-1, 3)   # per loop (card by card, corner by corner)
    print('card light mean', light.mean(0), flush=True)
    a = atlas.reshape(-1, 4); solid = a[:, 3] > .5
    albedo = a[solid, :3].mean(0) / 1.4          # the photos were lit by a white sky of strength 1.4
    disp = view_transform(light * albedo, sc, os.path.join(out, '_vt.png'))
    lin = srgb_to_lin(np.clip(disp, 0, 1))
    ca = me.color_attributes.new('light', 'FLOAT_COLOR', 'CORNER'); me.color_attributes.active_color = ca
    ca.data.foreach_set('color', np.concatenate([lin, np.ones((len(lin), 1), np.float32)], 1).ravel())
    me.uv_layers.active_index = 0   # the photo UVs are TEXCOORD_0 on the page
    # the detail texture: the photos in display values, around their mean, at half scale
    enc = lambda x: np.where(x <= .0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - .055)
    d = enc(a[:, :3]); mean = d[solid].mean(0)
    tex = np.concatenate([np.clip(d / mean * .5, 0, 1), a[:, 3:4]], 1).reshape(atlas.shape)
    from PIL import Image
    Image.fromarray((np.flipud(tex) * 255 + .5).astype(np.uint8), 'RGBA').save(os.path.join(out, 'twigs.png'))


def main(out, px=2048, samples=64):
    os.makedirs(out, exist_ok=True)
    P = hs.build(960, samples)
    P.rotation_euler = (0, 0, 0)
    objs = house_objects()
    print('house objects', len(objs), flush=True)
    if not os.environ.get('HOUSE_ONLY'): ground(out, px, samples)
    extra = instancers(False)
    tr = trunks()
    H = joined_copy(objs + tr, 'house_web', extra)
    for o in tr: D.objects.remove(o)
    print('triangles', sum(len(p.vertices) - 2 for p in H.data.polygons), flush=True)
    for o in objs + extra: o.hide_render = True   # the joined copy stands in for them during the bake
    # a bake lights only the side a face points to (the renders light both), so point every face
    # outward: thin pieces built inside out (window muntins, sashes) would otherwise bake black
    bm = bmesh.new(); bm.from_mesh(H.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(H.data); bm.free()
    # the sheer curtains glow from the lamps behind them (subsurface light, which bakes black from
    # the front): baked as that glow
    cm = D.materials.get('curtain')
    if cm:
        b = cm.node_tree.nodes['Principled BSDF']; b.inputs['Subsurface Weight'].default_value = 0
        b.inputs['Emission Color'].default_value = (1, .78, .52, 1); b.inputs['Emission Strength'].default_value = CURTAIN_GLOW
    unwrap(H, .002)
    bake(H, px, samples, os.path.join(out, 'house.png'))
    for o in C.view_layer.objects: o.select_set(False)
    H.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'house.glb'), export_format='GLB', use_selection=True,
                              export_materials='NONE', export_normals=False, export_texcoords=True, export_yup=True)
    # the window glass: drawn on the page as a faint warm reflection over the windows
    panes = [o for o in D.objects if o.type == 'MESH' and o.name in C.scene.objects and any(s_.material and s_.material.name == 'pane' for s_ in o.material_slots)]
    PN = joined_copy(panes, 'panes_web')
    for o in C.view_layer.objects: o.select_set(False)
    PN.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'panes.glb'), export_format='GLB', use_selection=True,
                              export_materials='NONE', export_normals=False, export_texcoords=False, export_yup=True)
    D.objects.remove(PN)
    if os.environ.get('HOUSE_ONLY'): return
    # trees and shrubs: cards, lit with the house (now the baked copy) and each other
    cards, atlas, info = veg_cards(out)
    for o in D.objects:
        if is_veg(o): o.hide_render = True
    for e in instancers(True): e.hide_render = True
    bake_cards(cards, atlas, out, samples)
    for o in C.view_layer.objects: o.select_set(False)
    cards.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'cards.glb'), export_format='GLB', use_selection=True,
                              export_materials='NONE', export_normals=False, export_texcoords=True, export_yup=True,
                              export_vertex_color='ACTIVE')
    # the ring, which does not turn: its own small atlas
    rg = D.objects['ring']; RG = joined_copy([rg], 'ring_web'); rg.hide_render = True
    unwrap(RG, .004); bake(RG, 1024, samples, os.path.join(out, 'ring.png'))
    for o in C.view_layer.objects: o.select_set(False)
    RG.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'ring.glb'), export_format='GLB', use_selection=True,
                              export_materials='NONE', export_normals=False, export_texcoords=True, export_yup=True)
    print('wrote', out, flush=True)


if __name__ == '__main__':
    main(ARGS[0], int(ARGS[1]) if len(ARGS) > 1 else 2048, int(ARGS[2]) if len(ARGS) > 2 else 64)

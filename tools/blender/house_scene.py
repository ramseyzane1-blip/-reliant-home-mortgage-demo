"""Procedural model of the Reliant model home, rendered as a 360-degree turntable.

    python3 tools/blender/house_scene.py preview [angle]     one test frame -> scratch png
    python3 tools/blender/house_scene.py frames N OUTDIR     N frames around the house

Needs the `bpy` package (pip install bpy). Everything is built in code so the model stays
consistent from every angle: a two-story colonial with a one-and-a-half story side wing,
portico and green front door, glowing windows, trees and shrubs on a round lawn, the sand
plinth, and the logo-swoosh ring. The house and plinth turn; the camera, lights and ring stay.
Units are meters, Z up, the front of the house faces -Y.
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Euler

rng = random.Random(7)
C = bpy.context
D = bpy.data


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------- materials
def _mat(name):
    m = D.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m, nt, bsdf


def mat_basic(name, color, rough=.6, spec=.3):
    m, nt, b = _mat(name)
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = spec
    return m


def _coord(nt):
    tc = nt.nodes.new('ShaderNodeTexCoord'); return tc.outputs['Object']


def mat_noisy(name, c1, c2, scale=3., rough=.7, bump=.2, bscale=40.):
    m, nt, b = _mat(name)
    co = _coord(nt)
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 6
    nt.links.new(co, n.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs[6].default_value = (*c1, 1); mix.inputs[7].default_value = (*c2, 1)
    nt.links.new(n.outputs['Fac'], mix.inputs[0])
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    if bump:
        n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = bscale; n2.inputs['Detail'].default_value = 8
        nt.links.new(co, n2.inputs['Vector'])
        bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump
        nt.links.new(n2.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_bands(name, color, period, dark=.82, rough=.6, bump=.5, stagger=False):
    """Lap siding / shingle rows: sawtooth along world-ish Z (object coords)."""
    m, nt, b = _mat(name)
    co = _coord(nt)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(co, sep.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 1 / period
    nt.links.new(sep.outputs['Z'], mul.inputs[0])
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(mul.outputs[0], fr.inputs[0])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = .35
    nt.links.new(fr.outputs[0], pw.inputs[0])
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 6; noise.inputs['Detail'].default_value = 5
    nt.links.new(co, noise.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeMapRange'); ramp.inputs['To Min'].default_value = dark; ramp.inputs['To Max'].default_value = 1.0
    nt.links.new(pw.outputs[0], ramp.inputs['Value'])
    mulc = nt.nodes.new('ShaderNodeMix'); mulc.data_type = 'RGBA'; mulc.blend_type = 'MULTIPLY'; mulc.inputs[0].default_value = 1
    mulc.inputs[6].default_value = (*color, 1)
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nm = nt.nodes.new('ShaderNodeMath'); nm.operation = 'MULTIPLY_ADD'; nm.inputs[1].default_value = .12; nm.inputs[2].default_value = .94
    nt.links.new(noise.outputs['Fac'], nm.inputs[0])
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'
    nt.links.new(ramp.outputs[0], m2.inputs[0]); nt.links.new(nm.outputs[0], m2.inputs[1])
    for k in range(3): nt.links.new(m2.outputs[0], comb.inputs[k])
    nt.links.new(comb.outputs[0], mulc.inputs[7])
    nt.links.new(mulc.outputs[2], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = .02
    nt.links.new(pw.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs[0], b.inputs['Normal'])
    return m


def mat_glass():
    """Lit window seen from outside: warm room glow, pale curtains gathered at each side,
    a faint reflection of the sky, a little variation per window."""
    m, nt, b = _mat('glass')
    out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]
    nt.nodes.remove(b)
    L = nt.links.new
    uv = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); L(uv.outputs['UV'], sep.inputs[0])
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    room = nt.nodes.new('ShaderNodeValToRGB')      # per-window room color
    room.color_ramp.elements[0].color = (1.0, .45, .14, 1); room.color_ramp.elements[1].color = (1.0, .66, .32, 1)
    L(oi.outputs['Random'], room.inputs[0])
    vg = nt.nodes.new('ShaderNodeValToRGB')        # lamp light pools in the lower middle of the room
    vg.color_ramp.elements[0].color = (1, 1, 1, 1); vg.color_ramp.elements[1].color = (.35, .35, .35, 1)
    L(sep.outputs['Y'], vg.inputs[0])
    roomc = nt.nodes.new('ShaderNodeMix'); roomc.data_type = 'RGBA'; roomc.blend_type = 'MULTIPLY'; roomc.inputs[0].default_value = 1
    L(room.outputs[0], roomc.inputs[6]); L(vg.outputs[0], roomc.inputs[7])
    cm = nt.nodes.new('ShaderNodeValToRGB')        # curtain mask across the window
    cr = cm.color_ramp; cr.interpolation = 'EASE'
    cr.elements[0].position = 0; cr.elements[0].color = (1, 1, 1, 1)
    cr.elements[1].position = 1; cr.elements[1].color = (1, 1, 1, 1)
    for p, c in ((.17, 1), (.24, 0), (.76, 0), (.83, 1)):
        e = cr.elements.new(p); e.color = (c, c, c, 1)
    L(sep.outputs['X'], cm.inputs[0])
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'
    wv.inputs['Scale'].default_value = 9; wv.inputs['Distortion'].default_value = 1.5
    L(uv.outputs['UV'], wv.inputs['Vector'])
    fold = nt.nodes.new('ShaderNodeMapRange'); fold.inputs['To Min'].default_value = .55; fold.inputs['To Max'].default_value = 1.0
    L(wv.outputs['Fac'], fold.inputs['Value'])
    curt = nt.nodes.new('ShaderNodeMix'); curt.data_type = 'RGBA'; curt.blend_type = 'MULTIPLY'; curt.inputs[0].default_value = 1
    curt.inputs[6].default_value = (.95, .72, .45, 1)
    fc = nt.nodes.new('ShaderNodeCombineXYZ')
    for k in range(3): L(fold.outputs[0], fc.inputs[k])
    L(fc.outputs[0], curt.inputs[7])
    mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'
    L(cm.outputs[0], mixc.inputs[0]); L(roomc.outputs[2], mixc.inputs[6]); L(curt.outputs[2], mixc.inputs[7])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 2.6
    L(mixc.outputs[2], em.inputs['Color'])
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = .03
    fr = nt.nodes.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.5
    mix = nt.nodes.new('ShaderNodeMixShader')
    L(fr.outputs[0], mix.inputs[0]); L(em.outputs[0], mix.inputs[1]); L(gl.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs[0])
    return m


def mat_pane():
    """Window glass: see-through (so rooms show), reflective at grazing angles, lets light out."""
    m, nt, b = _mat('pane'); out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]; nt.nodes.remove(b)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.inputs[0].default_value = (.9, .93, .92, 1)
    gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = .02
    fr = nt.nodes.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.52
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(fr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(gl.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    return m


def mat_curtain():
    m, nt, b = _mat('curtain')
    b.inputs['Base Color'].default_value = (.78, .7, .56, 1); b.inputs['Roughness'].default_value = .8
    b.inputs['Transmission Weight'].default_value = .0
    b.inputs['Subsurface Weight'].default_value = .35; b.inputs['Subsurface Radius'].default_value = (.3, .2, .1)
    return m


def mat_shade():
    m, nt, b = _mat('shade')
    b.inputs['Base Color'].default_value = (.9, .8, .6, 1)
    b.inputs['Emission Color'].default_value = (1, .7, .38, 1); b.inputs['Emission Strength'].default_value = 3.0
    return m


def mat_interior():
    """Inside faces of the walls: painted walls, a wood floor (faces pointing up), white ceiling."""
    m, nt, b = _mat('interior')
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
    cr.elements[0].position = 0; cr.elements[0].color = (.8, .78, .72, 1)      # ceiling (normal down)
    cr.elements[1].position = .75; cr.elements[1].color = (.32, .18, .09, 1)   # floor (normal up)
    e = cr.elements.new(.3); e.color = (.62, .5, .38, 1)                        # walls
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1; mr.inputs['From Max'].default_value = 1
    nt.links.new(sep.outputs['Z'], mr.inputs['Value']); nt.links.new(mr.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color']); b.inputs['Roughness'].default_value = .6
    return m


def mat_dark_glass():
    m, nt, b = _mat('darkglass')
    b.inputs['Base Color'].default_value = (.02, .025, .03, 1); b.inputs['Roughness'].default_value = .05
    b.inputs['Emission Color'].default_value = (.35, .45, .6, 1); b.inputs['Emission Strength'].default_value = .15
    return m


def mat_leaf(name, greens):
    m, nt, b = _mat(name)
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*greens[0], 1); ramp.color_ramp.elements[1].color = (*greens[1], 1)
    e = ramp.color_ramp.elements.new(.5); e.color = (*greens[2], 1)
    nt.links.new(oi.outputs['Random'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = .55
    b.inputs['Subsurface Weight'].default_value = .15
    b.inputs['Subsurface Radius'].default_value = (.1, .2, .05)
    return m


ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')


def _img(nt, path, color=True, proj='BOX'):
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = D.images.load(path, check_existing=True)
    if not color: n.image.colorspace_settings.name = 'Non-Color'
    n.projection = proj
    if proj == 'BOX': n.projection_blend = .2
    return n


def mat_pbr(name, tid, scale, tint=None, rot=0.0, proj='BOX', rough_mul=1.0, nor=1.0, sat=None, mul=None, detail=(0, .35)):
    """Scanned Poly Haven material mapped in object space (meters). tint recolors the albedo while
    keeping its detail (e.g. plank siding painted beige)."""
    d = os.path.join(ASSETS, 'textures', tid)
    m, nt, b = _mat(name)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / scale,) * 3
    mp.inputs['Rotation'].default_value = (0, 0, rot)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    vec = mp.outputs[0]
    diff = _img(nt, os.path.join(d, 'diff.jpg'), True, proj); nt.links.new(vec, diff.inputs[0])
    col = diff.outputs['Color']
    if tint is not None:
        # repaint: keep only the scan's light/dark detail (grain, board edges) around the tint color
        rgb2bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(col, rgb2bw.inputs[0])
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = detail[0]; mr.inputs['From Max'].default_value = detail[1]
        mr.inputs['To Min'].default_value = .62; mr.inputs['To Max'].default_value = 1.08
        nt.links.new(rgb2bw.outputs[0], mr.inputs['Value'])
        cb = nt.nodes.new('ShaderNodeCombineXYZ')
        for k in range(3): nt.links.new(mr.outputs[0], cb.inputs[k])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1
        nt.links.new(cb.outputs[0], mx.inputs[6]); mx.inputs[7].default_value = (*tint, 1)
        col = mx.outputs[2]
    if mul is not None:
        mm = nt.nodes.new('ShaderNodeMix'); mm.data_type = 'RGBA'; mm.blend_type = 'MULTIPLY'; mm.inputs[0].default_value = 1
        nt.links.new(col, mm.inputs[6]); mm.inputs[7].default_value = (*mul, 1); col = mm.outputs[2]
    if sat is not None:
        hs2 = nt.nodes.new('ShaderNodeHueSaturation'); hs2.inputs['Saturation'].default_value = sat
        nt.links.new(col, hs2.inputs['Color']); col = hs2.outputs[0]
    nt.links.new(col, b.inputs['Base Color'])
    rp = os.path.join(d, 'rough.jpg')
    if os.path.exists(rp):
        r = _img(nt, rp, False, proj); nt.links.new(vec, r.inputs[0])
        rm = nt.nodes.new('ShaderNodeMath'); rm.operation = 'MULTIPLY'; rm.inputs[1].default_value = rough_mul
        nt.links.new(r.outputs['Color'], rm.inputs[0]); nt.links.new(rm.outputs[0], b.inputs['Roughness'])
    npth = os.path.join(d, 'nor.jpg')
    if os.path.exists(npth) and nor:
        n = _img(nt, npth, False, proj); nt.links.new(vec, n.inputs[0])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = nor
        nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
    b.inputs['Specular IOR Level'].default_value = .35
    return m


def scatter(ob, inst, density, smin, smax, seed, up_only=False, tilt=.35, name='scatter'):
    """Geometry Nodes: scatter instances of `inst` over ob's faces, aligned to the surface with
    random twist and tilt. Deterministic, so every frame of the turn shows the same leaves."""
    ng = D.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; L = ng.links.new
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    dist = N.new('GeometryNodeDistributePointsOnFaces'); dist.distribute_method = 'RANDOM'
    dist.inputs['Density'].default_value = density; dist.inputs['Seed'].default_value = seed
    L(gi.outputs[0], dist.inputs['Mesh'])
    if up_only:
        nrm = N.new('GeometryNodeInputNormal'); sep = N.new('ShaderNodeSeparateXYZ')
        cmp = N.new('FunctionNodeCompare'); cmp.data_type = 'FLOAT'; cmp.operation = 'GREATER_THAN'; cmp.inputs[1].default_value = .8
        L(nrm.outputs['Normal'], sep.inputs[0]); L(sep.outputs['Z'], cmp.inputs[0]); L(cmp.outputs[0], dist.inputs['Selection'])
    oi = N.new('GeometryNodeObjectInfo'); oi.inputs['Object'].default_value = inst; oi.transform_space = 'ORIGINAL'
    oi.inputs['As Instance'].default_value = True
    iop = N.new('GeometryNodeInstanceOnPoints')
    L(dist.outputs['Points'], iop.inputs['Points']); L(oi.outputs['Geometry'], iop.inputs['Instance'])
    rv = N.new('FunctionNodeRandomValue'); rv.data_type = 'FLOAT_VECTOR'
    rv.inputs[0].default_value = (-tilt, -tilt, 0); rv.inputs[1].default_value = (tilt, tilt, 6.2832); rv.inputs['Seed'].default_value = seed + 1
    e2r = N.new('FunctionNodeEulerToRotation'); L(rv.outputs[0], e2r.inputs[0])
    rr = N.new('FunctionNodeRotateRotation'); rr.rotation_space = 'LOCAL'
    L(dist.outputs['Rotation'], rr.inputs['Rotation']); L(e2r.outputs[0], rr.inputs['Rotate By'])
    L(rr.outputs[0], iop.inputs['Rotation'])
    rs = N.new('FunctionNodeRandomValue'); rs.data_type = 'FLOAT'
    rs.inputs[2].default_value = smin; rs.inputs[3].default_value = smax; rs.inputs['Seed'].default_value = seed + 2
    L(rs.outputs[1], iop.inputs['Scale'])
    j = N.new('GeometryNodeJoinGeometry'); L(gi.outputs[0], j.inputs[0]); L(iop.outputs[0], j.inputs[0])
    L(j.outputs[0], go.inputs[0])
    md = ob.modifiers.new(name, 'NODES'); md.node_group = ng
    return md


_asset_cache = {}


def asset(mid):
    """Import a Poly Haven glTF model once into its own (unlinked) collection; returns the collection."""
    if mid in _asset_cache: return _asset_cache[mid]
    before = set(D.objects)
    path = [f for f in os.listdir(os.path.join(ASSETS, 'models', mid)) if f.endswith('.gltf')][0]
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, 'models', mid, path))
    new = [o for o in D.objects if o not in before]
    col = D.collections.new('asset_' + mid)
    for o in new:
        for c in list(o.users_collection): c.objects.unlink(o)
        col.objects.link(o)
    # put the base of the model at the origin
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    col.instance_offset = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    col['height'] = mx.z - mn.z
    _asset_cache[mid] = col
    return col


def place(mid, parent, loc, height=None, scale=None, rotz=0.0):
    col = asset(mid)
    e = D.objects.new('inst_' + mid, None); e.instance_type = 'COLLECTION'; e.instance_collection = col
    link(e, parent); e.location = loc; e.rotation_euler = (0, 0, rotz)
    k = scale if scale else height / col['height']
    e.scale = (k, k, k)
    return e


# ---------------------------------------------------------------- geometry helpers
def link(ob, parent=None):
    C.scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob


def mesh_obj(name, verts, faces, mat, parent=None, smooth=False):
    me = D.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = D.objects.new(name, me); me.materials.append(mat)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    return link(ob, parent)


def box(name, x0, x1, y0, y1, z0, z1, mat, parent=None, bevel=0.0):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_obj(name, v, f, mat, parent)
    if bevel:
        md = ob.modifiers.new('b', 'BEVEL'); md.width = bevel; md.segments = 2
    return ob


def prism_roof(name, x0, x1, y0, y1, zeave, zridge, mat, parent, axis='x', thick=.18, edge=None):
    """Gable roof slab. axis='x': ridge runs along X (gables at the x ends)."""
    if axis == 'x':
        ym = (y0 + y1) / 2
        outer = [(x0, y0, zeave), (x1, y0, zeave), (x1, ym, zridge), (x0, ym, zridge), (x1, y1, zeave), (x0, y1, zeave)]
    else:
        xm = (x0 + x1) / 2
        outer = [(x0, y0, zeave), (x0, y1, zeave), (xm, y1, zridge), (xm, y0, zridge), (x1, y1, zeave), (x1, y0, zeave)]
    # a thick two-slope shell: top surface plus underside offset down
    bm = bmesh.new()
    top = [bm.verts.new(p) for p in outer]
    bot = [bm.verts.new((p[0], p[1], p[2] - thick)) for p in outer]
    q = lambda a: bm.faces.new(a)
    if axis == 'x':
        q([top[0], top[1], top[2], top[3]]); q([top[3], top[2], top[4], top[5]])
        q([bot[3], bot[2], bot[1], bot[0]]); q([bot[5], bot[4], bot[2], bot[3]])
        q([top[0], bot[0], bot[1], top[1]]); q([top[4], bot[4], bot[5], top[5]])
        q([top[0], top[3], bot[3], bot[0]]); q([top[3], top[5], bot[5], bot[3]])
        q([top[1], bot[1], bot[2], top[2]]); q([top[2], bot[2], bot[4], top[4]])
    else:
        q([top[0], top[3], top[2], top[1]]); q([top[3], top[5], top[4], top[2]])
        q([bot[1], bot[2], bot[3], bot[0]]); q([bot[2], bot[4], bot[5], bot[3]])
        q([top[0], top[1], bot[1], bot[0]]); q([top[5], bot[5], bot[4], top[4]])
        q([top[0], bot[0], bot[3], top[3]]); q([top[3], bot[3], bot[5], top[5]])
        q([top[1], top[2], bot[2], bot[1]]); q([top[2], top[4], bot[4], bot[2]])
    # the two top slopes carry the roof material; fascia, rakes and soffit are trim
    for i, f in enumerate(bm.faces): f.material_index = 0 if i < 2 else 1
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = D.objects.new(name, me); me.materials.append(mat); me.materials.append(edge or mat)
    return link(ob, parent)


def gable_wall(name, x0, x1, y, zeave, zridge, mat, parent, depth=.05, axis='x'):
    """Triangle infill of a gable end. axis='x': triangle in the XZ plane at y."""
    xm = (x0 + x1) / 2
    if axis == 'x':
        v = [(x0, y, zeave), (x1, y, zeave), (xm, y, zridge), (x0, y + depth, zeave), (x1, y + depth, zeave), (xm, y + depth, zridge)]
    else:  # triangle in the YZ plane at x=y (reuse args: x0,x1 are y range, y is x)
        v = [(y, x0, zeave), (y, x1, zeave), (y, xm, zridge), (y + depth, x0, zeave), (y + depth, x1, zeave), (y + depth, xm, zridge)]
    f = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    return mesh_obj(name, v, f, mat, parent)


class Wall:
    """A wall plane for placing windows: origin, right vector, outward normal (all in house space)."""
    def __init__(self, origin, right, normal):
        self.o = Vector(origin); self.r = Vector(right).normalized(); self.n = Vector(normal).normalized(); self.u = Vector((0, 0, 1))

    def at(self, s, z, out=0.0):
        return self.o + self.r * s + self.u * z + self.n * out


WALL_T = .2          # wall thickness; windows are real openings through it
CUTTERS = None       # collection of boolean cutters (windows, doors) shared by walls and siding


def cutter(name, parent, M, rot, loc, x0, x1, y0, y1, z0, z1):
    ob = box(name, x0, x1, y0, y1, z0, z1, M['trim'], parent)
    ob.matrix_basis = rot.to_4x4(); ob.location = loc
    ob.hide_render = True; ob.display_type = 'WIRE'
    for c in list(ob.users_collection): c.objects.unlink(ob)
    CUTTERS.objects.link(ob)
    return ob


def curtain(name, x0, x1, z0, z1, y, mat, parent, put, seed):
    """A gathered fabric panel: a grid with soft vertical folds."""
    r = random.Random(seed); nx, nz = 14, 3
    v = []
    for j in range(nz + 1):
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            v.append((x, y + .035 * math.sin(i * 2.1 + r.uniform(0, .6)), z0 + (z1 - z0) * j / nz))
    f = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i) for j in range(nz) for i in range(nx)]
    ob = mesh_obj(name, v, f, mat, parent, smooth=True); put(ob)
    return ob


def window(wall, s, z0, w, h, M, parent, lit=True, cols=2, rows=3, name='win', room=True):
    """Double-hung window in a real opening: trim, sill and crown outside; sashes, muntins and glass
    in the opening; curtains, sometimes a lamp, and warm room light inside. s = offset along the wall,
    z0 = sill height. Local frame: x along the wall, -y out of the house, y = 0 on the wall face."""
    rot = Euler((0, 0, math.atan2(wall.n.y, wall.n.x) + math.pi / 2)).to_matrix()
    loc = wall.at(s, z0)

    def put(ob):
        ob.matrix_basis = rot.to_4x4(); ob.location = loc; return ob
    T, t, gy = WALL_T, .1, .07      # wall, trim width, glass depth into the opening
    cutter(name + 'cut', parent, M, rot, loc, -w / 2 - .01, w / 2 + .01, -.6, T + .3, -.01, h + .01)
    # glass
    me = D.meshes.new(name + 'g')
    me.from_pydata([(-w / 2, gy, 0), (w / 2, gy, 0), (w / 2, gy, h), (-w / 2, gy, h)], [], [(0, 1, 2, 3)])
    ob = D.objects.new(name + 'g', me); me.materials.append(M['pane']); link(ob, parent); put(ob)
    # outside trim
    for nm, a in [('l', (-w / 2 - t, -w / 2, -t, h + t)), ('r', (w / 2, w / 2 + t, -t, h + t)), ('t', (-w / 2 - t * 1.3, w / 2 + t * 1.3, h, h + t * 1.6))]:
        put(box(name + nm, a[0], a[1], -.11, .0, a[2], a[3], M['trim'], parent))
    put(box(name + 'sill', -w / 2 - t * 1.7, w / 2 + t * 1.7, -.19, gy, -t * .9, -t * .05, M['trim'], parent, bevel=.012))
    put(box(name + 'crown', -w / 2 - t * 1.5, w / 2 + t * 1.5, -.16, .0, h + t * 1.6, h + t * 1.85, M['trim'], parent, bevel=.01))
    # sash frames: the lower sash sits in front of the upper one
    sf = .055
    for (zz0, zz1, y0) in ((0, h / 2 + .02, gy - .045), (h / 2 - .02, h, gy - .015)):
        for (x0, x1, a0, a1) in ((-w / 2, w / 2, zz0, zz0 + sf), (-w / 2, w / 2, zz1 - sf, zz1), (-w / 2, -w / 2 + sf, zz0, zz1), (w / 2 - sf, w / 2, zz0, zz1)):
            put(box(name + 'sf', x0, x1, y0, y0 + .03, a0, a1, M['trim'], parent))
    bar = .026
    for i in range(1, cols):
        x = -w / 2 + w * i / cols
        for (zz0, zz1, y0) in ((0, h / 2, gy - .04), (h / 2, h, gy - .012)):
            put(box(name + 'mv', x - bar / 2, x + bar / 2, y0, y0 + .012, zz0, zz1, M['trim'], parent))
    for j in range(1, rows * 2):
        if j == rows: continue
        zz = h * j / (rows * 2); y0 = gy - .04 if j < rows else gy - .012
        put(box(name + 'mh', -w / 2, w / 2, y0, y0 + .012, zz - bar / 2, zz + bar / 2, M['trim'], parent))
    if not room: return
    r = random.Random(hash(name) & 0xffff)
    # curtains just inside, gathered to each side
    cw = w * r.uniform(.22, .3)
    curtain(name + 'cl', -w / 2 - .15, -w / 2 + cw, -.1, h + .25, T + .08, M['curtain'], parent, put, r.randint(0, 999))
    curtain(name + 'cr', w / 2 - cw, w / 2 + .15, -.1, h + .25, T + .08, M['curtain'], parent, put, r.randint(0, 999))
    box(name + 'rod', -w / 2 - .25, w / 2 + .25, T + .05, T + .08, h + .25, h + .28, M['metal'], parent); put(D.objects[name + 'rod'])
    if lit:
        L = D.lights.new(name + 'L', 'POINT'); L.energy = r.uniform(30, 55); L.color = (1, .58, .28); L.shadow_soft_size = .25
        lo = D.objects.new(name + 'L', L); link(lo, parent); put(lo)
        lo.location = rot @ Vector((r.uniform(-.4, .4), T + 1.6, h * .55)) + loc
        if r.random() < .5:   # a table lamp glowing in the room
            sx = r.choice((-1, 1)) * w * .25
            lamp = D.meshes.new(name + 'lamp'); bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=False, segments=16, radius1=.2, radius2=.13, depth=.28); bm.to_mesh(lamp); bm.free()
            lo2 = D.objects.new(name + 'lamp', lamp); lamp.materials.append(M['shade']); link(lo2, parent)
            lo2.location = rot @ Vector((sx, T + .9, .05)) + loc
            base = box(name + 'lampb', -.05, .05, -.05, .05, -.55, -.14, M['metal'], parent)
            base.location = lo2.location
            tb = box(name + 'table', -.35, .35, -.25, .25, -.62, -.56, M['wood'], parent)
            tb.matrix_basis = rot.to_4x4(); tb.location = lo2.location
            L2 = D.lights.new(name + 'L2', 'POINT'); L2.energy = 18; L2.color = (1, .55, .25); L2.shadow_soft_size = .08
            l2 = D.objects.new(name + 'L2', L2); link(l2, parent); l2.location = lo2.location


def door_opening(wall, s, w, h, z0, M, parent):
    rot = Euler((0, 0, math.atan2(wall.n.y, wall.n.x) + math.pi / 2)).to_matrix()
    cutter('doorcut', parent, M, rot, wall.at(s, z0), -w / 2 - .01, w / 2 + .01, -.6, WALL_T + .3, -.01, h + .01)


def shell(name, x0, x1, y0, y1, z0, z1, mo, mi, parent, t=None):
    """Hollow box: outer faces use mo, inner faces mi. Windows are cut through it later."""
    t = t or WALL_T
    bm = bmesh.new()

    def cube(a0, a1, b0, b1, c0, c1, flip, mat):
        v = [bm.verts.new(p) for p in [(a0, b0, c0), (a1, b0, c0), (a1, b1, c0), (a0, b1, c0), (a0, b0, c1), (a1, b0, c1), (a1, b1, c1), (a0, b1, c1)]]
        for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]:
            face = bm.faces.new([v[i] for i in (f[::-1] if flip else f)]); face.material_index = mat
    cube(x0, x1, y0, y1, z0, z1, False, 0)
    cube(x0 + t, x1 - t, y0 + t, y1 - t, z0 + .01, z1 - .01, True, 1)
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mo); me.materials.append(mi)
    ob = D.objects.new(name, me); link(ob, parent)
    return cut(ob)


def cut(ob):
    md = ob.modifiers.new('openings', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.solver = 'EXACT'
    md.operand_type = 'COLLECTION'; md.collection = CUTTERS; md.material_mode = 'TRANSFER'
    return ob


def lap_siding(name, wall, s0, s1, z0, z1, mat, parent, gable=None, expo=.18):
    """Real lap boards (thick at the bottom edge, thin at the top) across a wall. gable=(z_eave,
    z_ridge, s_center) narrows the rows into the triangle above the eave."""
    bm = bmesh.new()
    z = z0
    while z < z1 - .02:
        zt = min(z + expo + .02, z1)
        a0, a1 = s0, s1
        if gable and zt > gable[0]:
            ze, zr, sc = gable
            k = max(0.0, 1 - (zt - ze) / (zr - ze)); hw = (s1 - s0) / 2 * k
            a0, a1 = sc - hw, sc + hw
            if a1 - a0 < .05: break
        pts = []
        for a in (a0, a1):
            for (o, zz) in ((0, z), (.034, z), (.007, zt), (0, zt)):
                pts.append(bm.verts.new(tuple(wall.at(a, zz, o))))
        q = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        for f in q: bm.faces.new([pts[i] for i in f])
        z += expo
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = D.objects.new(name, me); me.materials.append(mat); me.materials.append(mat); link(ob, parent)
    # normals: make them consistent
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    return cut(ob)


# ---------------------------------------------------------------- scene parts
def materials():
    M = {}
    M['siding'] = mat_pbr('siding', 'weathered_plank_siding', 1.6, tint=(.62, .55, .44), nor=.7, detail=(.02, .16))
    M['roof'] = mat_pbr('roof', 'grey_roof_01', 2.2, proj='FLAT', sat=.3, nor=1.2, mul=(.42, .4, .39))
    M['roofy'] = mat_pbr('roofy', 'grey_roof_01', 2.2, rot=math.pi / 2, proj='FLAT', sat=.3, nor=1.2, mul=(.42, .4, .39))
    M['trim'] = mat_basic('trim', (.8, .78, .72), rough=.4)
    M['glass'] = mat_glass(); M['darkglass'] = mat_dark_glass()
    M['pane'] = mat_pane(); M['curtain'] = mat_curtain(); M['shade'] = mat_shade()
    M['interior'] = mat_interior(); M['wood'] = mat_basic('wood', (.2, .11, .05), rough=.45)
    M['door'] = mat_basic('door', (.025, .085, .055), rough=.3, spec=.5)
    M['stone'] = mat_pbr('stone', 'stone_wall_04', 1.4, nor=1.0)
    M['chimney'] = mat_pbr('chimney', 'stone_wall_04', 1.1, tint=(.42, .33, .27), nor=1.0, detail=(.1, .6))
    M['grass'] = mat_pbr('grass', 'leafy_grass', 2.0, proj='FLAT', sat=1.1)
    M['path'] = mat_noisy('path', (.46, .44, .4), (.56, .54, .5), scale=6, rough=.8, bump=.12, bscale=60)
    M['plinth'] = mat_noisy('plinth', (.64, .55, .42), (.7, .61, .48), scale=4, rough=.5, bump=.04)
    M['ring'] = mat_basic('ring', (.66, .57, .44), rough=.3, spec=.5)
    M['canopy'] = mat_basic('canopy', (.02, .04, .012), rough=.9)
    M['leaf'] = mat_leaf('leaf', [(.035, .085, .02), (.13, .19, .045), (.07, .13, .03)])
    M['boxwood'] = mat_leaf('boxwood', [(.025, .07, .018), (.08, .14, .03), (.05, .1, .025)])
    M['bloom'] = mat_leaf('bloom', [(.55, .56, .46), (.72, .72, .62), (.62, .64, .54)])
    M['blade'] = mat_leaf('blade', [(.05, .1, .02), (.16, .2, .05), (.09, .15, .03)])
    M['metal'] = mat_basic('metal', (.015, .015, .015), rough=.35, spec=.6)
    M['gutter'] = mat_basic('gutter', (.78, .76, .7), rough=.3, spec=.5)
    return M


def rake(name, a, b, w, d, mat, parent, out):
    """A trim board following a roof edge from a to b (the sloped edge of a gable)."""
    a, b, out = Vector(a), Vector(b), Vector(out).normalized()
    up = (b - a).cross(out).normalized()
    if up.z < 0: up = -up
    v = []
    for p in (a, b):
        for du, do in ((0, 0), (-w, 0), (-w, d), (0, d)):
            v.append(p + up * du + out * do)
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (0, 3, 2, 1), (4, 5, 6, 7)]
    return mesh_obj(name, [tuple(x) for x in v], f, mat, parent)


def gutter(name, x0, x1, y, z, M, parent, along='x'):
    c = D.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=.075, radius2=.075, depth=abs(x1 - x0)); bm.to_mesh(c); bm.free()
    ob = D.objects.new(name, c); c.materials.append(M['gutter']); link(ob, parent)
    for p in c.polygons: p.use_smooth = True
    if along == 'x': ob.rotation_euler = (0, math.pi / 2, 0); ob.location = ((x0 + x1) / 2, y, z)
    else: ob.rotation_euler = (math.pi / 2, 0, 0); ob.location = (y, (x0 + x1) / 2, z)
    return ob


def downspout(x, y, z1, M, parent):
    box('spout', x - .05, x + .05, y - .05, y + .05, .05, z1, M['gutter'], parent)


def house(M, P):
    # --- main block: x -5.5..4.5, y -3.5..3.5, foundation 0..0.5, walls to 5.6, roof ridge 8.8
    X0, X1, Y0, Y1, ZF, ZE, ZR = -5.5, 4.5, -3.5, 3.5, .5, 5.6, 8.8
    OV, OR = .55, .4          # eave and rake overhang
    box('found', X0 - .06, X1 + .06, Y0 - .06, Y1 + .06, 0, ZF, M['stone'], P)
    shell('main', X0, X1, Y0, Y1, ZF - .1, ZE, M['siding'], M['interior'], P)
    box('floor2', X0 + .2, X1 - .2, Y0 + .2, Y1 - .2, 3.05, 3.3, M['interior'], P)
    box('watertable', X0 - .09, X1 + .09, Y0 - .09, Y1 + .09, ZF, ZF + .15, M['trim'], P)
    gable_wall('gl', Y0, Y1, X0, ZE, ZR - .15, M['siding'], P, depth=.01, axis='y')
    gable_wall('gr', Y0, Y1, X1 - .01, ZE, ZR - .15, M['siding'], P, depth=.01, axis='y')
    prism_roof('roof', X0 - OR, X1 + OR, Y0 - OV, Y1 + OV, ZE - .12, ZR + .05, M['roof'], P, axis='x', edge=M['trim'])
    box('ridge', X0 - OR, X1 + OR, -.14, .14, ZR - .05, ZR + .12, M['roof'], P, bevel=.03)
    box('frieze_f', X0, X1, Y0 - .08, Y0, ZE - .38, ZE, M['trim'], P)
    box('frieze_b', X0, X1, Y1, Y1 + .08, ZE - .38, ZE, M['trim'], P)
    for (x, y) in [(X0, Y0), (X1, Y0), (X0, Y1), (X1, Y1)]:
        box('corner', x - .13, x + .13, y - .13, y + .13, ZF, ZE, M['trim'], P)
    for xe, sgn in ((X0 - OR, -1), (X1 + OR, 1)):   # rake boards on both gables
        for ys in (Y0 - OV, Y1 + OV):
            rake('rake', (xe, ys, ZE - .12), (xe, 0, ZR + .05), .26, .06 * -sgn, M['trim'], P, (sgn, 0, 0))
    gutter('gut_f', X0 - OR, X1 + OR, Y0 - OV - .02, ZE - .2, M, P)
    gutter('gut_b', X0 - OR, X1 + OR, Y1 + OV + .02, ZE - .2, M, P)
    downspout(X0 - .25, Y0 - .6, ZE - .2, M, P); downspout(X0 - .25, Y1 + .6, ZE - .2, M, P)
    downspout(X1 + .25, Y1 + .6, ZE - .2, M, P)
    # chimney on the left gable, with a cap and flue
    box('chim', X0 - .1, X0 + 1.2, -.65, .65, ZE - 2.5, ZR + 1.4, M['chimney'], P)
    box('chimcap', X0 - .2, X0 + 1.3, -.75, .75, ZR + 1.4, ZR + 1.55, M['stone'], P, bevel=.02)
    box('flue', X0 + .3, X0 + .8, -.25, .25, ZR + 1.55, ZR + 1.85, M['metal'], P)

    # --- side wing (right): x 4.5..9.8, y -3.0..2.6, walls to 3.9, front-facing gable
    WX0, WX1, WY0, WY1, WE, WR = 4.5, 9.8, -3.0, 2.6, 3.9, 6.5
    box('wfound', WX0, WX1 + .06, WY0 - .06, WY1 + .06, 0, ZF, M['stone'], P)
    shell('wingshell', WX0 - .2, WX1, WY0, WY1, ZF - .1, WE, M['siding'], M['interior'], P)
    box('wwater', WX0, WX1 + .09, WY0 - .09, WY1 + .09, ZF, ZF + .15, M['trim'], P)
    gable_wall('wgf', WX0, WX1, WY0 - .01, WE, WR - .15, M['siding'], P, depth=.01)
    gable_wall('wgb', WX0, WX1, WY1, WE, WR - .15, M['siding'], P, depth=.01)
    prism_roof('wroof', WX0 - .35, WX1 + .45, WY0 - .5, WY1 + .5, WE - .12, WR + .05, M['roofy'], P, axis='y', edge=M['trim'])
    box('wridge', (WX0 + WX1) / 2 - .02 - .12, (WX0 + WX1) / 2 + .1 + .12, WY0 - .5, WY1 + .5, WR - .05, WR + .12, M['roofy'], P, bevel=.03)
    xm = (WX0 - .35 + WX1 + .45) / 2
    for ys, sgn in ((WY0 - .5, -1), (WY1 + .5, 1)):
        for xs in (WX0 - .35, WX1 + .45):
            rake('wrake', (xs, ys, WE - .12), (xm, ys, WR + .05), .24, .06 * -sgn, M['trim'], P, (0, sgn, 0))
    box('wfrieze', WX1, WX1 + .08, WY0, WY1, WE - .34, WE, M['trim'], P)
    gutter('gut_w', WY0 - .5, WY1 + .5, WX1 + .47, WE - .2, M, P, along='y')
    downspout(WX1 + .3, WY0 - .2, WE - .2, M, P)
    for x in (WX0 + .1, WX1):
        box('wcorner', x - .13, x + .13, WY0 - .13, WY0 + .13, ZF, WE, M['trim'], P)
    box('wcorner', WX1 - .13, WX1 + .13, WY1 - .13, WY1 + .13, ZF, WE, M['trim'], P)

    # --- front portico: two columns, entablature, small gable roof, green door, lantern
    box('stoop', -1.7, 1.7, Y0 - 1.6, Y0, 0, .45, M['stone'], P, bevel=.03)
    box('step', -1.2, 1.2, Y0 - 2.0, Y0 - 1.6, 0, .22, M['stone'], P, bevel=.02)
    for x in (-1.45, 1.45):
        box('base', x - .2, x + .2, Y0 - 1.53, Y0 - 1.13, .45, .62, M['trim'], P, bevel=.02)
        c = bpy.data.meshes.new('col')
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=.14, radius2=.115, depth=2.55); bm.to_mesh(c); bm.free()
        ob = D.objects.new('col', c); c.materials.append(M['trim']); link(ob, P); ob.location = (x, Y0 - 1.33, .62 + 1.275)
        for p in c.polygons: p.use_smooth = True
        box('capital', x - .18, x + .18, Y0 - 1.51, Y0 - 1.15, 3.17, 3.25, M['trim'], P)
    box('entab', -1.75, 1.75, Y0 - 1.75, Y0, 3.25, 3.6, M['trim'], P, bevel=.02)
    prism_roof('proof', -1.95, 1.95, Y0 - 1.95, Y0 + .05, 3.55, 4.3, M['roof'], P, axis='x', thick=.12, edge=M['trim'])
    box('ceiling', -1.7, 1.7, Y0 - 1.7, Y0, 3.2, 3.26, M['trim'], P)
    box('door', -.55, .55, Y0 + .06, Y0 + .11, ZF - .02, ZF + 2.25, M['door'], P, bevel=.01)
    box('doorframe_l', -.74, -.56, Y0 - .11, Y0 + .2, ZF, ZF + 2.4, M['trim'], P)
    box('doorframe_r', .56, .74, Y0 - .11, Y0 + .2, ZF, ZF + 2.4, M['trim'], P)
    box('doorframe_t', -.84, .84, Y0 - .13, Y0 + .2, ZF + 2.26, ZF + 2.55, M['trim'], P, bevel=.01)
    for x in (-.28, .28):   # raised panels
        for z0, z1 in ((.7, 1.45), (1.65, 2.45)):
            box('panel', x - .18, x + .18, Y0 + .03, Y0 + .065, z0, z1, M['door'], P, bevel=.015)
    box('knob', .38, .45, Y0 - .01, Y0 + .06, 1.55, 1.62, M['metal'], P)
    box('lantern', -.12, .12, Y0 - 1.0, Y0 - .76, 2.55, 3.05, M['metal'], P)
    box('lanternglow', -.09, .09, Y0 - .97, Y0 - .79, 2.6, 3.0, M['glass'], P)
    box('chain', -.015, .015, Y0 - .9, Y0 - .86, 3.05, 3.2, M['metal'], P)
    L = D.lights.new('lantern', 'POINT'); L.energy = 40; L.color = (1, .62, .3); L.shadow_soft_size = .1
    lo = D.objects.new('lantern', L); link(lo, P); lo.location = (0, Y0 - .88, 2.8)
    for x in (-1.0, 1.0):   # clay pots with plants either side of the door
        place('planter_pot_clay', P, (x, Y0 - .35, .45), height=.5)

    # --- lap siding on every wall, gables included (window and door openings are cut through it)
    front = Wall((0, Y0, 0), (1, 0, 0), (0, -1, 0))
    back = Wall((0, Y1, 0), (-1, 0, 0), (0, 1, 0))
    left = Wall((X0, 0, 0), (0, -1, 0), (-1, 0, 0))
    right = Wall((X1, 0, 0), (0, 1, 0), (1, 0, 0))
    wfront = Wall((0, WY0, 0), (1, 0, 0), (0, -1, 0))
    wright = Wall((WX1, 0, 0), (0, 1, 0), (1, 0, 0))
    wback = Wall((0, WY1, 0), (-1, 0, 0), (0, 1, 0))
    zs = ZF + .14
    lap_siding('sid_f', front, X0, X1, zs, ZE, M['siding'], P)
    lap_siding('sid_b', back, -X1, -X0, zs, ZE, M['siding'], P)
    lap_siding('sid_l', left, -Y1, -Y0, zs, ZR - .2, M['siding'], P, gable=(ZE, ZR - .15, 0))
    lap_siding('sid_r', right, Y0, Y1, WE, ZR - .2, M['siding'], P, gable=(ZE, ZR - .15, 0))
    lap_siding('sid_r2', right, Y0, WY0, zs, WE, M['siding'], P); lap_siding('sid_r3', right, WY1, Y1, zs, WE, M['siding'], P)
    lap_siding('sid_wf', wfront, WX0, WX1, zs, WR - .2, M['siding'], P, gable=(WE, WR - .15, (WX0 + WX1) / 2))
    lap_siding('sid_wb', wback, -WX1, -WX0, zs, WR - .2, M['siding'], P, gable=(WE, WR - .15, -(WX0 + WX1) / 2))
    lap_siding('sid_wr', wright, WY0, WY1, zs, WE, M['siding'], P)
    door_opening(front, 0, 1.12, 2.28, ZF - .02, M, P)
    door_opening(back, 0, 1.92, 2.32, ZF + .03, M, P)

    # --- windows
    for s in (-3.0, 2.9):
        window(front, s, 1.1, 1.35, 1.85, M, P)
        window(front, s, 3.7, 1.35, 1.55, M, P)
    window(front, 0, 3.75, 1.3, 1.45, M, P, lit=False)
    window(wfront, 7.15, 1.15, 2.9, 1.7, M, P, cols=5, rows=2)                # the big picture window
    window(wfront, 7.15, 4.3, .7, .9, M, P, cols=2, rows=2, lit=False, room=False)       # small gable window
    for s in (-1.6, 1.6):
        window(left, s, 1.1, 1.2, 1.8, M, P)
        window(left, s, 3.7, 1.2, 1.5, M, P)
    window(left, 2.2, 6.1, .7, .8, M, P, cols=2, rows=2, lit=False, room=False)
    for s in (-1.0, 1.4):
        window(wright, s, 1.2, 1.3, 1.7, M, P)
    window(wback, -7.15, 1.2, 1.6, 1.7, M, P, cols=3)
    for s in (-3.0, 0.0, 3.0):
        window(back, s, 3.7, 1.35, 1.55, M, P)
    window(back, -2.9, 1.1, 1.35, 1.85, M, P)
    window(back, 2.9, 1.1, 1.35, 1.85, M, P)
    window(back, 0.0, ZF + .05, 1.9, 2.3, M, P, cols=4, rows=2, name='french')
    box('patio', -2.9, 2.9, Y1, Y1 + 3.3, 0, .1, M['path'], P, bevel=.02)
    for s in (-1.0, 1.0):   # wall lamps beside the French doors
        box('sconce', s * 1.45 - .08, s * 1.45 + .08, Y1, Y1 + .14, 2.3, 2.62, M['glass'], P)
    place('outdoor_table_chair_set_01', P, (0, Y1 + 1.8, .1), scale=1.15, rotz=math.pi / 2)
    box('ac', WX1 + .25, WX1 + 1.05, .2, 1.0, 0, .8, M['metal'], P, bevel=.03)


def blob(name, center, radius, mat, parent, squash=(1, 1, 1), sub=3, disp=.35, seed=0):
    """Lumpy sphere. The lumps are baked into the mesh so scattered leaves sit on the real surface."""
    from mathutils import noise
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=radius)
    off = Vector((seed * 7.31, seed * 3.17, seed * 5.53))
    for v in bm.verts:
        d = v.co.normalized()
        v.co = d * radius * (1 + disp * noise.fractal(d * 1.6 + off, 1.0, 2.0, 3))
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = D.objects.new(name, me); me.materials.append(mat); link(ob, parent)
    ob.location = center; ob.scale = squash
    for p in me.polygons: p.use_smooth = True
    return ob


def proto(name, verts, faces, mat):
    """An instance prototype (leaf, grass clump, bloom). Linked but hidden; scatter() instances it."""
    me = D.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); me.materials.append(mat)
    ob = D.objects.new(name, me); link(ob); ob.hide_render = True; ob.hide_viewport = True
    ob.location = (0, 0, -100)
    return ob


def protos(M):
    # a small leaf: pointed oval, slightly cupped, in the XY plane, facing +Z
    lv = [(0, -.5, 0), (.22, -.25, .04), (.28, .05, .05), (.18, .32, .03), (0, .5, 0),
          (-.18, .32, .03), (-.28, .05, .05), (-.22, -.25, .04), (0, 0, .07)]
    lf = [(8, i, i + 1) for i in range(7)] + [(8, 7, 0)]
    P = {'leaf': proto('p_leaf', lv, lf, M['boxwood'])}
    # grass clump: a few thin tapered blades leaning out
    gv, gf = [], []
    r = random.Random(3)
    for k in range(7):
        a = r.uniform(0, 2 * math.pi); lean = r.uniform(.15, .45); hgt = r.uniform(.7, 1.0); w = .045
        dx, dy = math.cos(a), math.sin(a); px, py = -dy * w, dx * w
        i = len(gv)
        gv += [(px, py, 0), (-px, -py, 0), (dx * lean * hgt, dy * lean * hgt, hgt)]
        gf.append((i, i + 1, i + 2))
    P['grass'] = proto('p_grass', gv, gf, M['blade'])
    # hydrangea bloom: a lumpy ball of florets
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=.5)
    me = D.meshes.new('p_bloom'); bm.to_mesh(me); bm.free(); me.materials.append(M['bloom'])
    for p in me.polygons: p.use_smooth = True
    ob = D.objects.new('p_bloom', me); link(ob); ob.hide_render = True; ob.hide_viewport = True; ob.location = (0, 0, -100)
    P['bloom'] = ob
    return P


def shrub(M, P, PR, x, y, r, seed, blooms=False, h=None):
    b = blob('shrub', (x, y, (h or r) * .72), r, M['canopy'], P, squash=(1, 1, (h or r) / r * .85), sub=3, disp=.22, seed=seed)
    scatter(b, PR['leaf'], 1400, .07, .12, seed, name='leaves')
    if blooms:
        scatter(b, PR['bloom'], 18, .1, .16, seed + 50, tilt=0, name='blooms')
    return b


def evergreen(M, P, PR, x, y, h, seed):
    c = D.meshes.new('evg'); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=h * .24, radius2=.02, depth=h); bm.to_mesh(c); bm.free()
    e = D.objects.new('evg', c); c.materials.append(M['canopy']); link(e, P); e.location = (x, y, h / 2)
    scatter(e, PR['leaf'], 1800, .06, .1, seed, name='needles')


def grounds(M, P, PR):
    R = 11.0
    # a disc made of small even quads, so grass can be cleared precisely around the walk and house
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=110, y_segments=110, size=R + .2)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().length > R], context='FACES')
    for v in bm.verts:                                  # round off the stair-stepped rim
        if v.co.length > R - .25: v.co = v.co.normalized() * min(v.co.length, R)
    me = D.meshes.new('lawn'); bm.to_mesh(me); bm.free(); me.materials.append(M['grass'])
    lawn = D.objects.new('lawn', me); link(lawn, P)
    bpy.ops.mesh.primitive_cylinder_add(vertices=192, radius=R + .45, depth=1.4, location=(0, 0, -.72))
    pl = C.object; pl.data.materials.append(M['plinth']); pl.parent = P
    md = pl.modifiers.new('b', 'BEVEL'); md.width = .1; md.segments = 4; md.limit_method = 'ANGLE'
    for p in pl.data.polygons: p.use_smooth = True
    bpy.ops.mesh.primitive_torus_add(major_radius=R + .22, minor_radius=.25, major_segments=192, minor_segments=16, location=(0, 0, .02))
    lip = C.object; lip.scale = (1, 1, .5); lip.data.materials.append(M['plinth']); lip.parent = P
    for p in lip.data.polygons: p.use_smooth = True
    # the front walk; the grass scatter skips it
    box('walk', -.7, .7, -R - .15, -5.5, 0, .06, M['path'], P, bevel=.02)
    grass = D.objects.new('lawn_grass', me.copy()); link(grass, P)
    # keep blades off the walk, the patio and from under the house
    gme = grass.data; bm = bmesh.new(); bm.from_mesh(gme)
    kill = [f for f in bm.faces if (abs(f.calc_center_median().x) < .85 and f.calc_center_median().y < -5.2)
            or (-5.7 < f.calc_center_median().x < 10.0 and -3.8 < f.calc_center_median().y < 3.8)
            or (abs(f.calc_center_median().x) < 3.0 and 3.4 < f.calc_center_median().y < 7.0)]
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(gme); bm.free()
    grass.location = (0, 0, .001)
    scatter(grass, PR['grass'], 1500, .12, .2, 5, tilt=.18, name='grass')


def plantings(M, P, PR):
    # trees (Poly Haven scans), placed like the reference renders
    def full_tree(x, y, h, rz):
        # two scans of the same tree, turned against each other, read as one full canopy
        place('tree_small_02', P, (x, y, 0), height=h, rotz=rz)
        place('tree_small_02', P, (x + .3, y - .2, 0), height=h * .93, rotz=rz + 2.3)
    full_tree(-8.4, .6, 8.2, .4)          # front-left
    full_tree(6.8, 6.2, 9.4, 1.1)         # tall tree behind the wing
    place('tree_small_02', P, (9.3, -5.7, 0), height=5.6, rotz=2.2)          # small tree, front-right
    full_tree(-6.8, 6.8, 7.4, .7)         # back-left
    place('island_tree_01', P, (-1.6, 9.2, 0), height=5.2, rotz=4.0)         # behind the patio
    # foundation plantings along the front, leaving the walk clear
    xs = [-5.0, -4.0, -2.9, -2.2, 2.2, 2.9, 4.0, 5.1, 6.2, 7.3, 8.4, 9.4]
    for i, x in enumerate(xs):
        y = -4.25 if x < 4.5 else -3.75
        shrub(M, P, PR, x, y + rng.uniform(-.15, .15), rng.uniform(.45, .62), 100 + i, blooms=(i in (1, 5, 9)))
    for x in (-2.35, 2.35):
        evergreen(M, P, PR, x, -4.25, 1.9, int(abs(x) * 10) + 300 + (x > 0))
    for i, (x, y) in enumerate([(-6.2, -2.4), (-6.3, 2.2), (10.6, -1.8), (10.5, 1.9), (-3.8, 4.3), (3.6, 4.4), (8.0, 3.4),
                                (-9.0, -4.5), (-4.5, -7.5), (5.0, -7.8)]):
        shrub(M, P, PR, x, y, rng.uniform(.5, .8), 200 + i, blooms=(i in (3, 7)))


def ring(M):
    """The logo swoosh: a flat ribbon circling the island a bit more than once, tilted back.
    It does not turn with the house."""
    bm = bmesh.new()
    Rr, W, T = 12.6, .5, .3
    n = 480; start, end = math.radians(-58), math.radians(-58 + 385)
    rows = []
    for i in range(n + 1):
        a = start + (end - start) * i / n
        rad = Rr - .9 * (i / n)
        taper = min(1, i / 30, (n - i) / 30) ** .5
        w, t = W * max(.25, taper), T * max(.35, taper)
        cx, cz = math.cos(a), math.sin(a)
        rows.append([bm.verts.new(((rad + dr) * cx, dy, (rad + dr) * cz)) for (dr, dy) in ((-w / 2, -t / 2), (w / 2, -t / 2), (w / 2, t / 2), (-w / 2, t / 2))])
    for i in range(n):
        a, b = rows[i], rows[i + 1]
        for k in range(4):
            bm.faces.new([a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]])
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    me = D.meshes.new('ring'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = D.objects.new('ring', me); me.materials.append(M['ring']); link(ob)
    ob.location = (0, 1.0, 2.4); ob.rotation_euler = (math.radians(-18), math.radians(-6), 0)
    sm = ob.modifiers.new('s', 'SUBSURF'); sm.levels = 1; sm.render_levels = 1
    return ob


SUN_AZ = math.radians(-128)   # where the key light comes from (front-left of the camera)
SUN_EL = math.radians(14)


def lighting_camera(res, samples=64):
    sc = C.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.cycles.samples = samples; sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    sc.cycles.max_bounces = 8; sc.cycles.transparent_max_bounces = 16
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = .1
    # sunset sky for ambient light and reflections, turned so its sun sits behind the key light
    w = D.worlds.new('w'); w.use_nodes = True; sc.world = w
    nt = w.node_tree; bg = nt.nodes['Background']
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = D.images.load(os.path.join(ASSETS, 'hdri', 'belfast_sunset_puresky.hdr'))
    import numpy as np
    W, H = env.image.size; px = np.array(env.image.pixels[:]).reshape(H, W, 4)[..., :3].sum(-1)
    yy, xx = np.unravel_index(np.argmax(px), px.shape)
    phi = (xx / W - .5) * 2 * math.pi                       # equirect longitude -> direction
    sun_az = math.atan2(math.sin(phi), -math.cos(phi))
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value = (0, 0, sun_az - SUN_AZ)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); nt.links.new(mp.outputs[0], env.inputs['Vector'])
    warm = nt.nodes.new('ShaderNodeMix'); warm.data_type = 'RGBA'; warm.blend_type = 'MULTIPLY'; warm.inputs[0].default_value = 1
    warm.inputs[7].default_value = (1.0, .8, .6, 1)             # push the sky toward golden hour
    nt.links.new(env.outputs['Color'], warm.inputs[6]); nt.links.new(warm.outputs[2], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = .55
    # key sun (crisp shadows) along the same azimuth, and a soft cool fill
    s = D.lights.new('sun', 'SUN'); s.energy = 5.0; s.color = (1.0, .6, .34); s.angle = math.radians(1.5)
    so = D.objects.new('sun', s); link(so)
    so.rotation_euler = (math.pi / 2 - SUN_EL, 0, SUN_AZ + math.pi / 2)   # lamp shines along -Z
    f = D.lights.new('fill', 'SUN'); f.energy = .35; f.color = (.7, .8, 1.0); f.angle = math.radians(25)
    fo = D.objects.new('fill', f); link(fo); fo.rotation_euler = (math.radians(55), 0, math.radians(60))
    cam = D.cameras.new('cam'); cam.lens = 70
    co = D.objects.new('cam', cam); link(co); sc.camera = co
    el = math.radians(13); dist = 60
    tgt = Vector((0, 0, 1.6))
    co.location = tgt + Vector((0, -math.cos(el) * dist, math.sin(el) * dist))
    co.rotation_euler = (math.pi / 2 - el, 0, 0)


def build(res=768, samples=64):
    reset()
    global CUTTERS
    CUTTERS = D.collections.new('cutters')
    M = materials()
    P = D.objects.new('turn', None); link(P)
    PR = protos(M)
    house(M, P); grounds(M, P, PR); plantings(M, P, PR); ring(M)
    lighting_camera(res, samples)
    return P


if __name__ == '__main__':
    args = sys.argv[1:]
    mode = args[0] if args else 'preview'
    if mode == 'preview':
        ang = float(args[1]) if len(args) > 1 else 0
        res = int(args[2]) if len(args) > 2 else 512
        out = args[3] if len(args) > 3 else '/tmp/house_preview.png'
        samples = int(args[4]) if len(args) > 4 else 64
        P = build(res, samples); P.rotation_euler = (0, 0, math.radians(ang))
        C.scene.render.filepath = out
        bpy.ops.render.render(write_still=True)
    elif mode == 'angles':        # several test angles from one build: angles res outprefix samples a1 a2 ...
        res, pre, samples = int(args[1]), args[2], int(args[3])
        P = build(res, samples)
        for a in args[4:]:
            P.rotation_euler = (0, 0, math.radians(float(a)))
            C.scene.render.filepath = '%s_%s.png' % (pre, a)
            bpy.ops.render.render(write_still=True)
    elif mode == 'frames':
        n, outdir = int(args[1]), args[2]
        res = int(args[3]) if len(args) > 3 else 768
        samples = int(args[4]) if len(args) > 4 else 64
        os.makedirs(outdir, exist_ok=True)
        P = build(res, samples)
        for i in range(n):
            fp = os.path.join(outdir, 'turn-%03d.png' % i)
            if os.path.exists(fp): continue
            P.rotation_euler = (0, 0, math.radians(i * 360 / n))
            C.scene.render.filepath = fp
            bpy.ops.render.render(write_still=True)
            print('frame', i, flush=True)

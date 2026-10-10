"""Writes the build_model code that rebuilds a job's 3D model in SketchUp from scripts/models/<job>.su.json,
so it can be saved as a .skp file for visitors to download (the "Download the SketchUp file" button).

    python3 scripts/su-to-skp-code.py --loader                              > loader.py   (once per session)
    python3 scripts/su-to-skp-code.py scripts/models/<job>.su.json          > job.py      (one per model)
    python3 scripts/su-to-skp-code.py --standalone scripts/models/<job>.su.json > job.py  (loader + model)

Run loader.py as one mcp__Trimble_SketchUp__build_model call (clean: true): it puts a `build` function in
session_state. Then for each job run its job.py (clean: false), which empties the model and rebuilds that job,
and call save_model with filename "<job>.skp". (session_state lasts until the connector session ends, 30 minutes
idle; if `build` is missing, run the loader again.)

The connector allows no imports or files, so the model travels inside the code as compact text:
- boxes (8 corners, 6 faces, square to the axes: most parts) as "B|name|material|x0,y0,z0,x1,y1,z1";
- any other part as "P|name|material|vertices|faces|visible edges", vertices in 0.1 mm, faces as loops of
  vertex numbers (holes after ':'), visible edges as vertex pairs (every other edge is softened, as in the
  original, so round bars look round).
All numbers are base 36 (int(text, 36) reads them back) to keep the code short.
Part names "Wardrobe: Drawer 1: Front" become nested groups (Wardrobe > Drawer 1 > Front), the same structure the
web viewer shows when a part is tapped, all inside one group named after the job; room context ("Room: ...")
ends up in a separate "Room" group. Materials keep
their colours; see-through ones (opacity) keep it as the colour's alpha. The file is in millimetres and opens on a
three-quarter view from the room side, in a plain style (paper background, dark edges, no ground or sky).
"""
import json
import sys

LOADER = r'''
def _reset():
    ents = model.get_entities()
    ents.clear()
    try:
        defs = model.get_group_definitions()
        if defs:
            model.remove_component_definitions(list(defs))
    except Exception:
        pass
    try:
        model.purge_unused_materials()
    except Exception:
        pass


def _units_mm():
    try:
        p = model.get_options_manager().get_options_provider_by_name("UnitsOptions")
        want = {"LENGTH_UNIT": 2, "LENGTH_FORMAT": 0, "LENGTH_PRECISION": 0}
        for k in list(p.keys()):
            nm = str(k).split(".")[-1]
            if nm in want:
                p[k] = TypedValue(int_value=want[nm])
    except Exception:
        pass


def _style():
    ro = model.get_rendering_options()
    for k, v in [("EDGE_DISPLAY_MODE", TypedValue(int_value=1)), ("EDGE_COLOR_MODE", TypedValue(int_value=0)),
                 ("RENDER_MODE", TypedValue(int_value=2)), ("MODEL_TRANSPARENCY", TypedValue(bool_value=False)),
                 ("MATERIAL_TRANSPARENCY", TypedValue(bool_value=True)), ("DRAW_DEPTH_QUE", TypedValue(bool_value=False)),
                 ("DRAW_SILHOUETTES", TypedValue(bool_value=True)), ("SILHOUETTE_WIDTH", TypedValue(int_value=2)),
                 ("DRAW_HORIZON", TypedValue(bool_value=False)), ("DRAW_GROUND", TypedValue(bool_value=False)),
                 ("DISPLAY_SKETCH_AXES", TypedValue(bool_value=False)),
                 ("HIGHLIGHT_COLOR", TypedValue(color_value=SUColor(0, 1, 255, 255))),
                 ("LOCKED_COLOR", TypedValue(color_value=SUColor(255, 0, 0, 255))),
                 ("BACKGROUND_COLOR", TypedValue(color_value=SUColor(241, 242, 239, 255))),
                 ("FACE_FRONT_COLOR", TypedValue(color_value=SUColor(245, 240, 230, 255))),
                 ("FACE_BACK_COLOR", TypedValue(color_value=SUColor(180, 178, 170, 255))),
                 ("FOREGROUND_COLOR", TypedValue(color_value=SUColor(40, 42, 45, 255)))]:
        try:
            ro[RenderingOptionKey[k]] = v
        except Exception:
            pass
    try:
        model.get_shadow_info()[ShadowInfoKey["DISPLAY_SHADOWS"]] = TypedValue(bool_value=False)
    except Exception:
        pass


def _camera(BBOX, U):
    xmin, ymin, zmin, xmax, ymax, zmax = [c * U for c in BBOX]
    cx, cy = (xmin + xmax) / 2.0, (ymin + ymax) / 2.0
    w, d, h = xmax - xmin, ymax - ymin, zmax - zmin
    fov = 35.0
    az, el = math.radians(35), math.radians(22)
    dx, dy, dz = -math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)
    rl = math.sqrt(dx * dx + dy * dy)
    rx, ry = -dy / rl, dx / rl
    ux, uy, uz = -dz * ry, dz * rx, dx * ry - dy * rx
    he = abs(rx) * w + abs(ry) * d
    ve = abs(ux) * w + abs(uy) * d + abs(uz) * h
    hv = math.radians(fov / 2.0)
    hh = math.atan(1.6 * math.tan(hv))
    dist = max((ve / 2.0) / math.tan(hv), (he / 2.0) / math.tan(hh)) * 1.2
    tz = zmin + h * 0.45
    cam = Camera()
    cam.set_orientation(SUPoint3D(cx + dist * dx, cy + dist * dy, tz + dist * dz), SUPoint3D(cx, cy, tz), SUVector3D(0, 0, 1))
    cam.enable_perspective()
    cam.set_perspective_frustum_fov(fov)
    model.set_camera(cam)


def _build(MATS, PARTS, BBOX, TITLE=""):
    U = 1.0 / 254.0  # 0.1 mm -> inches
    _reset()
    mats = {}
    for line in MATS.split("\n"):
        n, c = line.split("|")
        r, g, b, a = [int(x) for x in c.split(",")]
        m = Material()
        m.set_name(n)
        m.set_color(SUColor(r, g, b, a))
        model.add_materials([m])
        mats[n] = m
    groups = {}

    def parent_for(path):
        if not path:
            return None
        key = ": ".join(path)
        if key in groups:
            return groups[key]
        par = parent_for(path[:-1])
        g = Group()
        (par.get_entities() if par else model.get_entities()).add_group(g)
        g.set_name(path[-1])
        groups[key] = g
        return g

    BOXF = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
    made = 0
    for line in PARTS.split("\n"):
        f = line.split("|")
        segs = f[1].split(": ")
        path = segs[:-1] if (segs[0] == "Room" or not TITLE) else [TITLE] + segs[:-1]
        par = parent_for(path)
        g = Group()
        (par.get_entities() if par else model.get_entities()).add_group(g)
        gi = GeometryInput()
        vis = None
        if f[0] == "B":
            x0, y0, z0, x1, y1, z1 = [int(x, 36) for x in f[3].split(",")]
            V = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]
            faces = [[lp] for lp in BOXF]
        else:
            V = [int(x, 36) for x in f[3].split(",")]
            faces = [[[int(i, 36) for i in lp.split(",")] for lp in face.split(":")] for face in f[4].split(";")]
            vis = set()
            if f[5]:
                for pr in f[5].split(";"):
                    a, b = [int(i, 36) for i in pr.split(",")]
                    ka = (V[3 * a], V[3 * a + 1], V[3 * a + 2])
                    kb = (V[3 * b], V[3 * b + 1], V[3 * b + 2])
                    vis.add((ka, kb))
                    vis.add((kb, ka))
        gi.set_vertices([SUPoint3D(V[i] * U, V[i + 1] * U, V[i + 2] * U) for i in range(0, len(V), 3)])
        for face in faces:
            lp = LoopInput()
            for i in face[0]:
                lp.add_vertex_index(i)
            fi, gi = gi.add_face(lp)
            for inner in face[1:]:
                il = LoopInput()
                for i in inner:
                    il.add_vertex_index(i)
                gi = gi.face_add_inner_loop(fi, il)
        g.get_entities().fill(gi, weld_vertices=True)
        m = mats[f[2]]
        for fc in g.get_entities().get_faces():
            fc.set_front_material(m)
            fc.set_back_material(m)
        if vis is not None:
            for e in g.get_entities().get_edges():
                p = e.get_start_vertex().get_position()
                q = e.get_end_vertex().get_position()
                ka = (int(round(p.x * 254)), int(round(p.y * 254)), int(round(p.z * 254)))
                kb = (int(round(q.x * 254)), int(round(q.y * 254)), int(round(q.z * 254)))
                if (ka, kb) not in vis:
                    e.set_soft(True)
                    e.set_smooth(True)
        g.set_name(segs[-1])
        made += 1
    _units_mm()
    _style()
    _camera(BBOX, U)
    return {"parts": made, "groups": len(groups), "materials": len(mats), "faces": sum(1 for _ in model.get_entities().get_groups())}


session_state["build"] = _build
'''

DIG = '0123456789abcdefghijklmnopqrstuvwxyz'


def b36(n):
    if n == 0:
        return '0'
    neg = n < 0
    n = abs(n)
    out = ''
    while n:
        out = DIG[n % 36] + out
        n //= 36
    return ('-' if neg else '') + out


def place(t, x, y, z):
    if not t:
        return x, y, z
    return (t[0] * x + t[3] * y + t[6] * z + t[9], t[1] * x + t[4] * y + t[7] * z + t[10], t[2] * x + t[5] * y + t[8] * z + t[11])


def mat_rgba(m):
    if isinstance(m, list):
        return list(m) + [255]
    return list(m['color']) + [int(round(255 * m.get('opacity', 1)))]


def model_call(path):
    src = json.load(open(path))
    geoms = src.get('geoms', {})
    omit = set(src.get('omit') or [])
    lines = []
    bbox = [10 ** 12, 10 ** 12, 10 ** 12, -10 ** 12, -10 ** 12, -10 ** 12]
    used = set()
    for p in src['parts']:
        if p['n'] in omit:
            continue
        g = geoms[p['g']] if 'g' in p else p
        v = g['v']
        pts = [place(p.get('t'), v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)]
        pts = [(int(round(x * 10)), int(round(y * 10)), int(round(z * 10))) for (x, y, z) in pts]
        for (x, y, z) in pts:
            bbox = [min(bbox[0], x), min(bbox[1], y), min(bbox[2], z), max(bbox[3], x), max(bbox[4], y), max(bbox[5], z)]
        name = p['n'].replace('|', '/').replace('\n', ' ').replace('"""', "'''")
        mat = p.get('m', 'MDF 18 mm')
        used.add(mat)
        xs = sorted({q[0] for q in pts}); ys = sorted({q[1] for q in pts}); zs = sorted({q[2] for q in pts})
        is_box = (len(pts) == 8 and len(g['f']) == 6 and len(xs) == 2 and len(ys) == 2 and len(zs) == 2
                  and all(len(f) == 1 for f in g['f']))
        if is_box:
            lines.append('B|%s|%s|%s' % (name, mat, ','.join(b36(c) for c in (xs[0], ys[0], zs[0], xs[1], ys[1], zs[1]))))
        else:
            vs = ','.join(b36(c) for q in pts for c in q)
            fs = ';'.join(':'.join(','.join(b36(i) for i in loop) for loop in face) for face in g['f'])
            es = ';'.join('%s,%s' % (b36(a), b36(b)) for a, b in g.get('e', []))
            lines.append('P|%s|%s|%s|%s|%s' % (name, mat, vs, fs, es))
    mats = src.get('materials') or {}
    mat_lines = ['%s|%s' % (n.replace('|', '/'), ','.join(str(int(c)) for c in mat_rgba(mats.get(n, [200, 172, 142]))))
                 for n in sorted(used)]
    title = (src.get('name') or '').replace('"', "'").replace(':', ',')
    return 'result = session_state["build"]("""%s""", """%s""", %s, "%s")\n' % ('\n'.join(mat_lines), '\n'.join(lines), json.dumps(bbox), title)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--loader']:
        sys.stdout.write(LOADER)
    elif args and args[0] == '--standalone':
        sys.stdout.write(LOADER + '\n' + model_call(args[1]))
    else:
        sys.stdout.write(model_call(args[0]))

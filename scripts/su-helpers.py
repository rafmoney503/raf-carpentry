# SketchUp helpers for the job-page 3D models (Trimble SketchUp connector, build_model).
#
# Paste this whole file at the top of a build_model call (the connector allows no imports or files),
# then build the job in millimetres and finish with:
#
#     result = {"readback": export_model(), "pad": "x" * 120000}
#
# The padding makes the connector's answer too long for the chat, so it is saved as a file in the
# session's tool-results folder; scripts/su-readback.py turns that file plus a meta JSON into
# scripts/models/<job>.su.json, and scripts/su-to-glb.mjs makes the .glb.
#
# Axes (as su-to-glb.mjs expects): X along the back wall, Y out from the wall (the room is -Y,
# so fronts face -Y), Z up, all in mm. SketchUp itself works in inches; W() converts.
# Every part is its own group of world-coordinate geometry (identity transforms), so the read-back
# needs no transforms. A piece turned to face another way is built with set_frame(): local mm
# coordinates are turned about Z and moved before they become SketchUp points.
# Assemblies are groups that only hold other groups; their names prefix the part names
# ("Left wardrobe: Door, left"), which is what the page shows when a part is tapped and what
# the meta's `apart` list matches.

MM = 1.0 / 25.4
FRAME = {"o": (0.0, 0.0, 0.0), "a": 0.0}
MATS = {}


def set_frame(ox=0.0, oy=0.0, oz=0.0, deg=0.0):
    """Local -> world: turn `deg` degrees about Z (anticlockwise seen from above), then move by (ox, oy, oz) mm."""
    FRAME["o"] = (ox, oy, oz)
    FRAME["a"] = deg


def W(x, y, z):
    a = math.radians(FRAME["a"])
    c, s = math.cos(a), math.sin(a)
    ox, oy, oz = FRAME["o"]
    return SUPoint3D((ox + c * x - s * y) * MM, (oy + s * x + c * y) * MM, (oz + z) * MM)


def material(name, rgb, alpha=255):
    existing = {m.get_name(): m for m in model.get_materials()}
    if name in existing:
        MATS[name] = existing[name]
        return existing[name]
    m = Material()
    m.set_name(name)
    m.set_color(SUColor(rgb[0], rgb[1], rgb[2], alpha))
    model.add_materials([m])
    MATS[name] = m
    return m


def _ents(parent):
    return parent.get_entities() if parent is not None else model.get_entities()


def assembly(name, parent=None):
    g = Group()
    _ents(parent).add_group(g)
    g.set_name(name)
    return g


def _vsub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _newell(pts):
    n = [0.0, 0.0, 0.0]
    for i in range(len(pts)):
        a = pts[i]
        b = pts[(i + 1) % len(pts)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return (n[0], n[1], n[2])


def solid(name, mat, verts, faces, parent=None, soften=0.0):
    """A closed part. verts: local mm (x, y, z); faces: [[outer], [hole], ...] index loops, outer
    loops anticlockwise seen from outside. soften > 0 softens edges between faces whose normals
    are closer than that dot product (round sides of a cylinder)."""
    g = Group()
    _ents(parent).add_group(g)
    gi = GeometryInput()
    gi.set_vertices([W(*v) for v in verts])
    for loops in faces:
        lp = LoopInput()
        for i in loops[0]:
            lp.add_vertex_index(i)
        fi, gi = gi.add_face(lp)
        for inner in loops[1:]:
            il = LoopInput()
            for i in inner:
                il.add_vertex_index(i)
            gi = gi.face_add_inner_loop(fi, il)
    g.get_entities().fill(gi, weld_vertices=True)
    m = MATS[mat]
    for f in g.get_entities().get_faces():
        f.set_front_material(m)
        f.set_back_material(m)
    if soften > 0:
        for e in g.get_entities().get_edges():
            fs = e.get_faces()
            if len(fs) == 2:
                a = fs[0].get_normal()
                b = fs[1].get_normal()
                if a.x * b.x + a.y * b.y + a.z * b.z > soften:
                    e.set_soft(True)
                    e.set_smooth(True)
    g.set_name(name)
    return g


def box(name, mat, x0, y0, z0, x1, y1, z1, parent=None):
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    z0, z1 = min(z0, z1), max(z0, z1)
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [[[0, 3, 2, 1]], [[4, 5, 6, 7]], [[0, 1, 5, 4]], [[1, 2, 6, 5]], [[2, 3, 7, 6]], [[3, 0, 4, 7]]]
    return solid(name, mat, v, f, parent)


def prism(name, mat, pts, vec, holes=None, parent=None, soften=0.0):
    """A flat outline (local mm points in one plane) pushed along vec; holes are outlines in the same plane."""
    holes = holes or []
    n = _newell(pts)
    if _dot(n, vec) < 0:
        pts = list(reversed(pts))
    hs = []
    for h in holes:
        hs.append(list(reversed(h)) if _dot(_newell(h), vec) < 0 else list(h))
    verts = []
    rings = []
    for ring in [pts] + hs:
        start = len(verts)
        verts += [tuple(p) for p in ring]
        verts += [(p[0] + vec[0], p[1] + vec[1], p[2] + vec[2]) for p in ring]
        rings.append((start, len(ring)))
    faces = []
    s0, k0 = rings[0]
    base = [[s0 + i for i in reversed(range(k0))]]
    top = [[s0 + k0 + i for i in range(k0)]]
    for (s, k) in rings[1:]:
        base.append([s + i for i in range(k)])
        top.append([s + k + i for i in reversed(range(k))])
    faces.append(base)
    faces.append(top)
    for i in range(k0):
        j = (i + 1) % k0
        faces.append([[s0 + i, s0 + j, s0 + k0 + j, s0 + k0 + i]])
    for (s, k) in rings[1:]:
        for i in range(k):
            j = (i + 1) % k
            faces.append([[s + j, s + i, s + k + i, s + k + j]])
    return solid(name, mat, verts, faces, parent, soften)


def cyl(name, mat, c, axis, r, length, n=16, parent=None):
    """Round bar: centre c (mm) of one end, axis 'x' | 'y' | 'z' (or '-x' ...), radius, length."""
    sign = -1.0 if axis.startswith("-") else 1.0
    ax = axis[-1]
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        u, w = r * math.cos(a), r * math.sin(a)
        if ax == "x":
            pts.append((c[0], c[1] + u, c[2] + w))
        elif ax == "y":
            pts.append((c[0] + u, c[1], c[2] + w))
        else:
            pts.append((c[0] + u, c[1] + w, c[2]))
    vec = {"x": (sign * length, 0, 0), "y": (0, sign * length, 0), "z": (0, 0, sign * length)}[ax]
    return prism(name, mat, pts, vec, parent=parent, soften=0.7)


def export_model():
    """Every leaf group -> {v, f, e} in mm (faces wound outward, holes as inner loops, visible edges only)."""
    geoms = {}
    parts = []
    mats = {}

    def leaf(g, full):
        ents = g.get_entities()
        key = {}
        V = []

        def idx(p):
            k = (round(p.x * 25.4, 1), round(p.y * 25.4, 1), round(p.z * 25.4, 1))
            if k not in key:
                key[k] = len(V)
                V.append(k)
            return key[k]

        F = []
        vol = 0.0
        mname = None
        for f in ents.get_faces():
            loops = [f.get_outer_loop()] + list(f.get_inner_loops())
            ls = [[idx(v.get_position()) for v in lp.get_vertices()] for lp in loops]
            pts = [V[i] for i in ls[0]]
            nn = _newell(pts)
            fn = f.get_normal()
            if nn[0] * fn.x + nn[1] * fn.y + nn[2] * fn.z < 0:
                ls = [list(reversed(l)) for l in ls]
                nn = (-nn[0], -nn[1], -nn[2])
            vol += _dot(pts[0], nn)
            F.append(ls)
            if mname is None:
                fm = f.get_front_material()
                if fm is not None:
                    mname = fm.get_name()
                    c = fm.get_color()
                    mats[mname] = [c.red, c.green, c.blue]
        if vol < 0:
            F = [[list(reversed(l)) for l in ls] for ls in F]
        E = []
        for e in ents.get_edges():
            if e.get_soft() or e.get_hidden():
                continue
            E.append([idx(e.get_start_vertex().get_position()), idx(e.get_end_vertex().get_position())])
        k = "g" + str(len(geoms))
        geoms[k] = {"v": [c for p in V for c in p], "f": F, "e": E}
        parts.append({"n": full, "m": mname or "MDF 18 mm", "g": k})

    def walk(ents, prefix):
        for g in ents.get_groups():
            name = g.get_name() or "Part"
            sub = g.get_entities()
            if len(sub.get_groups()) > 0:
                walk(sub, prefix + name + ": ")
            else:
                leaf(g, prefix + name)

    walk(model.get_entities(), "")
    return {"geoms": geoms, "parts": parts, "materials": mats}

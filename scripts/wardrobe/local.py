# Runs the SketchUp helper code (scripts/su-helpers.py) without SketchUp: box, prism and cyl stay exactly as
# they are, and solid, material, assembly and export_model are swapped for plain Python that writes the same
# read-back ({geoms, parts, materials}, mm) that export_model() gives inside the connector. Used by
# scripts/wardrobe-model.py so a wardrobe from the planner is built in seconds, with no connector call.
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.dirname(HERE)


def _newell(pts):
    n = [0.0, 0.0, 0.0]
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return n


def namespace():
    ns = {"math": math}
    exec(open(os.path.join(SCRIPTS, "su-helpers.py")).read(), ns)
    parts = []
    mats = {}

    class Asm:
        def __init__(self, name, parent):
            self.prefix = (parent.prefix if parent else "") + name + ": "

    def material(name, rgb, alpha=255):
        mats[name] = [int(rgb[0]), int(rgb[1]), int(rgb[2])]
        ns["MATS"][name] = name
        return name

    def assembly(name, parent=None):
        return Asm(name, parent)

    def solid(name, mat, verts, faces, parent=None, soften=0.0):
        fr = ns["FRAME"]
        a = math.radians(fr["a"])
        c, s = math.cos(a), math.sin(a)
        ox, oy, oz = fr["o"]
        world = [(ox + c * x - s * y, oy + s * x + c * y, oz + z) for (x, y, z) in verts]
        key = {}
        V = []

        def idx(p):
            k = (round(p[0], 1), round(p[1], 1), round(p[2], 1))
            if k not in key:
                key[k] = len(V)
                V.append(k)
            return key[k]

        F = [[[idx(world[i]) for i in loop] for loop in face] for face in faces]
        vol = 0.0
        normals = []
        for face in F:
            pts = [V[i] for i in face[0]]
            nn = _newell(pts)
            vol += sum(pts[0][j] * nn[j] for j in range(3))
            ln = math.sqrt(sum(v * v for v in nn)) or 1.0
            normals.append([v / ln for v in nn])
        if vol < 0:
            F = [[list(reversed(l)) for l in face] for face in F]
            normals = [[-v for v in n] for n in normals]
        owners = {}
        for fi, face in enumerate(F):
            for loop in face:
                for j in range(len(loop)):
                    e = tuple(sorted((loop[j], loop[(j + 1) % len(loop)])))
                    owners.setdefault(e, []).append(fi)
        E = []
        for e, fs in owners.items():
            if soften > 0 and len(fs) == 2:
                na, nb = normals[fs[0]], normals[fs[1]]
                if sum(na[j] * nb[j] for j in range(3)) > soften:
                    continue
            E.append(list(e))
        full = (parent.prefix if parent else "") + name
        parts.append({"n": full, "m": mat, "geom": {"v": [c for p in V for c in p], "f": F, "e": E}})
        return full

    def export_model():
        geoms = {}
        out = []
        for i, p in enumerate(parts):
            k = "g%d" % i
            geoms[k] = p["geom"]
            out.append({"n": p["n"], "m": p["m"], "g": k})
        return {"geoms": geoms, "parts": out, "materials": dict(mats)}

    ns.update(material=material, assembly=assembly, solid=solid, export_model=export_model)
    return ns


def build(spec):
    """Spec -> (read-back, META, plan)."""
    ns = namespace()
    for f in ("plan.py", "build.py"):
        exec(open(os.path.join(HERE, f)).read(), ns)
    p = ns["plan"](spec)
    meta = ns["build_wardrobe"](spec, p)
    return ns["export_model"](), meta, p


def sketchup_code(spec):
    """The same build as one block to paste into the SketchUp connector's build_model."""
    src = [open(os.path.join(SCRIPTS, "su-helpers.py")).read()]
    for f in ("plan.py", "build.py"):
        src.append(open(os.path.join(HERE, f)).read())
    import json
    src.append("SPEC = %s\nbuild_wardrobe(SPEC, plan(SPEC))\nresult = {\"readback\": export_model(), \"pad\": \"x\" * 120000}\n" % json.dumps(spec).replace("true", "True").replace("false", "False"))
    return "\n\n".join(src)

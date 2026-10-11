# The wardrobe template: builds a fitted wardrobe from a planner spec and its plan (plan.py) with the
# su-helpers.py functions (material, assembly, box, prism, cyl). No imports, so the same code runs in the
# Trimble SketchUp connector (pasted after su-helpers.py and plan.py) and locally (scripts/wardrobe/local.py).
# Axes as su-helpers.py: X along the back wall from the left wall, Y out from the wall (the room is -Y), Z up, mm.
# build_wardrobe() also fills META (moves, dims, apart) for the model file; SketchUp ignores it.

META = {"moves": {}, "dims": [], "apart": []}

MDF = "MDF 18 mm"
FRAME_W = "PAX frame, white"
BACK = "Hardboard back"
RAIL = "Rail"
KNOB = "Knob"
BAR = "Bar handle"
WIRE = "Wire basket"
WALL = "Wall"


def wardrobe_materials(ikea):
    material(MDF, (200, 172, 142))
    material(RAIL, (196, 198, 202))
    material(KNOB, (170, 130, 90))
    material(BAR, (58, 58, 60))
    material(WALL, (236, 234, 228))
    if ikea:
        material(FRAME_W, (238, 238, 234))
        material(BACK, (226, 226, 222))
        material(WIRE, (150, 152, 156))


def _move(owner, m, at, riders):
    m = dict(m)
    m["at"] = at
    if riders:
        m["with"] = riders
    META["moves"][owner] = m


def _door(g, gname, name, x0, x1, z0, z1, yf, t, style, handles, hinge_left, knob_z, at):
    """One overlay door, front face at yf (the room side, more negative), t thick, with its moulding and handle.
    Hinged on its left or right front corner; opens 90 degrees."""
    full = gname + ": " + name
    box(name, MDF, x0, yf + t, z0, x1, yf, z1, g)
    riders = []
    w = x1 - x0
    h = z1 - z0
    if style == "shaker" and w > 200 and h > 300:
        rail = 70 if w > 300 else 55
        outer = [(x0, yf, z0), (x1, yf, z0), (x1, yf, z1), (x0, yf, z1)]
        hole = [(x0 + rail, yf, z0 + rail), (x1 - rail, yf, z0 + rail), (x1 - rail, yf, z1 - rail), (x0 + rail, yf, z1 - rail)]
        prism(name + " frame", MDF, outer, (0, -6, 0), [hole], g)
        riders.append(gname + ": " + name + " frame")
    elif style == "panelled" and w > 200 and h > 300:
        inset, mw = 70, 22
        panels = [(z0 + inset, z1 - inset)]
        if h > 1200:
            split = z0 + h * 0.36
            panels = [(z0 + inset, split - inset / 2), (split + inset / 2, z1 - inset)]
        for k, (pa, pb) in enumerate(panels):
            outer = [(x0 + inset, yf, pa), (x1 - inset, yf, pa), (x1 - inset, yf, pb), (x0 + inset, yf, pb)]
            hole = [(x0 + inset + mw, yf, pa + mw), (x1 - inset - mw, yf, pa + mw), (x1 - inset - mw, yf, pb - mw), (x0 + inset + mw, yf, pb - mw)]
            nm = name + " moulding %d" % (k + 1)
            prism(nm, MDF, outer, (0, -8, 0), [hole], g)
            riders.append(gname + ": " + nm)
    front = yf - (6 if style == "shaker" else 0)
    hx = x1 - 40 if hinge_left else x0 + 40
    if handles == "knobs":
        cyl(name + " knob", KNOB, (hx, front, knob_z), "-y", 15, 25, 16, g)
        riders.append(gname + ": " + name + " knob")
    elif handles == "bars":
        hz = min(max(knob_z, z0 + 150), z1 - 150)
        L = min(300, h - 120)
        box(name + " handle", BAR, hx - 6, front, hz - L / 2, hx + 6, front - 25, hz + L / 2, g)
        riders.append(gname + ": " + name + " handle")
    if hinge_left:
        hinge = {"hinge": {"origin": [x0, yf, 0], "axis": [0, 0, -1], "angle": 90}}
    else:
        hinge = {"hinge": {"origin": [x1, yf, 0], "axis": [0, 0, 1], "angle": 90}}
    _move(full, hinge, at, riders)


def _carcass(g, x0, x1, zb, zt, depth, mat, back_mat, back_t):
    """Sides, top, bottom and back of one box from y=0 (the wall) to y=-depth."""
    T = 18
    box("Side, left", mat, x0, 0, zb, x0 + T, -depth, zt, g)
    box("Side, right", mat, x1 - T, 0, zb, x1, -depth, zt, g)
    box("Top", mat, x0 + T, 0, zt - T, x1 - T, -depth, zt, g)
    box("Bottom", mat, x0 + T, 0, zb, x1 - T, -depth, zb + T, g)
    box("Back", back_mat, x0 + T, 0, zb + T, x1 - T, -back_t, zt - T, g)


def _inside(g, gname, sections, xi0, xi1, depth):
    """The unit's stack, bottom to top, as placed by plan(): baskets, drawers, shoe shelf, shelves, hanging."""
    T = 18
    front = -depth + 2  # just behind the doors
    pull = depth * 0.62
    ry = -depth / 2
    n_shelf = n_rail = n_dr = n_bk = n_group = 0
    slide = 0
    for sec in sections:
        k, z0, z1 = sec["kind"], sec["z0"], sec["z1"]
        if k == "drawers":
            for j in range(sec["count"]):
                n_dr += 1
                a = z0 + j * RULES["drawer"] + 4
                b = z0 + (j + 1) * RULES["drawer"] - 4
                nm = "Drawer %d" % n_dr
                box(nm, MDF, xi0 + 4, front + T, a, xi1 - 4, front, b, g)
                box(nm + " box", MDF, xi0 + 16, front + T, a + 10, xi1 - 16, -40, b - 45, g)
                _move(gname + ": " + nm, {"slide": {"offset": [0, -pull, 0]}}, [0.55 + 0.03 * slide, 0.9 + 0.01 * slide], [gname + ": " + nm + " box"])
                slide += 1
        elif k == "baskets":
            for j in range(sec["count"]):
                n_bk += 1
                a = z0 + j * RULES["basket"] + 15
                b = a + 115
                nm = "Basket %d" % n_bk
                bx0, bx1, by0, by1 = xi0 + 12, xi1 - 12, front - 4, -40
                box(nm, WIRE, bx0, by0 + 8, a, bx1, by0, b, g)
                box(nm + " base", WIRE, bx0, by1, a, bx1, by0 + 8, a + 4, g)
                box(nm + " back rail", WIRE, bx0, by1, b - 8, bx1, by1 - 8, b, g)
                box(nm + " side rail, left", WIRE, bx0, by1, b - 8, bx0 + 8, by0 + 8, b, g)
                box(nm + " side rail, right", WIRE, bx1 - 8, by1, b - 8, bx1, by0 + 8, b, g)
                riders = [gname + ": " + nm + r for r in (" base", " back rail", " side rail, left", " side rail, right")]
                _move(gname + ": " + nm, {"slide": {"offset": [0, -pull, 0]}}, [0.55 + 0.03 * slide, 0.9 + 0.01 * slide], riders)
                slide += 1
        elif k == "shoes":
            box("Shoe shelf", MDF, xi0, -T, z0 + 110, xi1, front + 20, z0 + 128, g)
            cyl("Shoe rail", RAIL, (xi0, front + 60, z0 + 200), "x", 8, xi1 - xi0, 12, g)
        elif k == "shelf":
            n_shelf += 1
            box("Shelf %d" % n_shelf, MDF, xi0, -T, z0, xi1, front + 20, z0 + T, g)
        elif k in ("long", "short"):
            n_rail += 1
            cyl("Hanging rail %d (%s)" % (n_rail, "long" if k == "long" else "short"), RAIL, (xi0, ry, z1 - 60), "x", 12.5, xi1 - xi0, 16, g)
        elif k == "shelves" and sec["count"] > 0:
            n_group += 1
            step = (z1 - z0) / (sec["count"] + 1)
            for j in range(sec["count"]):
                n_shelf += 1
                z = z0 + step * (j + 1) - T / 2
                box("Shelf %d" % n_shelf, MDF, xi0, -T, z, xi1, front + 20, z + T, g)


def build_wardrobe(s, p):
    s = normalise(s)
    ikea = s["build"] == "ikea"
    wardrobe_materials(ikea)
    T = 18
    W, H, D = float(s["width"]), float(s["ceiling"]), float(s["depth"])
    CD = 580.0 if ikea else D - T  # carcass depth; the doors make up the rest
    yf = -CD - T  # front face of the doors
    n = len(s["units"])

    # the room: back wall, and a side wall where an end meets one
    box("Room: Back wall", WALL, -150 if s["left"] != "wall" else -100, 100, 0, W + (150 if s["right"] != "wall" else 100), 0, H)
    if s["left"] == "wall":
        box("Room: Left wall", WALL, -100, 0, 0, 0, -D - 250, H)
    if s["right"] == "wall":
        box("Room: Right wall", WALL, W, 0, 0, W + 100, -D - 250, H)

    # ends
    for side, e in (("left", s["left"]), ("right", s["right"])):
        xa = 0.0 if side == "left" else W - take_off(e)
        if e == "panel":
            box("End panel, " + side, MDF, xa, 0, 0, xa + T, yf, H)
        elif e == "wall":
            box("Scribe filler, " + side, MDF, xa, -CD, 0, xa + RULES["scribe"], yf, H)
    if ikea and p["filler"] > 0.5:
        f = p["filler"] / 2
        xl = take_off(s["left"])
        xr = W - take_off(s["right"]) - f
        box("Filler, left", MDF, xl, -CD, 0, xl + f, yf, s["pax"])
        box("Filler, right", MDF, xr, -CD, 0, xr + f, yf, s["pax"])

    zb = float(RULES["paxBase"]) if ikea else float(RULES["plinth"])
    ztop = float(s["pax"]) if ikea else H
    for i, u in enumerate(s["units"]):
        up = p["units"][i]
        gname = "Unit %d" % (i + 1)
        META["apart"].append(gname)
        g = assembly(gname)
        x0, x1 = up["x"], up["x"] + up["w"]
        if ikea:
            _carcass(g, x0, x1, 0, ztop, CD, FRAME_W, BACK, 3)
            box("Plinth", FRAME_W, x0 + T, -CD + 20, 0, x1 - T, -CD + 38, zb, g)
        else:
            _carcass(g, x0, x1, zb, ztop, CD, MDF, MDF, T)
            box("Plinth", MDF, x0 + T, -CD + 60, 0, x1 - T, -CD + 78, zb, g)
        # the box's own bottom sits at zb (MDF) or 0 (PAX, bottom shelf at zb)
        if ikea:
            box("Bottom shelf", FRAME_W, x0 + T, -3, zb, x1 - T, -CD + 20, zb + T, g)
        _inside(g, gname, up["sections"], x0 + T, x1 - T, CD)

        # doors: a double's pair hinged at the outer edges; a single hinged towards the nearer end
        nd = up["doors"]
        dw = up["w"] / nd
        gap = RULES["gap"] / 2
        if ikea:
            dh = 1951 if s["pax"] == 2010 else 2290
            dz1 = s["pax"] - 3
            dz0 = dz1 - dh
        else:
            dz0, dz1 = zb + 2, H - 3
        for d in range(nd):
            if nd == 2:
                left_hinge = d == 0
            else:
                left_hinge = i < (n - 1) / 2.0 or n == 1
            nm = "Door" if nd == 1 else ("Door, left" if d == 0 else "Door, right")
            a0 = 0.02 * i + 0.01 * d
            _door(g, gname, nm, x0 + d * dw + gap, x0 + (d + 1) * dw - gap, dz0, dz1, yf, T, s["doors"], s["handles"], left_hinge, min(1050, dz0 + (dz1 - dz0) * 0.5), [a0, a0 + 0.45])

        if ikea and p["top"] == "box":
            tb = assembly("Top box", g)
            tname = gname + ": Top box"
            _carcass(tb, x0, x1, ztop, H, CD, MDF, MDF, T)
            for d in range(nd):
                left_hinge = (d == 0) if nd == 2 else (i < (n - 1) / 2.0 or n == 1)
                nm = "Door" if nd == 1 else ("Door, left" if d == 0 else "Door, right")
                a0 = 0.08 + 0.02 * i
                _door(tb, tname, nm, x0 + d * dw + gap, x0 + (d + 1) * dw - gap, ztop + 3, H - 3, yf, T, s["doors"] if H - ztop > 450 else "flat", s["handles"], left_hinge, ztop + 70, [a0, a0 + 0.4])
    if ikea and p["top"] == "infill":
        box("Infill over the doors", MDF, take_off(s["left"]), -CD, ztop, W - take_off(s["right"]), yf, H)

    # dimension lines for the sizes Raf typed
    META["dims"] = [
        {"a": [0, yf, H], "b": [W, yf, H], "off": [0, 0, 170], "label": "%d mm" % round(W)},
        {"a": [W, yf, 0], "b": [W, yf, H], "off": [170, 0, 0], "label": "%d mm" % round(H)},
        {"a": [W, 0, H], "b": [W, yf, H], "off": [0, 0, 170], "label": "%d mm" % round(D)},
    ]
    return META

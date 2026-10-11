# 3D builds for the alcove, bookcase and chest of drawers planners (src/lib/planners/*.ts give the plan, through
# scripts/planner-plan.mjs). Written with the su-helpers.py functions and the door/carcass helpers of
# scripts/wardrobe/build.py (exec'd first, same namespace), so it also runs in the SketchUp connector.
# Axes: X along the back wall, Y out from the wall (the room is -Y), Z up, mm. No imports.

STONE = "Room: hearth"
IRON = "Room: cast iron"


def _room_wall(x0, x1, h):
    box("Room: Back wall", WALL, x0, 100, 0, x1, 0, h)


def build_alcove(s, p):
    wardrobe_materials(False)
    material(STONE, (196, 192, 184))
    material(IRON, (44, 44, 46))
    T = 18
    H = float(s["ceiling"])
    W = float(p["W"])
    bx, bw, bd = float(p["breastX"]), float(s["breastW"]), float(s["breastD"])
    _room_wall(-150, W + 150, H)
    box("Room: Chimney breast", WALL, bx, 0, 0, bx + bw, -bd, H)
    fh = min(900.0, H * 0.38)
    box("Room: Fireplace", IRON, bx + bw * 0.25, -bd, 0, bx + bw * 0.75, -bd - 4, fh)
    box("Room: Hearth", STONE, bx + bw * 0.15, -bd, 0, bx + bw * 0.85, -bd - 400, 30)
    box("Room: Left wall", WALL, -100, 0, 0, 0, -bd - 150, H)
    box("Room: Right wall", WALL, W, 0, 0, W + 100, -bd - 150, H)
    R = {"plinth": 80, "top": 25, "shelfT": 25}
    k = 0
    for a in p["sides"]:
        gname = "Left alcove" if a["side"] == "left" else "Right alcove"
        META["apart"].append(gname)
        g = assembly(gname)
        x0, x1 = a["x"], a["x"] + a["w"]
        if a["base"]:
            bh, d = float(a["base"]["h"]), float(a["base"]["d"])
            CD = d - T
            yf = -d
            _carcass(g, x0, x1, R["plinth"], bh - R["top"], CD, MDF, MDF, T)
            box("Plinth", MDF, x0 + T, -CD + 40, 0, x1 - T, -CD + 58, R["plinth"], g)
            box("Top", MDF, x0, 0, bh - R["top"], x1, yf - 15, bh, g)
            mid = R["plinth"] + (bh - R["top"] - R["plinth"]) / 2
            box("Shelf inside", MDF, x0 + T, -T, mid, x1 - T, -CD + 20, mid + T, g)
            for i, dr in enumerate(a["base"]["doors"]):
                nm = "Door" if len(a["base"]["doors"]) == 1 else ("Door, left" if i == 0 else "Door, right")
                _door(g, gname, nm, dr["x0"], dr["x1"], R["plinth"] + 2, bh - R["top"] - 2, yf, T, s["doors"], s["handles"], dr["hingeLeft"], bh - R["top"] - 90, [0.1 * k, 0.1 * k + 0.6])
            k += 1
        for i, z in enumerate(a["shelves"]):
            box("Shelf %d" % (i + 1), MDF, x0, 0, z, x1, -a["shelfD"], z + R["shelfT"], g)
    META["dims"] = [
        {"a": [0, -bd, H], "b": [W, -bd, H], "off": [0, 0, 170], "label": "%d mm" % round(W)},
        {"a": [W, -bd, 0], "b": [W, -bd, H], "off": [170, 0, 0], "label": "%d mm" % round(H)},
    ]
    return META


def build_bookcase(s, p):
    wardrobe_materials(False)
    T = 18
    H = float(s["height"])
    W = float(s["width"])
    D = float(s["depth"])
    cup = s["base"] == "cupboards"
    BD = float(s["baseD"]) if cup else D
    BH = float(s["baseH"]) if cup else 0
    plinth = 80.0
    top_t = 25.0
    _room_wall(-150, W + 150, max(H + 150, 2400))
    deepest = max(D, BD)
    if s["left"] == "wall":
        box("Room: Left wall", WALL, -100, 0, 0, 0, -deepest - 250, H + 150)
    if s["right"] == "wall":
        box("Room: Right wall", WALL, W, 0, 0, W + 100, -deepest - 250, H + 150)
    for side, e in (("left", s["left"]), ("right", s["right"])):
        if e == "panel":
            xa = 0.0 if side == "left" else W - 18
            box("End panel, " + side, MDF, xa, 0, 0, xa + 18, -deepest, H)
        elif e == "wall":
            xa = 0.0 if side == "left" else W - 20
            box("Scribe filler, " + side, MDF, xa, -D + 18 if not cup else -BD + 18, 0, xa + 20, -deepest, H)
    g = assembly("Bookcase")
    x0, x1 = p["x0"], p["x1"]
    if cup:
        CD = BD - T
        for i, x in enumerate(p["dividers"]):
            box("Cupboard side %d" % (i + 1), MDF, x, 0, plinth, x + T, -CD, BH - top_t, g)
        box("Cupboard bottom", MDF, x0, 0, plinth, x1, -CD, plinth + T, g)
        box("Cupboard back", MDF, x0, 0, plinth + T, x1, -T, BH - top_t, g)
        box("Cupboard top", MDF, x0, 0, BH - top_t, x1, -BD - 10, BH, g)
        box("Plinth", MDF, x0 + T, -CD + 40, 0, x1 - T, -CD + 58, plinth, g)
        zu = BH
    else:
        zu = plinth
        box("Bottom", MDF, x0, 0, plinth, x1, -D, plinth + T, g)
        box("Plinth", MDF, x0 + T, -D + 40, 0, x1 - T, -D + 58, plinth, g)
    for i, x in enumerate(p["dividers"]):
        box(("Side %d" if i in (0, len(p["dividers"]) - 1) else "Upright %d") % (i + 1), MDF, x, 0, zu, x + T, -D, H - T, g)
    box("Top", MDF, x0, 0, H - T, x1, -D, H, g)
    box("Back", MDF, x0 + T, 0, zu, x1 - T, -T, H - T, g)
    n = 0
    for bi, b in enumerate(p["bays"]):
        for z in b["shelves"]:
            n += 1
            box("Shelf %d" % n, MDF, b["x0"], -T, z, b["x1"], -D + 5, z + T, g)
        if cup:
            for k, dr in enumerate(b["doors"]):
                nm = "Bay %d door" % (bi + 1) if len(b["doors"]) == 1 else "Bay %d door, %s" % (bi + 1, "left" if k == 0 else "right")
                a0 = 0.05 * bi
                _door(g, "Bookcase", nm, dr["x0"], dr["x1"], plinth + 2, BH - top_t - 2, -BD, T, s["doors"], s["handles"], dr["hingeLeft"], BH - top_t - 90, [a0, a0 + 0.5])
    META["dims"] = [
        {"a": [0, -deepest, H], "b": [W, -deepest, H], "off": [0, 0, 170], "label": "%d mm" % round(W)},
        {"a": [W, -deepest, 0], "b": [W, -deepest, H], "off": [170, 0, 0], "label": "%d mm" % round(H)},
    ]
    return META


def build_chest(s, p):
    wardrobe_materials(False)
    T = 18
    W, H, D = float(s["width"]), float(s["height"]), float(s["depth"])
    _room_wall(-400, W + 400, 1400)
    g = assembly("Chest")
    base = float(p["baseH"])
    top = float(p["bodyTop"])
    CD = D - T  # fronts make up the rest
    box("Side, left", MDF, 0, 0, base, T, -CD, top, g)
    box("Side, right", MDF, W - T, 0, base, W, -CD, top, g)
    box("Bottom", MDF, T, 0, base, W - T, -CD, base + T, g)
    box("Back", MDF, T, 0, base + T, W - T, -T, top, g)
    box("Top", MDF, -15, 0, top, W + 15, -D - 15, H, g)
    if s["base"] == "plinth":
        box("Plinth", MDF, 30, -40, 0, W - 30, -CD + 30, base, g)
    elif s["base"] == "legs":
        for nm, x, y in (("Leg, back left", 30, -30), ("Leg, back right", W - 70, -30), ("Leg, front left", 30, -CD + 10), ("Leg, front right", W - 70, -CD + 10)):
            box(nm, BAR, x, y, 0, x + 40, y - 40, base, g)
    if s["columns"] > 1:
        cw = W / s["columns"]
        for c in range(1, s["columns"]):
            x = c * cw - T / 2
            box("Divider %d" % c, MDF, x, -T, base + T, x + T, -CD, top, g)
    pull = D * 0.6
    fronts = p["fronts"]
    for i, f in enumerate(fronts):
        nm = "Drawer %d" % (i + 1)
        box(nm, MDF, f["x0"], -CD, f["z0"], f["x1"], -D, f["z1"], g)
        box(nm + " box", MDF, f["x0"] + 25, -40, f["z0"] + 15, f["x1"] - 25, -CD, f["z1"] - 30, g)
        riders = ["Chest: " + nm + " box"]
        cz = (f["z0"] + f["z1"]) / 2
        cx = (f["x0"] + f["x1"]) / 2
        if s["handles"] == "knobs":
            xs = [f["x0"] + (f["x1"] - f["x0"]) / 4, f["x1"] - (f["x1"] - f["x0"]) / 4] if f["x1"] - f["x0"] > 500 else [cx]
            for j, x in enumerate(xs):
                cyl(nm + " knob %d" % (j + 1), KNOB, (x, -D, cz), "-y", 15, 25, 16, g)
                riders.append("Chest: " + nm + " knob %d" % (j + 1))
        elif s["handles"] == "bars":
            L = min(300, (f["x1"] - f["x0"]) / 2)
            box(nm + " handle", BAR, cx - L / 2, -D, cz - 6, cx + L / 2, -D - 25, cz + 6, g)
            riders.append("Chest: " + nm + " handle")
        order = len(fronts) - 1 - i  # top drawers first
        a0 = 0.06 * order
        _move("Chest: " + nm, {"slide": {"offset": [0, -pull, 0]}}, [min(a0, 0.6), min(a0, 0.6) + 0.4], riders)
    META["dims"] = [
        {"a": [0, -D, H], "b": [W, -D, H], "off": [0, 0, 170], "label": "%d mm" % round(W)},
        {"a": [W, -D, 0], "b": [W, -D, H], "off": [170, 0, 0], "label": "%d mm" % round(H)},
        {"a": [W, 0, H], "b": [W, -D, H], "off": [0, 0, 170], "label": "%d mm" % round(D)},
    ]
    return META

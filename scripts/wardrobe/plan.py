# The wardrobe planner's sums, the same as src/lib/wardrobe.ts (keep the two saying the same thing).
# No imports: this file is also pasted into the SketchUp connector (build_model) with su-helpers.py and build.py.
# spec: {build: 'mdf'|'ikea', pax: 2010|2364, width, ceiling, depth,
#        units: [{type: 'double'|'single', pieces: [{kind, count}, ...bottom to top]}],
#        left, right: 'panel'|'wall'|'none', doors: 'flat'|'shaker'|'panelled', handles: 'knobs'|'bars'|'push'}
# piece kinds: baskets, drawers (with a count), shoes, shelf, short, long (hanging), shelves (with a count). mm.

RULES = {
    "plinth": 80, "scribe": 20, "panel": 18, "gap": 3, "topBoxFrom": 300, "doorMin": 300, "doorMax": 600,
    "paxDouble": 1000, "paxSingle": 500, "paxDoor": 497, "paxBase": 60, "fillerMax": 250, "drawer": 200,
    "basket": 160, "shoes": 250, "topShelfSpace": 300, "longNeeds": 1400, "shortNeeds": 1000, "shelfGap": 250,
    "board": 18,
}


def jround(x):
    """Math.round, as in the app (Python's round() rounds halves to even)."""
    return int((x + 0.5) // 1)


def take_off(e):
    return RULES["panel"] if e == "panel" else RULES["scribe"] if e == "wall" else 0


def normalise(s):
    """Requests saved before the inside became a stack (bottom + above + top shelf)."""
    units = []
    for u in s["units"]:
        if "pieces" in u:
            units.append({"type": u["type"], "pieces": u["pieces"]})
            continue
        pcs = []
        b = u.get("bottom")
        if b in ("baskets", "drawers"):
            pcs += [{"kind": b, "count": u.get("count") or 1}, {"kind": "shelf", "count": 0}]
        if b == "shoes":
            pcs.append({"kind": "shoes", "count": 0})
        a = u.get("above")
        if a in ("long", "short"):
            pcs.append({"kind": a, "count": 0})
        if a == "two":
            pcs += [{"kind": "short", "count": 0}, {"kind": "short", "count": 0}]
        if a == "shelves":
            pcs.append({"kind": "shelves", "count": u.get("shelves") or 3})
        if u.get("topShelf"):
            pcs.append({"kind": "shelf", "count": 0})
        units.append({"type": u["type"], "pieces": pcs})
    out = dict(s)
    out["units"] = units
    return out


def _fixed(p, last):
    k = p["kind"]
    if k == "baskets":
        return p["count"] * RULES["basket"]
    if k == "drawers":
        return p["count"] * RULES["drawer"]
    if k == "shoes":
        return RULES["shoes"]
    if k == "shelf":
        return RULES["board"] + (RULES["topShelfSpace"] if last else 0)
    return 0


def _flex(p):
    k = p["kind"]
    if k == "long":
        return RULES["longNeeds"]
    if k == "short":
        return RULES["shortNeeds"]
    if k == "shelves":
        return (p["count"] + 1) * RULES["shelfGap"]
    return 0


def stack(pieces, z0, z1):
    n = len(pieces)
    fixed = sum(_fixed(p, i == n - 1) for i, p in enumerate(pieces))
    need = sum(_flex(p) for p in pieces)
    free = z1 - z0 - fixed
    k = max(free, 0) / need if need > 0 else 0
    z = z0
    out = []
    for i, p in enumerate(pieces):
        h = _fixed(p, i == n - 1) or _flex(p) * k
        s = dict(p)
        s["z0"], s["z1"] = z, z + h
        out.append(s)
        z += h
    return out, (need - free if need > 0 else fixed - (z1 - z0))


def plan(s):
    s = normalise(s)
    R = RULES
    units = s["units"]
    doors = sum(2 if u["type"] == "double" else 1 for u in units)
    size = sum(1 if u["type"] == "double" else 0.5 for u in units)
    avail = s["width"] - take_off(s["left"]) - take_off(s["right"])
    ikea = s["build"] == "ikea"
    share = avail / doors if doors else 0
    frames = sum(R["paxDouble"] if u["type"] == "double" else R["paxSingle"] for u in units)
    filler = avail - frames if ikea else 0
    carcass_h = s["pax"] if ikea else s["ceiling"] - R["plinth"]
    above = s["ceiling"] - s["pax"] if ikea else 0
    top = "none" if (not ikea or above <= 0) else ("box" if above >= R["topBoxFrom"] else "infill")
    door_w = R["paxDoor"] if ikea else share - R["gap"]
    problems = []
    if not s["width"]:
        problems.append("Type the wall to wall width.")
    elif not doors:
        problems.append("Pick a layout.")
    elif ikea:
        if filler < 0:
            problems.append("The PAX frames are %d mm too wide: take a unit off." % jround(-filler))
        elif filler > R["fillerMax"]:
            problems.append("%d mm of filler left over: add a single?" % jround(filler))
    elif door_w > R["doorMax"]:
        problems.append("Doors would be %d mm wide: add a unit." % jround(door_w))
    elif door_w < R["doorMin"]:
        problems.append("Doors would be %d mm wide: use fewer units." % jround(door_w))
    if ikea and s["ceiling"] < s["pax"]:
        problems.append("The %d frame is taller than the ceiling." % s["pax"])

    z0 = R["paxBase"] + R["board"] if ikea else R["plinth"] + R["board"]
    z1 = (s["pax"] if ikea else s["ceiling"]) - R["board"]
    x = take_off(s["left"]) + (max(filler, 0) / 2 if ikea else 0)
    ups = []
    for i, u in enumerate(units):
        if ikea:
            w = R["paxDouble"] if u["type"] == "double" else R["paxSingle"]
        else:
            w = 2 * share if u["type"] == "double" else share
        sections, short = stack(u["pieces"], z0, z1)
        ok = short <= 0
        note = "Empty inside" if not u["pieces"] else ("%d mm to spare" % jround(-short) if ok else "%d mm too much inside" % jround(short))
        if not ok:
            problems.append("Unit %d: %s." % (i + 1, note))
        ups.append({"x": x, "w": w, "doors": 2 if u["type"] == "double" else 1, "z0": z0, "z1": z1, "sections": sections, "ok": ok, "note": note})
        x += w
    return {"doors": doors, "size": size, "avail": avail, "doorW": door_w, "filler": filler, "carcassH": carcass_h,
            "above": above, "top": top, "units": ups, "problems": problems}

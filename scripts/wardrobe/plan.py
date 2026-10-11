# The wardrobe planner's sums, the same as src/lib/wardrobe.ts (keep the two saying the same thing).
# No imports: this file is also pasted into the SketchUp connector (build_model) with su-helpers.py and build.py.
# spec: {build: 'mdf'|'ikea', pax: 2010|2364, width, ceiling, depth, units: [{type, bottom, count, above,
#        shelves, topShelf}], left, right: 'panel'|'wall'|'none', doors: 'flat'|'shaker'|'panelled',
#        handles: 'knobs'|'bars'|'push'}   (all mm)

RULES = {
    "plinth": 80, "scribe": 20, "panel": 18, "gap": 3, "topBoxFrom": 300, "doorMin": 300, "doorMax": 600,
    "paxDouble": 1000, "paxSingle": 500, "paxDoor": 497, "fillerMax": 250, "drawer": 200, "basket": 160,
    "shoes": 250, "topShelfSpace": 300, "longNeeds": 1400, "shortNeeds": 1000, "board": 18,
}


def jround(x):
    """Math.round, as in the app (Python's round() rounds halves to even)."""
    return int((x + 0.5) // 1)


def take_off(e):
    return RULES["panel"] if e == "panel" else RULES["scribe"] if e == "wall" else 0


def plan(s):
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

    x = take_off(s["left"]) + (max(filler, 0) / 2 if ikea else 0)
    inner = carcass_h - 2 * R["board"]
    ups = []
    for i, u in enumerate(units):
        if ikea:
            w = R["paxDouble"] if u["type"] == "double" else R["paxSingle"]
        else:
            w = 2 * share if u["type"] == "double" else share
        b = u["bottom"]
        bottom_h = u["count"] * R["drawer"] if b == "drawers" else u["count"] * R["basket"] if b == "baskets" else R["shoes"] if b == "shoes" else 0
        space = inner - bottom_h - (R["topShelfSpace"] if u["topShelf"] else 0)
        ok, note = True, "%d mm above the bottom" % jround(space)
        if u["above"] == "long" and space < R["longNeeds"]:
            ok, note = False, "%d mm is short for long hanging" % jround(space)
        elif u["above"] == "short" and space < R["shortNeeds"]:
            ok, note = False, "%d mm is short for short hanging" % jround(space)
        elif u["above"] == "two" and space < 2 * R["shortNeeds"]:
            ok, note = False, "%d mm is short for two rails" % jround(space)
        if not ok:
            problems.append("Unit %d: %s." % (i + 1, note))
        ups.append({"x": x, "w": w, "doors": 2 if u["type"] == "double" else 1, "inner": inner, "bottomH": bottom_h, "space": space, "ok": ok, "note": note})
        x += w
    return {"doors": doors, "size": size, "avail": avail, "doorW": door_w, "filler": filler, "carcassH": carcass_h,
            "above": above, "top": top, "units": ups, "problems": problems}

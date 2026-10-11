"""A fitted wardrobe's 3D model straight from the Job Kit's wardrobe planner (src/lib/wardrobe.ts).

    python3 scripts/wardrobe-model.py SPEC OUT.su.json OUT.glb [--name "Title, Area"] [--sketchup CODE.py]
                                                              [--from-sketchup TOOL_RESULT]

SPEC is the request's job.json (design.wardrobe) or a bare planner spec JSON. The template
(scripts/wardrobe/build.py, with plan.py) is built locally through scripts/wardrobe/local.py, which runs the same
su-helpers.py code SketchUp runs, so the model is ready in seconds. --sketchup writes that code as one block to
paste into the Trimble SketchUp connector's build_model; --from-sketchup uses the read-back saved from such a
run instead of the local geometry (moves and dimension lines still come from the template).
Prints a JSON summary for content/designs/<code>.json: sizes, a sentence for the option, the planner's warnings.
"""
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "wardrobe"))
import local  # noqa: E402

args = sys.argv[1:]


def opt(name):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return None


name = opt("--name") or "Wardrobe"
code_out = opt("--sketchup")
from_su = opt("--from-sketchup")
spec_path, su_out, glb_out = args[:3]

raw = json.load(open(spec_path))
spec = raw.get("design", {}).get("wardrobe") if "design" in raw else raw
if not spec:
    sys.exit(f"{spec_path}: no wardrobe planner in this request")

ns = {}
exec(open(os.path.join(HERE, "wardrobe", "plan.py")).read(), ns)
spec = ns["normalise"](spec)
readback, meta, p = local.build(spec)
if code_out:
    open(code_out, "w").write(local.sketchup_code(spec))

ikea = spec["build"] == "ikea"
materials = {
    "MDF 18 mm": {"color": [200, 172, 142], "roughness": 0.85},
    "Rail": {"color": [196, 198, 202], "roughness": 0.25, "metalness": 0.8},
    "Knob": {"color": [170, 130, 90], "roughness": 0.6},
    "Bar handle": {"color": [58, 58, 60], "roughness": 0.4, "metalness": 0.6},
    "Wall": {"color": [236, 234, 228], "roughness": 0.95},
}
if ikea:
    materials.update({
        "PAX frame, white": {"color": [238, 238, 234], "roughness": 0.7},
        "Hardboard back": {"color": [226, 226, 222], "roughness": 0.9},
        "Wire basket": {"color": [150, 152, 156], "roughness": 0.35, "metalness": 0.7},
    })
units = spec["units"]
doors_words = {"flat": "flat doors", "shaker": "shaker doors", "panelled": "panelled doors"}[spec["doors"]]
handle_words = {"knobs": "wooden knobs", "bars": "bar handles", "push": "push to open"}[spec["handles"]]
meta_json = {
    "name": name,
    "source": "Built from the Job Kit wardrobe planner with the wardrobe template (scripts/wardrobe/build.py, the su-helpers.py code), "
              + ("read back from SketchUp" if from_su else "run locally") + ". Spec: " + json.dumps(spec),
    "materials": materials,
    "moves": meta["moves"],
    "dims": meta["dims"],
    "view": {"yaw": 0.35, "pitch": 0.16, "yawMin": -1.2, "yawMax": 1.2, "pitchMin": -0.05, "pitchMax": 0.85},
    "actions": {"open": "Open the doors", "close": "Close the doors"},
    "secs": 2.4,
    **({"apart": meta["apart"]} if len(units) > 1 else {}),
}

with tempfile.TemporaryDirectory() as tmp:
    rb_path = from_su or os.path.join(tmp, "readback.json")
    if not from_su:
        json.dump({"readback": readback}, open(rb_path, "w"))
    mp = os.path.join(tmp, "meta.json")
    json.dump(meta_json, open(mp, "w"))
    subprocess.run([sys.executable, os.path.join(HERE, "su-readback.py"), rb_path, mp, su_out], check=True)
os.makedirs(os.path.dirname(os.path.abspath(glb_out)), exist_ok=True)
subprocess.run(["node", os.path.join(HERE, "su-to-glb.mjs"), su_out, glb_out], check=True, cwd=os.path.dirname(HERE))

# what the design page says
def piece_words(pc, last):
    k, c = pc["kind"], pc["count"]
    if k == "baskets":
        return "%d IKEA basket%s" % (c, "" if c == 1 else "s")
    if k == "drawers":
        return "%d drawer%s" % (c, "" if c == 1 else "s")
    if k == "shelves":
        return "%d shelves" % c
    if k == "shelf":
        return "a top shelf" if last else "a shelf"
    return {"shoes": "a shoe shelf", "short": "short hanging", "long": "long hanging"}[k]


def unit_words(u):
    pcs = u["pieces"]
    if not pcs:
        return "left empty"
    return "from the bottom " + ", ".join(piece_words(pc, i == len(pcs) - 1) for i, pc in enumerate(pcs))


parts = []
for i, u in enumerate(units):
    parts.append(("the %s" % ("left" if i == 0 else "right" if i == len(units) - 1 else "middle")) if len(units) <= 3 else "unit %d" % (i + 1))
kind_word = (lambda t: {"double": "1000", "mid": "750", "single": "500"}[t] + " unit") if ikea else (lambda t: "single" if t == "single" else "double")
inside = "; ".join("%s %s, %s" % (parts[i], kind_word(u["type"]), unit_words(u)) for i, u in enumerate(units))
build_words = ("IKEA PAX frames %d high" % spec["pax"] + (" with a top box above" if p["top"] == "box" else " with an infill strip above" if p["top"] == "infill" else "")) if ikea else "MDF from floor to ceiling on a plinth"
text = "%d doors in %s, %s and %s. Inside: %s." % (p["doors"], build_words, doors_words, handle_words, inside)
sizes = [
    {"label": "Width, wall to wall", "value": "%d mm" % spec["width"]},
    {"label": "Height, to the ceiling", "value": "%d mm" % spec["ceiling"]},
    {"label": "Depth", "value": "%d mm" % spec["depth"]},
]
if not ikea:
    sizes.append({"label": "Each door", "value": "%d mm" % int((p["doorW"] + 0.5) // 1)})
print(json.dumps({"text": text, "sizes": sizes, "problems": p["problems"], "doors": p["doors"]}, indent=2))

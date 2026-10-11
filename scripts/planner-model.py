"""3D design straight from a Job Kit planner: wardrobe, alcoves, bookcase or chest of drawers.

    python3 scripts/planner-model.py SPEC OUT.su.json OUT.glb [--name "Title, Area"]

SPEC is the planner JSON that design-requests.py --fetch saves (wardrobe.json, alcove.json, bookcase.json,
chest.json). A wardrobe goes to scripts/wardrobe-model.py. The others get their sums from src/lib/planners/<kind>.ts
(through scripts/planner-plan.mjs, so the model matches what the app showed) and are built by
scripts/planners/build.py with the same SketchUp helper code, run locally (scripts/wardrobe/local.py).
Prints a JSON summary for content/designs/<code>.json: title, text, sizes, the planner's warnings.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "wardrobe"))
import local  # noqa: E402

args = sys.argv[1:]
name = "Design"
if "--name" in args:
    i = args.index("--name")
    name = args[i + 1]
    del args[i:i + 2]
spec_path, su_out, glb_out = args[:3]
spec = json.load(open(spec_path))
kind = spec.get("kind", "wardrobe")
if kind == "wardrobe":
    sys.exit(subprocess.run([sys.executable, os.path.join(HERE, "wardrobe-model.py"), spec_path, su_out, glb_out, "--name", name]).returncode)

out = subprocess.run(["node", "--experimental-strip-types", "--no-warnings", os.path.join(HERE, "planner-plan.mjs"), kind, spec_path], capture_output=True, text=True, check=True)
res = json.loads(out.stdout)
p, summary = res["plan"], res["summary"]

ns = local.namespace()
exec(open(os.path.join(HERE, "wardrobe", "plan.py")).read(), ns)
exec(open(os.path.join(HERE, "wardrobe", "build.py")).read(), ns)
exec(open(os.path.join(HERE, "planners", "build.py")).read(), ns)
meta = ns["build_" + kind](spec, p)
readback = ns["export_model"]()

materials = {
    "MDF 18 mm": {"color": [200, 172, 142], "roughness": 0.85},
    "Rail": {"color": [196, 198, 202], "roughness": 0.25, "metalness": 0.8},
    "Knob": {"color": [170, 130, 90], "roughness": 0.6},
    "Bar handle": {"color": [58, 58, 60], "roughness": 0.4, "metalness": 0.6},
    "Wall": {"color": [236, 234, 228], "roughness": 0.95},
    "Room: hearth": {"color": [196, 192, 184], "roughness": 0.8},
    "Room: cast iron": {"color": [44, 44, 46], "roughness": 0.6, "metalness": 0.3},
}
used = {pt["m"] for pt in readback["parts"]}
materials = {k: v for k, v in materials.items() if k in used}
words = {"alcove": ("Open the doors", "Close the doors"), "bookcase": ("Open the doors", "Close the doors"), "chest": ("Open the drawers", "Close the drawers")}[kind]
meta_json = {
    "name": name,
    "source": "Built from the Job Kit %s planner (src/lib/planners/%s.ts sums, scripts/planners/build.py on the su-helpers.py code, run locally). Spec: %s" % (kind, kind, json.dumps(spec)),
    "materials": materials,
    "moves": meta["moves"],
    "dims": meta["dims"],
    "view": {"yaw": 0.35, "pitch": 0.16 if kind != "chest" else 0.3, "yawMin": -1.2, "yawMax": 1.2, "pitchMin": -0.05, "pitchMax": 0.9},
    "secs": 2.0,
}
if meta["moves"]:
    meta_json["actions"] = {"open": words[0], "close": words[1]}
if len(meta["apart"]) > 1:
    meta_json["apart"] = meta["apart"]

import tempfile  # noqa: E402

with tempfile.TemporaryDirectory() as tmp:
    rb = os.path.join(tmp, "readback.json")
    json.dump({"readback": readback}, open(rb, "w"))
    mp = os.path.join(tmp, "meta.json")
    json.dump(meta_json, open(mp, "w"))
    subprocess.run([sys.executable, os.path.join(HERE, "su-readback.py"), rb, mp, su_out], check=True)
os.makedirs(os.path.dirname(os.path.abspath(glb_out)), exist_ok=True)
subprocess.run(["node", os.path.join(HERE, "su-to-glb.mjs"), su_out, glb_out], check=True, cwd=os.path.dirname(HERE))
print(json.dumps(summary, indent=2))

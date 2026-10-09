"""Turns a SketchUp read-back (the padded build_model answer saved by the connector) into scripts/models/<job>.su.json.

    python3 scripts/su-readback.py <tool-result file> <meta.json> scripts/models/<job>.su.json

The read-back is `result = {"readback": export_model(), "pad": "x" * 120000}` from a build_model call:
export_model() walks the model's groups and component instances and returns
{geoms: {key: {v, f, e}}, parts: [{n, m, g, t?}], materials: {name: [r, g, b]}} in mm (see su-to-glb.mjs).
meta.json holds what SketchUp does not: name, source, materials (overrides with roughness, metalness,
emissive), moves, dims (real sizes only), view, actions, secs, apart. Material colours not in meta come from SketchUp.
"""
import json
import sys

src, meta_path, out_path = sys.argv[1:4]
raw = open(src).read()
data = json.loads(raw[raw.index('{'):raw.rindex('}') + 1])
rb = data['result']['readback'] if 'result' in data else data['readback']
meta = json.load(open(meta_path))

materials = {n: c for n, c in rb['materials'].items()}
for n, m in (meta.get('materials') or {}).items():
    materials[n] = m
names = {p['n'] for p in rb['parts']}
for owner, mv in (meta.get('moves') or {}).items():
    for n in [owner, *mv.get('with', [])]:
        if n not in names:
            sys.exit(f'moves: no part called "{n}". Parts: {sorted(names)}')

out = {
    'name': meta['name'],
    'source': meta['source'],
    'materials': materials,
    **{k: meta[k] for k in ('moves', 'dims', 'view', 'actions', 'secs', 'apart') if k in meta},
    'geoms': rb['geoms'],
    'parts': rb['parts'],
}
json.dump(out, open(out_path, 'w'), separators=(',', ':'))
print(f"{out_path}: {len(rb['parts'])} parts, {len(rb['geoms'])} shapes, materials {list(materials)}")

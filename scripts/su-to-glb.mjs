// Turns a SketchUp model read back through the Trimble SketchUp connector into a .glb for a job page.
//
//   node scripts/su-to-glb.mjs scripts/models/<job>.su.json public/models/<job>.glb
//
// Input (SketchUp's own axes, millimetres: X along the back wall, Y out from the room (the room is -Y), Z up):
//   materials: { "<name>": [r,g,b] | { color: [r,g,b], roughness?, metalness?, emissive?: [r,g,b] (glows, e.g. LED strips) } }
//   geoms:     { "<key>": { v: [x,y,z, ...], f: [[outerLoop, ...innerLoops]], e: [[a,b], ...] } }
//              one entry per SketchUp component/group definition: faces as vertex-index loops
//              (holes as inner loops) and SketchUp's visible (not soft) edges
//   parts:     [{ n: name, m: material, g: geom key, t?: [3x3 rotation by columns, then x,y,z mm] }]
//              (or v/f/e inline instead of g)
//   moves:     { "<part>": { hinge: { origin: [x,y,z], axis: [x,y,z], angle: degrees }
//                          | slide: { offset: [x,y,z] },
//                           at: [start, end] (0..1 of the open animation), with?: [parts that ride along] } }
//   dims:      [{ a: [x,y,z], b: [x,y,z], off: [x,y,z], label: "3000 mm" }]  dimension lines
//   view:      { yaw, pitch, yawMin, yawMax, pitchMin, pitchMax } (radians; yaw 0 = straight at the front)
//   actions:   { open: "Lift the lids", close: "Close the lids" },  secs: length of the open animation
// Output: binary glTF in metres, Y up, the room side facing +Z. Faces are triangulated with
// three.js (holes kept), edges become line primitives, moves/dims/view ride along as extras,
// and each part node has extras.part = its name (shown when the part is tapped). A part with the
// material "Wall" is room context: it stays put when the job is taken apart and can't be tapped.
// Shown by Model3D.tsx / src/lib/model3d-scene.ts. Checked with gltf-validator: no errors.
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: node scripts/su-to-glb.mjs in.su.json out.glb'); process.exit(1); }
const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const fail = (msg) => { console.error(msg); process.exit(1); };

// SketchUp (X, Y, Z) mm -> glTF (X, Z, -Y) m. A proper rotation, so face windings stay outward.
const conv = ([x, y, z]) => [x / 1000, z / 1000, -y / 1000];
const convDir = ([x, y, z]) => [x, z, -y];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
function newell(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm(n);
}
const place = (t, [x, y, z]) => (t ? [t[0] * x + t[3] * y + t[6] * z + t[9], t[1] * x + t[4] * y + t[7] * z + t[10], t[2] * x + t[5] * y + t[8] * z + t[11]] : [x, y, z]);

// materials
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const matNames = Object.keys(src.materials ?? { 'MDF 18 mm': [200, 172, 142] });
const materials = matNames.map((name) => {
  const m = (src.materials ?? {})[name] ?? [200, 172, 142];
  const { color, roughness = 0.85, metalness = 0, emissive } = Array.isArray(m) ? { color: m } : m;
  return { name, pbrMetallicRoughness: { baseColorFactor: [...color.map(lin), 1], metallicFactor: metalness, roughnessFactor: roughness }, ...(emissive ? { emissiveFactor: emissive.map(lin) } : {}) };
});
const EDGE_MAT = materials.length;
materials.push({ name: 'Edges', pbrMetallicRoughness: { baseColorFactor: [lin(22), lin(25), lin(28), 1], metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } });

const parts = [];
let tris = 0, faces = 0;
for (const p of src.parts) {
  const geo = p.g ? src.geoms?.[p.g] : p;
  if (!geo) fail(`${p.n}: no geometry "${p.g}"`);
  // every edge must be shared by exactly two face loops, or the part is not a closed solid
  const c = new Map();
  for (const loops of geo.f) for (const l of loops) for (let i = 0; i < l.length; i++) {
    const a = l[i], b = l[(i + 1) % l.length], k = a < b ? `${a},${b}` : `${b},${a}`;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  const open = [...c.values()].filter((v) => v !== 2).length;
  if (open) fail(`${p.n}: ${open} open edges`);

  const V = [];
  for (let i = 0; i < geo.v.length; i += 3) V.push(conv(place(p.t, [geo.v[i], geo.v[i + 1], geo.v[i + 2]])));
  const pos = [], nor = [], idx = [];
  for (const loops of geo.f) {
    faces++;
    const outer = loops[0].map((i) => V[i]);
    const holes = loops.slice(1).map((l) => l.map((i) => V[i]));
    const n = newell(outer);
    const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = norm(cross(ref, n)), w = cross(n, u);
    const to2 = (q) => new Vector2(dot(q, u), dot(q, w));
    const base = pos.length / 3, all = [...outer, ...holes.flat()];
    for (const q of all) { pos.push(...q); nor.push(...n); }
    for (const t of ShapeUtils.triangulateShape(outer.map(to2), holes.map((h) => h.map(to2)))) {
      const [a, b, cc] = t.map((k) => all[k]);
      const flip = dot(cross(sub(b, a), sub(cc, a)), n) < 0; // keep SketchUp's front face outward
      idx.push(base + t[0], base + (flip ? t[2] : t[1]), base + (flip ? t[1] : t[2]));
      tris++;
    }
  }
  const lines = [];
  for (const [a, b] of geo.e) lines.push(...V[a], ...V[b]);
  const mi = matNames.indexOf(p.m ?? matNames[0]);
  if (mi < 0) fail(`${p.n}: unknown material "${p.m}"`);
  parts.push({ name: p.n, mat: mi, pos, nor, idx, lines });
}

// ---------- binary glTF ----------
const chunks = [], bufferViews = [], accessors = [];
let byteLength = 0;
function addAccessor(arr, type, isIndex) {
  const typed = isIndex ? (arr.length && Math.max(...arr) > 65535 ? new Uint32Array(arr) : new Uint16Array(arr)) : new Float32Array(arr);
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad; }
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, target: isIndex ? 34963 : 34962 });
  chunks.push(buf); byteLength += buf.length;
  const acc = { bufferView: bufferViews.length - 1, componentType: isIndex ? (typed instanceof Uint32Array ? 5125 : 5123) : 5126, count: arr.length / (type === 'VEC3' ? 3 : 1), type };
  if (type === 'VEC3') {
    acc.min = [Infinity, Infinity, Infinity]; acc.max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) { acc.min[k] = Math.min(acc.min[k], arr[i + k]); acc.max[k] = Math.max(acc.max[k], arr[i + k]); }
  }
  accessors.push(acc);
  return accessors.length - 1;
}

const moves = src.moves ?? {};
const riders = new Map(); // part name -> the moving part it rides with
for (const [owner, mv] of Object.entries(moves)) for (const r of mv.with ?? []) riders.set(r, owner);
for (const name of [...Object.keys(moves), ...riders.keys()]) if (!parts.some((p) => p.name === name)) fail(`moves: no part called "${name}"`);

const dims = (src.dims ?? []).map((d) => ({ a: conv(d.a), b: conv(d.b), off: conv(d.off), label: d.label }));
const rootExtras = { ...(dims.length ? { dims } : {}), ...(src.view ? { view: src.view } : {}), ...(src.actions ? { actions: src.actions } : {}), ...(src.secs ? { secs: src.secs } : {}) };
const meshes = [], nodes = [{ name: src.name ?? 'Model', children: [], ...(Object.keys(rootExtras).length ? { extras: rootExtras } : {}) }];
const nodeOf = new Map();
for (const p of parts) {
  const prims = [{ attributes: { POSITION: addAccessor(p.pos, 'VEC3'), NORMAL: addAccessor(p.nor, 'VEC3') }, indices: addAccessor(p.idx, 'SCALAR', true), material: p.mat, mode: 4 }];
  if (p.lines.length) prims.push({ attributes: { POSITION: addAccessor(p.lines, 'VEC3') }, material: EDGE_MAT, mode: 1 });
  meshes.push({ name: p.name, primitives: prims });
  // extras.part keeps the readable name (glTF loaders mangle node names), shown when a part is tapped
  const node = { name: p.name, mesh: meshes.length - 1, extras: { part: p.name } };
  const mv = moves[p.name];
  if (mv) {
    const at = mv.at ?? [0, 1];
    if (mv.hinge) node.extras.move = { kind: 'hinge', origin: conv(mv.hinge.origin), axis: convDir(mv.hinge.axis), angle: (mv.hinge.angle * Math.PI) / 180, at };
    else if (mv.slide) node.extras.move = { kind: 'slide', offset: conv(mv.slide.offset), at };
    else fail(`${p.name}: a move needs hinge or slide`);
  }
  nodes.push(node);
  nodeOf.set(p.name, nodes.length - 1);
}
for (const p of parts) {
  const owner = riders.get(p.name);
  const parent = owner ? nodes[nodeOf.get(owner)] : nodes[0];
  (parent.children ??= []).push(nodeOf.get(p.name));
}

const gltf = {
  asset: { version: '2.0', generator: 'Raf Carpentry su-to-glb (SketchUp model read back through the Trimble SketchUp connector)' },
  extensionsUsed: ['KHR_materials_unlit'],
  scene: 0, scenes: [{ name: src.name ?? 'Model', nodes: [0] }],
  nodes, meshes, materials, accessors, bufferViews, buffers: [{ byteLength }],
};
const pad4 = (buf, fill) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, fill)]);
const json = pad4(Buffer.from(JSON.stringify(gltf)), 0x20);
const bin = pad4(Buffer.concat(chunks), 0);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(outPath, Buffer.concat([head, jh, json, bh, bin]));
console.log(`${outPath}: ${parts.length} parts, ${faces} faces, ${tris} triangles, ${Object.keys(moves).length} moving, ${dims.length} dimensions, ${fs.statSync(outPath).size} bytes`);

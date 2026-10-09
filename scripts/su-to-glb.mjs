// Turns a SketchUp model read back through the Trimble SketchUp connector into a .glb for a job page.
//
//   node scripts/su-to-glb.mjs scripts/models/<job>.su.json public/models/<job>.glb
//
// Input (SketchUp's own axes, millimetres: X along the back wall, Y out into the room, Z up):
//   parts:  [{ n: name, v: [x,y,z, ...], f: [[outerLoop, ...innerLoops]], e: [[a,b], ...] }]
//           every face as vertex-index loops (holes as inner loops) and SketchUp's visible edges
//   hinges: { "<part name>": { origin: [x,y,z], axis: [x,y,z], open?: degrees } }  lids that lift
//   dims:   [{ a: [x,y,z], b: [x,y,z], off: [x,y,z], label: "3000 mm" }]  dimension lines
// Output: binary glTF in metres, Y up, the room side facing +Z. Faces are triangulated with
// three.js (holes kept), edges become line primitives, hinges and dims ride along as extras.
// Model3D.tsx / src/lib/model3d-scene.ts show it. Checked with gltf-validator: no errors.
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: node scripts/su-to-glb.mjs in.su.json out.glb'); process.exit(1); }
const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));

// SketchUp (X, Y, Z) mm -> glTF (X, Z, -Y) m. A proper rotation, so face windings stay outward.
const conv = ([x, y, z]) => [x / 1000, z / 1000, -y / 1000];

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

// every edge must be shared by exactly two face loops, or the part is not a closed solid
for (const p of src.parts) {
  const c = new Map();
  for (const loops of p.f) for (const l of loops) for (let i = 0; i < l.length; i++) {
    const a = l[i], b = l[(i + 1) % l.length], k = a < b ? `${a},${b}` : `${b},${a}`;
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  const open = [...c.values()].filter((v) => v !== 2).length;
  if (open) { console.error(`${p.n}: ${open} open edges`); process.exit(1); }
}

const parts = [];
let tris = 0, faces = 0;
for (const p of src.parts) {
  const V = [];
  for (let i = 0; i < p.v.length; i += 3) V.push(conv([p.v[i], p.v[i + 1], p.v[i + 2]]));
  const pos = [], nor = [], idx = [];
  for (const loops of p.f) {
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
      const [a, b, c] = t.map((k) => all[k]);
      const flip = dot(cross(sub(b, a), sub(c, a)), n) < 0; // keep SketchUp's front face outward
      idx.push(base + t[0], base + (flip ? t[2] : t[1]), base + (flip ? t[1] : t[2]));
      tris++;
    }
  }
  const lines = [];
  for (const [a, b] of p.e) lines.push(...V[a], ...V[b]);
  parts.push({ name: p.n, pos, nor, idx, lines });
}

// ---------- binary glTF ----------
const chunks = [], bufferViews = [], accessors = [];
let byteLength = 0;
function addAccessor(arr, type, isIndex) {
  const typed = isIndex ? new Uint16Array(arr) : new Float32Array(arr);
  const pad = (4 - (byteLength % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad; }
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buf.length, target: isIndex ? 34963 : 34962 });
  chunks.push(buf); byteLength += buf.length;
  const acc = { bufferView: bufferViews.length - 1, componentType: isIndex ? 5123 : 5126, count: arr.length / (type === 'VEC3' ? 3 : 1), type };
  if (type === 'VEC3') {
    acc.min = [0, 1, 2].map((k) => Math.min(...arr.filter((_, i) => i % 3 === k)));
    acc.max = [0, 1, 2].map((k) => Math.max(...arr.filter((_, i) => i % 3 === k)));
  }
  accessors.push(acc);
  return accessors.length - 1;
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const [r, g, b] = src.color ?? [205, 172, 135];
const materials = [
  { name: src.material ?? 'MDF 18 mm', pbrMetallicRoughness: { baseColorFactor: [lin(r), lin(g), lin(b), 1], metallicFactor: 0, roughnessFactor: 0.85 } },
  { name: 'Edges', pbrMetallicRoughness: { baseColorFactor: [lin(22), lin(25), lin(28), 1], metallicFactor: 0, roughnessFactor: 1 }, extensions: { KHR_materials_unlit: {} } },
];
const hinges = src.hinges ?? {};
const dims = (src.dims ?? []).map((d) => ({ a: conv(d.a), b: conv(d.b), off: conv(d.off), label: d.label }));
const meshes = [], nodes = [{ name: src.name ?? 'Model', children: [], ...(dims.length ? { extras: { dims } } : {}) }];
for (const p of parts) {
  const prims = [{ attributes: { POSITION: addAccessor(p.pos, 'VEC3'), NORMAL: addAccessor(p.nor, 'VEC3') }, indices: addAccessor(p.idx, 'SCALAR', true), material: 0, mode: 4 }];
  if (p.lines.length) prims.push({ attributes: { POSITION: addAccessor(p.lines, 'VEC3') }, material: 1, mode: 1 });
  meshes.push({ name: p.name, primitives: prims });
  const node = { name: p.name, mesh: meshes.length - 1 };
  const h = hinges[p.name];
  if (h) node.extras = { hinge: { origin: conv(h.origin), axis: conv(h.axis).map((v) => v * 1000), ...(h.open ? { open: (h.open * Math.PI) / 180 } : {}) } };
  nodes.push(node);
  nodes[0].children.push(nodes.length - 1);
}
const missing = Object.keys(hinges).filter((n) => !parts.some((p) => p.name === n));
if (missing.length) { console.error('hinge for a part that is not there:', missing); process.exit(1); }

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
console.log(`${outPath}: ${parts.length} parts, ${faces} faces, ${tris} triangles, ${Object.keys(hinges).length} lids, ${dims.length} dimensions, ${fs.statSync(outPath).size} bytes`);

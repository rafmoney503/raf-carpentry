// The moving picture of CabinetOS Units, my extension for SketchUp (28 Oct 2026, Raf: 'the cabinetos extension in
// SketchUp should be more prominent and more visual and be seen'). An angled unit, a wardrobe and a chest of drawers
// build themselves board by board from the extension's own parts (cabinetos-site's builder.js, every board a prism
// at its true cut size): boards drop in, drawers slide in from the front, doors swing shut, then the wardrobe opens and
// a drawer comes out, the way the extension opens them. Drawn the same way as cabinetos-site's
// scripts/sketchup-page/render.cjs (front-right view, back to front by bounding boxes), frame by frame, then made
// into a silent loop with ffmpeg.
//
// Needs ../cabinetos-site next to this repo (like scripts/cabinetos-check). Run from the repo root:
//   node scripts/sketchup-extension/clip.cjs [tall|square|wide]
// Writes public/images/sketchup/extension/build-<shape>-<hash>.{mp4,webm,jpg} and prints the names for
// src/lib/extension-clip.ts. New names every time, so old copies aren't served from cache.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.resolve(ROOT, '..', 'cabinetos-site', 'sketchup-plugin', 'rb', 'cabinetos_angled');
require(path.join(DIR, 'engine.js'));
require(path.join(DIR, 'builder.js'));
const B = globalThis.CabinetOSAngledBuilder;
const OUT = path.join(ROOT, 'public', 'images', 'sketchup', 'extension');
const FPS = 25;

const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const COLOURS = {
  carcass: '#eadcb8', shelf: '#e6d6ae', plinth: '#ddcda4', infill: '#e3d4ad', outer: '#e3d4ad', back: '#d9cfba',
  door: '#f7f5ef', drawer_front: '#f7f5ef', drawer_front_internal: '#f3f1ea', drawer_box: '#efe2c2', drawer_support: '#e0d0a8',
  worktop: '#cfb07e', hardware: '#a7afb8', timber: '#d9b98a',
};
const INK = '#16191c';
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * k))));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
};
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

// A part at its place: open f (door swing or drawer slide, as the extension moves them), plus a drop or slide-in.
function prism(pt, f, dz, dy) {
  const o = pt.origin, X = pt.xAxis, Y = pt.yAxis, Z = v.cross(X, Y);
  const at = (q, w) => v.add(o, v.add(v.mul(X, q[0]), v.add(v.mul(Y, q[1]), v.mul(Z, w))));
  let front = pt.poly.map((q) => at(q, 0)), back = pt.poly.map((q) => at(q, pt.thickness));
  const m = pt.move;
  if (m && f > 0) {
    if (m.type === 'door') {
      const a = ((m.hinge === 'right' ? 1 : -1) * (m.angle || 100) * f * Math.PI) / 180;
      const c = Math.cos(a), s = Math.sin(a), px = m.pivot[0], py = m.pivot[1];
      const rot = (p) => [px + (p[0] - px) * c - (p[1] - py) * s, py + (p[0] - px) * s + (p[1] - py) * c, p[2]];
      front = front.map(rot); back = back.map(rot);
    } else {
      const d = (m.slide || 0) * f;
      front = front.map((p) => [p[0], p[1] - d, p[2]]); back = back.map((p) => [p[0], p[1] - d, p[2]]);
    }
  }
  const shift = (p) => [p[0], p[1] - dy, p[2] + dz];
  front = front.map(shift); back = back.map(shift);
  const n = front.length, faces = [front.slice().reverse(), back];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([front[i], front[j], back[j], back[i]]); }
  return { faces, pts: front.concat(back) };
}

// The camera: front-right, a little above, as the extension page's drawings.
const AZ = (26 * Math.PI) / 180, EL = (12 * Math.PI) / 180;
const E = [Math.sin(AZ) * Math.cos(EL), -Math.cos(AZ) * Math.cos(EL), Math.sin(EL)];
const F = v.mul(E, -1), R = v.norm(v.cross(F, [0, 0, 1])), U = v.cross(R, F);
const L = v.norm([0.35, -0.75, 0.9]);
const proj = (p) => [v.dot(p, R), -v.dot(p, U)];

// The width of each unit, dimensioned in blue in front of the plinth once they're built.
const DIM_Y = -320;
const dimLines = () => units.map((u) => ({ x0: u.dx, x1: u.dx + u.w, label: String(u.w) }));
function dimsSvg(fx, a) {
  if (a <= 0.001) return '';
  const P = (x, z) => fx(proj([x, DIM_Y, z]));
  const parts = dimLines().map(({ x0, x1, label }) => {
    const m = proj([(x0 + x1) / 2, DIM_Y, 0]);
    const [tx, ty] = fx(m).split(',').map(Number);
    return `<path d="M${P(x0 + 6, 0)}L${P(x1 - 6, 0)}M${P(x0 + 6, -45)}L${P(x0 + 6, 45)}M${P(x1 - 6, -45)}L${P(x1 - 6, 45)}" stroke="#2547d0" stroke-width="2" fill="none"/>` +
      `<text x="${tx}" y="${ty + 30}" fill="#2547d0" font-family="DejaVu Sans Mono, monospace" font-size="24" font-weight="bold" text-anchor="middle">${label}</text>`;
  });
  return `<g opacity="${a.toFixed(3)}">${parts.join('')}</g>`;
}

// One frame: every part where it is now, with its opacity; back to front by bounding boxes.
function frame(items, box, W, H, fade, dimA = 0) {
  const solids = [];
  items.forEach(({ pt, dx, f, dz, dy, a }) => {
    if (a <= 0.001) return;
    const pr = prism(pt, f, dz, dy);
    const move = (p) => [p[0] + dx, p[1], p[2]];
    const faces = pr.faces.map((fc) => fc.map(move));
    const pts = pr.pts.map(move);
    const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
    const scr = pts.map(proj);
    solids.push({ pt, a, faces, lo, hi,
      box: [Math.min(...scr.map((q) => q[0])), Math.min(...scr.map((q) => q[1])), Math.max(...scr.map((q) => q[0])), Math.max(...scr.map((q) => q[1]))],
      depth: v.dot(pts.reduce((s, p) => v.add(s, p), [0, 0, 0]).map((x) => x / pts.length), F) });
  });
  const eps = 0.5, n = solids.length, before = solids.map(() => []), indeg = new Array(n).fill(0);
  const overlap = (a, b) => a.box[0] < b.box[2] - 0.1 && b.box[0] < a.box[2] - 0.1 && a.box[1] < b.box[3] - 0.1 && b.box[1] < a.box[3] - 0.1;
  const farther = (a, b) => (a.hi[0] <= b.lo[0] + eps) || (a.lo[1] >= b.hi[1] - eps) || (a.hi[2] <= b.lo[2] + eps);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j || !overlap(solids[i], solids[j])) continue;
    const ij = farther(solids[i], solids[j]), ji = farther(solids[j], solids[i]);
    if ((ij && !ji) || (!ij && !ji && solids[i].depth > solids[j].depth + 1e-6)) { before[i].push(j); indeg[j]++; }
  }
  const order = [], done = new Array(n).fill(false);
  while (order.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || solids[i].depth > solids[pick].depth)) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || solids[i].depth > solids[pick].depth)) pick = i;
    done[pick] = true; order.push(pick); before[pick].forEach((j) => indeg[j]--);
  }
  const k = W / (box[2] - box[0]);
  const fx = (q) => `${((q[0] - box[0]) * k).toFixed(1)},${((q[1] - box[1]) * k).toFixed(1)}`;
  const polys = [];
  order.forEach((i) => {
    const s = solids[i], base = COLOURS[s.pt.group] || '#e8e2d4';
    const op = s.a < 0.999 ? ` opacity="${s.a.toFixed(3)}"` : '';
    s.faces.forEach((fc) => {
      const nrm = v.norm(v.cross(v.sub(fc[1], fc[0]), v.sub(fc[2], fc[0])));
      if (v.dot(nrm, E) <= 1e-6) return;
      const sh = 0.8 + 0.24 * Math.max(0, v.dot(nrm, L));
      polys.push(`<path d="M${fc.map((q) => fx(proj(q))).join('L')}Z" fill="${shade(base, sh)}"${op}/>`);
    });
  });
  // Graph paper behind, like the site's drawings: 10 mm squares on screen, a darker line every 50.
  const g = 100 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><pattern id="s" width="${g / 5}" height="${g / 5}" patternUnits="userSpaceOnUse"><path d="M${g / 5} 0H0V${g / 5}" fill="none" stroke="#2547d0" stroke-opacity="0.06" stroke-width="1"/></pattern>` +
    `<pattern id="l" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><rect width="${g}" height="${g}" fill="url(#s)"/><path d="M${g} 0H0V${g}" fill="none" stroke="#2547d0" stroke-opacity="0.11" stroke-width="1"/></pattern></defs>` +
    `<rect width="${W}" height="${H}" fill="#fbfbf9"/><rect width="${W}" height="${H}" fill="url(#l)"/>` +
    `<g opacity="${fade.toFixed(3)}"><g stroke="${INK}" stroke-width="1.6" stroke-linejoin="round">${polys.join('')}</g>${dimsSvg(fx, dimA)}</g></svg>`;
}

const ok = (p) => { const r = B.build(p); if (!r.ok) throw new Error(JSON.stringify(p) + ' ' + r.warnings.join('; ')); return r; };
const units = [
  { r: ok({ unitType: 'angled', widthMm: 700, heightMm: 2400, lowSideHeightMm: 1500, topFlatWidthMm: 250, angleSide: 'LEFT', shelvesCount: 3 }), dx: 0, w: 700 },
  { r: ok({ unitType: 'wardrobe', widthMm: 1000, doors: 2, rail: 'full_length', shelvesCount: 1, front: 'drawers_inside', drawerCount: 2, drawerZoneHeightMm: 380 }), dx: 700, w: 1000 },
  { r: ok({ unitType: 'chest', widthMm: 800, heightMm: 900, front: 'drawers', drawerCount: 4, worktop: true }), dx: 1700, w: 800 },
];

// The build order of a unit's boards, as you'd put it together: plinth, bottom, sides, top, back, shelves and
// rail, runner boards, the drawers (box and front together), worktop; the doors come on last.
const RANK = { plinth: 0, carcass: 1, back: 3, shelf: 4, hardware: 4, drawer_support: 5, drawer_box: 6, drawer_front: 6, worktop: 8, door: 9 };
const carcassRank = (name) => (/^Bottom/.test(name) ? 0 : /^Side/.test(name) ? 0.4 : /^Top|^Flat|^Slope/.test(name) ? 0.8 : 0.6);
const steps = []; // [{ unit, parts: [pt...], kind: 'drop' | 'slide' | 'door' }]
units.forEach((u, ui) => {
  const parts = u.r.parts.filter((pt) => !pt.hidden);
  const drawers = new Map();
  const singles = [];
  parts.forEach((pt) => {
    if (pt.move && pt.move.type === 'drawer') {
      const k = pt.move.group || pt.name;
      if (!drawers.has(k)) drawers.set(k, []);
      drawers.get(k).push(pt);
    } else singles.push(pt);
  });
  const list = singles.map((pt) => ({ ui, parts: [pt], kind: pt.move && pt.move.type === 'door' ? 'door' : 'drop',
    rank: (RANK[pt.group] ?? 4) + (pt.group === 'carcass' ? carcassRank(pt.name) : 0) }));
  // Drawers from the bottom up.
  [...drawers.values()].forEach((ps) => list.push({ ui, parts: ps, kind: 'slide', rank: 6 + Math.min(...ps.map((p) => p.origin[2])) / 10000 }));
  list.sort((a, b) => a.rank - b.rank);
  steps.push(...list);
});

// Timings (seconds). Each step starts STEP after the last and takes DUR.
const T0 = 0.35, STEP = 0.075, DUR = 0.42;
steps.forEach((s, i) => { s.t = T0 + i * STEP; });
const built = steps[steps.length - 1].t + DUR;
const CLOSE = [built + 0.15, built + 0.95]; // the doors swing shut
const OPEN = [CLOSE[1] + 0.9, CLOSE[1] + 1.75]; // the wardrobe opens and a drawer comes out
const FADE = [OPEN[1] + 1.5, OPEN[1] + 2.0];
const TOTAL = FADE[1] + 0.25;
const dimAt = (t) => ease((t - CLOSE[1] + 0.1) / 0.5);
// The chest's top drawer comes out (the drawers are numbered from the bottom).
const topDrawer = (() => { let best = null, z = -1; units[2].r.parts.forEach((pt) => { if (pt.move && pt.move.type === 'drawer' && pt.origin[2] > z) { z = pt.origin[2]; best = pt.move.group; } }); return best; })();
const isOpener = (pt, ui) => (ui === 1 && pt.move && pt.move.type === 'door') || (ui === 2 && pt.move && pt.move.group === topDrawer);

function state(t) {
  const items = [];
  steps.forEach((s) => {
    const p = (t - s.t) / DUR;
    const a = Math.max(0, Math.min(1, p * 2.2));
    s.parts.forEach((pt) => {
      let f = 0, dz = 0, dy = 0;
      if (s.kind === 'drop') dz = 320 * (1 - out(p));
      if (s.kind === 'slide') dy = 520 * (1 - out(p));
      if (s.kind === 'door') {
        f = 1 - ease((t - CLOSE[0]) / (CLOSE[1] - CLOSE[0]));
        if (isOpener(pt, s.ui)) f = Math.max(f, ease((t - OPEN[0]) / (OPEN[1] - OPEN[0])));
      } else if (isOpener(pt, s.ui)) f = 0.75 * ease((t - OPEN[0]) / (OPEN[1] - OPEN[0]));
      items.push({ pt, dx: units[s.ui].dx, f, dz, dy, a: p <= 0 ? 0 : a });
    });
  });
  return items;
}

// The frame box: every part where it ends up, closed and open, so nothing moves the camera.
function bounds(aspect) {
  const pts = [];
  [0, 1].forEach((f) => units.forEach((u) => u.r.parts.filter((pt) => !pt.hidden).forEach((pt) =>
    prism(pt, f, 0, 0).pts.forEach((p) => pts.push(proj([p[0] + u.dx, p[1], p[2]]))))));
  dimLines().forEach(({ x0, x1 }) => [x0, x1].forEach((x) => [-45, 45, -130].forEach((z) => pts.push(proj([x, DIM_Y, z])))));
  let x0 = Math.min(...pts.map((q) => q[0])), x1 = Math.max(...pts.map((q) => q[0]));
  let y0 = Math.min(...pts.map((q) => q[1])), y1 = Math.max(...pts.map((q) => q[1]));
  const pad = 70;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  // A set shape (width / height): the paper is widened or made taller round the units, never cut.
  if (aspect) {
    const w = x1 - x0, h = y1 - y0;
    if (w / h < aspect) { const e = (h * aspect - w) / 2; x0 -= e; x1 += e; } else { const e = (w / aspect - h) / 2; y0 -= e; y1 += e; }
  }
  return [x0, y0, x1, y1];
}

const SHAPES = { tall: [960, null], square: [720, 1], wide: [960, 4 / 3] };

async function make(shape) {
  const [W, aspect] = SHAPES[shape];
  const box = bounds(aspect);
  const H = Math.round((W * (box[3] - box[1])) / (box[2] - box[0]) / 2) * 2;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'extclip-'));
  const frames = Math.round(TOTAL * FPS);
  // The loop starts on the still (built and open, the moment before it fades), so the picture shown before the video
  // plays and the video's first frame are the same: it fades away, builds, shuts, opens and comes back to it.
  const first = Math.round((FADE[0] - 0.05) * FPS);
  for (let k = 0; k < frames; k++) {
    const i = (first + k) % frames;
    const t = i / FPS;
    const fade = 1 - ease((t - FADE[0]) / (FADE[1] - FADE[0]));
    const svg = frame(state(t), box, W, H, fade, dimAt(t));
    await sharp(Buffer.from(svg)).png().toFile(path.join(tmp, `f${String(k).padStart(4, '0')}.png`));
  }
  const still = frame(state(first / FPS), box, W, H, 1, dimAt(first / FPS));
  const stillBuf = await sharp(Buffer.from(still)).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const hash = crypto.createHash('sha1').update(stillBuf).update(String(frames)).digest('hex').slice(0, 8);
  const base = path.join(OUT, `build-${shape}-${hash}`);
  fs.writeFileSync(base + '.jpg', stillBuf);
  const inp = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png')];
  execFileSync('ffmpeg', [...inp, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', base + '.mp4']);
  execFileSync('ffmpeg', [...inp, '-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-pix_fmt', 'yuv420p', '-an', base + '.webm']);
  fs.rmSync(tmp, { recursive: true, force: true });
  const kb = (f) => Math.round(fs.statSync(f).size / 1024) + ' KB';
  console.log(`${shape}: ${W} x ${H}, ${frames} frames (${TOTAL.toFixed(1)} s)  /images/sketchup/extension/build-${shape}-${hash}  mp4 ${kb(base + '.mp4')}, webm ${kb(base + '.webm')}, jpg ${kb(base + '.jpg')}`);
}

(async () => {
  // PEEK=dir writes a few frames as pictures to look at, and nothing else.
  if (process.env.PEEK) {
    const box = bounds(null), W = 720, H = Math.round((W * (box[3] - box[1])) / (box[2] - box[0]));
    fs.mkdirSync(process.env.PEEK, { recursive: true });
    for (const t of [0.6, 1.5, 2.5, 3.5, 4.5, built, CLOSE[1], OPEN[1], FADE[0] + 0.25]) {
      const fade = 1 - ease((t - FADE[0]) / (FADE[1] - FADE[0]));
      await sharp(Buffer.from(frame(state(t), box, W, H, fade, dimAt(t)))).png().toFile(path.join(process.env.PEEK, `t${t.toFixed(2)}.png`));
    }
    console.log('steps', steps.length, 'built', built.toFixed(2), 'total', TOTAL.toFixed(2));
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2];
  for (const shape of Object.keys(SHAPES)) if (!only || only === shape) await make(shape);
})();

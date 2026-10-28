// The 'Under a slope' drawing in the SketchUp page's strip of units, with its two doors folding together as they
// should (fold.cjs; 28 Oct 2026, Raf). The other seven drawings are copies of cabinetos-site's public/sketchup/unit-*.svg;
// this one is drawn here with cabinetos-site's own scripts/sketchup-page/render.cjs, at the same view and the same
// frame height, so it stays at one scale with them. Edges in ink like the copies.
//
// Needs ../cabinetos-site next to this repo. Run from the repo root:
//   node scripts/sketchup-extension/angled-svg.cjs
// Writes public/images/sketchup/extension/unit-angled-<hash>.svg and prints the name for content/pages/sketchup.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { foldInfo, foldedPart } = require('./fold.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const { render, B } = require(path.resolve(ROOT, '..', 'cabinetos-site', 'scripts', 'sketchup-page', 'render.cjs'));
const OUT = path.join(ROOT, 'public', 'images', 'sketchup', 'extension');
const FOLD_OPEN = 0.8; // folded most of the way, so the two doors read as a pair

const ok = (p) => { const r = B.build(p); if (!r.ok) throw new Error(JSON.stringify(p) + ' ' + r.warnings.join('; ')); return r; };
const firstDrawer = (f) => (pt) => (pt.move ? (pt.move.type === 'door' ? 1 : /^Drawer 1\b/.test(pt.name) ? f : 0) : 0);
// The same units and view as render.cjs's strip, for the same frame height.
const types = {
  wardrobe: ok({ unitType: 'wardrobe', widthMm: 900, doors: 2, rail: 'double', shelvesCount: 1 }),
  combined: ok({ unitType: 'combined', widthMm: 900, front: 'drawers_below', drawerCount: 2 }),
  wall: ok({ unitType: 'wall', widthMm: 800, doors: 2, shelvesCount: 2 }),
  chest: ok({ unitType: 'chest', widthMm: 800, front: 'drawers', drawerCount: 4, worktop: true }),
  tv: ok({ unitType: 'tv', widthMm: 1500, front: 'doors', doors: 2, worktop: true }),
  alcove: ok({ unitType: 'alcove', alcoveLayout: 'deep' }),
  nightstand: ok({ unitType: 'nightstand', drawerCount: 2, nsLower: 'door' }),
  angled: ok({ unitType: 'angled', widthMm: 700, shelvesCount: 3 }),
};
const view = { az: 26, el: 12, width: 360, pad: 20 };
const frameH = Math.max(...Object.values(types).map((r) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(render([{ r, open: firstDrawer(0.6) }], view))[1]) - 2 * view.pad));

const ang = types.angled;
const info = foldInfo(ang.parts);
if (!info) throw new Error('the angled unit has no pair of doors');
const parts = ang.parts.map((pt) => (pt === info.leaf || pt === info.main ? foldedPart(pt, info, FOLD_OPEN) : pt));
const svg = render([{ r: { ...ang, parts }, open: firstDrawer(0.6) }], { ...view, frameH, label: ang.label }).replace('stroke="#4a4234"', 'stroke="#16191c"');
const hash = crypto.createHash('sha1').update(svg).digest('hex').slice(0, 8);
const name = `unit-angled-${hash}.svg`;
fs.writeFileSync(path.join(OUT, name), svg);
console.log(`/images/sketchup/extension/${name}  ${Math.round(svg.length / 1024)} KB, frame height ${frameH}`);

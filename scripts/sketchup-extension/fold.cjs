// The angled unit's two doors fold together (28 Oct 2026, Raf: 'there are two angled doors and smaller one can not
// open like normal door, they have to be attached to bigger and fold together'). On a hinge of its own the small door
// (the one on the low side, under the slope) would swing its tall edge into the sloping ceiling, so it's hinged to the
// big door's edge and the pair opens on the big door's hinge: the big door swings out and the small one folds back
// against it (back faces together), its free edge sliding along the front, as a bi-fold does.
//
// foldInfo(parts): the two doors of an angled unit (the extension's builder.js parts) and how they fold, or null.
// foldedPart(pt, info, f): a copy of one of the pair turned to how far it's open (f 0 = shut, 1 = folded open),
// with no move of its own left, so any drawing code can draw it as it stands.
const FOLD_ANGLE = 72; // the big door's swing when folded open; the small one turns twice that back against it

function foldInfo(parts) {
  const doors = parts.filter((pt) => pt.move && pt.move.type === 'door');
  if (doors.length !== 2) return null;
  const [leaf, main] = doors.slice().sort((a, b) => a.move.z[1] - b.move.z[1]); // the small one is the lower one
  const sign = main.move.hinge === 'right' ? 1 : -1;
  const jx = leaf.move.x[1] <= main.move.x[0] ? (leaf.move.x[1] + main.move.x[0]) / 2 : (main.move.x[1] + leaf.move.x[0]) / 2;
  return { leaf, main, sign, angle: FOLD_ANGLE, pivot: main.move.pivot, joint: [jx, main.move.pivot[1]] };
}

const turnPoint = (p, deg, [px, py]) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [px + (p[0] - px) * c - (p[1] - py) * s, py + (p[0] - px) * s + (p[1] - py) * c, p[2]];
};
const turnVector = (d, deg) => turnPoint(d, deg, [0, 0]);

function foldedPart(pt, info, f) {
  const th = info.sign * info.angle * f;
  let { origin, xAxis, yAxis } = pt;
  if (pt === info.leaf) { origin = turnPoint(origin, -2 * th, info.joint); xAxis = turnVector(xAxis, -2 * th); yAxis = turnVector(yAxis, -2 * th); }
  origin = turnPoint(origin, th, info.pivot); xAxis = turnVector(xAxis, th); yAxis = turnVector(yAxis, th);
  return { ...pt, origin, xAxis, yAxis, move: null };
}

module.exports = { FOLD_ANGLE, foldInfo, foldedPart };

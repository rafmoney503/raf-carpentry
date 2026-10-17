// @ts-nocheck -- bundled by run.sh with CabinetOS's own code (the "cos/..." imports), not part of the site build
/* The wardrobe planner's units against CabinetOS's own code (16 Oct 2026). For a few thousand random designs it lays
   the units out with src/lib/cabinetos-wardrobe.ts (what the planner draws and sizes), sends them through CabinetOS's
   website mapper (cabinetos-site src/lib/inbound/websiteDesign.ts, as /api/brief does) and compares, unit by unit:
     - shelves: CabinetOS's shelf centres (computeShelfYFromBottomMmList, as its drawings show them: none under a
       full-length rail) with the planner's
     - rails: computeHangingRailYFromBottomMm
     - drawers: the drawer zone, each front's height (getDrawerBankMetrics) and the dust shelf on top of them
     - doors: every door's place and hinge side in the front view (elevationDoorsMm)
     - the cut list (generateParts): door fronts, shelves, dust shelves, hanging rails, drawer boxes, side panels, against the sizes
       the planner shows
   Prints the first differences and exits 1 if there are any. Run: bash scripts/cabinetos-check/run.sh */
import { COS, PLAN, PRESETS, SLIDE, presetInside, PAIR, canSplit, payloadUnits, planPieces, runFor, slidingDoorsFor, slidingDrawerSpans } from '../../src/lib/cabinetos-wardrobe';
import { slidingLayout } from 'cos/lib/slidingDoors';
import { parseWebsiteDesign, websiteDesignToProject } from 'cos/lib/inbound/websiteDesign';
import { generateParts, getShelfLayoutMetricsForUnit, getOccupiedOpeningWidthMm } from 'cos/components/pages/CabinetApp';
import { computeShelfYFromBottomMmList, computeHangingRailYFromBottomMm, filterShelvesAboveRailMm } from 'cos/lib/shelfLayout';
import { getDrawerBankMetrics } from 'cos/lib/viewportGeometry';
import { elevationDoorsMm } from 'cos/lib/elevationDoors';

const SETTINGS = {
  carcassThickness: 18, backThickness: 18, frontThickness: 18, drawerBoxThickness: 18, worktopThickness: 18,
  carcassMaterial: 'MDF', backMaterial: 'MDF', frontMaterial: 'MDF', drawerMaterial: 'MDF', worktopMaterial: 'MDF',
  companyName: '', companyEmail: '', companyPhone: '', workshopDefaultEdgeBandingThicknessMm: 1, workshopDefaultEdgeFinish: 'SQ',
};

let seed = Number(process.env.SEED || 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

const N = Number(process.env.N || 1500);
const fails = [];
let slidingSeen = 0;
let slidingDrawersSeen = 0;
let slidingCaught = 0;
let slidingLowered = 0;
let units = 0, shelvesSeen = 0, railsSeen = 0, drawersSeen = 0, doorsSeen = 0, okLayouts = 0, hatsSeen = 0, dustSeen = 0;
const close = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
const fail = (where, what) => { if (fails.length < 40) fails.push(`${where}: ${what}`); else fails.length++; };

function randomInside(): any {
  if (rnd() < 0.5) return { ...presetInside(pick(['long', 'double', 'short', 'drawhang', 'drawers', 'shelves'])), below: rnd() < 0.3 };
  return { rail: pick(['none', 'long', 'short', 'double']), shelves: int(0, 7), drawers: int(0, 5), below: rnd() < 0.4 };
}

for (let k = 0; k < N; k++) {
  const fit = pick(['wall', 'wall', 'openL', 'openR', 'free']);
  const free = fit === 'free';
  const ceiling = int(2000, 3000);
  const plinth = pick([0, 70, 100, 100, 150, int(0, 250)]);
  const infill = free ? 0 : pick([0, 50, 50, 100, 150, int(0, 300)]);
  const freeH = Math.min(int(1200, 2600), ceiling - 20);
  const sliding = rnd() < 0.15;
  const depth = sliding ? pick([650, int(560, 800)]) : pick([600, 450, int(350, 800)]);
  const topSplit = rnd() < 0.8 ? PLAN.hatShelf : int(1800, 2300);
  const space = { ceiling, plinth, infill, free, freeH, topCupboards: rnd() < 0.3, topSplit, depth, sliding };
  const run = runFor(space);
  if (run.boxH < 300) continue;
  const n = int(1, 4);
  const sections = Array.from({ length: n }, () => {
    const w = pick([300, 400, 450, 500, 600, 800, 900, 1000, int(150, 1200)]);
    const split = canSplit(w) && rnd() < 0.25 ? (rnd() < 0.5 ? PAIR.map((x) => ({ ...x })) : [randomInside(), randomInside()]) : null;
    return { w, custom: false, inside: randomInside(), split };
  });
  const mods = sections.reduce((a, s) => a + s.w, 0);
  const ends = fit === 'wall' ? 0 : free ? 2 : 1;
  const fillL = fit === 'wall' || fit === 'openR' ? int(20, 100) : 0;
  const fillR = fit === 'wall' || fit === 'openL' ? int(20, 100) : 0;
  const width = mods + ends * 18 + fillL + fillR;
  // sliding doors across the units and end panels, as the planner sizes them (overlap so the drawers open)
  const pieces = planPieces(sections, run);
  const SD = sliding ? slidingDoorsFor(mods + ends * 18, run.zone, undefined, slidingDrawerSpans(pieces, fit === 'openL' || free ? 18 : 0)) : null;
  const design = {
    source: 'rafcarpentry-wardrobe-planner', version: 2,
    space: { widthMm: width, ceilingMm: ceiling, fit, depthMm: depth, plinthMm: plinth, topInfillMm: infill, freeHeightMm: free ? freeH : run.top },
    doors: { type: sliding ? 'sliding' : 'hinged', style: sliding ? 'slab' : 'shaker', handle: 'brass', topCupboards: space.topCupboards, topSplitMm: topSplit,
      ...(SD ? { sliding: { system: 'eslide', doorCount: SD.n, overlapAuto: true, overlapMm: SD.ov, trackDepthMm: SLIDE.trackDepth, heightOffMm: SLIDE.heightOff, track: 'bottom', panel: 'mdf' } } : {}) },
    colour: 'Sage',
    units: payloadUnits(sections, run),
    fillers: { leftMm: fillL, rightMm: fillR },
    customer: { name: 'Check', postcode: 'N22', jobNumber: '' },
  };
  if (width > 8000) continue;
  let project;
  try {
    project = websiteDesignToProject(parseWebsiteDesign(JSON.parse(JSON.stringify(design))), { id: 'c', now: 0 }).project;
  } catch (e) {
    fail(`design ${k}`, `mapper refused it: ${e.message}`);
    continue;
  }
  if (project.units.length !== pieces.length) { fail(`design ${k}`, `${pieces.length} planner units, ${project.units.length} in CabinetOS`); continue; }
  if (!free) {
    const used = getOccupiedOpeningWidthMm(project.units);
    if (used !== project.opening.width) fail(`design ${k}`, `units fill ${used} of the ${project.opening.width} opening`);
  }
  const parts = generateParts(project.units, SETTINGS, project.openingCombine, project.opening.height, { slidingDoors: project.slidingDoors, openingDepthMm: project.opening.depth });
  // Sliding doors: CabinetOS's own layout and its door panel rows against the planner's.
  if (SD) {
    const lay = slidingLayout(project.units, project.slidingDoors, { openingDepthMm: project.opening.depth });
    if (!lay || lay.doorCount !== SD.n || !close(lay.doorWidthMm, SD.w) || !close(lay.doorHeightMm, SD.h) || !close(lay.spanMm, SD.span)) {
      fail(`design ${k}`, `sliding doors CabinetOS ${lay ? `${lay.doorCount} x ${lay.doorWidthMm} x ${lay.doorHeightMm} over ${lay.spanMm}` : 'none'}; planner ${SD.n} x ${SD.w} x ${SD.h} over ${SD.span}`);
    }
    // the same door on the same track in the same place, and the same overlap (Auto, so the drawers open)
    if (lay && (lay.overlapMm !== SD.ov || lay.doors.some((d, i) => !SD.doors[i] || d.back !== SD.doors[i].back || !close(d.x0, SD.doors[i].x0) || !close(d.x1, SD.doors[i].x1)))) {
      fail(`design ${k}`, `sliding door order: CabinetOS ${lay.overlapMm} ${lay.doors.map((d) => `${d.back ? 'B' : 'F'}${d.x0}`)}; planner ${SD.ov} ${SD.doors.map((d) => `${d.back ? 'B' : 'F'}${d.x0}`)}`);
    }
    // the drawers the planner thinks open are the ones CabinetOS thinks open
    if (lay) {
      const plannerSpans = slidingDrawerSpans(pieces, fit === 'openL' || free ? 18 : 0);
      if (plannerSpans.length !== lay.drawers.length || lay.drawers.some((d, i) => !close(d.x0, plannerSpans[i][0]) || !close(d.x1, plannerSpans[i][1]))) {
        fail(`design ${k}`, `drawers along the span: CabinetOS ${lay.drawers.map((d) => `${d.x0}-${d.x1}`)}; planner ${plannerSpans.map(([a, b]) => `${a}-${b}`)}`);
      }
      slidingDrawersSeen += lay.drawers.length;
      slidingCaught += lay.drawers.filter((d) => !d.opens).length;
      if (SD.ov !== SLIDE.overlap) slidingLowered++;
    }
    const panels = parts.filter((r) => /Sliding door panel$/.test(r.description));
    const q = panels.reduce((a, r) => a + (r.qty ?? 1), 0);
    if (q !== SD.n || panels.some((r) => !close(r.length, SD.h) || !close(r.width, SD.w))) fail(`design ${k}`, `sliding panels cut ${panels.map((r) => `${r.qty} x ${r.length} x ${r.width}`)}; planner ${SD.n} x ${SD.h} x ${SD.w}`);
    if (lay && lay.maxUnitDepthMm != null && project.units.some((u) => u.depthMm > lay.maxUnitDepthMm + 0.5)) fail(`design ${k}`, `units deeper than the ${lay.maxUnitDepthMm} the track leaves`);
    slidingSeen++;
  }

  pieces.forEach((p, i) => {
    const u = project.units[i];
    const L = p.layout;
    const where = `design ${k} ${p.label} (${p.w} wide, box ${run.boxH}${run.topH ? ` + top ${run.topH}` : ''}, ${JSON.stringify(p.inside)})`;
    units++;
    if (L.problems.length === 0) okLayouts++;
    if (u.widthMm !== p.w) fail(where, `width ${u.widthMm}`);

    // Shelves, as CabinetOS's drawings show them.
    const m = getShelfLayoutMetricsForUnit(u);
    let ys = computeShelfYFromBottomMmList(u, { effectiveHeightMm: m.effectiveHeightMm, drawerZoneHeightFromBottomMm: m.drawerZoneHeightFromBottomMm, boardMm: 18 });
    let railYs = u.hangingRail?.enabled ? computeHangingRailYFromBottomMm({ effectiveHeightMm: m.effectiveHeightMm, doorTopGapMm: u.doorTopGapMm ?? 3, rail: u.hangingRail }) : [];
    if (u.hangingRail?.enabled && u.hangingRail.railType === 'full_length' && railYs[0] != null) ys = filterShelvesAboveRailMm(ys, railYs[0]);
    if (close(m.effectiveHeightMm, run.boxH) === false) fail(where, `CabinetOS box height ${m.effectiveHeightMm}`);
    if (ys.length !== L.shelves.length || ys.some((y, j) => !close(y, L.shelves[j]))) fail(where, `shelves CabinetOS [${ys.map((y) => y.toFixed(2))}] planner [${L.shelves.map((y) => y.toFixed(2))}]`);
    shelvesSeen += ys.length;
    if (L.hat != null) hatsSeen++;
    if (railYs.length !== L.rails.length || railYs.some((y, j) => !close(y, L.rails[j]))) fail(where, `rails CabinetOS [${railYs}] planner [${L.rails}]`);
    railsSeen += railYs.length;
    if (!close(m.drawerZoneHeightFromBottomMm, L.drawerZone)) fail(where, `drawer zone CabinetOS ${m.drawerZoneHeightFromBottomMm} planner ${L.drawerZone}`);

    // Drawers.
    if (L.drawers.length) {
      const b = getDrawerBankMetrics(u, 18, 18, 18, 18);
      if (!close(b.drawerFrontHeight, L.drawerFront, 0.006)) fail(where, `drawer front CabinetOS ${b.drawerFrontHeight} planner ${L.drawerFront}`);
      drawersSeen += L.drawers.length;
    }

    // Doors in the front view (a combined unit drawn without its filler, as CabinetOS's units page does: its
    // elevation takes the filler off the base box, the cut list doesn't).
    const doorUnit = u.type === 'combined_unit' && (u.topInfillHeightMm ?? 0) > 0
      ? { ...u, heightMm: u.heightMm - u.topInfillHeightMm, topInfillHeightMm: 0, topInfillEnabled: false, combined: { ...u.combined, topInfillHeightMm: 0 } }
      : u;
    const cd = sliding ? [] : elevationDoorsMm(doorUnit, 18).map((d) => {
      const xs = d.points.map((q) => q.x), yy = d.points.map((q) => q.y);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...yy), y1: Math.max(...yy), hingeLeft: d.hingeLeft };
    });
    // Sliding doors come into CabinetOS as hinged ones (the mapper says so in its notes), so only hinged runs compare.
    if (!sliding && cd.length !== L.doors.length) fail(where, `${cd.length} doors in CabinetOS, ${L.doors.length} drawn`);
    else cd.forEach((d, j) => {
      const e = L.doors[j];
      if (!close(d.x0, e.x0) || !close(d.x1, e.x1) || !close(d.y0, e.y0) || !close(d.y1, e.y1) || d.hingeLeft !== e.hingeLeft) {
        fail(where, `door ${j + 1} CabinetOS ${JSON.stringify(d)} planner ${JSON.stringify(e)}`);
      }
    });
    doorsSeen += cd.length;

    // The cut list.
    const rows = parts.filter((r) => r.unitId === u.id);
    const sum = (re) => rows.filter((r) => re.test(r.description)).reduce((a, r) => a + (r.qty ?? 1), 0);
    const doorRows = rows.filter((r) => /Door front( \(.*\))?$/.test(r.description));
    // Behind sliding doors a unit has no door fronts of its own; top cupboards keep theirs.
    const want = [];
    if (!sliding) for (let j = 0; j < L.sizes.door.n; j++) want.push(`${L.sizes.door.h} x ${L.sizes.door.w}`);
    if (L.sizes.topDoor) for (let j = 0; j < L.sizes.topDoor.n; j++) want.push(`${L.sizes.topDoor.h} x ${L.sizes.topDoor.w}`);
    const got = doorRows.flatMap((r) => Array(r.qty ?? 1).fill(`${r.length} x ${r.width}`));
    if (got.sort().join('|') !== want.sort().join('|')) fail(where, `door fronts cut ${got.join(', ')}; planner ${want.join(', ')}`);
    const shelfRows = rows.filter((r) => /(^|\/ )Shelf$/.test(r.description) && !/Top \/|\/ Top /.test(r.description));
    const shelfQty = shelfRows.reduce((a, r) => a + (r.qty ?? 1), 0);
    if (shelfQty !== L.sizes.shelf.n) fail(where, `${shelfQty} shelves cut, ${L.sizes.shelf.n} drawn (${shelfRows.map((r) => r.description).join(', ')})`);
    if (shelfRows.some((r) => r.length !== L.sizes.shelf.w || r.width !== L.sizes.shelf.d)) fail(where, `shelf cut ${shelfRows.map((r) => `${r.length} x ${r.width}`)}; planner ${L.sizes.shelf.w} x ${L.sizes.shelf.d}`);
    const dustRows = rows.filter((r) => /Dust shelf/.test(r.description));
    const dustQty = dustRows.reduce((a, r) => a + (r.qty ?? 1), 0);
    if (dustQty !== (L.dust != null ? 1 : 0)) fail(where, `${dustQty} dust shelves cut, ${L.dust != null ? 1 : 0} drawn`);
    if (dustRows.some((r) => r.length !== L.sizes.shelf.w || r.width !== L.sizes.shelf.d)) fail(where, `dust shelf cut ${dustRows.map((r) => `${r.length} x ${r.width}`)}; planner ${L.sizes.shelf.w} x ${L.sizes.shelf.d}`);
    dustSeen += dustQty;
    const railQty = sum(/Hanging rail/);
    if (railQty !== L.rails.length) fail(where, `${railQty} rails cut, ${L.rails.length} drawn`);
    const boxSides = sum(/Drawer box side$/);
    // Under PLAN.minDrawerWidth the planner says take the drawers out (CabinetOS can't make them under about 160).
    if (p.w >= PLAN.minDrawerWidth && boxSides !== 2 * L.drawers.length) fail(where, `${boxSides} drawer box sides cut for ${L.drawers.length} drawers`);
    const side = rows.find((r) => /Side panel \(Left\)$/.test(r.description) && !/Top \//.test(r.description));
    if (!side || side.length !== run.boxH - 36) fail(where, `side panel ${side?.length} (box ${run.boxH})`);
    if (L.drawersBelow) {
      const fronts = rows.filter((r) => /Drawer front( \(.*\))?$/.test(r.description));
      const q = fronts.reduce((a, r) => a + (r.qty ?? 1), 0);
      if (q !== L.drawers.length || fronts.some((r) => !close(r.length, L.drawerFront, 0.006) && !close(r.width, L.drawerFront, 0.006))) {
        fail(where, `drawer fronts cut ${fronts.map((r) => `${r.qty} x ${r.length} x ${r.width}`)}; planner ${L.drawers.length} at ${L.drawerFront}`);
      }
    }
  });
}

console.log(`${slidingSeen} sliding runs compared (${slidingDrawersSeen} drawer units behind them, ${slidingCaught} caught, overlap lowered in ${slidingLowered} runs).`);
console.log(`${units} units in ${N} designs (${okLayouts} build as drawn): ${shelvesSeen} shelves (${hatsSeen} over the hanging), ${railsSeen} rails, ${drawersSeen} drawers, ${dustSeen} dust shelves, ${doorsSeen} doors compared.`);
if (fails.length) {
  console.log(`\n${fails.length} differences:`);
  for (const f of fails.slice(0, 40)) console.log(` - ${f}`);
  process.exit(1);
}
console.log('Everything matches CabinetOS.');

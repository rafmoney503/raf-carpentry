/* Checks the batten grid calculator on the wall panelling job pages (src/lib/panelling-calc.ts):
   node scripts/panelling-calc/check.mjs (Node 22.18 or later reads the .ts lib itself)
   The Barnet wall is worked out by hand first; then every answer is compared with the Workshop Tools app's own
   panelCalc (the generated app, src/lib/workshop-tools/app.generated.js), so the page and the app can't drift
   apart; then the cutting: every piece is cut, no length holds more than it can, rails join over an upright. */
import { GRID, GRID_START, appStateFor, grid, gridAppHref, gridBriefHref, gridText, layOut, readMm } from '../../src/lib/panelling-calc.ts';
import { defineComponent } from '../../src/lib/workshop-tools/app.generated.js';

let checks = 0;
const fails = [];
const ok = (cond, what) => {
  checks++;
  if (!cond) fails.push(what);
};
const eq = (a, b, what) => ok(a === b, `${what}: ${a} (want ${b})`);
const near = (a, b, what, tol = 1e-6) => ok(Math.abs(a - b) <= tol, `${what}: ${a} (want ${b})`);

// The Barnet wall, by hand: 4105 wide, 1000 high, 69 battens, 6 panels, one row, from the floor.
{
  const g = grid(GRID_START);
  eq(g.error, '', 'barnet: no error');
  near(g.openW, (4105 - 7 * 69) / 6, 'barnet: opening 3622 / 6');
  eq(Math.round(g.openW * 10) / 10, 603.7, 'barnet: opening 603.7 as the app shows');
  eq(g.openH, 862, 'barnet: 1000 − 2 × 69');
  eq(g.ups.length, 7, 'barnet: 7 uprights');
  eq(g.ups.map((x) => Math.round(x * 10) / 10).join(' '), '0 672.7 1345.3 2018 2690.7 3363.3 4036', 'barnet: the app’s upright marks');
  eq(g.autoN, 7, 'barnet: Auto would give 7 panels (4036 / 569)');
  eq(g.lengthsByMetre, 7, 'barnet: the app’s 7 lengths (14244 + 10% over 2440)');
  eq(g.total, 2 * 4105 + 7 * 862, 'barnet: 14,244 mm of batten');
  eq(g.joins.length, 1, 'barnet: each rail joined once');
  near(g.joins[0], 2018 + 34.5, 'barnet: over the middle of upright 4');
  eq(g.joinOffUpright, false, 'barnet: the join is over an upright');
  eq(g.railPieces.length, 2, 'barnet: two pieces a rail');
  eq(g.lengths.length, 8, 'barnet: 4 rail pieces of 2052.5 on 4 lengths, 7 uprights two to a length on 4');
}

// The app's own sums, from the generated app.
class Stub {
  constructor() {
    this.state = {};
  }
  setState() {}
}
const App = defineComponent(Stub);
const app = new App();
const appGrid = (inp) =>
  app.panelCalc(
    Object.assign(app.defaults(), {
      pgWalls: [{ w: String(inp.w), n: inp.panels }],
      pH: String(inp.h),
      pBat: String(inp.batten),
      pRows: inp.rows,
      pgFrom: inp.from,
      pfSkirt: String(inp.skirting),
      pgGap: String(inp.gap),
      pTarget: String(GRID.target),
      pStock: String(GRID.stock),
      pWaste: String(GRID.waste),
    }),
  );

let compared = 0;
let laid = 0;
const widths = [300, 450, 900, 1200, 1800, 2440, 2441, 3000, 3600, 4105, 4880, 5000, 6200, 7500, 9800];
const heights = [150, 300, 600, 900, 1000, 1200, 1400, 2000, 2400, 2700];
for (const w of widths)
  for (const h of heights)
    for (const batten of [12, 45, 69, 95, 150])
      for (const panels of [0, 1, 3, 6, 9, 20])
        for (const rows of [1, 2, 3])
          for (const [from, skirting, gap] of [
            ['floor', 0, 0],
            ['skirting', 100, 0],
            ['skirting', 120, 20],
          ]) {
            const inp = { w, h, batten, panels, rows, from, skirting, gap };
            const g = grid(inp);
            const a = appGrid(inp);
            const tag = `${w}×${h} b${batten} n${panels} r${rows} ${from}${skirting}+${gap}`;
            const appTooLong = !a.error && a.openH > GRID.stock;
            if (appTooLong) {
              ok(!!g.error, `${tag}: uprights over a length should be an error here`);
              continue;
            }
            eq(!!g.error, !!a.error, `${tag}: an error in one and not the other (${g.error} / ${a.error})`);
            if (g.error || a.error) {
              if (g.error && a.error) eq(g.error, a.error.replace(/^Wall 1: /, '').replace('too many panels, the openings come out under 20 mm', 'Too many panels: the openings come out under 20 mm').replace('the width needs', 'The wall needs'), `${tag}: same words`);
              continue;
            }
            compared++;
            const wl = a.walls[0];
            eq(g.n, wl.n, `${tag}: panels`);
            eq(g.autoN, wl.autoN, `${tag}: auto panels`);
            near(g.openW, wl.gapW, `${tag}: opening width`);
            near(g.openH, a.openH, `${tag}: opening height`);
            near(g.G, a.G, `${tag}: grid height`);
            near(g.base, a.base, `${tag}: base`);
            eq(g.ups.length, wl.ups.length, `${tag}: uprights`);
            g.ups.forEach((x, i) => near(x, wl.ups[i], `${tag}: upright ${i}`));
            near(g.total, a.total, `${tag}: total`);
            eq(g.lengthsByMetre, a.lengths, `${tag}: lengths by the metre`);
            eq(g.uprights, a.uprights, `${tag}: upright count`);
            eq(g.n * g.rows, a.panels, `${tag}: panel count`);

            // the cutting
            laid++;
            const centres = g.ups.map((x) => x + g.B / 2);
            const pieces = g.lengths.flatMap((l) => l.pieces);
            eq(pieces.filter((p) => p.kind === 'upright').length, g.uprights, `${tag}: every upright cut`);
            eq(pieces.filter((p) => p.kind === 'rail').length, g.rails * g.railPieces.length, `${tag}: every rail piece cut`);
            near(
              pieces.reduce((s, p) => s + p.len, 0),
              g.total,
              `${tag}: the pieces add up to the batten`,
              1e-4,
            );
            near(
              g.railPieces.reduce((s, p) => s + p, 0),
              g.W,
              `${tag}: a rail's pieces add up to the wall`,
              1e-6,
            );
            for (const p of g.railPieces) ok(p <= GRID.stock + 1e-6 && p > 0, `${tag}: a rail piece ${p} longer than a length`);
            for (const j of g.joins) if (!g.joinOffUpright) ok(centres.some((c) => Math.abs(c - j) < 1e-6), `${tag}: join ${j} not over an upright`);
            ok(g.joinOffUpright === g.joins.some((j) => !centres.some((c) => Math.abs(c - j) < 1e-6)), `${tag}: joinOffUpright says so`);
            if (g.W <= GRID.stock) eq(g.joins.length, 0, `${tag}: no join on a wall shorter than a length`);
            for (const l of g.lengths) {
              const used = l.pieces.reduce((s, p) => s + p.len, 0) + (l.pieces.length - 1) * GRID.kerf;
              ok(used <= GRID.stock + 1e-6, `${tag}: a length holds ${used}`);
              near(l.left, GRID.stock - used, `${tag}: what's left on a length`, 1e-6);
            }
            ok(g.lengths.length >= Math.ceil(g.total / GRID.stock), `${tag}: fewer lengths than the metres allow`);
            ok(gridText(g, '/portfolio/x').includes(`${g.n} panels across`), `${tag}: the text`);
          }
eq(compared > 2000, true, `compared ${compared} grids with the app`);

// layOut on its own: two 1200s fit one 2440 with a 3 mm cut (2403), three don't.
{
  const l = layOut([{ kind: 'upright', len: 1200 }, { kind: 'upright', len: 1200 }, { kind: 'upright', len: 1200 }], 2440, 3);
  eq(l.length, 2, 'layOut: three 1200s on two lengths');
  eq(l[0].pieces.length, 2, 'layOut: two on the first');
  near(l[0].left, 2440 - 2403, 'layOut: 37 left on the first');
  const exact = layOut([{ kind: 'rail', len: 1218.5 }, { kind: 'rail', len: 1218.5 }], 2440, 3);
  eq(exact.length, 1, 'layOut: two pieces filling a length exactly, with the cut');
}

// readMm
eq(readMm('4105'), 4105, 'readMm 4105');
eq(readMm('4,105'), 4105, 'readMm 4,105');
eq(readMm('603.7'), 603.7, 'readMm 603.7');
eq(readMm('603,7'), 603.7, 'readMm 603,7');
eq(readMm('69 mm'), 69, 'readMm 69 mm');
eq(readMm(''), null, 'readMm empty');
eq(readMm('abc'), null, 'readMm letters');
eq(readMm('-5'), null, 'readMm negative');

// The links
{
  const g = grid(GRID_START);
  const brief = gridBriefHref(g, 'wall-panelling-barnet');
  ok(brief.startsWith('/how-it-works?') && brief.endsWith('#brief'), 'brief link shape');
  const q = new URLSearchParams(brief.split('?')[1].split('#')[0]);
  eq(q.get('job'), 'wall-panelling-barnet', 'brief: the job');
  eq(q.get('what'), 'Wall panelling', 'brief: Wall panelling ticked');
  eq(q.get('w'), '4105', 'brief: width');
  eq(q.get('h'), '1000', 'brief: height');
  ok((q.get('note') ?? '').includes('603.7 × 862'), 'brief: the openings in the note');
  ok((q.get('note') ?? '').length <= 300, 'brief: the note fits the brief’s 300 characters');

  const app1 = gridAppHref(GRID_START);
  const st = appStateFor(new URLSearchParams(app1.split('?')[1]));
  eq(JSON.stringify(st), JSON.stringify({ pnStyle: 'grid', pgWalls: [{ w: '4105', n: 6 }], pgSel: 0, pH: '1000', pBat: '69', pRows: 1, pgFrom: 'floor' }), 'app link: the app’s settings');
  // the app's settings give the app the same answer as the page
  const a = app.panelCalc(Object.assign(app.defaults(), st));
  near(a.walls[0].gapW, grid(GRID_START).openW, 'app link: the app works out the same openings');
  const sk = { ...GRID_START, from: 'skirting', h: 1100, skirting: 120, gap: 15, panels: 0, rows: 2 };
  const st2 = appStateFor(new URLSearchParams(gridAppHref(sk).split('?')[1]));
  const a2 = app.panelCalc(Object.assign(app.defaults(), st2));
  near(a2.walls[0].gapW, grid(sk).openW, 'app link above the skirting: same openings');
  near(a2.openH, grid(sk).openH, 'app link above the skirting: same height');
  eq(appStateFor(new URLSearchParams('tool=grid&w=4105')), null, 'app link: a missing size opens nothing');
  eq(appStateFor(new URLSearchParams('tool=other&w=4105&h=1000&b=69')), null, 'app link: another tool opens nothing');
  eq(appStateFor(new URLSearchParams('tool=grid&w=50&h=1000&b=69')), null, 'app link: a wall under 300 opens nothing');
  // every key it sets is one the app has
  const def = app.defaults();
  for (const k of Object.keys(st2)) ok(k in def, `app link: ${k} is an app setting`);
  for (const k of Object.keys(st2)) ok(typeof st2[k] === typeof def[k], `app link: ${k} the same kind as the app's`);
}

if (fails.length) {
  console.log(`${fails.length} of ${checks} checks failed:`);
  for (const f of fails.slice(0, 40)) console.log(' - ' + f);
  process.exit(1);
}
console.log(`All ${checks} checks pass (${compared} grids compared with the Workshop Tools app, ${laid} cut out).`);

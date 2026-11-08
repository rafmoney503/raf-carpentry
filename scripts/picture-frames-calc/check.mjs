/* Checks the picture frame calculator on the wall panelling job pages (src/lib/picture-frames-calc.ts):
   node scripts/picture-frames-calc/check.mjs (Node 22.18 or later reads the .ts lib itself)
   A wall is worked out by hand first; then every answer is compared with the Workshop Tools app's own frameCalc (the
   generated app, src/lib/workshop-tools/app.generated.js), so the page and the app can't drift apart; then the
   cutting: every piece is cut, no length holds more than it can. */
import { FRAMES, FRAMES_START, frames, framesAppHref, framesAppStateFor, framesBriefHref, framesText, layOutFrames, readMm } from '../../src/lib/picture-frames-calc.ts';
import { defineComponent } from '../../src/lib/workshop-tools/app.generated.js';

let checks = 0;
const fails = [];
const ok = (cond, what) => {
  checks++;
  if (!cond) fails.push(what);
};
const eq = (a, b, what) => ok(a === b, `${what}: ${a} (want ${b})`);
const near = (a, b, what, tol = 1e-6) => ok(Math.abs(a - b) <= tol, `${what}: ${a} (want ${b})`);

// A living room wall by hand: 4200 wide, 2900 to the ceiling, 180 skirting, a 70 dado rail with its top at 950,
// 20 moulding, 100 gaps, frames on Auto.
const HARINGEY = { w: 4200, ceiling: 2900, skirting: 180, railTop: 950, railH: 70, mould: 20, around: 100, between: 100, frames: 0, upper: true };
{
  const f = frames(HARINGEY);
  eq(f.error, '', 'haringey: no error');
  eq(f.autoN, 5, 'haringey: Auto gives 5 (4100 / 800)');
  eq(f.n, 5, 'haringey: 5 frames');
  eq(f.fw, 720, 'haringey: (4000 − 400) / 5');
  eq(f.xs.join(' '), '100 920 1740 2560 3380', 'haringey: frame marks');
  eq(f.lowBot, 280, 'haringey: frames start 100 over the 180 skirting');
  eq(f.lowTop, 780, 'haringey: 100 under the rail at 880');
  eq(f.lh, 500, 'haringey: lower frames 500 high');
  eq(f.upBot, 1050, 'haringey: upper frames 100 over the rail');
  eq(f.uh, 1750, 'haringey: upper frames 1750 high');
  eq(f.frames, 10, 'haringey: 10 frames');
  eq(f.total, 5 * (2 * (720 + 500) + 2 * (720 + 1750)), 'haringey: moulding');
  eq(f.railLengths, 2, 'haringey: 2400 + 1800 of rail');
  eq(f.railPieces.join(' '), '2400 1800', 'haringey: rail pieces');
  // 10 sides of 1750 take a length each (1750 + 20 + 3); the rest packs round them
  ok(f.lengths.length >= 10, 'haringey: at least one length for each tall side');
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
const appFrames = (i) =>
  app.frameCalc(
    Object.assign(app.defaults(), {
      pfWalls: [{ w: String(i.w), n: i.frames }],
      pfCeil: String(i.ceiling),
      pfSkirt: String(i.skirting),
      pfRailTop: String(i.railTop),
      pfRailH: String(i.railH),
      pfMould: String(i.mould),
      pfAround: String(i.around),
      pfBetween: String(i.between),
      pfTarget: String(FRAMES.target),
      pfUpper: i.upper ? 'yes' : 'no',
      pfRailStock: String(FRAMES.railStock),
      pStock: String(FRAMES.stock),
      pWaste: String(FRAMES.waste),
    }),
  );
const sameWords = (mine, theirs) =>
  theirs
    .replace(/^Wall 1: the width needs to be at least 300 mm\./, 'The wall needs to be at least 300 mm wide.')
    .replace(/^Wall 1: the frames/, 'The frames')
    .replace('set Above rail to Plain wall', 'set Above the rail to Plain wall') === mine;

let compared = 0;
let laid = 0;
const widths = [300, 450, 800, 1200, 2400, 2401, 3000, 3600, 4200, 5000, 6500, 9000];
for (const w of widths)
  for (const ceiling of [900, 2100, 2400, 2700, 2900, 3300])
    for (const skirting of [0, 100, 180])
      for (const [railTop, railH] of [
        [700, 45],
        [950, 70],
        [1000, 45],
        [1500, 60],
        [2400, 45],
      ])
        for (const mould of [12, 22, 40])
          for (const [around, between] of [
            [50, 50],
            [100, 100],
            [150, 80],
          ])
            for (const n of [0, 1, 3, 6, 15])
              for (const upper of [true, false]) {
                const inp = { w, ceiling, skirting, railTop, railH, mould, around, between, frames: n, upper };
                const f = frames(inp);
                const a = appFrames(inp);
                const tag = `${w}/${ceiling} sk${skirting} rail${railTop}-${railH} mw${mould} g${around}/${between} n${n} ${upper ? 'up' : 'plain'}`;
                const appLong = !a.error && Math.max(a.walls[0].fw, a.lh, upper ? a.uh : 0) + mould > FRAMES.stock;
                if (appLong) {
                  ok(!!f.error, `${tag}: a side longer than a length should be an error here`);
                  continue;
                }
                eq(!!f.error, !!a.error, `${tag}: an error in one and not the other (${f.error} / ${a.error})`);
                if (f.error || a.error) {
                  if (f.error && a.error) ok(sameWords(f.error, a.error), `${tag}: same words (${f.error} / ${a.error})`);
                  continue;
                }
                compared++;
                const wl = a.walls[0];
                eq(f.n, wl.n, `${tag}: frames`);
                eq(f.autoN, wl.autoN, `${tag}: auto frames`);
                near(f.fw, wl.fw, `${tag}: frame width`);
                eq(f.xs.length, wl.xs.length, `${tag}: marks`);
                f.xs.forEach((x, i) => near(x, wl.xs[i], `${tag}: mark ${i}`));
                near(f.lh, a.lh, `${tag}: lower height`);
                near(f.uh, a.uh, `${tag}: upper height`);
                near(f.lowBot, a.lowBot, `${tag}: lower bottom`);
                near(f.upBot, a.upBot, `${tag}: upper bottom`);
                near(f.total, a.total, `${tag}: moulding`);
                eq(f.lengthsByMetre, a.lengths, `${tag}: lengths by the metre`);
                eq(f.railLengths, a.railLengths, `${tag}: rail lengths`);
                eq(f.frames, a.frames, `${tag}: frame count`);

                // the cutting
                laid++;
                const pieces = f.lengths.flatMap((l) => l.pieces);
                eq(pieces.length, f.n * 4 * (upper ? 2 : 1), `${tag}: four pieces a frame`);
                near(
                  pieces.reduce((s, p) => s + p.len, 0),
                  f.total,
                  `${tag}: the pieces add up to the moulding`,
                  1e-4,
                );
                for (const l of f.lengths) {
                  const used = l.pieces.reduce((s, p) => s + p.len + mould, 0) + (l.pieces.length - 1) * FRAMES.kerf;
                  ok(used <= FRAMES.stock + 1e-6, `${tag}: a length holds ${used}`);
                  near(l.left, FRAMES.stock - used, `${tag}: what's left on a length`, 1e-6);
                }
                ok(f.lengths.length >= Math.ceil(f.total / FRAMES.stock), `${tag}: fewer lengths than the metres allow`);
                near(
                  f.railPieces.reduce((s, p) => s + p, 0),
                  w,
                  `${tag}: the rail's pieces add up to the wall`,
                  1e-6,
                );
                eq(f.railPieces.length, f.railLengths, `${tag}: a rail length for each piece`);
                ok(framesText(f, '/portfolio/x').includes(`${f.n} frames across`), `${tag}: the text`);
              }
eq(compared > 3000, true, `compared ${compared} walls with the app`);

// layOutFrames on its own: two 1200 sides with a 20 moulding and a 3 mm cut between take 2443, more than a 2440 length.
{
  const two = layOutFrames([{ row: 'lower', side: 'side', len: 1200 }, { row: 'lower', side: 'side', len: 1200 }], 2440, 3, 20);
  eq(two.length, 2, 'layOut: two 1200 sides need two lengths with the mitre spare');
  const fits = layOutFrames([{ row: 'lower', side: 'side', len: 1190 }, { row: 'lower', side: 'side', len: 1190 }], 2440, 3, 20);
  eq(fits.length, 1, 'layOut: two 1190 sides fit one (2423)');
  near(fits[0].left, 17, 'layOut: 17 left');
}

// readMm
eq(readMm('4200'), 4200, 'readMm 4200');
eq(readMm('4,200'), 4200, 'readMm 4,200');
eq(readMm('22,5'), 22.5, 'readMm 22,5');
eq(readMm(''), null, 'readMm empty');

// The links
{
  const f = frames(HARINGEY);
  const brief = framesBriefHref(f, 'picture-frame-panelling-haringey');
  ok(brief.startsWith('/how-it-works?') && brief.endsWith('#brief'), 'brief link shape');
  const q = new URLSearchParams(brief.split('?')[1].split('#')[0]);
  eq(q.get('job'), 'picture-frame-panelling-haringey', 'brief: the job');
  eq(q.get('what'), 'Wall panelling', 'brief: Wall panelling ticked');
  eq(q.get('w'), '4200', 'brief: width');
  eq(q.get('h'), '2900', 'brief: height');
  ok((q.get('note') ?? '').includes('720 × 500'), 'brief: the frames in the note');
  ok((q.get('note') ?? '').length <= 300, 'brief: the note fits the brief’s 300 characters');

  for (const inp of [HARINGEY, FRAMES_START, { ...HARINGEY, frames: 4, upper: false, skirting: 0 }]) {
    const st = framesAppStateFor(new URLSearchParams(framesAppHref(inp).split('?')[1]));
    ok(st !== null, 'app link: opens');
    const a = app.frameCalc(Object.assign(app.defaults(), st));
    const mine = frames(inp);
    eq(a.error ?? '', mine.error, 'app link: no error in the app either');
    if (!mine.error) {
      near(a.walls[0].fw, mine.fw, 'app link: the app works out the same frames');
      near(a.lh, mine.lh, 'app link: the same lower height');
      near(a.uh, mine.uh, 'app link: the same upper height');
      eq(a.upper, inp.upper, 'app link: frames above or a plain wall');
    }
    const def = app.defaults();
    for (const k of Object.keys(st)) ok(k in def, `app link: ${k} is an app setting`);
    for (const k of Object.keys(st)) ok(typeof st[k] === typeof def[k], `app link: ${k} the same kind as the app's`);
  }
  eq(framesAppStateFor(new URLSearchParams('tool=frames&w=4200')), null, 'app link: no ceiling opens nothing');
  eq(framesAppStateFor(new URLSearchParams('tool=grid&w=4200&ch=2400')), null, 'app link: another tool opens nothing');
}

if (fails.length) {
  console.log(`${fails.length} of ${checks} checks failed:`);
  for (const f of fails.slice(0, 40)) console.log(' - ' + f);
  process.exit(1);
}
console.log(`All ${checks} checks pass (${compared} walls compared with the Workshop Tools app, ${laid} cut out).`);

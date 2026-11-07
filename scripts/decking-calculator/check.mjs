/* Checks the decking calculator's sums (src/lib/decking-calc.ts):
   node scripts/decking-calculator/check.mjs (Node 22.18 or later reads the .ts lib itself)
   The example deck on the page (3.5 × 3.0 m) is worked out by hand here, so a change to a rule shows up; then every
   size from 1 to 9 m in tenths, both boards, both ways, both heights and every joist spacing has to hold together. */
import { BOARDS, CENTRES, DECK_START, RULES, deck, deckBriefHref, deckPlan, deckText, readMetres } from '../../src/lib/decking-calc.ts';

let checks = 0;
const fails = [];
const ok = (cond, what) => {
  checks++;
  if (!cond) fails.push(what);
};
const eq = (a, b, what) => ok(a === b, `${what}: ${a} (want ${b})`);

// The page's starting deck, by hand: 3.5 along the house, 3.0 out, composite 146 + 6 mm gaps along the house.
{
  const d = deck(DECK_START);
  eq(d.rows, 20, 'start: rows, 3000 / 152'); // 20 × 146 + 19 × 6 = 3034
  eq(d.edgeWidth, 112, 'start: last board 146 − 34');
  eq(d.edges, 'last', 'start: only the last board cut');
  eq(d.boardLength, 3.6, 'start: 3.6 m boards');
  eq(d.boards, 21, 'start: 20 boards + 1 spare');
  eq(d.joistsAtCentres, 10, 'start: joists, 3500 / 400 rounded up, + 1');
  eq(d.joists, 10, 'start: no joins, no doubled joists');
  eq(d.joistBuy.len, 3.0, 'start: joists bought 3.0 m');
  eq(d.rimBuy.len, 3.6, 'start: rims bought 3.6 m');
  eq(d.nogginPieces, 9, 'start: one row of noggins between 10 joists');
  eq(d.nogginLengths, 1, 'start: 9 noggins of 353 from one 3.6 m length');
  eq(d.pads, 40, 'start: 4 pads under each of 10 joists');
  eq(d.clips, 210, 'start: 20 boards × 10 joists + 10 start clips');
  eq(d.frameScrews, 100, 'start: 40 + 36 frame screws, a box of 100');
  eq(d.fascia, 3, 'start: 9.5 m of fascia in 3.6 m lengths');
  eq(d.membrane, 12, 'start: 10.5 m² + 10%');
  eq(d.tape, 37, 'start: 10 × 3.0 + 2 × 3.5 m of tape');
  eq(d.fall, 15, 'start: 5 mm a metre over 3.0 m');
  eq(d.area, 10.5, 'start: area');
}

// The same deck in softwood: 144 + 5 mm, so 21 rows and a 20 mm sliver, which goes half to each edge instead.
{
  const d = deck({ ...DECK_START, board: 'softwood' });
  eq(d.rows, 21, 'softwood: rows');
  eq(d.edges, 'both', 'softwood: first and last cut, not a 20 mm sliver');
  eq(d.edgeWidth, 82, 'softwood: 144 − 124 / 2');
  eq(d.boardLength, 3.6, 'softwood: 3.6 m boards beat 2.4 and 4.8');
  eq(d.boards, 22, 'softwood: 21 + 1 spare');
  eq(d.screws, 420, 'softwood: 2 screws × 21 boards × 10 joists');
  eq(d.screwBoxes, 1, 'softwood: one box of 500');
}

// Boards out from the house: they run 3.0 m, joists run along the house.
{
  const d = deck({ ...DECK_START, run: 'out' });
  eq(d.rows, 24, 'out: rows across 3500');
  eq(d.joistsAtCentres, 9, 'out: joists along 3.0 m at 400');
  eq(d.joistBuy.len, 3.6, 'out: joists 3.5 m long, bought 3.6');
}

// A deck longer than a composite board: one line of joins over a doubled joist.
{
  const d = deck({ ...DECK_START, len: 5 });
  eq(d.joins, 1, 'joins: 5 m from 3.6 m boards');
  eq(d.boardsNeeded, 31, 'joins: 20 rows × 5 m + 10% over 3.6 m lengths');
  eq(d.joists, 15, 'joins: 14 at 400 + 1 doubled');
}

// Raised: posts every 1.8 m, bearers, 47 × 150, and the planning warning.
{
  const d = deck({ ...DECK_START, height: 'raised' });
  eq(d.posts, 9, 'raised: 3 × 3 posts');
  eq(d.joistSize, '47 × 150', 'raised: deeper joists');
  ok(d.checks[0].warn && /planning permission/.test(d.checks[0].text), 'raised: planning warning');
  ok(d.items.some((it) => /Bearers/.test(it.what)) && !d.items.some((it) => /pads/.test(it.what)), 'raised: bearers, no pads');
}

eq(readMetres('3,5'), 3.5, 'reads a comma');
eq(readMetres(' 4.25 m'), 4.25, 'reads a unit');
eq(readMetres('0.5'), null, 'too small');
eq(readMetres('25'), null, 'too big');
eq(readMetres(''), null, 'empty');

// Every size, board, way, height and spacing.
for (let a = 10; a <= 90; a++)
  for (let c = 10; c <= 90; c += 3)
    for (const board of ['composite', 'softwood'])
      for (const run of ['along', 'out'])
        for (const height of ['ground', 'raised'])
          for (const centres of CENTRES) {
            const input = { len: a / 10, dep: c / 10, board, run, height, centres };
            const d = deck(input);
            const b = BOARDS[board];
            const tag = `${a / 10}×${c / 10} ${board} ${run} ${height} ${centres}`;
            const W = d.across * 1000;
            ok(d.rows * b.w + (d.rows - 1) * b.gap >= W - 0.5, `${tag}: boards cover the width`);
            ok((d.rows - 1) * b.w + (d.rows - 2) * b.gap < W, `${tag}: no row more than needed`);
            ok(d.edgeWidth > b.w * 0.4 && d.edgeWidth <= b.w, `${tag}: edge board ${d.edgeWidth} mm is a sensible width`);
            ok(d.spare >= 1 && d.boards === d.boardsNeeded + d.spare, `${tag}: spare boards`);
            ok(d.boardsNeeded * d.boardLength >= d.rows * d.run - 1e-6, `${tag}: enough board length`);
            ok((d.run * 1000 - RULES.joist) / (d.joistsAtCentres - 1) <= centres + 1e-6, `${tag}: joists no further apart than ${centres}`);
            ok(d.joistBuy.len * d.joistBuy.per >= d.across - 1e-6, `${tag}: joist lengths long enough`);
            ok(d.rimBuy.len * d.rimBuy.per >= d.run - 1e-6, `${tag}: rim lengths long enough`);
            ok(d.fascia * 3.6 >= d.fasciaMetres - 1e-6, `${tag}: enough fascia`);
            ok(d.membrane >= d.area, `${tag}: enough membrane`);
            ok(d.items.every((it) => !/[—–]/.test(it.what + it.note)), `${tag}: no dashes`);
            ok(d.items.every((it) => it.qty && !/NaN|Infinity|undefined/.test(it.qty + it.what + it.note)), `${tag}: every line worked out`);
            for (const view of ['boards', 'frame']) {
              const p = deckPlan(d, view);
              ok(p.rects.every((r) => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= p.w + 0.5 && r.y + r.h <= p.h + 0.5 && r.w > 0 && r.h > 0), `${tag} ${view}: drawing inside the deck`);
              if (view === 'boards') eq(p.rects.filter((r) => r.kind === 'board' || r.kind === 'board2').length, d.rows, `${tag}: a board drawn a row`);
              else eq(p.rects.filter((r) => r.kind === (height === 'raised' ? 'post' : 'pad')).length, height === 'raised' ? d.posts : d.joistsAtCentres * d.padsPerJoist, `${tag}: supports drawn`);
            }
          }

{
  const href = deckBriefHref(deck(DECK_START));
  ok(href.startsWith('/how-it-works?') && href.endsWith('#brief'), 'brief link');
  const q = new URLSearchParams(href.slice(href.indexOf('?') + 1, href.indexOf('#')));
  eq(q.get('what'), 'Decking', 'brief: Decking ticked');
  eq(q.get('w'), '3500', 'brief: along the house in mm');
  eq(q.get('h'), '3000', 'brief: out from it in mm');
  ok(/composite boards along the house, on the ground/.test(q.get('note') ?? ''), 'brief: note');
  const t = deckText(deck(DECK_START));
  ok(t.startsWith('My deck: 3.5 × 3.0 m (10.5 m²)') && t.includes('- 21  Composite deck boards'), 'list text');
}

if (fails.length) {
  console.error(`${fails.length} of ${checks} checks failed:`);
  for (const f of fails.slice(0, 30)) console.error(' - ' + f);
  process.exit(1);
}
console.log(`${checks} checks passed`);

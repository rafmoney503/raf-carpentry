/* Checks the calculators on the job pages and the Job Kit's boxes for them (src/lib/job-calculators.ts):
   npx tsx scripts/job-calculators/check.mjs
   Every job JSON's calculator starts with no error; a Job Kit draft made from a job's sizes becomes the calculator
   it says, gives the same answer as the calculator's own lib, and survives the trip through job.json. */
import fs from 'node:fs';
import path from 'node:path';
import { CALC_FIELDS, calcAnswer, calcKindsFor, calcNotesLine, deckInput, framesInput, fromDraft, gridInput, shownFields, startDraft } from '../../src/lib/job-calculators.ts';
import { grid } from '../../src/lib/panelling-calc.ts';
import { frames } from '../../src/lib/picture-frames-calc.ts';
import { deck } from '../../src/lib/decking-calc.ts';

let checks = 0;
const fails = [];
const ok = (cond, what) => {
  checks++;
  if (!cond) fails.push(what);
};
const eq = (a, b, what) => ok(JSON.stringify(a) === JSON.stringify(b), `${what}: ${JSON.stringify(a)} (want ${JSON.stringify(b)})`);

// which calculators a job's kinds offer
eq(calcKindsFor(['Wall panelling']), ['batten-grid', 'picture-frames'], 'panelling offers both wall calculators');
eq(calcKindsFor(['Decking or fence']), ['decking'], 'decking offers decking');
eq(calcKindsFor(['Fitted wardrobes', 'Doors']), [], 'a wardrobe job offers none');
eq(calcKindsFor(['Wall panelling', 'Decking or fence']), ['batten-grid', 'picture-frames', 'decking'], 'both kinds offer all three');

// every job page's calculator
const dir = 'content/projects';
let pages = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (!p.calculator) continue;
  pages++;
  const c = p.calculator;
  ok(['batten-grid', 'picture-frames', 'decking'].includes(c.kind), `${f}: a calculator kind the page knows`);
  const a = calcAnswer(c);
  ok(a.ok, `${f}: starts with no error (${a.line})`);
  if (c.kind === 'decking') {
    ok(c.along >= 1000 && c.along <= 20000 && c.out >= 1000 && c.out <= 20000, `${f}: a deck the calculator takes (1 to 20 m)`);
  }
}
ok(pages >= 3, `job pages with a calculator: ${pages}`);

// Job Kit drafts: from a job's first size, typed, through job.json and back
const sizes = { w: '4105', h: '1000', d: '' };
{
  const v = startDraft('batten-grid', sizes);
  eq(v.w, '4105', 'grid: wall width from the size');
  eq(v.h, '1000', 'grid: height from the size');
  eq(v.batten, '69', 'grid: batten from the default');
  const { calc, bad } = fromDraft({ kind: 'batten-grid', v: { ...v, panels: '6' } });
  eq(bad, '', 'grid: no bad box');
  eq(calc, { kind: 'batten-grid', w: 4105, h: 1000, batten: 69, panels: 6, rows: 1, from: 'floor' }, 'grid: the calculator, the same as the Barnet page');
  const a = calcAnswer(calc);
  const g = grid(gridInput(calc));
  ok(a.ok && a.line.includes('603.7 × 862') && a.line.includes(`${g.lengths.length} lengths`), `grid: the answer (${a.line})`);
  ok(calcNotesLine(calc).startsWith('Batten grid: wall 4105'), 'grid: the notes line');
  eq(JSON.parse(JSON.stringify(calc)), calc, 'grid: survives job.json');
  // above the skirting shows two more boxes
  eq(shownFields('batten-grid', { ...v, from: 'skirting' }).length, CALC_FIELDS['batten-grid'].length, 'grid: skirting and gap show above the skirting');
  eq(shownFields('batten-grid', v).length, CALC_FIELDS['batten-grid'].length - 2, 'grid: and hide from the floor');
  const sk = fromDraft({ kind: 'batten-grid', v: { ...v, from: 'skirting', skirting: '120', gap: '20', h: '1140' } }).calc;
  eq([sk.skirting, sk.gap, sk.from], [120, 20, 'skirting'], 'grid: skirting and gap kept');
  eq(fromDraft({ kind: 'batten-grid', v: { ...v, w: '' } }).bad, 'w', 'grid: an empty wall is the bad box');
  eq(fromDraft({ kind: 'batten-grid', v: { ...v, w: '200' } }).bad, 'w', 'grid: under 300 is the bad box');
  eq(fromDraft({ kind: 'batten-grid', v: { ...v, w: '4,105' } }).calc?.w, 4105, 'grid: 4,105 read');
}
{
  const v = startDraft('picture-frames', { w: '4200', h: '2900', d: '' });
  eq([v.w, v.ceiling, v.railTop], ['4200', '2900', '1000'], 'frames: wall and ceiling from the size, rail from the default');
  const { calc } = fromDraft({ kind: 'picture-frames', v: { ...v, skirting: '180', railTop: '950', railH: '70', mould: '20' } });
  const f = frames(framesInput(calc));
  eq(f.error, '', 'frames: no error');
  ok(calcAnswer(calc).line.includes('720 × 500 below, 720 × 1750 above'), `frames: the answer (${calcAnswer(calc).line})`);
  eq(fromDraft({ kind: 'picture-frames', v: { ...v, upper: 'no' } }).calc.upper, false, 'frames: plain wall above');
  eq(fromDraft({ kind: 'picture-frames', v: { ...v, ceiling: '800' } }).bad, 'ceiling', 'frames: a ceiling under 1000 is the bad box');
  ok(calcNotesLine(calc).includes('frames on Auto'), 'frames: the notes line says Auto');
}
{
  const v = startDraft('decking', { w: '3600', h: '', d: '5000' });
  eq([v.along, v.out], ['3600', '5000'], 'deck: along and out from W and D');
  eq(startDraft('decking', { w: '3600', h: '4000', d: '' }).out, '4000', 'deck: out from H when there is no D');
  const { calc } = fromDraft({ kind: 'decking', v: { ...v, board: 'softwood', run: 'out' } });
  eq(calc, { kind: 'decking', along: 3600, out: 5000, board: 'softwood', run: 'out', height: 'ground', centres: 400 }, 'deck: the calculator');
  const d = deck(deckInput(calc));
  eq([d.input.len, d.input.dep], [3.6, 5], 'deck: metres for the calculator');
  ok(calcAnswer(calc).line.includes(`${d.boards} boards`), 'deck: the answer');
  eq(fromDraft({ kind: 'decking', v: { ...v, along: '500' } }).bad, 'along', 'deck: under a metre is the bad box');
  eq(fromDraft({ kind: 'decking', v: { ...v, out: '30000' } }).calc.out, 20000, 'deck: held to 20 m');
}
// a typed value is kept when the calculator changes
eq(startDraft('picture-frames', sizes, { w: '3900' }).w, '3900', 'switching keeps the wall width typed');
eq(fromDraft({ kind: 'none', v: {} }).calc, null, 'None: no calculator');
{
  // grid, then frames, then the grid again: its panels are still there
  const g1 = { ...startDraft('batten-grid', sizes), panels: '6' };
  const f1 = startDraft('picture-frames', sizes, g1);
  eq(f1.panels, '6', 'switching to frames keeps the grid’s panels');
  eq(startDraft('batten-grid', sizes, f1).panels, '6', 'and back to the grid finds them');
  eq(fromDraft({ kind: 'picture-frames', v: f1 }).calc.frames, 0, 'the grid’s panels don’t become frames');
}

if (fails.length) {
  console.log(`${fails.length} of ${checks} checks failed:`);
  for (const f of fails) console.log(' - ' + f);
  process.exit(1);
}
console.log(`All ${checks} checks pass (${pages} job pages with a calculator).`);

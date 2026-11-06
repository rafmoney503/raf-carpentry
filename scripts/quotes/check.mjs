/* Checks the Job Kit's quote sums (src/lib/quote-sums.ts), the Cworkshop board list (src/lib/cworkshop-boards.ts)
   and how Claude's answer is cleaned (cleanRead in src/lib/quote-maker.ts):
   node scripts/quotes/check.mjs   (Node 22.18 or later reads the .ts files itself; jiti loads the ones with imports)
   Raf's own prices are fixed here on purpose, as in scripts/cost-calculator/check.mjs: changing one in the lib
   without changing it here fails the check. */
import { createJiti } from 'jiti';
import { readFileSync } from 'node:fs';
import {
  boardParts,
  boardSheets,
  boardWork,
  DEFAULT_PRICES,
  hingesFor,
  ownPrices,
  splitOf,
  splitSheets,
  fromPrice,
  optionsFor,
  otherOptions,
  picked,
  PRICE_ROWS,
  pricesWith,
  quoteMessage,
  roundUp,
  sizesOf,
  SHEET_M2,
  SHEET_YIELD,
  wardrobeOptions,
  withVat,
} from '../../src/lib/quote-sums.ts';

const jiti = createJiti(import.meta.url);
const { BOARDS, CUT_CHARGE, INSIDE_DEFAULT, PRICE_BASE, SERVICES, CHANGES, FAMILY_ORDER, BOARDS_CHECKED } = await jiti.import('../../src/lib/cworkshop-boards.ts');
const { fillWall } = await jiti.import('../../src/lib/pax-brief.ts');
const { cleanRead } = await jiti.import('../../src/lib/quote-maker.ts');

let checks = 0;
const fails = [];
const ok = (cond, what) => {
  checks++;
  if (!cond) fails.push(what);
};

/* Raf's prices (before VAT): 1 Nov 2026 for the calculator ones, his Wandsworth quote for PAX, Cworkshop's cutting. */
const RAF = { plainPerM: 1200, shakerPerM: 1600, paxPerM: 1050, dayRate: 650, kitchen: 2200, laminateM2: 40, loftM2: 120, deckingM2: 250, door: 250, mediaBasic: 2800, mediaMid: 5400, roundTo: 50, cutEdgeSheet: 47.3 };
for (const [k, v] of Object.entries(RAF)) ok(DEFAULT_PRICES[k] === v, `default ${k} is ${v}`);
ok(CUT_CHARGE === DEFAULT_PRICES.cutEdgeSheet, 'cutting charge matches the board list');
ok(PRICE_ROWS.length === Object.keys(DEFAULT_PRICES).length - 1, 'a price row for every price');
ok(new Set(PRICE_ROWS.map((r) => r.key)).size === PRICE_ROWS.length, 'price rows unique');
for (const r of PRICE_ROWS) ok(typeof DEFAULT_PRICES[r.key] === 'number', `default for ${r.key}`);
for (const r of PRICE_ROWS) ok(!/[—–]/.test(r.label + r.from), `no dashes in ${r.key}`);

/* the boards */
ok(BOARDS.length >= 25, 'at least 25 boards');
ok(new Set(BOARDS.map((b) => `${b.name}|${b.brand}`)).size === BOARDS.length, 'no two boards of one maker share a name');
ok(new Set(BOARDS.map((b) => b.code)).size === BOARDS.length, 'board codes unique');
ok(BOARDS.some((b) => b.code === INSIDE_DEFAULT), 'the inside board is in the list');
ok(/^\d{4}-\d{2}-\d{2}$/.test(BOARDS_CHECKED), 'the list says when it was checked');
for (const b of BOARDS) {
  ok(b.exVat > 50 && b.exVat < 250, `${b.code} price looks like a sheet`);
  ok(/^https:\/\/cworkshop\.co\.uk\/sheet-materials\/(egger|kronospan)\/[a-z0-9-]+-chipboard-2800-x-2070mm\/((18(\.5)?|19)mm\/)?$/.test(b.url), `${b.code} links to its Cworkshop page`);
  ok(['Egger', 'Kronospan'].includes(b.brand), `${b.code} has its maker`);
  ok(FAMILY_ORDER.includes(b.family), `${b.code} is in a family the screens show`);
  ok(b.thick === 18 || b.thick === 18.5 || b.thick === 19, `${b.code} is 18, 18.5 or 19 mm`);
  ok(b.thick !== 19 || /19mm\/$/.test(b.url), `${b.code} links to its 19 mm page`);
  ok(b.thick !== 18.5 || /18\.5mm\/$/.test(b.url), `${b.code} links to its 18.5 mm page`);
  ok(/^\d{4}-\d{2}-\d{2}$/.test(b.checked ?? '') && b.checked <= BOARDS_CHECKED, `${b.code} says when its price was read`);
  ok(/^#[0-9a-f]{6}$/.test(b.hex), `${b.code} has a swatch colour`);
  ok(!/[—–]/.test(b.describe + b.name), `${b.code} words have no dashes`);
  if (b.offerEnds) ok(b.normalExVat && b.normalExVat > b.exVat, `${b.code} offer is below the normal price`);
}

/* Cworkshop's services: each one a price row in the Cworkshop group, where the list of prices starts */
const raw = JSON.parse(readFileSync(new URL('../../content/cworkshop.json', import.meta.url), 'utf8'));
ok(raw.boards.length === BOARDS.length && raw.services.length === SERVICES.length, 'the data file is what the Job Kit reads');
for (const sv of SERVICES) {
  const row = PRICE_ROWS.find((r) => r.key === sv.key);
  ok(row && row.group === 'Cworkshop', `${sv.key} is a Cworkshop price row`);
  ok(PRICE_BASE[sv.key] === sv.price, `${sv.key} starts at Cworkshop's ${sv.price}`);
  ok(typeof sv.published === 'boolean' && sv.from.length > 10, `${sv.key} says where its price comes from`);
  ok(!/[—–]/.test(sv.label + sv.from), `${sv.key} words have no dashes`);
}
for (const r of PRICE_ROWS.filter((x) => x.group === 'Cworkshop')) ok(SERVICES.some((sv) => sv.key === r.key), `${r.key} is in the data file`);
ok(SERVICES.find((x) => x.key === 'cutEdgeSheet').published === true, 'cutting is Cworkshop’s published price');
/* Raf's basket of 6 Nov 2026: each line's total comes out the same from the saved prices */
for (const [key, qty, total] of [['edgeThinM', 118.3, 347.09], ['hingeHole', 25, 59.85], ['narrowEdge', 2, 6.25], ['tapeM', 5, 7.12]]) {
  const sv = SERVICES.find((x) => x.key === key);
  ok(sv && sv.source === 'basket' && sv.list > sv.price, `${key} is from the basket`);
  ok(sv && Math.abs(sv.list * (1 - sv.discount / 100) - sv.price) < 1e-9, `${key}: ${sv?.list} less ${sv?.discount}% is ${sv?.price}`);
  ok(sv && Math.abs(qty * sv.price - total) < 0.01, `${key}: ${qty} at ${sv?.price} is the basket's £${total}`);
  ok(PRICE_BASE[key] === sv?.price, `${key} reaches the quotes`);
}
for (const sv of SERVICES) ok(['website', 'basket', 'guess'].includes(sv.source) && (sv.source === 'guess') === !sv.published, `${sv.key} says where its price comes from (${sv.source})`);
ok(CHANGES.length >= 1 && CHANGES.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.at) && c.text.length > 5 && !/[—–]/.test(c.text)), 'changes dated and worded');
ok(pricesWith({}, PRICE_BASE).edgeThinM === PRICE_BASE.edgeThinM, 'the Job Kit starts from Cworkshop’s prices');

/* pricesWith keeps good numbers, drops bad ones */
{
  const p = pricesWith({ plainPerM: 1300, shakerPerM: 'x', dayRate: -5, roundTo: 0, boards: { 'H3171 ST12': 99.5, nope: 'x', big: 99999 } });
  ok(p.plainPerM === 1300, 'a saved price is used');
  ok(p.shakerPerM === 1600 && p.dayRate === 650, 'bad saved prices fall back to the defaults');
  ok(p.roundTo === 1, 'rounding never under £1');
  ok(p.boards['H3171 ST12'] === 99.5 && !('nope' in p.boards) && !('big' in p.boards), 'board prices checked');
}

const P = pricesWith({});
const wardrobe = (runs, w = {}) => ({
  kind: 'wardrobe',
  title: 'Fitted wardrobe in an alcove',
  summary: '',
  runs: runs.map(([width, height, depth = 600]) => ({ label: '', width, height, depth, widthFrom: 'given', heightFrom: 'photo' })),
  seen: [],
  check: [],
  questions: ['Could you send a photo of the whole wall?', 'Where are the sockets?'],
  intro: 'Thanks for your brief and the photos of your bedroom.',
  budget: '',
  wardrobe: { units: 3, drawers: 0, top: false, sliding: false, inside: '', paxOk: true, paxNote: '', ...w },
  colours: [{ code: 'H3171 ST12', why: 'a warm honey oak to go with your floor' }],
  inside: 'W1000 ST9',
  recommend: 'plain',
  recommendWhy: '',
  other: [],
});
const by = (opts, id) => opts.find((o) => o.id === id);

/* a 2,400 wall, floor to ceiling */
{
  const r = wardrobe([[2400, 2400]]);
  const o = wardrobeOptions(r, P, BOARDS, {}, fillWall);
  ok(o.length === 4 && o.map((x) => x.id).join() === 'plain,pax,shaker,board', 'four wardrobe options in order');
  ok(by(o, 'plain').price === 2900, 'plain 2.4 m: 2,880 rounded up to 2,900');
  ok(by(o, 'shaker').price === 3850, 'shaker 2.4 m: 3,840 rounded up to 3,850');
  ok(by(o, 'pax').price === 2550 && by(o, 'pax').offered, 'PAX 2.4 m: 2,520 to 2,550, offered');
  ok(/PAX 100 \+ 75 \+ 50/.test(by(o, 'pax').says), 'PAX names the frames for 2,400');
  ok(/roughly £1,000/.test(by(o, 'pax').says), 'PAX says roughly what their IKEA parts cost');
  // board, worked out by hand from the same rules
  const s = boardSheets(sizesOf(r), 3, 0, false);
  const outM2 = 2.4 * 2.4 + 2.4 * 0.25 + 2 * 2.4 * 0.1;
  const inM2 = 4 * 2.4 * 0.6 + 4 * 2.4 * 0.6 + 2.4 * 2.4;
  ok(s.out === Math.ceil(outM2 / (SHEET_M2 * SHEET_YIELD)) && s.in === Math.ceil(inM2 / (SHEET_M2 * SHEET_YIELD)), `sheets ${s.out} + ${s.in} as worked by hand`);
  // edges: 4 doors 600 x 2,250 all round, the infill and two fillers; three carcasses' fronts and two shelves each
  const parts = boardParts(sizesOf(r), 3, 0, false);
  const thick = Math.ceil(2 * 2.4 + 2 * 4 * 2.25 + 2.4 + 2 * 2.4 - 1e-9);
  const thin = Math.ceil(2 * 3 * 2.25 + 4 * 2.4 - 1e-9);
  ok(parts.thickM === thick && parts.thinM === thin, `edging ${parts.thickM} m 2 mm and ${parts.thinM} m 1 mm as worked by hand (${thick}, ${thin})`);
  ok(parts.doors === 4 && parts.hinges === 4 * hingesFor(2.25) && hingesFor(2.25) === 5, `4 doors, ${parts.hinges} hinges`);
  const oak = BOARDS.find((b) => b.code === 'H3171 ST12').exVat;
  const white = BOARDS.find((b) => b.code === 'W1000 ST9').exVat;
  const days = Math.round((0.5 + 2.4) * 4) / 4;
  const sum = s.out * oak + s.in * white + (s.out + s.in) * 47.3 + thick * 2.934 + thin * 2.934 + 3 * 50 + 60 + days * 650;
  ok(by(o, 'board').worked === roundUp(sum, 50), `board ${by(o, 'board').worked} = ${roundUp(sum, 50)} by hand`);
  ok(by(o, 'board').lines.some((l) => /^Edging 2 mm, 30 m at £2\.93/.test(l.label)) && by(o, 'board').lines.some((l) => /^Edging 1 mm, 24 m at £2\.93/.test(l.label)), 'edging lines say the metres and the price');
  ok(/30 m of 2 mm edging and 24 m of 1 mm; 20 hinges on 4 doors/.test(by(o, 'board').extra), `the note says the parts: ${by(o, 'board').extra}`);
  ok(/Every edge is finished to match/.test(by(o, 'board').says), 'board says the edges match');
  ok(/^Egger Oiled Kendal Oak outside \(a warm honey oak to go with your floor\), Premium White inside\./.test(by(o, 'board').says), `board says the colour and the inside: ${by(o, 'board').says}`);
  ok(/no painting/.test(by(o, 'board').says), 'board says nothing to paint');
  ok(by(o, 'plain').price < by(o, 'shaker').price, 'flat doors cost less than shaker');
  ok(fromPrice(o) === 2550, 'from the cheapest: PAX');
  for (const x of o) ok(x.price % 50 === 0, `${x.id} rounded to £50`);
  for (const x of o) ok(!/[—–]/.test(x.says), `${x.id} words have no dashes`);
  for (const x of o) ok(!/paint(s|ed|ing)? (it|them|the)|I paint|I'll paint|spray/i.test(x.says), `${x.id} never says Raf paints`);
}

/* drawers and top cupboards cost more; a low ceiling rules PAX out; shallow is checked */
{
  const r = wardrobe([[2400, 2400]], { drawers: 3, top: true });
  const o = wardrobeOptions(r, P, BOARDS, {}, fillWall);
  ok(by(o, 'plain').price === roundUp(2880 + 3 * 80 + 2.4 * 250, 50), 'plain with 3 drawers and top cupboards');
  const low = wardrobeOptions(wardrobe([[1800, 2000]]), P, BOARDS, {}, fillWall);
  ok(!by(low, 'pax').offered && /2,030/.test(by(low, 'pax').why), 'PAX not offered under 2,030 high');
  ok(!picked(by(low, 'pax')), 'an option not offered is never picked');
  const no = wardrobeOptions(wardrobe([[2400, 2400]], { paxOk: false, paxNote: 'Sloped ceiling' }), P, BOARDS, {}, fillWall);
  ok(!by(no, 'pax').offered && by(no, 'pax').why === 'Sloped ceiling', 'Claude can rule PAX out, with why');
  const shallow = wardrobeOptions(wardrobe([[2400, 2400, 450]]), P, BOARDS, {}, fillWall);
  ok(/58 cm deep/.test(by(shallow, 'pax').says), 'shallow space: PAX depth to check');
}

/* two alcoves, Raf's own numbers over Claude's */
{
  const r = wardrobe([[950, 2400], [1000, 2400]]);
  const o = wardrobeOptions(r, P, BOARDS, {}, fillWall);
  ok(by(o, 'plain').price === roundUp(1.95 * 1200, 50), 'two alcoves add up');
  const e = { runs: [{ w: 1100 }, {}], price: { shaker: 3999 }, pick: { pax: false }, colour: 'U638 ST9', drawers: 2 };
  const o2 = wardrobeOptions(r, P, BOARDS, e, fillWall);
  ok(by(o2, 'plain').price === roundUp(2.1 * 1200 + 2 * 80, 50), 'a typed width and drawers change the price');
  ok(by(o2, 'shaker').price === 3999 && by(o2, 'shaker').changed, 'Raf’s own price wins');
  ok(!picked(by(o2, 'pax'), e), 'untick leaves it out');
  ok(/Sage Green/.test(by(o2, 'board').says), 'picked colour used');
  ok(sizesOf(r, { runs: [{ w: 50 }] })[0].w === 950, 'a slip under 200 mm is ignored');
  ok(sizesOf(wardrobe([[50, 9000]]))[0].w === 1000 && sizesOf(wardrobe([[50, 9000]]))[0].h === 2400, 'Claude’s nonsense sizes fall back');
  const msg = quoteMessage(r, o2, e, 'Sarah', true);
  ok(msg.startsWith('Hi Sarah,\n\nThanks for your brief'), 'message starts with the name and intro');
  ok(/two spaces of about 1,100 and 1,000 mm wide and 2,400 mm high/.test(msg), `message says the sizes`);
  ok(/for a space about 2,400 mm wide and 2,400 mm high/.test(quoteMessage(wardrobe([[2400, 2400]]), wardrobeOptions(wardrobe([[2400, 2400]]), P, BOARDS, {}, fillWall), {}, 'Sam', true)), 'one space: a space about');
  ok(/I’ll measure properly on the visit/.test(msg), 'heights from a photo: says it will be measured');
  ok(/^1\. Made to measure in MDF with flat doors: £2,700 \+ VAT \(£3,240\)\./m.test(msg), 'numbered option with VAT');
  ok(/^2\. Made to measure with shaker doors: £3,999 \+ VAT \(£4,799\)/m.test(msg), 'Raf’s price in the message');
  ok(!/IKEA PAX built in/.test(msg), 'unticked option not in the message');
  ok(/A few questions to firm it up:\n- Could you send a photo of the whole wall\?\n- Where are the sockets\?/.test(msg), 'questions listed');
  ok(msg.endsWith('Thanks,\nRaf'), 'signed when it’s copied');
  ok(quoteMessage(r, o2, e, 'Sarah', false).endsWith('Thanks,'), 'not signed for the email box (ServiceM8 adds it)');
  ok(!/[—–]/.test(msg), 'no dashes in the message');
  ok(!/\n\n\n/.test(msg), 'never two empty lines');
  const one = quoteMessage(r, o2, { ...e, pick: { pax: false, plain: false, shaker: false }, ask: { 0: false } }, 'Sarah', true);
  ok(/My rough price for/.test(one) && !/^1\./m.test(one), 'one option: not numbered');
  ok(/One question to firm it up: Where are the sockets\?/.test(one), 'one question inline');
  const none = quoteMessage({ ...r, questions: [] }, o2, { pick: { plain: false, pax: false, shaker: false, board: false } }, '', true);
  ok(none.startsWith('Hi there,') && !/rough price/.test(none), 'no options: no price lines');
  ok(/The next step is a free visit to measure up/.test(msg), 'the usual closing paragraph');
  // Raf's instructions can add a paragraph to every message and change the closing one (2 Nov 2026)
  const own = quoteMessage({ ...r, extra: 'Send more photos on WhatsApp any time.', closing: 'I can come and measure up this week.' }, o2, e, 'Sarah', true);
  ok(/Where are the sockets\?\n\nSend more photos on WhatsApp any time\.\n\nI can come and measure up this week\.\n\nThanks,\nRaf$/.test(own), 'his extra paragraph, then his closing, then Thanks');
  ok(!/The next step is a free visit/.test(own), 'his closing replaces the usual one');
  ok(quoteMessage({ ...r, extra: '  ', closing: '' }, o2, e, 'Sarah', true) === msg, 'empty extra and closing change nothing');
  ok(!/\n\n\n/.test(own), 'never two empty lines with his paragraphs');
}

/* board sheets and days can be set by hand */
{
  const r = wardrobe([[2400, 2400]]);
  const w = boardWork(r, P, { sheets: { out: 4, in: 9 }, days: 5 });
  ok(w.out === 4 && w.in === 9 && w.days === 5, 'own sheets and days');
  ok(boardWork(r, P, { sheets: { out: 999 } }).out === w.calc.out, 'silly sheets ignored');
  const o = wardrobeOptions(r, P, BOARDS, { sheets: { out: 4, in: 9 }, days: 5 }, fillWall);
  ok(by(o, 'board').lines.some((l) => /Labour, 5 days/.test(l.label)), 'own days in the sums');
  const cheap = pricesWith({ boards: { 'H3171 ST12': 50 } });
  ok(by(wardrobeOptions(r, cheap, BOARDS, {}, fillWall), 'board').worked < by(wardrobeOptions(r, P, BOARDS, {}, fillWall), 'board').worked, 'Raf’s board price used');
}

/* one board or two: one decor throughout, a decor outside and another inside, or the doors and the rest */
{
  const r = wardrobe([[2400, 2400]]);
  const parts = boardParts(sizesOf(r), 3, 0, false);
  const one = splitSheets(parts, 'one');
  const two = splitSheets(parts, 'outside');
  const doors = splitSheets(parts, 'doors');
  ok(one.in === 0 && one.out <= two.out + two.in && one.out === Math.ceil((parts.doorsM2 + parts.frameM2 + parts.insideM2) / (SHEET_M2 * SHEET_YIELD) - 1e-9), `one board: ${one.out} sheets, never more than two boards' ${two.out + two.in}`);
  ok(doors.outM2 === parts.doorsM2 && Math.abs(doors.inM2 - (parts.frameM2 + parts.insideM2)) < 0.11, 'doors split: the doors in the first board, the rest in the second');
  ok(splitOf(r) === 'outside', 'a decor outside and white inside to start with');
  ok(splitOf({ ...r, inside: 'H3171 ST12' }) === 'one', 'the same board inside means one board');
  ok(splitOf({ ...r, split: 'doors' }) === 'doors' && splitOf({ ...r, split: 'doors' }, { split: 'one' }) === 'one', 'Claude’s split, then Raf’s');
  const o1 = by(wardrobeOptions(r, P, BOARDS, { split: 'one' }, fillWall), 'board');
  ok(/^Egger Oiled Kendal Oak inside and out \(a warm honey oak/.test(o1.says), `one board says inside and out: ${o1.says}`);
  ok(o1.lines.filter((l) => / sheets? /.test(l.label) && !/cutting/i.test(l.label)).length === 1 && /\(throughout\)/.test(o1.lines[0].label), 'one board: one line of sheets');
  ok(boardWork(r, P, { split: 'one', sheets: { out: 9, in: 4 } }).in === 0, 'one board has no second board, whatever was typed');
  const o2 = by(wardrobeOptions(r, P, BOARDS, { split: 'doors', inside: 'W1100 ST9' }, fillWall), 'board');
  ok(/^Egger Oiled Kendal Oak doors \(a warm honey oak to go with your floor\), with Alpine White for the frame and inside\./.test(o2.says), `doors split words: ${o2.says}`);
  ok(o2.lines.some((l) => /Alpine White \(frame and inside\)/.test(l.label)) && o2.lines.some((l) => /Oiled Kendal Oak \(doors\)/.test(l.label)), 'doors split lines name each board’s parts');
  const k = by(wardrobeOptions({ ...r, colours: [{ code: 'K357 PW', why: '' }] }, P, BOARDS, {}, fillWall), 'board');
  ok(/^Kronospan Greige Castello Oak outside, Premium White inside\./.test(k.says), `a Kronospan board says its maker: ${k.says}`);
  // the extras
  const base = by(wardrobeOptions(r, P, BOARDS, {}, fillWall), 'board');
  const sumOf = (o) => o.lines.reduce((n, l) => n + l.amount, 0);
  const holes = by(wardrobeOptions(r, P, BOARDS, { holes: true }, fillWall), 'board');
  ok(Math.abs(sumOf(holes) - sumOf(base) - parts.hinges * 2.394) < 1e-6, 'hinge holes: each hinge at £2.39 (£2.66 less 10%)');
  const fast = by(wardrobeOptions(r, P, BOARDS, { fast: true }, fillWall), 'board');
  ok(Math.abs(sumOf(fast) - sumOf(base) - 50) < 1e-6 && fast.lines.some((l) => /Fast Flow/.test(l.label)), 'Fast Flow adds its price');
  const coll = by(wardrobeOptions(r, P, BOARDS, { delivery: false }, fillWall), 'board');
  ok(Math.abs(sumOf(base) - sumOf(coll) - 60) < 1e-6 && !coll.lines.some((l) => /Delivery/.test(l.label)), 'collected: no delivery');
  const drawers = by(wardrobeOptions(wardrobe([[2400, 2400]], { drawers: 2 }), P, BOARDS, {}, fillWall), 'board');
  ok(drawers.lines.some((l) => l.label === 'Drawer runners, 2 at £25'), 'drawer runners at his price');
  const twice = pricesWith({ labourX: 2 });
  const lx = by(wardrobeOptions(r, twice, BOARDS, {}, fillWall), 'board');
  const mats = lx.lines.filter((l) => !/Labour|Delivery|Fast Flow/.test(l.label)).reduce((n, l) => n + l.amount, 0);
  const lab = lx.lines.find((l) => /^Labour/.test(l.label));
  ok(lab && /2 × the materials/.test(lab.label) && Math.abs(lab.amount - 2 * mats) < 1e-6, `labour as twice the materials: ${lab?.label}`);
  ok(pricesWith({ labourX: 99 }).labourX === 10, 'times the materials kept sensible');
  const dear = pricesWith({ edgeThickM: 3, edgeThinM: 2 });
  ok(Math.abs(sumOf(by(wardrobeOptions(r, dear, BOARDS, {}, fillWall), 'board')) - sumOf(base) - (parts.thickM * (3 - 2.934) + parts.thinM * (2 - 2.934))) < 1e-6, 'his edging prices used');
  // top cupboards: short doors over tall ones, more edging and hinges
  const t = boardParts(sizesOf(r), 3, 0, true);
  ok(t.doors === 8 && t.hinges === 4 * hingesFor(1.9) + 4 * hingesFor(0.35) && t.thickM > parts.thickM, `top cupboards: ${t.doors} doors, ${t.hinges} hinges`);
}

/* his price list keeps only what he changed, so Cworkshop's own prices still reach every quote */
{
  const full = pricesWith({ plainPerM: 1300, boards: { 'U638 ST9': 80 } }, PRICE_BASE);
  const kept = ownPrices(full, PRICE_BASE);
  ok(kept.plainPerM === 1300 && !('cutEdgeSheet' in kept) && !('edgeThinM' in kept) && kept.boards['U638 ST9'] === 80, `only his changes kept: ${Object.keys(kept).join(', ')}`);
  const moved = { ...PRICE_BASE, cutEdgeSheet: 49.5 };
  ok(pricesWith(kept, moved).cutEdgeSheet === 49.5 && pricesWith(kept, moved).plainPerM === 1300, 'a new Cworkshop price reaches his list, his own prices stay');
  ok(pricesWith(ownPrices({ ...full, cutEdgeSheet: 40 }, PRICE_BASE), moved).cutEdgeSheet === 40, 'his own cutting price wins over Cworkshop’s');
}

/* every size: rounded, at least the smallest job, wider never cheaper */
for (let w = 400; w <= 6000; w += 100) {
  const a = wardrobeOptions(wardrobe([[w, 2400]]), P, BOARDS, {}, fillWall);
  const b = wardrobeOptions(wardrobe([[w + 100, 2400]]), P, BOARDS, {}, fillWall);
  for (const x of a) {
    ok(x.price % 50 === 0 && x.price >= 330, `${x.id} at ${w}: rounded and at least £330`);
    ok(by(b, x.id).price >= x.price, `${x.id}: ${w + 100} not cheaper than ${w}`);
  }
  ok(withVat(by(a, 'plain').price) === Math.round(by(a, 'plain').price * 1.2), 'VAT 20%');
}

/* other jobs: Raf's rates, or days and materials */
{
  const r = { ...wardrobe([]), kind: 'other', wardrobe: undefined, other: [
    { name: 'Laminate laying', says: 'Laying your laminate.', how: 'rate', rate: 'laminateM2', qty: 20 },
    { name: 'Small patch', says: 'A small patch.', how: 'rate', rate: 'laminateM2', qty: 2 },
    { name: 'Built-in desk', says: 'A desk.', how: 'build', days: 2, materials: [{ item: 'Birch ply', cost: 300 }] },
    { name: 'Fourth', says: 'x', how: 'build', days: 1 },
  ] };
  const o = otherOptions(r, P);
  ok(o.length === 3, 'at most three other options');
  ok(o[0].price === 800 && /20 m² at £40/.test(o[0].lines[0].label), 'laminate 20 m² at £40');
  ok(o[1].price === 350, 'a tiny job is at least the smallest job, rounded');
  ok(o[2].price === 1600, 'build: 2 days and £300 of materials');
  ok(optionsFor(r, P, BOARDS).length === 3, 'optionsFor picks the other options');
  const door = otherOptions({ ...r, other: [{ name: 'Doors', says: 'x', how: 'rate', rate: 'door', qty: 4 }] }, P);
  ok(door[0].price === 1000 && /4 doors at £250/.test(door[0].lines[0].label), '4 doors at £250');
}

/* cleanRead: Claude's answer made safe */
{
  const c = cleanRead({
    kind: 'wardrobe',
    title: 'Wardrobe — alcove',
    runs: [{ label: 'Left', width_mm: '1,000', height_mm: 2400.4, depth_mm: 600, width_from: 'given', height_from: 'nonsense' }, {}, {}, {}, {}],
    seen: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    questions: ['One?', 'Two?'],
    intro: 'Thanks – lovely room',
    colours: [{ code: 'H3171 ST12', why: 'warm' }, { code: 'NOPE', why: 'x' }],
    inside: 'NOPE',
    recommend: 'teak',
    wardrobe: { units: 2.6, drawers: -1, top_cupboards: true, pax_ok: false, pax_note: 'sloped' },
  });
  ok(c.title === 'Wardrobe, alcove' && c.intro === 'Thanks, lovely room', 'dashes become commas');
  ok(c.runs.length === 4 && c.runs[0].height === 2400 && c.runs[0].heightFrom === 'guess', 'runs trimmed and rounded');
  ok(c.seen.length === 6, 'at most six things seen');
  ok(c.colours.length === 1 && c.colours[0].code === 'H3171 ST12', 'only real board codes');
  ok(c.split === undefined, 'no board split when Claude gives none');
  ok(cleanRead({ kind: 'wardrobe', board_split: 'doors' }).split === 'doors' && cleanRead({ kind: 'wardrobe', board_split: 'half' }).split === undefined, 'Claude’s board split kept when it’s a real one');
  ok(c.inside === '' && c.recommend === 'none', 'bad inside and pick dropped');
  ok(c.wardrobe.units === 3 && c.wardrobe.drawers === 0 && c.wardrobe.top && !c.wardrobe.paxOk && c.wardrobe.paxNote === 'sloped', 'wardrobe facts cleaned');
  ok(cleanRead({ kind: 'other', other_options: [{ name: 'A', how: 'rate', rate: 'nope' }] }).other[0].how === 'build', 'an unknown rate becomes days and materials');
  const x = cleanRead({ kind: 'wardrobe', extra: ' Send   more photos — any time. ', closing: '' });
  ok(x.extra === 'Send more photos, any time.' && x.closing === undefined, 'his extra paragraph cleaned, an empty closing dropped');
  ok(c.extra === undefined && c.closing === undefined, 'no extra or closing unless asked');
}

console.log(`${checks - fails.length} of ${checks} checks pass`);
if (fails.length) {
  console.log(fails.slice(0, 30).join('\n'));
  process.exit(1);
}

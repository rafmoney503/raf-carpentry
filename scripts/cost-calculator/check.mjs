/* Checks the cost calculator's sums (src/lib/cost-calculator.ts) for every job, every option and every size the
   page allows: node scripts/cost-calculator/check.mjs (Node 22.18 or later reads the .ts lib itself)
   Raf's prices are fixed here on purpose: changing a price in the lib without changing it here fails the check,
   so a slip of the keyboard can't change what customers see. */
import { COST_JOBS, MIN_JOB, RANGE_OVER, VAT_RATE, cleanQty, costMessage, estimate, fromPrice, money, qtyWords } from '../../src/lib/cost-calculator.ts';

let checks = 0;
const fails = [];
const ok = (cond, what) => {
  checks++;
  if (!cond) fails.push(what);
};

// Raf's prices, 1 Nov 2026 (before VAT). GUESS ones are marked in the lib.
const RAF = {
  'fitted-wardrobes': { flat: 1200, shaker: 1600 },
  'kitchen-fitting': { small: 1600, standard: 2200, large: 3200 },
  'laminate-flooring': { fit: 40 },
  'loft-boarding': { raised: 120 },
  decking: { composite: 250, softwood: 180 },
  'internal-doors': { hang: 250 },
  'media-wall': { basic: 2800, mid: 5400 },
};

ok(COST_JOBS.length === 7, 'seven jobs');
ok(new Set(COST_JOBS.map((j) => j.slug)).size === COST_JOBS.length, 'slugs are unique');
ok(VAT_RATE === 0.2 && RANGE_OVER === 0.25 && MIN_JOB === 330, 'VAT 20%, range +25%, smallest job £330');

for (const job of COST_JOBS) {
  const want = RAF[job.slug];
  ok(want, `${job.slug}: has Raf's prices in the check`);
  ok(job.options.length === Object.keys(want ?? {}).length, `${job.slug}: same options as the check`);
  for (const o of job.options) ok(want?.[o.id] === o.rate, `${job.slug}/${o.id}: rate ${o.rate} is Raf's ${want?.[o.id]}`);
  ok(job.options.some((o) => o.id === job.def), `${job.slug}: starts on one of its options`);
  ok(/^[a-z-]+$/.test(job.slug), `${job.slug}: slug shape`);
  ok(job.metaTitle.length <= 70 && job.metaDescription.length <= 160, `${job.slug}: title and description lengths`);
  for (const t of [job.lede, job.metaDescription, ...job.inPrice, ...job.notInPrice, ...job.moves, ...job.options.map((o) => o.sub)])
    ok(!/[—–]/.test(t), `${job.slug}: no dashes in "${t}"`);

  // Every size the slider or the box can give, every option.
  const sizes = [];
  if (job.qty) {
    for (let v = job.qty.min; v <= job.qty.max + 1e-9; v += job.qty.step) sizes.push(Number(v.toFixed(1)));
    ok(sizes.includes(job.qty.def), `${job.slug}: the starting size is on the steps`);
  } else sizes.push(1);

  for (const o of job.options) {
    let prev = 0;
    for (const s of sizes) {
      const e = estimate(job, s, o.id);
      const raw = (job.qty ? s : 1) * o.rate;
      const where = `${job.slug}/${o.id} at ${s}`;
      ok(e.qty === s, `${where}: size kept (${e.qty})`);
      ok(e.net[0] >= raw - 5 && e.net[0] >= MIN_JOB, `${where}: never under Raf's price or the smallest job (${e.net[0]} vs ${raw})`);
      ok(Math.abs(e.net[0] - Math.max(raw, MIN_JOB)) <= 5, `${where}: low end is Raf's price (${e.net[0]} vs ${raw})`);
      ok(Math.abs(e.net[1] - e.net[0] * 1.25) <= 5, `${where}: top is 25% over (${e.net[1]})`);
      ok(Math.abs(e.gross[0] - e.net[0] * 1.2) <= 5 && Math.abs(e.gross[1] - e.net[1] * 1.2) <= 5, `${where}: VAT added (${e.gross})`);
      ok(e.net.concat(e.gross).every((v) => v % 10 === 0), `${where}: whole tens`);
      ok(e.minimum === raw < MIN_JOB, `${where}: minimum flag`);
      ok(e.net[0] >= prev, `${where}: bigger never cheaper`);
      prev = e.net[0];
    }
  }
  if (job.qty) {
    ok(cleanQty(job, job.qty.max * 10) === job.qty.max && cleanQty(job, -5) === job.qty.min, `${job.slug}: sizes held to the range`);
    ok(cleanQty(job, Number.NaN) === job.qty.def, `${job.slug}: rubbish gives the starting size`);
  }
  ok(estimate(job, job.qty?.def ?? 1, 'nonsense').rate === job.options.find((o) => o.id === job.def).rate, `${job.slug}: unknown option falls back`);

  const msg = costMessage({ name: 'Sam Lee', job, qty: job.qty?.def ?? 1, optionId: job.def, when: 'In the next 3 months', postcode: 'N22 5SN', notes: 'Back bedroom' });
  const e = estimate(job, job.qty?.def ?? 1, job.def);
  ok(msg.startsWith('Hi Raf, this is Sam Lee. Here is my brief from your website.'), `${job.slug}: brief opening`);
  ok(msg.includes(`What: ${job.what}`), `${job.slug}: What line`);
  ok(msg.includes(`${money(e.gross[0])} to ${money(e.gross[1])} with VAT`), `${job.slug}: price in the brief`);
  ok(!job.qty || msg.includes(`Rough size: ${qtyWords(job, job.qty.def)}`), `${job.slug}: size in the brief`);
  ok(msg.includes('When: In the next 3 months') && msg.endsWith('Notes: Back bedroom'), `${job.slug}: when and notes`);
  ok(!/[—–‘’]/.test(msg), `${job.slug}: brief in plain characters`);
  ok(/^£[\d,]+( a (metre|m²|door))?$/.test(fromPrice(job)), `${job.slug}: from price "${fromPrice(job)}"`);
}

// The examples given to Raf.
const wr = COST_JOBS[0];
ok(estimate(wr, 2.4, 'flat').net.join() === '2880,3600', 'a 2.4 m flat wardrobe: £2,880 to £3,600 before VAT');
ok(estimate(wr, 2.4, 'flat').gross.join() === '3460,4320', 'and £3,460 to £4,320 with VAT');
ok(fromPrice(wr) === '£1,440 a metre', 'wardrobes from £1,440 a metre with VAT');
ok(estimate(COST_JOBS[2], 5, 'fit').minimum && estimate(COST_JOBS[2], 5, 'fit').net[0] === 330, '5 m² of laminate is the smallest job, £330');

console.log(`${checks} checks, ${fails.length} failed`);
if (fails.length) {
  console.log(fails.slice(0, 30).join('\n'));
  process.exit(1);
}

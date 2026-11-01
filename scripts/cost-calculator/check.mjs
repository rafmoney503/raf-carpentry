/* Checks the cost calculator's sums (src/lib/cost-calculator.ts) for every job, every option and every size the
   page allows, including the ones switched off (ALL_COST_JOBS), and what's on the site (COST_LIVE, COST_LINK):
   node scripts/cost-calculator/check.mjs (Node 22.18 or later reads the .ts lib itself)
   Raf's prices are fixed here on purpose: changing a price in the lib without changing it here fails the check,
   so a slip of the keyboard can't change what customers see. */
import { ALL_COST_JOBS, COST_JOBS, COST_LIVE, MIN_JOB, RANGE_OVER, VAT_RATE, cleanQty, costBriefHref, costJob, estimate, fromPrice } from '../../src/lib/cost-calculator.ts';
import { COST_LINK } from '../../src/lib/cost-link.ts';

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

ok(ALL_COST_JOBS.length === 7, 'seven jobs');
ok(new Set(ALL_COST_JOBS.map((j) => j.slug)).size === ALL_COST_JOBS.length, 'slugs are unique');
ok(VAT_RATE === 0.2 && RANGE_OVER === 0.25 && MIN_JOB === 330, 'VAT 20%, range +25%, smallest job £330');

for (const job of [...ALL_COST_JOBS, ...COST_JOBS]) {
  const want = RAF[job.slug];
  ok(want, `${job.slug}: has Raf's prices in the check`);
  ok(job.options.length === Object.keys(want ?? {}).length || COST_JOBS.includes(job), `${job.slug}: same options as the check`);
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

  const href = costBriefHref(job, job.qty?.def ?? 1);
  ok(href.startsWith('/how-it-works') && href.endsWith('#brief'), `${job.slug}: Get a quote opens the brief (${href})`);
  ok(job.unit !== 'metre' || href.includes(`w=${Math.round((job.qty?.def ?? 0) * 1000)}`), `${job.slug}: the width goes with it in mm`);
  ok(/^£[\d,]+( a (metre|m²|door))?$/.test(fromPrice(job)), `${job.slug}: from price "${fromPrice(job)}"`);
}

// What's on the site (Raf, 1 Nov 2026: basic MDF wardrobes at £1,200 a metre only, the rest hidden).
for (const [slug, ids] of Object.entries(COST_LIVE)) {
  const all = ALL_COST_JOBS.find((j) => j.slug === slug);
  ok(all, `live ${slug}: is a job`);
  ok(ids.length && ids.every((id) => all?.options.some((o) => o.id === id)), `live ${slug}: its options are real (${ids})`);
}
ok(COST_JOBS.map((j) => j.slug).join() === 'fitted-wardrobes', `only wardrobes on (${COST_JOBS.map((j) => j.slug)})`);
const live = costJob('fitted-wardrobes');
ok(live?.options.length === 1 && live.options[0].id === 'flat' && live.options[0].rate === 1200 && live.def === 'flat', 'wardrobes: basic MDF at £1,200 a metre only');
ok(live?.options[0].label === 'Basic MDF', 'wardrobes: the option is called Basic MDF');
ok(['kitchen-fitting', 'laminate-flooring', 'loft-boarding', 'decking', 'internal-doors', 'media-wall'].every((s) => !costJob(s)), 'the other six have no page');
ok(ALL_COST_JOBS[0].options.length === 2, 'shaker kept, just switched off');
ok(COST_LINK.href === (COST_JOBS.length === 1 ? `/cost/${COST_JOBS[0].slug}` : '/cost'), `menu link ${COST_LINK.href} agrees with COST_LIVE`);
ok(COST_JOBS.length === 1 || COST_LINK.label === 'Cost calculator', 'menu link label with more than one job on');
{
  ok(costBriefHref(live, 2.4) === '/how-it-works?wardrobe=mto&w=2400#brief', `wardrobe Get a quote: ${costBriefHref(live, 2.4)}`);
  ok(costBriefHref(live, 40) === '/how-it-works?wardrobe=mto&w=6000#brief', 'a width past the range goes as 6000');
  ok(costBriefHref(live, 1.25).includes('w=1300') || costBriefHref(live, 1.25).includes('w=1200'), 'a width between tenths snaps to one');
  ok(fromPrice(live) === '£1,440 a metre', 'live wardrobes from £1,440 a metre with VAT');
}

// The examples given to Raf.
const wr = ALL_COST_JOBS[0];
ok(estimate(wr, 2.4, 'flat').net.join() === '2880,3600', 'a 2.4 m flat wardrobe: £2,880 to £3,600 before VAT');
ok(estimate(wr, 2.4, 'flat').gross.join() === '3460,4320', 'and £3,460 to £4,320 with VAT');
ok(fromPrice(wr) === '£1,440 a metre', 'wardrobes from £1,440 a metre with VAT');
ok(estimate(ALL_COST_JOBS[2], 5, 'fit').minimum && estimate(ALL_COST_JOBS[2], 5, 'fit').net[0] === 330, '5 m² of laminate is the smallest job, £330');

console.log(`${checks} checks, ${fails.length} failed`);
if (fails.length) {
  console.log(fails.slice(0, 30).join('\n'));
  process.exit(1);
}

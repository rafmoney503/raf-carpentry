/* npm run check: the Ads section's sums (src/lib/adsums.ts) on a made-up ad account. */
import type { AdRow, AdsReport } from '../src/lib/ads-types';
import { adSums, bestAd, draftGroups, money, oursOf, statusWords } from '../src/lib/adsums';

let pass = 0;
let fail = 0;
function ok(c: boolean, m: string) {
  if (c) pass++;
  else {
    fail++;
    console.log('FAIL', m);
  }
}

const ad = (id: string, business: AdRow['business'], spend: number, clicks: number, impressions: number, reach: number, more: Partial<AdRow> = {}): AdRow => ({
  id,
  name: id,
  status: 'ACTIVE',
  account: 'Me',
  campaignId: 'c',
  campaign: 'C',
  business,
  spend,
  clicks,
  impressions,
  reach,
  result: null,
  ...more,
});
const ourDay = (day: string, rafPaid: number, rafEnq: number, cosPaid: number, cosSu: number) => ({
  day,
  raf: { paid: rafPaid, paidEnq: rafEnq, paidFb: rafPaid, paidIg: 0, meta: 1, metaEnq: 0 },
  cos: { paid: cosPaid, paidFb: cosPaid, paidIg: 0, meta: 2, paidSignups: cosSu, metaSignups: 1 },
});
const r: AdsReport = {
  v: 1,
  state: 'ok',
  at: 0,
  days: 7,
  since: '2026-11-09',
  until: '2026-11-15',
  canWrite: true,
  meta: {
    accounts: [{ id: 'act_1', name: 'Me', currency: 'GBP', status: 1, active: true, spentAll: 100 }],
    currency: 'GBP',
    totals: { spend: 62.4, impressions: 9100, reach: 5200, clicks: 148 },
    before: { spend: 20, clicks: 30 },
    places: [],
    days: [
      { day: '2026-11-10', ad: 'a1', spend: 10, impressions: 1000, clicks: 30 },
      { day: '2026-11-10', ad: 'a2', spend: 5, impressions: 900, clicks: 9 },
      { day: '2026-11-15', ad: 'a1', spend: 20.2, impressions: 3000, clicks: 50 },
      { day: '2026-10-01', ad: 'a1', spend: 99, impressions: 1, clicks: 1 }, // outside the period: left out
    ],
    campaigns: [],
    ads: [
      ad('a1', 'raf', 30.2, 80, 4000, 2600, { result: { kind: 'landing', n: 60 } }),
      ad('a2', 'cabinetos', 25, 50, 3800, 2400, { status: 'PAUSED', result: { kind: 'signup', n: 2 } }),
      ad('a3', 'raf', 7.2, 18, 1300, 900),
      ad('a4', null, 0.5, 0, 40, 30),
    ],
  },
  ours: [ourDay('2026-11-10', 6, 1, 3, 1), ourDay('2026-11-15', 9, 2, 4, 1)],
  drafts: [
    { id: 'aaaaaaaa', business: 'raf', status: 'new', at: 3, photo: { src: '/x.jpg', alt: '' }, headline: 'h', text: 't', description: '', cta: 'LEARN_MORE', page: '', params: '', audience: { where: '', ages: '', interests: [] }, angle: '' },
    { id: 'bbbbbbbb', business: 'raf', status: 'approved', at: 2, photo: { src: '/y.jpg', alt: '' }, headline: 'h', text: 't', description: '', cta: 'LEARN_MORE', page: '', params: '', audience: { where: '', ages: '', interests: [] }, angle: '', live: { ad: 'a1', name: 'a1', status: 'ACTIVE', spend: 30.2, clicks: 80 } },
    { id: 'cccccccc', business: 'cabinetos', status: 'no', at: 1, photo: { src: '/z.jpg', alt: '' }, headline: 'h', text: 't', description: '', cta: 'LEARN_MORE', page: '', params: '', audience: { where: '', ages: '', interests: [] }, angle: '' },
    { id: 'dddddddd', business: 'cabinetos', status: 'approved', at: 0, photo: { src: '/w.jpg', alt: '' }, headline: 'h', text: 't', description: '', cta: 'LEARN_MORE', page: '', params: '', audience: { where: '', ages: '', interests: [] }, angle: '' },
  ],
};

const both = adSums(r, 'both');
ok(both.spend === 62.9, `both spend ${both.spend}`);
ok(both.clicks === 148 && both.reach === 5200 && !both.reachAdded, 'both: clicks, the account reach');
ok(both.cpc === 0.43, `both cpc ${both.cpc}`);
ok(both.ctr === 1.62, `both ctr ${both.ctr}`);
ok(both.perEnquiry === 12.47, `per enquiry ${both.perEnquiry}`); // (30.2 + 7.2) / 3
ok(both.perSignup === 12.5, `per sign-up ${both.perSignup}`); // 25 / 2
ok(both.days.length === 7 && both.days[1].spend === 15 && both.days[6].spend === 20.2 && both.days[1].enquiries === 1 && both.days[1].signups === 1, 'both: days');
ok(both.meta?.kind === 'signup' && both.meta.n === 2, 'Meta counts sign-ups before landing page views');
ok(both.live.length === 3, 'running ads');
ok(both.best?.ad.id === 'a2' && both.best.why === '£12.50 a sign-up', `best ${both.best?.ad.id} ${both.best?.why}`);
ok(both.before?.spend === 20, 'before only for both');

const raf = adSums(r, 'raf');
ok(raf.spend === 37.4 && raf.clicks === 98 && raf.reach === 3500 && raf.reachAdded, 'raf: spend, clicks, reach added up');
ok(raf.perSignup === null && raf.perEnquiry === 12.47, 'raf: enquiries only');
ok(raf.days[1].spend === 10 && raf.days[1].signups === 0, 'raf: only its ads a day');
ok(raf.best?.ad.id === 'a1' && raf.best.why === '£0.38 a click, 2% of people who saw it clicked', `raf best on clicks: ${raf.best?.ad.id} ${raf.best?.why}`);
ok(raf.places === null && raf.before === null, 'raf: no account-wide figures');
const cos = adSums(r, 'cabinetos');
ok(cos.spend === 25 && cos.perSignup === 12.5 && cos.perEnquiry === null, 'cabinetos');

const o = oursOf(r.ours, 'both')!;
ok(o.visits === 22 && o.enquiries === 3 && o.signups === 2 && o.untagged === 6 && o.untaggedSignups === 2, `ours ${JSON.stringify(o)}`);
ok(oursOf(null, 'both') === null, 'no counters');

// no result, no money spent, a lone tiny ad: no best
ok(bestAd([ad('x', 'raf', 0.5, 3, 100, 90)]) === null, 'under £1: not judged');
ok(bestAd([ad('x', 'raf', 5, 0, 100, 90)]) === null, 'no clicks: not judged');

const g = draftGroups(r.drafts, 'both');
ok(g.live.map((d) => d.id).join() === 'bbbbbbbb' && g.waiting.map((d) => d.id).join() === 'aaaaaaaa' && g.approved.map((d) => d.id).join() === 'dddddddd' && g.no.map((d) => d.id).join() === 'cccccccc', 'draft groups');
ok(draftGroups(r.drafts, 'cabinetos').waiting.length === 0 && draftGroups(r.drafts, 'cabinetos').approved.length === 1, 'drafts for one business');

ok(money(62.4) === '£62.40' && money(1200) === '£1,200' && money(5) === '£5' && money(0.425) === '£0.43' && money(3, 'EUR') === '€3', 'money');
ok(statusWords('ACTIVE').on && statusWords('DISAPPROVED').bad && statusWords('CAMPAIGN_PAUSED').text === 'Campaign paused', 'status words');

// an empty report: nothing breaks, nothing divided by nought
const empty = adSums({ ...r, state: 'no-permission', meta: null, ours: null }, 'both');
ok(empty.spend === 0 && empty.cpc === null && empty.perEnquiry === null && empty.best === null && empty.days.length === 7, 'no Meta, no counters');

console.log(`ads: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);

/* npm run check: the day sums and the "worth knowing" rules on made-up numbers. */
import { cleanNotes, morningLine, summarise, type AsRaw } from '../src/lib/assistant';
import { buildInsights, morningSummary } from '../src/lib/insights';
import { addDays, londonDay, londonMidnight, rangeText } from '../src/lib/time';
import type { DayPoint, Leads, SiteStats } from '../src/lib/types';

let pass = 0;
let fail = 0;
function ok(c: boolean, m: string) {
  if (c) pass++;
  else {
    fail++;
    console.log('FAIL', m);
  }
}

ok(londonMidnight('2026-11-11').toISOString() === '2026-11-11T00:00:00.000Z', 'GMT midnight');
ok(londonMidnight('2026-07-01').toISOString() === '2026-06-30T23:00:00.000Z', 'BST midnight');
ok(londonDay(new Date('2026-07-01T23:30:00Z')) === '2026-07-02', 'BST day after 23:00 UTC');
ok(addDays('2026-11-01', -1) === '2026-10-31', 'addDays across a month');
ok(rangeText('2026-11-04', '2026-11-10') === '4 to 10 November', 'range one month');
ok(rangeText('2026-10-29', '2026-11-04') === '29 October to 4 November', 'range two months');

const today = '2026-11-11';
function days(values: number[]): DayPoint[] {
  return values.map((v, i) => ({ day: addDays(today, i - values.length + 1), visitors: v, views: v * 3 }));
}
function site(key: string, values: number[], more: Partial<SiteStats> = {}): SiteStats {
  const d = days(values);
  const week = d.slice(20, 27).reduce((a, x) => a + x.visitors, 0);
  const lastWeek = d.slice(13, 20).reduce((a, x) => a + x.visitors, 0);
  return {
    key, name: key, sub: key, url: 'https://x', initial: 'X', color: '#2547d0', ink: '#fff', light: '#7d97ff', vercelName: key,
    status: 'ok', days: d, today: values[27], yesterday: values[26], yesterdayByNow: null, week, lastWeek, weekViews: week * 3,
    homeOnly: null, sources: [], pages: [], countries: [], devices: [], extras: [], deploy: null, up: { ok: true, status: 200, ms: 50 },
    ...more,
  };
}

const flat = site('flat', Array(28).fill(25));
ok(buildInsights([flat], null, today).length === 0, 'flat site: nothing worth knowing');

const spikeVals = Array(28).fill(25);
spikeVals[20] = 96; // 4 Nov, in the last 7 days
const spiky = site('spiky', spikeVals);
const ins = buildInsights([spiky], null, today);
const spike = ins.find((i) => i.id === 'spike:spiky:2026-11-04');
ok(Boolean(spike), 'spike found on 4 Nov');
ok(Boolean(spike?.body.includes('about 4 times a normal day')), 'spike times: ' + spike?.body);
ok(Boolean(spike?.body.includes('the same as the week before')), 'spike adjusted to same: ' + spike?.body);
ok(!ins.some((i) => i.id.startsWith('change:')), 'a spike explains the change, no change card');

const up = site('up', [...Array(20).fill(20), ...Array(8).fill(40)]);
const upIns = buildInsights([up], null, today);
ok(upIns.some((i) => i.id.startsWith('change:up:') && i.title.includes('up 100%')), 'week up 100%');

const src = site('src', Array(28).fill(25), { sources: [{ key: 'google-classroom', name: 'Google Classroom', visitors: 6, isNew: true }, { key: 'x', name: 'X', visitors: 2, isNew: true }] });
const srcIns = buildInsights([src], null, today);
ok(srcIns.some((i) => i.title === 'A teacher shared src'), 'classroom card');
ok(!srcIns.some((i) => i.title.includes('A new way in: X')), 'two people is not enough');

const home = site('home', Array(28).fill(7), { homeOnly: 43 });
home.week = 49;
ok(buildInsights([home], null, today).some((i) => i.id.startsWith('home:home:')), 'home-only card');

const off = { ...site('off', Array(28).fill(0)), status: 'not-counting' as const };
const down = site('down', Array(28).fill(25), { up: { ok: false, status: 503, ms: 100 } });
const mix = buildInsights([down, off], null, today);
ok(mix[0].id.startsWith('down:down:'), 'down first');
ok(mix[mix.length - 1].id === 'setup:counting:off', 'setup last');

const leads: Leads = {
  rafsite: [{ goal: 'quote', label: 'Get a quote', short: 'quote taps', week: 12, last: 4, today: 1, people: 10 }],
  rafsiteDays: [{ day: addDays(today, -1), taps: 3 }],
  cabinetos: { signupsWeek: 3, signupsLast: 3, signupsToday: 0, signupsYesterday: 1, signupsDays: [], accounts: 40, paying: [], payingTotal: 1, sketchupWeek: [] },
};
const li = buildInsights([flat], leads, today);
ok(li.some((i) => i.id === `signup:${addDays(today, -1)}`), 'sign-up yesterday card');
ok(li.some((i) => i.id.startsWith('quote:') && i.title.includes('up: 12 against 4')), 'quote taps up');

const m = morningSummary([site('a', Array(28).fill(10)), site('b', Array(28).fill(5)), off], leads, today);
ok(m.title === 'Yesterday: 15 visitors across 2 sites', 'morning title: ' + m.title);
ok(m.body.includes('a 10 · b 5') && m.body.includes('3 taps to get in touch') && m.body.includes('1 new CabinetOS account'), 'morning body: ' + m.body);

// Tell us on Build It in 3D: a card while there are new messages, a new one when another comes in, a morning line.
const msgs = { unread: 2, newest: 41, yesterday: 1, week: 3 };
const ti = buildInsights([flat], null, today, msgs);
ok(ti.some((i) => i.id === 'tellus:41' && i.title === '2 new messages on Build It in 3D' && i.action?.href === '/messages'), 'Tell us card');
ok(!buildInsights([flat], null, today, { ...msgs, unread: 0 }).some((i) => i.id.startsWith('tellus:')), 'no Tell us card once read');
ok(buildInsights([flat], null, today, { ...msgs, newest: 42 }).some((i) => i.id === 'tellus:42'), 'a new message makes a new card');
const tm = morningSummary([site('a', Array(28).fill(10))], null, today, msgs);
ok(tm.body.includes('1 message on Build It in 3D'), 'morning line for messages: ' + tm.body);

// The Job Kit assistant
{
  const now = Date.parse('2026-11-12T18:00:00Z');
  const day0 = londonMidnight('2026-11-12').getTime();
  const h = (x: number) => now - x * 3600e3;
  const raw: AsRaw = {
    items: [
      { id: 'job:a', kind: 'enquiry', at: h(2), data: { kind: 'enquiry', job: 'a', name: 'Sarah Jones', area: 'N8', what: 'Fitted wardrobe', source: 'email', made: { photos: 2 }, quote: { state: 'ready', from: 1900, options: 4 }, drawings: { code: 'x', state: 'ready', options: 3 } } },
      { id: 'job:b', kind: 'enquiry', at: h(20), data: { kind: 'enquiry', job: 'b', name: 'Dan Price', area: 'N8', what: 'Kitchen fitting', source: 'servicem8', quote: { state: 'ready', from: 2200, options: 1 }, drawings: { skipped: 'not-furniture' } } },
      { id: 'job:c', kind: 'enquiry', at: h(30), data: { kind: 'enquiry', job: 'c', name: 'Amelia Brown', source: 'website', quote: { state: 'failed', error: 'out of Claude credit' } } },
      { id: 'job:d', kind: 'enquiry', at: h(24 * 5), data: { kind: 'enquiry', job: 'd', name: 'Old One', quote: { state: 'ready', from: 900 } } },
      { id: 'mail:m', kind: 'mail', at: h(3), data: { kind: 'mail', from: 'Bark', read: 'platform' } },
      { id: 'mail:n', kind: 'mail', at: h(3), data: { kind: 'mail', from: 'Tom', read: 'maybe' } },
    ],
    run: { last: { at: h(0.2), problems: [] } },
    runs: [{ at: h(0.2), made: 1, quotes: 3, drawings: 1 }, { at: h(24 * 9), made: 5 }],
    settings: {},
    support: [
      { key: 'mail:1', who: 'Natalia', at: new Date(h(1)).toISOString(), kind: 'how_to', summary: 'wants drawers in the corner unit', urgent: false },
      { key: 'mail:2', who: 'Jo', at: new Date(h(22)).toISOString(), kind: 'bug', summary: 'export does nothing', urgent: true },
      { key: 'mail:3', who: 'Old', at: new Date(h(24 * 4)).toISOString(), kind: 'bug', summary: 'old', urgent: false },
    ],
    now,
  };
  const a = summarise(raw, now, day0)!;
  ok(a.support.length === 2 && a.support[0].who === 'Natalia' && a.support[0].kind === 'Needs help' && a.support[1].urgent, 'support emails of the last 3 days, newest first, with their kind');
  ok(a.yesterday.support === 1, 'one support email yesterday');
  ok(a.recent.length === 3 && a.recent[0].name === 'Sarah Jones', 'three enquiries in the last 3 days, newest first');
  ok(a.recent[0].lines.join(' · ') === 'Job made from their email with 2 photos · Rough quote from £1,900 + VAT (4 options) · 3 quick drawings ready', 'Sarah’s lines: ' + a.recent[0].lines.join(' · '));
  ok(a.recent[1].lines.join(' · ') === 'Rough quote from £2,200 + VAT' && a.recent[1].source === 'in ServiceM8', 'Dan: a quote, no drawings');
  ok(a.recent[2].needs === 'Work out the quote yourself' && /out of Claude credit/.test(a.recent[2].lines[0]), 'Amelia: no quote');
  ok(a.mails.leads === 1 && a.mails.maybe === 1, 'emails left for Raf');
  ok(a.week === 'Last 7 days: 4 enquiries, 1 job made from emails, 3 rough quotes, 1 drawing.', 'the week: ' + a.week);
  ok(a.yesterday.enquiries === 2 && a.yesterday.quotes === 1, 'yesterday: Dan and Amelia, Dan’s quote ready');
  ok(morningLine(a) === '2 new enquiries, 1 rough quote ready · 1 email to CabinetOS support', 'morning line: ' + morningLine(a));
  ok(morningLine({ ...a, yesterday: { enquiries: 1, quotes: 0, support: 0 } }) === '1 new enquiry', 'morning line, one');
  ok(morningLine({ ...a, yesterday: { enquiries: 2, quotes: 2, support: 0 } }) === '2 new enquiries, 2 rough quotes ready', 'morning line with quotes');
  ok(morningLine({ ...a, yesterday: { enquiries: 0, quotes: 0, support: 3 } }) === '3 emails to CabinetOS support', 'morning line, support only');
  const ma = morningSummary([site('a', Array(28).fill(10))], null, today, null, { ...a, yesterday: { enquiries: 2, quotes: 1, support: 0 } });
  ok(ma.body.includes('2 new enquiries, 1 rough quote ready'), 'in the morning summary: ' + ma.body);
  ok(summarise(null, now, day0) === null, 'nothing before the function exists');
  ok(summarise({ items: [], run: {}, runs: [], settings: { paused: true }, now } as AsRaw, now, day0)!.paused, 'paused');
  ok(JSON.stringify(cleanNotes({ notes: [{ title: 'New enquiry: Sarah', body: 'x', tag: 'assistant-1' }] })) === JSON.stringify([{ title: 'New enquiry: Sarah', body: 'x', tag: 'assistant-1' }]), 'a buzz');
  ok(cleanNotes({ notes: [] }) === null && cleanNotes({}) === null && cleanNotes({ notes: [{ title: '' }] }) === null && cleanNotes({ notes: [{ title: 'x'.repeat(200) }] }) === null, 'bad buzzes refused');
  ok(cleanNotes({ notes: [{ title: 'a', tag: '<script>' }] })![0].tag === 'assistant', 'odd tag replaced');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

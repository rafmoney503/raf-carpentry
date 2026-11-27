'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SOURCE_LABEL } from '@/lib/site-stats';
import { buyerMoney, countryName, feeOf, guideTitle, incomeOf, isUK, periods, pounds, saleLink, unseen, vatIn, type GuideSale, type Income } from '@/lib/guide-income';
import type { TodayLine } from './current';
import { label } from './parts';
import { post } from './sm8-post';
import { readPin } from './uploader';
import { EtsyBox } from './etsy';

/* Guide sales (Raf, 19 Nov 2026: 'Someone bought Ikea pax guide today morning. Yay. Can I get confirmation in jobkit
   about the sale and income'). Each guide sold on the website (rafsite.guide_sales, recorded by Stripe's webhook in
   src/lib/guide-sales.ts) with what it brought in: what the buyer paid, the VAT in it, Stripe's fee, what's left and
   what Stripe pays into the bank (sums in src/lib/guide-income.ts). A To do line for each sale until Raf opens the
   screen; seen is kept in the store, so the phone and the computer agree. On this device: the last answer
   (raf_jobkit_sales), so Today shows it with no signal. Server: /api/job-kit/sales (behind the PIN).
   Who bought it (Raf, 19 Nov 2026 afternoon: 'Can I be notified about this in jobkit and amount paid and who'): the
   buyer's name and email as they gave them at Stripe, on the To do line, the New sale box and each sale.
   Each sale has the buyer's own download link (Raf, 19 Nov 2026: 'can we have a link for download in jobkit for
   each sale in case someone missed the download so we can share a link'): Copy it, send it on WhatsApp, or email it
   to them again from info@. */

const KEY = 'raf_jobkit_sales';
const EVENT = 'jk-sales';
const API = '/api/job-kit/sales';
const FRESH = 3 * 60_000;
export const STRIPE_PAYMENTS = 'https://dashboard.stripe.com/payments';
const SHORT: Record<string, string> = { 'pax-guide': 'IKEA PAX guide' };
const shortTitle = (p: string) => SHORT[p] ?? guideTitle(p);

export type SalesState = { all: number; pence: number; sales: GuideSale[]; fetchedAt: number; error?: string };

const problem = (e?: string) =>
  e === 'offline' ? 'No signal just now.' : e === 'wrong-pin' ? 'Wrong PIN: check it in Settings.' : e === 'no-pin' ? 'Add your PIN in Settings first.' : e === 'sales-not-set-up' ? 'The sales list isn’t set up here.' : 'The sales list isn’t answering just now.';

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  const yday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  const day = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  if (day === today) return `Today, ${time}`;
  if (day === yday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}, ${time}`;
};
const shortDay = (iso: string) => {
  const w = when(iso);
  return w.split(',')[0];
};
const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ---------- kept on the device, shared by Today and the screen ---------- */

let cache: { raw: string | null; val: SalesState | null } = { raw: null, val: null };
function snapshot(): SalesState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* no storage */
  }
  if (raw !== cache.raw) {
    let val: SalesState | null = null;
    try {
      val = raw ? (JSON.parse(raw) as SalesState) : null;
    } catch {
      val = null;
    }
    cache = { raw, val };
  }
  return cache.val;
}
function keep(s: SalesState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* full or blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
};
export const useSales = () => useSyncExternalStore(subscribe, snapshot, () => null);

let asking: Promise<void> | null = null;
/* Asks the store (at most every 3 minutes unless forced); an error keeps what was there. */
export function fetchSales(force = false): Promise<void> {
  const cur = snapshot();
  if (!force && cur && Date.now() - cur.fetchedAt < FRESH && !cur.error) return Promise.resolve();
  if (asking) return asking;
  const pin = readPin();
  if (!pin) return Promise.resolve();
  asking = (async () => {
    const r = await post<{ all: number; pence: number; sales: GuideSale[] }>(pin, { action: 'list' }, API);
    if (!r.ok) {
      keep(cur ? { ...cur, error: r.error } : { all: 0, pence: 0, sales: [], fetchedAt: 0, error: r.error });
      return;
    }
    keep({ all: Number(r.data.all) || 0, pence: Number(r.data.pence) || 0, sales: Array.isArray(r.data.sales) ? r.data.sales : [], fetchedAt: Date.now() });
  })().finally(() => {
    asking = null;
  });
  return asking;
}

/* On Today: ask when it opens and when the app comes back to the screen. */
export function useSalesRefresh(pin: string) {
  useEffect(() => {
    if (!pin) return;
    void fetchSales();
    const back = () => {
      if (document.visibilityState === 'visible') void fetchSales();
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [pin]);
}

/* Raf has seen them: in the store first (so the other device's To do clears too), then here. */
async function markSeen(upto: string) {
  const r = await post(readPin(), { action: 'seen', upto }, API);
  if (!r.ok) return;
  const cur = snapshot();
  if (cur) keep({ ...cur, sales: cur.sales.map((s) => (!s.seen && s.at <= upto ? { ...s, seen: new Date().toISOString() } : s)) });
}

/* A first name as it should read ('ana' typed in lower case reads Ana), and a country after 'in'. */
const cap = (n: string | null) => (n ? n[0].toUpperCase() + n.slice(1) : '');
const THE: Record<string, string> = { GB: 'the UK', US: 'the United States', NL: 'the Netherlands', AE: 'the United Arab Emirates', PH: 'the Philippines', CZ: 'the Czech Republic' };
const inPlace = (c: string) => THE[c.toUpperCase()] ?? countryName(c);

/* ---------- what it means, for Today ---------- */

/* How they found the page, from the Buy button (sales since 19 Nov 2026; the first one was put in by hand). */
const firstPage = (p: string) =>
  p === '/' ? 'the home page' : p === '/pax-guide' ? 'the guide’s own page' : p.startsWith('/blog/') ? `the post “${p.slice(6).replace(/-/g, ' ')}”` : p;
function fromLine(x: GuideSale) {
  if (!x.source) return '';
  const how =
    x.source === 'direct'
      ? 'No link trail (typed in, or tapped in an app that hides it, like Instagram or WhatsApp)'
      : x.source === 'internal'
        ? 'From another page of the site'
        : `From ${SOURCE_LABEL[x.source] ?? x.source}`;
  return x.landing ? `${how} · first page: ${firstPage(x.landing)}` : how;
}

const place = (s: GuideSale) => (s.country && !isUK(s.country) ? countryName(s.country) : '');
/* Who bought it: their name as typed at Stripe ('reina biey' reads Reina Biey), else the first name. */
const tidyName = (n: string) => n.trim().replace(/\s+/g, ' ').replace(/(^|[\s'-])(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase());
export const whoOf = (s: GuideSale) => (s.name?.trim() ? (s.name === s.name.toLowerCase() || s.name === s.name.toUpperCase() ? tidyName(s.name.toLowerCase()) : s.name.trim().replace(/\s+/g, ' ')) : cap(s.first));
const who = (s: GuideSale) => [whoOf(s), place(s)].filter(Boolean).join(', ');

export function salesTodayLines(s: SalesState | null): TodayLine[] {
  const fresh = unseen(s?.sales ?? []);
  if (!fresh.length) return [];
  if (fresh.length > 2) {
    const inc = incomeOf(fresh);
    return [{ text: `${fresh.length} guide sales: ${pounds(inc.paid)} in`, go: 'sales', icon: 'money', urgent: true }];
  }
  return fresh.map((x) => ({ text: `Sold: ${shortTitle(x.product)} · ${pounds(x.amount ?? 0)}${who(x) ? ` · ${who(x)}` : ''}`, go: 'sales', id: x.key, icon: 'money', urgent: true }));
}

export function salesLine(s: SalesState | null): string {
  if (!s || (!s.fetchedAt && s.error)) return s?.error === 'no-pin' ? 'Add your PIN to see them' : 'The IKEA PAX guide sold on the website, and what it brings in';
  if (!s.sales.length) return 'None sold yet';
  const fresh = unseen(s.sales);
  const all = incomeOf(s.sales);
  const head = fresh.length ? `${fresh.length} new · ` : '';
  return `${head}${all.count} sold · ${pounds(all.paid)} in · last ${shortDay(s.sales[0].at)}`;
}

export const salesNewCount = (s: SalesState | null) => unseen(s?.sales ?? []).length;

/* ---------- one sale's download link: copy, WhatsApp, or email it again ---------- */

const resendProblem = (e?: string) =>
  e === 'too-soon' ? 'Just sent: wait a minute before sending it again.' : e === 'no-email' ? 'Stripe gave no email for this one: copy the link or send it on WhatsApp.' : e === 'sale-gone' ? 'That sale isn’t in the list any more.' : e === 'outlook-not-set-up' ? 'Email from info@ isn’t set up here.' : e === 'offline' ? 'No signal just now.' : 'The email didn’t go: try again in a minute.';

function opened(x: GuideSale): string {
  if (!x.downloads) return 'Not downloaded yet';
  const times = (x.downloadTimes ?? []).slice(-4).map(when);
  const n = `Downloaded ${x.downloads} time${x.downloads === 1 ? '' : 's'}`;
  if (times.length > 1) return `${n}: ${times.join(' · ')}`;
  return x.lastDownload ? `${n} · last ${when(x.lastDownload)}` : n;
}

function SaleLink({ x }: { x: GuideSale }) {
  const [copied, setCopied] = useState(false);
  const [arm, setArm] = useState(false);
  const [send, setSend] = useState<{ state: 'sending' | 'done' | 'failed'; at?: string; error?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  if (!x.session) return null;
  const link = saleLink(typeof window === 'undefined' ? 'https://www.rafcarpentry.com' : window.location.origin, x);
  const first = (whoOf(x) || '').split(' ')[0];
  const msg = `${first ? `Hi ${first}, h` : 'H'}ere's your ${guideTitle(x.product)} guide again: ${link}\nTap "Download the guide (PDF)" on that page. On a phone, open the PDF and save it to Files or Books so it's always there.\nRaf`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const t = document.createElement('textarea');
      t.value = link;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const resend = async () => {
    if (!arm) {
      setArm(true);
      timer.current = setTimeout(() => setArm(false), 5000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setArm(false);
    setSend({ state: 'sending' });
    const r = await post<{ ok?: boolean; at?: string }>(readPin(), { action: 'resend', session: x.session }, API);
    if (r.ok && r.data.ok) {
      setSend({ state: 'done', at: r.data.at ?? new Date().toISOString() });
      const cur = snapshot();
      if (cur) keep({ ...cur, sales: cur.sales.map((s) => (s.key === x.key ? { ...s, emailed: true, emailedAt: r.data.at ?? new Date().toISOString() } : s)) });
    } else setSend({ state: 'failed', error: r.ok ? 'error' : r.error });
  };
  const btn = 'inline-flex h-10 items-center rounded-sm border border-line-strong bg-paper px-3 text-[14px] font-semibold';
  return (
    <div data-sale-link className="mt-2">
      <p className="text-[13.5px] text-muted">
        Their download link{x.downloads >= 30 ? ' (all 30 downloads used)' : `, ${30 - x.downloads} downloads left`}:
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={btn} data-sale-copy>
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className={btn} data-sale-wa>
          Send on WhatsApp
        </a>
        <button type="button" onClick={resend} disabled={send?.state === 'sending'} className={`${btn} ${arm ? 'border-ink bg-ink text-paper' : ''}`} data-sale-resend>
          {send?.state === 'sending' ? 'Sending…' : arm ? `Tap again to email ${first || 'them'}` : 'Email it again'}
        </button>
      </div>
      {send?.state === 'done' ? (
        <p role="status" className="mt-1.5 text-[13.5px]" data-sale-resent>
          ✓ Emailed again from info@ at {clock(Date.parse(send.at ?? ''))}{x.email ? ` to ${x.email}` : ', to the address they paid with'}.
        </p>
      ) : send?.state === 'failed' ? (
        <p role="status" className="mt-1.5 text-[13.5px] text-muted">
          {resendProblem(send.error)}
        </p>
      ) : null}
      <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[13px] text-muted underline">
        See their page
      </a>
    </div>
  );
}

/* ---------- the screen ---------- */

function IncomeRows({ inc }: { inc: Income }) {
  const row = (k: string, v: string, note?: string, strong?: boolean) => (
    <li className={`flex items-baseline justify-between gap-3 py-2 ${strong ? 'text-[17px] font-semibold' : 'text-[15px]'}`}>
      <span className="min-w-0">
        {k}
        {note ? <span className="block text-[13px] font-normal text-muted">{note}</span> : null}
      </span>
      <span className="shrink-0 font-mono">{v}</span>
    </li>
  );
  return (
    <ul className="divide-y divide-line" data-income>
      {row('Buyers paid', pounds(inc.paid), `${inc.count} sale${inc.count === 1 ? '' : 's'}, with VAT`)}
      {row('VAT in it (20%)', pounds(-inc.vat), 'For your VAT return')}
      {row('Stripe’s fee', pounds(-inc.fee), inc.feeReal ? 'As Stripe charged it' : 'About: worked out from Stripe’s rates')}
      {row('Yours', pounds(inc.kept), 'After VAT and Stripe, before tax', true)}
    </ul>
  );
}

export function SalesView() {
  const s = useSales();
  const [range, setRange] = useState<'month' | 'all'>('all');
  // which were new when the screen opened: they keep their New tag while it's open
  const [fresh, setFresh] = useState<Set<string>>(() => new Set(unseen(snapshot()?.sales ?? []).map((x) => x.key)));
  // once the list is fresh: what's new gets its tag, and is marked seen (so Today's line goes on both devices)
  useEffect(() => {
    let live = true;
    void fetchSales(true).then(() => {
      const now = unseen(snapshot()?.sales ?? []);
      if (!live || !now.length) return;
      setFresh((f) => new Set([...f, ...now.map((x) => x.key)]));
      void markSeen(now[0].at);
    });
    return () => {
      live = false;
    };
  }, []);

  const sales = s?.sales ?? [];
  const p = periods(sales);
  const inc = range === 'month' ? p.month : p.all;
  const abroad = sales.filter((x) => x.country && !isUK(x.country));
  const abroadPlaces = [...new Set(abroad.map((x) => countryName(x.country)))];
  const newest = sales.find((x) => fresh.has(x.key));

  return (
    <div className="pt-7" data-guide-sales>
      <p className="kicker">Website · sold with Stripe</p>
      <h1 className="mt-1 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Guide sales</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">Every guide sold on rafcarpentry.com, and what it brings in. Your Etsy shop is at the bottom.</p>

      {s?.error ? (
        <p role="status" className="mt-4 text-[14px] text-muted">
          {problem(s.error)}
          {s.fetchedAt ? ` Showing the list from ${clock(s.fetchedAt)}.` : ''}
        </p>
      ) : null}

      {!s || (!s.fetchedAt && !s.error) ? (
        <p className="mt-5 text-[15px] text-muted">Checking…</p>
      ) : !sales.length && s.fetchedAt ? (
        <p className="mt-5 rounded-sm border border-line-strong bg-mount p-4 text-[15px]">None sold yet. Each sale shows here, and on Today, as soon as Stripe sends it.</p>
      ) : sales.length ? (
        <>
          {newest ? (
            <section data-sale-new className="mt-5 rounded-sm border-2 border-ink bg-mount p-4" aria-live="polite">
              <p className="font-mono text-[12.5px] font-semibold uppercase tracking-[0.08em] jk-sec-ink">New sale</p>
              <p className="mt-1 font-display text-[24px] font-[650] leading-tight">
                {pounds(newest.amount ?? 0)} for {guideTitle(newest.product)}
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed">
                {when(newest.at)}
                {whoOf(newest) ? ` · ${whoOf(newest)}` : ''}
                {newest.country ? ` in ${inPlace(newest.country)}` : ''}. {newest.emailed ? 'The download link was emailed to them.' : 'The download link hasn’t been emailed yet.'}
              </p>
              {newest.email ? (
                <p className="mt-1.5 text-[15px]">
                  <a href={`mailto:${newest.email}`} data-sale-email className="break-all underline">
                    {newest.email}
                  </a>
                </p>
              ) : null}
              {fromLine(newest) ? <p className="mt-1.5 text-[14px] text-muted">{fromLine(newest)}</p> : null}
            </section>
          ) : null}

          <section className="mt-4 grid grid-cols-3 gap-2" aria-label="Sold">
            {([['Today', p.today], ['This month', p.month], ['All time', p.all]] as const).map(([k, v]) => (
              <div key={k} className="rounded-sm border border-line-strong bg-mount px-3 py-3">
                <p className={label}>{k}</p>
                <p className="mt-1 font-mono text-[24px] leading-none">{v.count}</p>
                <p className="mt-1 font-mono text-[13px] text-muted">{pounds(v.paid)}</p>
              </div>
            ))}
          </section>

          <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4" aria-labelledby="gs-income">
            <div className="flex items-center justify-between gap-3">
              <h2 id="gs-income" className={label}>
                Income
              </h2>
              <div className="flex rounded-sm border border-line-strong p-0.5 text-[13.5px]" role="group" aria-label="Which sales">
                {(['month', 'all'] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={`h-9 rounded-[2px] px-3 ${range === r ? 'bg-ink text-paper' : 'text-muted'}`}>
                    {r === 'month' ? 'This month' : 'All time'}
                  </button>
                ))}
              </div>
            </div>
            {inc.count ? (
              <>
                <div className="mt-2">
                  <IncomeRows inc={inc} />
                </div>
                <p className="mt-2 border-t border-line pt-2 text-[13.5px] leading-relaxed text-muted">
                  Stripe pays {pounds(inc.payout)} into the bank (Rafal Solutions Ltd); the {pounds(inc.vat)} VAT is in that.
                </p>
              </>
            ) : (
              <p className="mt-2 text-[15px] text-muted">Nothing sold this month yet.</p>
            )}
          </section>

          <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4" aria-labelledby="gs-list">
            <h2 id="gs-list" className={label}>
              Each sale · newest first
            </h2>
            <ul className="mt-1 divide-y divide-line">
              {sales.map((x) => {
                const fee = feeOf(x);
                const theirs = buyerMoney(x);
                const kept = (x.amount ?? 0) - vatIn(x.amount ?? 0) - fee.pence;
                return (
                  <li key={x.key} data-sale={x.key} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold">{guideTitle(x.product)}</span>
                      <span className="shrink-0 font-mono text-[15px]">{pounds(x.amount ?? 0)}</span>
                    </div>
                    <p className="mt-0.5 text-[14.5px]">
                      {fresh.has(x.key) ? (
                        <span data-sale-tag className="mr-1.5 inline-block rounded-sm bg-ink px-1.5 py-px font-mono text-[11.5px] font-semibold uppercase tracking-[0.06em] text-paper">
                          New
                        </span>
                      ) : null}
                      {when(x.at)}
                      {whoOf(x) ? ` · ${whoOf(x)}` : ''}
                      {x.country ? ` · ${countryName(x.country)}` : ''}
                    </p>
                    {x.email ? (
                      <p className="mt-0.5 text-[14px]">
                        <a href={`mailto:${x.email}`} className="break-all text-muted underline">
                          {x.email}
                        </a>
                      </p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-[13px] leading-relaxed text-muted">
                      {theirs ? `They paid ${theirs} · ` : ''}VAT {pounds(vatIn(x.amount ?? 0))} · Stripe {fee.real ? '' : 'about '}
                      {pounds(fee.pence)} · yours {pounds(kept)}
                    </p>
                    {fromLine(x) ? (
                      <p className="mt-0.5 text-[13.5px] text-muted" data-sale-from>
                        {fromLine(x)}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[13.5px] text-muted" data-sale-opened>
                      {x.emailed ? `✓ Link emailed${x.emailedAt ? ` ${when(x.emailedAt)}` : ''}` : 'Link not emailed yet'} · {opened(x)}
                    </p>
                    <SaleLink x={x} />
                  </li>
                );
              })}
            </ul>
          </section>

          {abroad.length ? (
            <section data-sales-abroad className="mt-4 rounded-sm border border-line-strong bg-raised p-4 text-[14.5px] leading-relaxed">
              <p className="font-semibold">
                {abroad.length === sales.length && abroad.length === 1 ? 'Sold abroad' : `${abroad.length} sold abroad`}: {abroadPlaces.join(', ')}
              </p>
              <p className="mt-1 text-muted">VAT on a download sold to someone abroad can go by their country instead of UK VAT (in the EU, the buyer’s country’s rate). Worth asking Sanjay before selling more abroad.</p>
            </section>
          ) : null}

          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            A download counts each time their link to the PDF opens. A PDF left open in a phone’s browser opens again by itself when the phone reloads it, so one person can count several times; since 19 Nov, opening it again within 10 minutes counts once. Their link works for 30.
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Prices include 20% VAT. Stripe’s fee is the real one where it’s been read from Stripe, else worked out from its rates: 1.5% + 20p for UK cards, 2.5% + 20p for European, 3.25% + 20p for the rest. Stripe pays out a few days after each sale.{' '}
            <a href={STRIPE_PAYMENTS} target="_blank" rel="noreferrer" className="underline">
              Payments in Stripe
            </a>
          </p>
        </>
      ) : null}
      <EtsyBox />
    </div>
  );
}

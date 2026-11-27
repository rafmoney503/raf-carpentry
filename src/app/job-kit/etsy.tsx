'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EtsyOrder, EtsyOverview } from '@/lib/etsy';
import { countryName, isUK, pounds } from '@/lib/guide-income';
import type { TodayLine } from './current';
import { label } from './parts';
import { post } from './sm8-post';
import { readPin } from './uploader';

/* Etsy in the Job Kit (27 Nov 2026, Raf: 'is it possible so you can run etsy store for me'). The shop's orders and
   reviews, read through Raf's own Etsy app (src/lib/etsy.ts, /api/job-kit/etsy behind the PIN), in a box on the Guide
   sales screen, with a To do line for each new order until he has seen it (kept in the store, so the phone and the
   computer agree). On this device: the last answer (raf_jobkit_etsy), so Today shows it with no signal. Read only:
   listings, prices and messages stay in Etsy. */

const KEY = 'raf_jobkit_etsy';
const EVENT = 'jk-etsy';
const API = '/api/job-kit/etsy';
const FRESH = 5 * 60_000;
const NEW_DAYS = 14;
export const ETSY_ORDERS = 'https://www.etsy.com/your/orders/sold';

export type EtsyState = { data: EtsyOverview | null; fetchedAt: number; error?: string; detail?: string; note?: string };

let cache: { raw: string | null; val: EtsyState | null } = { raw: null, val: null };
function snapshot(): EtsyState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* no storage */
  }
  if (raw !== cache.raw) {
    let val: EtsyState | null = null;
    try {
      val = raw ? (JSON.parse(raw) as EtsyState) : null;
    } catch {
      val = null;
    }
    cache = { raw, val };
  }
  return cache.val;
}
function keep(s: EtsyState) {
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
export const useEtsy = () => useSyncExternalStore(subscribe, snapshot, () => null);

let asking: Promise<void> | null = null;
export function fetchEtsy(force = false): Promise<void> {
  const cur = snapshot();
  if (!force && cur && Date.now() - cur.fetchedAt < FRESH && !cur.error) return Promise.resolve();
  if (asking) return asking;
  const pin = readPin();
  if (!pin) return Promise.resolve();
  asking = (async () => {
    const r = await post<EtsyOverview>(pin, { action: 'status' }, API);
    const now = snapshot();
    if (!r.ok) {
      keep({ data: now?.data ?? null, fetchedAt: now?.fetchedAt ?? 0, error: r.error, detail: r.detail, note: now?.note });
      return;
    }
    keep({ data: r.data, fetchedAt: Date.now(), note: now?.note });
  })().finally(() => {
    asking = null;
  });
  return asking;
}

/* Today and the sidebar: asked when the app opens and comes back, at most every 5 minutes. */
export function useEtsyRefresh(pin: string) {
  useEffect(() => {
    if (!pin) return;
    void fetchEtsy();
    const back = () => {
      if (document.visibilityState === 'visible') void fetchEtsy();
    };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [pin]);
}

/* Back from Etsy's 'allow access' page (?etsy=…): a note in the box, then the shop. */
export function etsyBack(result: string) {
  const cur = snapshot();
  const note =
    result === 'ok'
      ? `Etsy connected: your shop’s orders and reviews show here now.${readPin() ? '' : ' If this opened in a browser window, close it and go back to the Job Kit app: it’s connected there too.'}`
      : result === 'cancelled'
        ? 'Etsy wasn’t connected (cancelled). Tap Connect Etsy to try again.'
        : result === 'expired'
          ? 'That took too long or Etsy turned it down. Tap Connect Etsy again.'
          : etsyProblem(result);
  keep({ data: cur?.data ?? null, fetchedAt: 0, note });
  void fetchEtsy(true);
}

export function etsyProblem(error?: string, detail?: string): string {
  switch (error) {
    case undefined:
      return '';
    case 'etsy-not-set-up':
      return `Etsy isn’t set up here yet${detail ? `: ${detail} missing in Vercel` : ''}.`;
    case 'etsy-not-connected':
      return 'Etsy isn’t connected yet.';
    case 'etsy-expired':
      return 'Etsy wants you to connect again (it’s been 90 days, or access was taken away).';
    case 'etsy-busy':
      return 'Etsy isn’t answering just now. Try again in a minute.';
    case 'etsy-store':
      return 'The Job Kit’s store isn’t answering just now.';
    case 'offline':
      return 'No signal just now.';
    case 'wrong-pin':
      return 'Wrong PIN: check it in Settings.';
    case 'no-pin':
      return 'Add your PIN in Settings first.';
    default:
      return `Etsy sent back an error${detail ? `: ${detail}` : ''}.`;
  }
}

/* ---------- what it means ---------- */

const money = (o: EtsyOrder) => (o.currency === 'GBP' ? pounds(o.pence) : `${(o.pence / 100).toFixed(2)} ${o.currency}`);
const firstName = (n: string) => n.split(/\s+/)[0] ?? '';
const shortItem = (o: EtsyOrder) => {
  const t = o.items[0]?.title ?? 'Order';
  const s = /ikea pax/i.test(t) ? 'IKEA PAX guide' : t.length > 40 ? `${t.slice(0, 38)}…` : t;
  return o.items.length > 1 ? `${s} + ${o.items.length - 1} more` : s;
};
/* New: since the newest order Raf has seen, in the last 14 days (a first connection doesn't fill To do with old ones). */
export function newOrders(s: EtsyState | null): EtsyOrder[] {
  const d = s?.data;
  if (!d?.connected) return [];
  const since = new Date(Date.now() - NEW_DAYS * 86_400_000).toISOString();
  const seen = d.seenAt ?? d.at; // until anything is seen, only orders after the first look count as new
  return d.orders.filter((o) => o.at > seen && o.at > since);
}
export const etsyNewCount = (s: EtsyState | null) => newOrders(s).length;

export function etsyTodayLines(s: EtsyState | null): TodayLine[] {
  const fresh = newOrders(s);
  if (!fresh.length) return [];
  if (fresh.length > 2) return [{ text: `${fresh.length} Etsy orders: ${pounds(fresh.reduce((a, o) => a + (o.currency === 'GBP' ? o.pence : 0), 0))} in`, go: 'sales', icon: 'money', urgent: true }];
  return fresh.map((o) => ({
    text: `Sold on Etsy: ${shortItem(o)} · ${money(o)}${o.name ? ` · ${firstName(o.name)}` : ''}${o.country && !isUK(o.country) ? `, ${countryName(o.country)}` : ''}${!o.shipped && o.items.some((i) => !i.digital) ? ' · to send' : ''}`,
    go: 'sales',
    id: `etsy-${o.id}`,
    icon: 'money',
    urgent: true,
  }));
}

/* The Guide sales row on Today adds the shop's line once connected. */
export function etsyLine(s: EtsyState | null): string {
  const d = s?.data;
  if (!d?.connected || !d.shop) return '';
  const n = etsyNewCount(s);
  return `Etsy: ${n ? `${n} new · ` : ''}${d.shop.sold} sold`;
}

const day = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  const k = d.toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  return k === today ? `Today, ${time}` : `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}, ${time}`;
};
const stars = (n: number) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));

/* ---------- the box on the Guide sales screen ---------- */

export function EtsyBox() {
  const s = useEtsy();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [armOff, setArmOff] = useState(false);
  const [fresh] = useState<Set<number>>(() => new Set(newOrders(snapshot()).map((o) => o.id)));

  // fresh on open; what's new keeps its tag while the screen is open and is marked seen in the store
  useEffect(() => {
    let live = true;
    void fetchEtsy(true).then(async () => {
      const cur = snapshot();
      const now = newOrders(cur);
      if (!live || !cur?.data?.connected) return;
      const upto = now[0]?.at ?? (cur.data.seenAt ? null : cur.data.at);
      if (!upto) return;
      const r = await post<{ at: string }>(readPin(), { action: 'seen', upto }, API);
      const after = snapshot();
      if (r.ok && after?.data) keep({ ...after, data: { ...after.data, seenAt: r.data.at } });
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!armOff) return;
    const t = setTimeout(() => setArmOff(false), 5000);
    return () => clearTimeout(t);
  }, [armOff]);

  async function connect() {
    setBusy(true);
    setErr('');
    const r = await post<{ url: string }>(readPin(), { action: 'start' }, API);
    if (!r.ok) {
      setErr(etsyProblem(r.error, r.detail));
      setBusy(false);
      return;
    }
    window.location.assign(r.data.url);
  }
  async function disconnect() {
    if (!armOff) return setArmOff(true);
    setArmOff(false);
    const r = await post(readPin(), { action: 'disconnect' }, API);
    if (!r.ok) return setErr(etsyProblem(r.error, r.detail));
    keep({ data: null, fetchedAt: 0 });
    void fetchEtsy(true);
  }

  const d = s?.data;
  const note = s?.note;
  const problem = s?.error ? etsyProblem(s.error, s.detail) : '';
  const needConnect = !d?.connected || s?.error === 'etsy-expired' || s?.error === 'etsy-not-connected';

  return (
    <section data-etsy className="mt-6 rounded-sm border border-line-strong bg-mount p-4" aria-labelledby="etsy-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="etsy-h" className={label}>
          Etsy shop
        </h2>
        {d?.shop ? (
          <a href={d.shop.url} target="_blank" rel="noreferrer" className="text-[13.5px] text-muted underline">
            {d.shop.name}
          </a>
        ) : null}
      </div>

      {note ? (
        <p role="status" data-etsy-note className="mt-2 text-[14.5px]">
          {note}
        </p>
      ) : null}
      {problem && !(needConnect && !d?.connected) ? (
        <p role="status" className="mt-2 text-[14px] text-muted">
          {problem}
        </p>
      ) : null}

      {needConnect ? (
        <div className="mt-2">
          {s?.error === 'etsy-not-set-up' || d?.missing?.length ? (
            <p className="text-[14.5px] leading-relaxed text-muted">
              Etsy isn’t set up here yet{d?.missing?.length ? `: ${d.missing.join(', ')} missing in Vercel` : ''}. Make the app key on Etsy, then add its Keystring and Shared Secret in Vercel as ETSY_KEYSTRING and ETSY_SHARED_SECRET.
            </p>
          ) : (
            <>
              <p className="text-[14.5px] leading-relaxed text-muted">See your Etsy orders and reviews here, with a To do line for each new order. Read only: listings and messages stay in Etsy.</p>
              <button type="button" data-etsy-connect onClick={connect} disabled={busy} className="mt-3 h-11 rounded-sm bg-ink px-4 font-semibold text-paper disabled:opacity-60">
                {busy ? 'Opening Etsy…' : d?.connected === false || !d ? 'Connect Etsy' : 'Connect Etsy again'}
              </button>
            </>
          )}
          {err ? <p className="mt-2 text-[14px] text-muted">{err}</p> : null}
        </div>
      ) : d?.shop ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ['Sold', String(d.shop.sold)],
                ['Listings', String(d.shop.listings)],
                ['Reviews', d.shop.reviewCount ? `${(d.shop.reviewAverage ?? 0).toFixed(1)} ★` : '–'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-sm border border-line-strong bg-paper px-3 py-2.5">
                <p className={label}>{k}</p>
                <p className="mt-1 font-mono text-[20px] leading-none">{v}</p>
              </div>
            ))}
          </div>

          <h3 className={`${label} mt-4`}>Orders · newest first</h3>
          {d.orders.length ? (
            <ul className="mt-1 divide-y divide-line" data-etsy-orders>
              {d.orders.slice(0, 12).map((o) => (
                <li key={o.id} data-etsy-order={o.id} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-semibold">{shortItem(o)}</span>
                    <span className="shrink-0 font-mono text-[15px]">{money(o)}</span>
                  </div>
                  <p className="mt-0.5 text-[14px] text-muted">
                    {fresh.has(o.id) ? <span className="mr-1.5 inline-block rounded-sm bg-ink px-1.5 py-px font-mono text-[11.5px] font-semibold uppercase tracking-[0.06em] text-paper">New</span> : null}
                    {day(o.at)}
                    {o.name ? ` · ${o.name}` : ''}
                    {o.country ? ` · ${countryName(o.country)}` : ''}
                    {o.items.every((i) => i.digital) ? ' · download' : o.shipped ? ' · sent' : ' · to send'}
                    {o.paid ? '' : ' · not paid yet'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[14.5px] text-muted">No orders yet. Each one shows here, and on Today.</p>
          )}

          {d.reviews.length ? (
            <>
              <h3 className={`${label} mt-4`}>Latest reviews</h3>
              <ul className="mt-1 divide-y divide-line" data-etsy-reviews>
                {d.reviews.slice(0, 5).map((r, i) => (
                  <li key={i} className="py-2.5 text-[14.5px]">
                    <span className="font-mono text-[13px]" aria-label={`${r.rating} out of 5`}>
                      {stars(r.rating)}
                    </span>{' '}
                    <span className="text-muted">{day(r.at).split(',')[0]}</span>
                    {r.text ? <p className="mt-0.5">{r.text}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            Etsy takes 20p a listing, 6.5% of each sale and about 4% + 20p for the payment. Messages to buyers stay in the Etsy app.{' '}
            <a href={ETSY_ORDERS} target="_blank" rel="noreferrer" className="underline">
              Orders in Etsy
            </a>
            {' · '}
            <button type="button" data-etsy-disconnect onClick={disconnect} className="underline">
              {armOff ? 'Tap again to disconnect' : 'Disconnect'}
            </button>
          </p>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-muted">Checking…</p>
      )}
    </section>
  );
}

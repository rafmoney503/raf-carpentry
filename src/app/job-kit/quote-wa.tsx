'use client';

import { useEffect, useRef, useState } from 'react';
import { showNumber, windowLeft } from '@/lib/wa-live';
import type { QuoteEdits } from '@/lib/quote-sums';
import { problemText } from './sm8-post';
import { checkWa, sendLiveTo, type WaCheck } from './wa-store';

/* A rough quote sent on WhatsApp straight from the Job Kit (Raf, 14 Nov 2026: 'I want to be able to send it back
   through WhatsApp ... and I want to have a confirmation it's been sent in jobkit job').
   It goes from his own number through 360dialog, so it shows in WhatsApp on his phone too. WhatsApp only takes
   words from a business within 24 hours of the customer's last message; past that the quote's 'WhatsApp <name>'
   button opens his WhatsApp app with it typed in, as before. The confirmation (sent, delivered, read, or didn't
   go) is on the quote and on the job's Rough quote box; WhatsApp's ticks come in through the webhook. */

export type WaSent = NonNullable<QuoteEdits['wa']>;

/* A short fingerprint of the words, so a changed message can be sent again */
export function hashOf(text: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const when = (t: number) => {
  const d = new Date(t);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `today ${time}`;
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return `yesterday ${time}`;
  if (d.toDateString() === new Date(Date.now() + 864e5).toDateString()) return `tomorrow ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
};
export const sentWhen = (t: number) => when(t);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- can it go from here ---------- */

export type WaWindow =
  | { state: 'none' } // no number
  | { state: 'checking' }
  | { state: 'off' } // live WhatsApp not linked
  | { state: 'error'; error: string }
  | { state: 'open'; left: number; until: number }
  | { state: 'shut'; lastInAt: number | null; liveInAt: number | null }; // more than 24 hours, or they haven't written since the link

export function useWaWindow(wa: string, deviceLiveInAt?: number | null): WaWindow {
  const [check, setCheck] = useState<WaCheck | { error: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!wa) return;
    let alive = true;
    const ask = async () => {
      const r = await checkWa(wa);
      if (alive) setCheck(r);
    };
    void ask();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void ask();
      else tick((n) => n + 1);
    }, 60_000);
    const back = () => document.visibilityState === 'visible' && void ask();
    document.addEventListener('visibilitychange', back);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', back);
    };
  }, [wa]);
  if (!wa) return { state: 'none' };
  if (!check) return deviceLiveInAt && windowLeft(deviceLiveInAt) > 60_000 ? { state: 'open', left: windowLeft(deviceLiveInAt), until: deviceLiveInAt + 24 * 3600e3 } : { state: 'checking' };
  if ('error' in check) return { state: 'error', error: check.error };
  if (!check.linked) return { state: 'off' };
  const live = Math.max(check.chat?.liveInAt ?? 0, deviceLiveInAt ?? 0) || null;
  const left = windowLeft(live);
  return left > 60_000 ? { state: 'open', left, until: (live ?? 0) + 24 * 3600e3 } : { state: 'shut', lastInAt: check.chat?.lastInAt ?? null, liveInAt: live };
}

/* ---------- how it went ---------- */

const CACHE = 'raf_jobkit_quote_wa';
const DONE = new Set(['read', 'failed']);
function cached(id: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(CACHE) || '{}') as Record<string, string>)[id] ?? null;
  } catch {
    return null;
  }
}
function keep(id: string, status: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) || '{}') as Record<string, string>;
    all[id] = status;
    const ids = Object.keys(all);
    for (const k of ids.slice(0, Math.max(0, ids.length - 60))) delete all[k];
    localStorage.setItem(CACHE, JSON.stringify(all));
  } catch {
    /* private mode: shown, not kept */
  }
}

/* WhatsApp's ticks for a message sent from here: asked when shown, then every 15 s while on screen, until it's
   read or failed (or two days old) */
export function useWaStatus(sent?: WaSent | null) {
  const id = sent?.id ?? '';
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!sent?.id) return;
    const c = cached(sent.id);
    setStatus(c);
    if ((c && DONE.has(c)) || Date.now() - sent.at > 2 * 864e5) return;
    let alive = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      if (document.visibilityState === 'visible') {
        const r = await checkWa(sent.to, sent.id);
        if (!alive) return;
        const s = 'error' in r ? null : (r.msg?.status ?? null);
        if (s) {
          setStatus(s);
          keep(sent.id, s);
          if (DONE.has(s)) return;
        }
      }
      t = setTimeout(() => void ask(), 15_000);
    };
    void ask();
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // the record is the same message while its id is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return status;
}

function statusLine(status: string | null, first: string) {
  switch (status) {
    case 'read':
      return { text: `Read by ${first || 'them'}`, ticks: '✓✓', tone: 'read' as const };
    case 'delivered':
      return { text: 'Delivered to their phone', ticks: '✓✓', tone: 'ok' as const };
    case 'failed':
      return { text: 'WhatsApp couldn’t deliver it. Send it from your WhatsApp app instead.', ticks: '!', tone: 'bad' as const };
    case 'sent':
      return { text: 'Sent from your number, not on their phone yet', ticks: '✓', tone: 'ok' as const };
    default:
      return { text: 'Sent from your number', ticks: '✓', tone: 'ok' as const };
  }
}

/* The confirmation: on the quote and on the job */
export function WaSentNote({ sent, first, compact = false }: { sent: WaSent; first: string; compact?: boolean }) {
  const status = useWaStatus(sent);
  const s = statusLine(status, first);
  return (
    <div
      data-wa-sent={status || 'sent'}
      className={`jk-wa-sent rounded-sm border px-3 py-2.5 ${s.tone === 'bad' ? 'is-bad' : ''} ${compact ? 'mt-2.5' : 'mt-3'}`}
    >
      <p className="flex items-center gap-2 text-[15px] font-[650] text-ink">
        <span aria-hidden className={`jk-wa-ticks font-mono text-[14px] ${s.tone === 'read' ? 'is-read' : s.tone === 'bad' ? 'is-bad' : ''}`}>
          {s.ticks}
        </span>
        Quote sent on WhatsApp
      </p>
      <p className="mt-0.5 font-mono text-[12.5px] leading-snug text-muted">
        To {first || 'them'}, {showNumber(sent.to)} · {when(sent.at)}
      </p>
      <p className={`mt-0.5 text-[14px] leading-snug ${s.tone === 'bad' ? 'font-semibold text-ink' : 'text-muted'}`} data-wa-status>
        {s.text}
      </p>
    </div>
  );
}

/* ---------- the button on the quote ---------- */

export function QuoteWaSend({
  wa,
  win,
  first,
  message,
  sent,
  onSent,
}: {
  wa: string;
  win: WaWindow;
  first: string;
  message: string;
  sent?: WaSent;
  onSent: (rec: WaSent) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const arm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(arm.current), []);
  if (!wa || win.state === 'none' || win.state === 'off') return sent ? <WaSentNote sent={sent} first={first} /> : null;
  const same = sent && sent.to === wa && sent.hash === hashOf(message.trim());
  const who = first || 'them';

  const go = async () => {
    if (!armed) {
      setArmed(true);
      setProblem('');
      clearTimeout(arm.current);
      arm.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    clearTimeout(arm.current);
    setArmed(false);
    setBusy(true);
    setProblem('');
    const text = message.trim();
    const r = await sendLiveTo(wa, text);
    setBusy(false);
    if ('error' in r) {
      setProblem(
        r.error === 'wa-window'
          ? `It’s more than 24 hours since ${who} last wrote on WhatsApp, so WhatsApp won’t take it from here. Use WhatsApp ${first || 'them'} below: it opens your WhatsApp with the quote typed in.`
          : problemText(r.error, r.detail),
      );
      return;
    }
    onSent({ id: r.msg.id, at: r.msg.at || Date.now(), to: wa, hash: hashOf(text) });
  };

  return (
    <div className="mt-3" data-wa-send={win.state}>
      {sent ? <WaSentNote sent={sent} first={first} /> : null}
      {same ? null : win.state === 'open' ? (
        <>
          <button
            type="button"
            onClick={() => void go()}
            disabled={busy || !message.trim()}
            className={`btn mt-3 w-full ${armed ? 'btn-primary' : 'btn-whatsapp'} disabled:opacity-50`}
            data-wa-send-button
          >
            {busy ? 'Sending…' : armed ? `Tap again to send to ${who}` : sent ? 'Send this version on WhatsApp too' : 'Send on WhatsApp now'}
          </button>
          <p className="mt-1.5 text-[13.5px] leading-snug text-muted">
            {sent ? 'You’ve changed the message since you sent it. ' : ''}From your WhatsApp number to {showNumber(wa)}, so it shows in WhatsApp on your phone too. Works until {when(win.until)}, 24 hours after {who}’s last message.
          </p>
        </>
      ) : win.state === 'checking' ? (
        <p className="mt-1 font-mono text-[12.5px] text-faint">Checking if WhatsApp can take it from here…</p>
      ) : win.state === 'shut' ? (
        <p className="mt-1 text-[14px] leading-snug text-muted" data-wa-shut>
          {win.lastInAt || win.liveInAt
            ? `${cap(who)} last wrote on WhatsApp ${when(win.liveInAt || win.lastInAt || 0)}. That’s more than 24 hours ago, so WhatsApp won’t let the Job Kit send words to them.`
            : `${cap(who)} hasn’t written to your WhatsApp since it was linked to the Job Kit, so it can’t go from here.`}{' '}
          Use WhatsApp {first || 'them'} below: it opens your WhatsApp with the quote typed in.
        </p>
      ) : (
        <p className="mt-1 text-[14px] leading-snug text-muted">Couldn’t check WhatsApp just now ({problemText(win.error)}). Use WhatsApp {first || 'them'} below.</p>
      )}
      {problem ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold leading-snug">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

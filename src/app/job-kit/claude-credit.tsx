'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TodayLine } from './current';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';

/* Claude credit (Raf, 3 Nov 2026: 'i'd like to have in job kit the status of account with claude regarding
   creating notes and designs to see when i need to top up'). Anthropic's API can't tell anyone the prepaid balance,
   so the website notes what each Claude answer cost (src/lib/ai-usage.ts) and Raf types the balance the Claude
   Console shows when he tops up; what's left = that balance less what's been used since. With ANTHROPIC_ADMIN_KEY
   set, the Console's own Cost report is used for 'used since' instead. A Today line when it's low or ran out.
   On this phone: the last answer (raf_jobkit_claude), so Today shows it with no signal. Server: /api/job-kit/claude. */

const KEY = 'raf_jobkit_claude';
const EVENT = 'jk-claude';
const API = '/api/job-kit/claude';
const FRESH = 10 * 60_000;
export const CONSOLE_BILLING = 'https://console.anthropic.com/settings/billing';

type Use = { at: number; feature: string; cost: number; refused: boolean; in: number; out: number };
export type CreditStatus = {
  credit: { balance: number; warn: number; at: number } | null;
  since: { cost: number; uses: number };
  month: { feature: string; uses: number; cost: number }[];
  days30: number;
  days7: number;
  refusedAt: number | null;
  recent: Use[];
  firstAt: number | null;
  console: number | null;
  admin: boolean;
  fetchedAt: number;
  error?: string;
};

const NAMES: Record<string, string> = { quotes: 'Quotes (rough prices)', design: 'Design with Claude', draft: 'Draft a reply', pots: 'Money pots, Ask Claude' };
const nameOf = (f: string) => NAMES[f] ?? f;
const usd = (v: number) => `$${(Math.round(v * 100) / 100).toFixed(2)}`;
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const when = (t: number) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? `Today ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : `${day(t)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

/* ---------- kept on the phone, shared by Today and the screen ---------- */

let cache: { raw: string | null; val: CreditStatus | null } = { raw: null, val: null };
function snapshot(): CreditStatus | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* no storage */
  }
  if (raw !== cache.raw) {
    let val: CreditStatus | null = null;
    try {
      val = raw ? (JSON.parse(raw) as CreditStatus) : null;
    } catch {
      val = null;
    }
    cache = { raw, val };
  }
  return cache.val;
}
function keep(s: CreditStatus) {
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
export const useCredit = () => useSyncExternalStore(subscribe, snapshot, () => null);

/* Asks the store (at most every 10 minutes unless forced); an error keeps what was there. */
export async function fetchCredit(force = false): Promise<void> {
  const cur = snapshot();
  if (!force && cur && Date.now() - cur.fetchedAt < FRESH && !cur.error) return;
  const r = await post<Omit<CreditStatus, 'fetchedAt'>>(readPin(), { action: 'status' }, API);
  if (!r.ok) {
    if (cur) keep({ ...cur, error: r.error });
    else keep({ credit: null, since: { cost: 0, uses: 0 }, month: [], days30: 0, days7: 0, refusedAt: null, recent: [], firstAt: null, console: null, admin: false, fetchedAt: 0, error: r.error });
    return;
  }
  keep({ ...r.data, fetchedAt: Date.now() });
}

/* ---------- what it means ---------- */

export function creditState(s: CreditStatus | null) {
  if (!s || (!s.fetchedAt && s.error)) return { kind: 'unknown' as const, left: null, spent: 0, perDay: 0, daysLeft: null };
  const c = s.credit;
  const spent = c ? (s.console ?? Number(s.since.cost)) : 0;
  const left = c ? Math.max(0, Number(c.balance) - spent) : null;
  const perDay = Number(s.days7) / 7;
  const daysLeft = left !== null && perDay > 0.005 ? Math.floor(left / perDay) : null;
  const out = Boolean(s.refusedAt && (!c || s.refusedAt > c.at));
  const kind = out ? ('out' as const) : left === null ? ('untold' as const) : left < Number(c?.warn ?? 5) ? ('low' as const) : ('ok' as const);
  return { kind, left, spent, perDay, daysLeft };
}

export function creditLine(s: CreditStatus | null) {
  const st = creditState(s);
  const monthUses = (s?.month ?? []).reduce((n, m) => n + Number(m.uses), 0);
  const uses = monthUses ? ` · ${monthUses} use${monthUses === 1 ? '' : 's'} this month` : '';
  if (st.kind === 'unknown') return s?.error ? problemText(s.error) || 'Couldn’t check just now' : 'How much Claude credit is left, and what used it';
  if (st.kind === 'out') return `Ran out: Claude turned a request down ${s?.refusedAt ? day(s.refusedAt) : ''}. Top up`;
  if (st.kind === 'untold') return `Type your Console balance to see what’s left${uses}`;
  return `About ${usd(st.left ?? 0)} left${uses}`;
}

export function creditTodayLine(s: CreditStatus | null): TodayLine | null {
  const st = creditState(s);
  if (st.kind === 'out') return { text: 'Claude credit has run out: top up', go: 'claude', urgent: true, icon: 'money' };
  if (st.kind === 'low') return { text: `Claude credit about ${usd(st.left ?? 0)} left: top up soon`, go: 'claude', urgent: true, icon: 'money' };
  return null;
}

/* ---------- the screen ---------- */

export function ClaudeCreditView() {
  const s = useCredit();
  const st = creditState(s);
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState('');
  const [warn, setWarn] = useState(() => String(s?.credit?.warn ?? 5));
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState('');
  useEffect(() => {
    void fetchCredit(true);
  }, []);
  const save = async () => {
    const b = Number.parseFloat(balance.replace(/[^0-9.]/g, ''));
    const w = Number.parseFloat(warn.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(b) || b < 0) return setProblem('Type the balance the Console shows, in dollars, e.g. 18.40.');
    setBusy(true);
    setProblem('');
    const r = await post(readPin(), { action: 'credit', balance: b, warn: Number.isFinite(w) && w >= 0 ? w : 5 }, API);
    setBusy(false);
    if (!r.ok) return setProblem(problemText(r.error) || 'Couldn’t save it. Try again.');
    setBalance('');
    setSaved(`Saved: ${usd(b)} from now.`);
    void fetchCredit(true);
  };
  const monthTotal = (s?.month ?? []).reduce((n, m) => n + Number(m.cost), 0);
  return (
    <div className="pt-7">
      <p className="kicker">Claude API · prepaid credit</p>
      <h1 className="mt-1 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Claude credit</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">What Quotes, Design with Claude, Draft a reply and Money pots use from your Claude account, and when to top up.</p>

      <section className={`mt-5 rounded-sm border-2 bg-mount p-4 ${st.kind === 'out' || st.kind === 'low' ? 'border-ink' : 'border-line-strong'}`} aria-live="polite">
        {st.kind === 'out' ? (
          <>
            <p className="font-display text-[24px] font-[650] leading-tight">It ran out</p>
            <p className="mt-1.5 text-[15px] leading-relaxed">
              Claude turned a request down for credit {s?.refusedAt ? `on ${when(s.refusedAt)}` : ''}. Top up in the Console, then type the new balance below.
            </p>
          </>
        ) : st.kind === 'unknown' ? (
          <p className="text-[15px] leading-relaxed text-muted">{s?.error ? problemText(s.error) || 'Couldn’t check just now.' : 'Checking…'}</p>
        ) : st.kind === 'untold' ? (
          <>
            <p className="font-display text-[22px] font-[650] leading-tight">How much is left?</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">Claude can’t tell the Job Kit your balance. Type what the Console shows (Billing) and it keeps count from there.</p>
          </>
        ) : (
          <>
            <p className="font-mono text-[34px] leading-none">{usd(st.left ?? 0)}</p>
            <p className="mt-1 text-[15px] font-semibold">{st.kind === 'low' ? 'Getting low: top up soon' : 'About this much left'}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {usd(Number(s?.credit?.balance))} on {s?.credit ? day(s.credit.at) : ''}, less {usd(st.spent)} used since
              {s?.console !== null && s?.console !== undefined ? ' (the Console’s own figure)' : ` (${s?.since.uses ?? 0} uses)`}.
              {st.daysLeft !== null ? (st.daysLeft > 120 ? ' At this week’s rate it lasts months.' : ` At this week’s rate that’s about ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}.`) : ''}
            </p>
          </>
        )}
        <a href={CONSOLE_BILLING} target="_blank" rel="noreferrer" className="btn btn-primary mt-4 w-full">
          Top up in the Claude Console
        </a>
      </section>

      <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4" aria-labelledby="cc-set">
        <h2 id="cc-set" className={label}>
          After you top up
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <label className="grid gap-1 text-[13px] text-muted">
            The Console shows now ($)
            <input inputMode="decimal" className={`${field} h-11 font-mono`} value={balance} placeholder="e.g. 25.00" onChange={(e) => setBalance(e.target.value)} />
          </label>
          <label className="grid gap-1 text-[13px] text-muted">
            Warn me under ($)
            <input inputMode="decimal" className={`${field} h-11 font-mono`} value={warn} onChange={(e) => setWarn(e.target.value)} />
          </label>
        </div>
        <button type="button" disabled={busy || !balance.trim()} onClick={() => void save()} className="btn btn-ghost btn-sm mt-3">
          {busy ? 'Saving…' : 'Save the balance'}
        </button>
        {problem ? (
          <p role="alert" className="mt-2 text-[14px]">
            {problem}
          </p>
        ) : saved ? (
          <p role="status" className="mt-2 text-[14px] text-muted">
            {saved}
          </p>
        ) : null}
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">The Console is in dollars. It shows your balance under Billing.</p>
      </section>

      <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4" aria-labelledby="cc-month">
        <h2 id="cc-month" className={label}>
          This month · {usd(monthTotal)}
        </h2>
        {s?.month.length ? (
          <ul className="mt-2 divide-y divide-line">
            {s.month.map((m) => (
              <li key={m.feature} className="flex items-baseline justify-between gap-3 py-2 text-[15px]">
                <span className="min-w-0">
                  {nameOf(m.feature)}
                  <span className="block text-[13px] text-muted">
                    {Number(m.uses)} use{Number(m.uses) === 1 ? '' : 's'}
                    {Number(m.uses) ? ` · about ${usd(Number(m.cost) / Number(m.uses))} each` : ''}
                  </span>
                </span>
                <span className="font-mono">{usd(Number(m.cost))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14.5px] text-muted">Nothing used yet this month.</p>
        )}
        <p className="mt-2 flex justify-between border-t border-line pt-2 font-mono text-[13px] text-muted">
          <span>Last 7 days {usd(Number(s?.days7 ?? 0))}</span>
          <span>Last 30 days {usd(Number(s?.days30 ?? 0))}</span>
        </p>
      </section>

      {s?.recent.length ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-mount p-4" aria-labelledby="cc-recent">
          <h2 id="cc-recent" className={label}>
            Latest
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {s.recent.map((u, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-[14px]">
                <span className="min-w-0">
                  <span className="font-mono text-[12.5px] text-faint">{when(u.at)} · </span>
                  {nameOf(u.feature)}
                </span>
                <span className="shrink-0 font-mono">{u.refused ? 'turned down' : usd(Number(u.cost))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        Each use is worked out from the tokens Claude reports, at Claude’s list prices ($2 a million tokens in, $10 out for Sonnet 5.5). Only what the website asks Claude is counted, not your Claude app or Claude Code plan.
        {s?.admin ? ' With the Admin key set, “used since” is the Console’s own figure for the whole account.' : ' Counting started on 3 Nov 2026.'}
      </p>
    </div>
  );
}

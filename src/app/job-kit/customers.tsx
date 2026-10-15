'use client';
import { useMemo, useState } from 'react';
import type { Client, CurrentJob, Person } from '@/lib/servicem8';
import { Icon } from './icons';
import { field } from './parts';
import { clock, post, problemText } from './sm8-post';

/* Finding a customer in ServiceM8 (15 Oct 2026, Raf: 'when type in person first name and last name can it search
   through service m8 database'). ServiceM8's own filter only finds a name typed exactly, so the server hands the
   phone every active client with their people (POST /api/job-kit/sm8 {action: 'clients'}) and the phone searches
   that as Raf types: any part of the first or last name, in any order, accents or not, or a mobile, an email or a
   postcode. The list is kept on this phone like the Current jobs (customer details only ever travel phone <->
   website server <-> ServiceM8), refreshed when the search box is used and it's over 10 minutes old.
   Opening a customer asks ServiceM8 for all their jobs (customer-view.tsx). */

export type { Client, Person };
export type Clients = { clients: Client[]; at: number; error?: string; detail?: string };
export type CustomerDetail = { client: Client; jobs: CurrentJob[]; at: number };

const CLIENTS_KEY = 'raf_jobkit_clients';
const CUSTOMERS_KEY = 'raf_jobkit_customers'; // the last customers opened, for opening with no signal
const KEEP_CUSTOMERS = 12;
export const CLIENTS_FRESH = 10 * 60_000;

const read = <T,>(key: string, empty: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) || 'null') as T) ?? empty;
  } catch {
    return empty;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* no storage, or full: the list still works until the app closes */
  }
};

export const savedClients = (): Clients => read<Clients>(CLIENTS_KEY, { clients: [], at: 0 });
export async function fetchClients(pin: string, before: Clients): Promise<Clients> {
  const r = await post<{ clients: Client[]; at: number }>(pin, { action: 'clients' });
  if (!r.ok) return { ...before, error: r.error, detail: r.detail };
  const next: Clients = { clients: r.data.clients, at: r.data.at };
  write(CLIENTS_KEY, next);
  return next;
}

export const savedCustomers = (): Record<string, CustomerDetail> => read<Record<string, CustomerDetail>>(CUSTOMERS_KEY, {});
export function keepCustomer(d: CustomerDetail) {
  const all = { ...savedCustomers(), [d.client.uuid]: d };
  const keep = Object.values(all)
    .sort((a, b) => b.at - a.at)
    .slice(0, KEEP_CUSTOMERS);
  write(CUSTOMERS_KEY, Object.fromEntries(keep.map((c) => [c.client.uuid, c])));
}
export async function fetchCustomer(pin: string, uuid: string) {
  const r = await post<{ client: Client; jobs: CurrentJob[]; at: number }>(pin, { action: 'client', uuid });
  if (!r.ok) return r;
  const d: CustomerDetail = { client: r.data.client, jobs: r.data.jobs, at: r.data.at };
  keepCustomer(d);
  return { ok: true as const, data: d };
}

/* Customers that are on a current job but not in the list yet (added since it was fetched, or the list hasn't
   come yet), so a search finds them anyway. */
export function withCurrent(list: Client[], jobs: CurrentJob[]): Client[] {
  const have = new Set(list.map((c) => c.uuid));
  const extra = new Map<string, Client>();
  for (const j of jobs)
    if (j.client && !have.has(j.client) && !extra.has(j.client))
      extra.set(j.client, { uuid: j.client, name: j.name, address: j.address, people: [{ first: j.first, last: '', mobile: j.mobile, phone: j.phone, email: j.email }], edited: j.created });
  return extra.size ? [...extra.values(), ...list] : list;
}

/* ---------- matching ---------- */

const FOLD: Record<string, string> = { ł: 'l', Ł: 'l', ø: 'o', Ø: 'o', ß: 'ss', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe', đ: 'd', Đ: 'd', ı: 'i' };
/* Lower case, no accents (Łukasz finds lukasz and the other way round). */
export const fold = (s: string) =>
  s
    .replace(/[łŁøØßæÆœŒđĐı]/g, (c) => FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
/* The words of a name or an address; O'Brien and Smith-Jones also as one word. */
function wordsOf(s: string) {
  const out = new Set<string>();
  for (const part of fold(s).split(/\s+/)) {
    const bits = part.split(/[^a-z0-9]+/).filter(Boolean);
    bits.forEach((b) => out.add(b));
    if (bits.length > 1) out.add(bits.join(''));
  }
  return [...out];
}
/* A UK number as its digits, starting 0 (07..., 020...), so +44 7..., 0044 7... and 07... all match. */
export function digitsOf(s: string) {
  const plus = /^\s*\+/.test(s);
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0044')) d = `0${d.slice(4)}`;
  else if (d.startsWith('44') && (plus || d.length >= 12)) d = `0${d.slice(2)}`;
  return d;
}
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
export const postcodeOf = (address: string) => {
  const m = address.match(POSTCODE);
  return m ? `${m[1]} ${m[2]}`.toUpperCase() : '';
};
export const personName = (p: Person) => [p.first, p.last].filter(Boolean).join(' ');

export type Entry = { client: Client; name: string; nameWords: string[]; addrWords: string[]; phones: { d: string; p: Person; raw: string }[]; emails: { e: string; p: Person }[] };
export function indexClients(list: Client[]): Entry[] {
  return list.map((client) => ({
    client,
    name: wordsOf(client.name).join(' '),
    nameWords: [...new Set([...wordsOf(client.name), ...client.people.flatMap((p) => wordsOf(personName(p)))])],
    addrWords: wordsOf(client.address),
    phones: client.people.flatMap((p) => [p.mobile, p.phone].filter(Boolean).map((raw) => ({ d: digitsOf(raw), p, raw }))).filter((x) => x.d.length >= 6),
    emails: client.people.filter((p) => p.email).map((p) => ({ e: p.email.toLowerCase().trim(), p })),
  }));
}

export type Hit = { client: Client; why: 'name' | 'mobile' | 'email' | 'address'; shown?: string; score: number };

/* Every customer matching what's typed, best first: the start of their name, then every word typed starting a
   word of their name (first or last, any order), then a postcode or street; a number finds mobiles and phones;
   an email finds emails. Ties go to the customer changed most recently in ServiceM8. */
export function searchClients(index: Entry[], q: string): Hit[] {
  const raw = q.trim();
  if (raw.length < 2) return [];
  const hits: Hit[] = [];
  const byRecent = (a: Hit, b: Hit) => b.score - a.score || (b.client.edited ?? '').localeCompare(a.client.edited ?? '');
  if (/^[\d\s+()-]+$/.test(raw)) {
    const d = digitsOf(raw);
    if (d.length < 3) return [];
    for (const e of index) {
      const ph = e.phones.find((x) => x.d.includes(d));
      if (ph) hits.push({ client: e.client, why: 'mobile', shown: ph.raw, score: ph.d.startsWith(d) ? 2 : 1 });
    }
    return hits.sort(byRecent);
  }
  if (raw.includes('@')) {
    const t = raw.toLowerCase();
    for (const e of index) {
      const em = e.emails.find((x) => x.e.includes(t));
      if (em) hits.push({ client: e.client, why: 'email', shown: em.p.email, score: em.e.startsWith(t) ? 2 : 1 });
    }
    return hits.sort(byRecent);
  }
  const tokens = [...new Set(fold(raw).split(/[^a-z0-9]+/).filter(Boolean))];
  if (!tokens.length) return [];
  const whole = tokens.join(' ');
  for (const e of index) {
    let score = 0;
    let byName = 0;
    let ok = true;
    for (const t of tokens) {
      if (e.nameWords.some((w) => w.startsWith(t))) {
        byName++;
        score += e.nameWords.includes(t) ? 15 : 10;
      } else if (e.addrWords.some((w) => w.startsWith(t))) score += 3;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (e.name.startsWith(whole)) score += 100;
    hits.push({ client: e.client, why: byName ? 'name' : 'address', score });
  }
  return hits.sort(byRecent);
}

/* For a new enquiry: customers already in ServiceM8 who look like the same person (same mobile, same email, or
   the same name), strongest first, up to 3. */
export type Same = { client: Client; why: 'mobile' | 'email' | 'same name' | 'name' };
export function sameCustomers(index: Entry[], e: { name: string; mobile: string; email: string }): Same[] {
  const out: Same[] = [];
  const add = (client: Client, why: Same['why']) => {
    if (!out.some((s) => s.client.uuid === client.uuid)) out.push({ client, why });
  };
  const d = digitsOf(e.mobile);
  if (d.length >= 10) for (const x of index) if (x.phones.some((p) => p.d.slice(-10) === d.slice(-10))) add(x.client, 'mobile');
  const em = e.email.trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) for (const x of index) if (x.emails.some((y) => y.e === em)) add(x.client, 'email');
  const typed = fold(e.name).split(/[^a-z0-9]+/).filter(Boolean);
  const full = wordsOf(e.name).join(' ');
  if (full.length >= 3) {
    for (const x of index) {
      const names = [x.name, ...x.client.people.map((p) => wordsOf(personName(p)).join(' '))];
      if (names.includes(full)) add(x.client, 'same name');
    }
    // Two or more words typed: "Kasia Now" finds Kasia Nowak.
    if (typed.length >= 2) for (const x of index) if (typed.every((t) => x.nameWords.some((w) => w.startsWith(t)))) add(x.client, 'name');
  }
  return out.slice(0, 3);
}

/* ---------- the search box (Today and Current jobs) ---------- */

const FIND_KEY = 'raf_jobkit_find_';
const STATUS_WORD: Record<string, string> = { Quote: 'Quote', 'Work Order': 'Work Order', Completed: 'Completed', Unsuccessful: 'Unsuccessful' };

/* One line under the name: where they are and how to reach them, or what matched. */
function subLine(h: Hit) {
  const pc = postcodeOf(h.client.address);
  const where = pc || h.client.address.split(/\n|,/)[0]?.trim() || '';
  const mobile = h.client.people.find((p) => p.mobile)?.mobile || h.client.people.find((p) => p.phone)?.phone || '';
  if (h.why === 'mobile' || h.why === 'email') return [h.shown, where].filter(Boolean).join(' · ');
  return [where, mobile].filter(Boolean).join(' · ');
}

export function CustomerSearch({
  place,
  clients,
  jobs,
  loading,
  onNeed,
  onRefresh,
  onOpen,
  onNewNamed,
}: {
  place: 'today' | 'current';
  clients: Clients;
  jobs: CurrentJob[];
  loading: boolean;
  onNeed: () => void; // the box was used: fetch the list if it's old
  onRefresh: () => void;
  onOpen: (uuid: string) => void;
  onNewNamed?: (name: string) => void;
}) {
  // What was typed survives opening a customer and coming back (this visit only).
  // (The app only draws its screens once it has opened on the phone, so sessionStorage is there.)
  const [q, setQ] = useState(() => {
    try {
      return sessionStorage.getItem(FIND_KEY + place) || '';
    } catch {
      return '';
    }
  });
  const [more, setMore] = useState(false);
  const setQuery = (v: string) => {
    setQ(v);
    setMore(false);
    try {
      sessionStorage.setItem(FIND_KEY + place, v);
    } catch {
      /* no storage */
    }
  };
  const all = useMemo(() => withCurrent(clients.clients, jobs), [clients.clients, jobs]);
  const index = useMemo(() => indexClients(all), [all]);
  const hits = useMemo(() => searchClients(index, q), [index, q]);
  const active = q.trim().length >= 2;
  const SHOW = 25;
  const openJobs = (uuid: string) => jobs.filter((j) => j.client === uuid && j.status !== 'Unsuccessful');
  const problem = clients.error ? problemText(clients.error, clients.detail, clients.at || undefined) : '';
  const looksLikeName = /[a-z]/i.test(q) && !/[\d@]/.test(q);

  return (
    <div className={place === 'today' ? 'mt-3' : 'mt-5'}>
      <label className="relative block">
        <span className="sr-only">Find a customer in ServiceM8</span>
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-[20px] w-[20px] -translate-y-1/2 text-faint" />
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={q}
          onFocus={onNeed}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); // closes the keyboard so the results show
          }}
          placeholder="Find a customer: name, mobile, postcode"
          className={`${field} h-12 pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {q ? (
          <button type="button" aria-label="Clear the search" onClick={() => setQuery('')} className="absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-[22px] leading-none text-faint">
            ×
          </button>
        ) : null}
      </label>

      {active ? (
        <div className="mt-2.5" aria-live="polite">
          {problem && !hits.length ? (
            <p role="alert" className="rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
              {problem}
            </p>
          ) : null}
          {!clients.at && loading && !hits.length ? <p className="py-2 font-mono text-[13.5px] text-faint">Getting your customers from ServiceM8…</p> : null}
          {hits.length ? (
            <ul className="grid gap-2">
              {(more ? hits : hits.slice(0, SHOW)).map((h) => {
                const open = openJobs(h.client.uuid);
                const person = h.client.people.map(personName).find((n) => n && fold(n) !== fold(h.client.name));
                return (
                  <li key={h.client.uuid}>
                    <button type="button" onClick={() => onOpen(h.client.uuid)} className="block w-full rounded-sm border border-line-strong bg-mount px-3.5 py-2.5 text-left transition-colors hover:border-ink">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[16px] font-semibold leading-snug">{h.client.name}</span>
                        <span aria-hidden className="shrink-0 text-accent">
                          →
                        </span>
                      </span>
                      {person ? <span className="block truncate text-[14px] text-muted">{person}</span> : null}
                      {subLine(h) ? <span className="block truncate font-mono text-[12.5px] text-faint">{subLine(h)}</span> : null}
                      {open.length ? (
                        <span className="mt-1.5 flex flex-wrap gap-1.5">
                          {open.slice(0, 3).map((j) => (
                            <span key={j.uuid} className="rounded-sm border border-accent/50 px-1.5 py-0.5 font-mono text-[11.5px] text-accent">
                              {STATUS_WORD[j.status]}
                              {j.number ? ` #${j.number}` : ''}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : !clients.at && !loading && !problem ? (
            <p className="py-2 font-mono text-[13.5px] text-faint">Your customers haven’t come from ServiceM8 yet. Tap Refresh.</p>
          ) : clients.at ? (
            <div className="rounded-sm border border-dashed border-line-strong px-3.5 py-3">
              <p className="text-[15px]">No customer in ServiceM8 matches “{q.trim()}”.</p>
              {onNewNamed && looksLikeName ? (
                <button type="button" className="btn btn-ghost btn-sm mt-2.5" onClick={() => onNewNamed(q.trim())}>
                  New enquiry for {q.trim()}
                </button>
              ) : null}
            </div>
          ) : null}
          {hits.length > SHOW && !more ? (
            <button type="button" onClick={() => setMore(true)} className="mt-2 h-10 text-[14.5px] text-accent underline">
              Show all {hits.length}
            </button>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[12.5px] text-faint">
            <span>
              {hits.length ? `${hits.length} of ` : ''}
              {all.length} customers{clients.at ? `, ${clock(clients.at)}` : ''}
            </span>
            <button type="button" onClick={onRefresh} disabled={loading} className="h-9 text-accent underline">
              {loading ? 'Checking…' : 'Refresh'}
            </button>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- "Already a customer?" in New enquiry ---------- */

const WHY: Record<Same['why'], string> = { mobile: 'same mobile', email: 'same email', 'same name': 'same name', name: 'similar name' };

export function SameCustomer({
  index,
  e,
  picked,
  fresh,
  onPick,
  onUnpick,
  onFresh,
  onOpen,
}: {
  index: Entry[];
  e: { name: string; mobile: string; email: string };
  picked?: Client;
  fresh: boolean; // Raf said it's a different person
  onPick: (c: Client) => void;
  onUnpick: () => void;
  onFresh: (v: boolean) => void;
  onOpen?: (uuid: string) => void; // their page (what's typed stays on the phone)
}) {
  const same = useMemo(() => (picked ? [] : sameCustomers(index, e)), [index, e, picked]);
  if (picked)
    return (
      <div className="rounded-sm border border-accent bg-accent-soft px-3.5 py-3">
        <p className="text-[15px] leading-relaxed">
          Going on <strong>{picked.name}</strong>’s record in ServiceM8{postcodeOf(picked.address) ? ` (${postcodeOf(picked.address)})` : ''}, as a new Quote job.
        </p>
        <button type="button" className="mt-1 h-10 text-[14.5px] text-accent underline" onClick={onUnpick}>
          Not them: make a new customer
        </button>
      </div>
    );
  if (!same.length) return null;
  const sameName = same.find((s) => s.why === 'same name');
  if (fresh)
    return (
      <p className="rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-[14.5px] leading-relaxed">
        A new customer will be made, even though {same.length === 1 ? `${same[0].client.name} looks` : 'some look'} the same.{' '}
        <button type="button" className="text-accent underline" onClick={() => onFresh(false)}>
          Show them again
        </button>
      </p>
    );
  return (
    <div className="rounded-sm border border-accent bg-accent-soft px-3.5 py-3">
      <p className="font-semibold">Already a customer?</p>
      <ul className="mt-2 grid gap-2">
        {same.map((s) => (
          <li key={s.client.uuid} className="rounded-sm border border-line-strong bg-mount px-3 py-2.5">
            <p className="text-[15.5px] font-semibold leading-snug">{s.client.name}</p>
            <p className="font-mono text-[12.5px] text-faint">
              {[WHY[s.why], postcodeOf(s.client.address) || s.client.address.split(/\n|,/)[0], s.client.people.find((p) => p.mobile)?.mobile].filter(Boolean).join(' · ')}
            </p>
            <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onPick(s.client)}>
                Yes, it’s them
              </button>
              {onOpen ? (
                <button type="button" className="h-10 text-[14.5px] text-accent underline" onClick={() => onOpen(s.client.uuid)}>
                  See their jobs
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
        {sameName ? `If you don’t pick, ServiceM8 puts it on ${sameName.client.name} because the names match. ` : 'If you don’t pick, a new customer is made. '}
      </p>
      <button type="button" className="mt-1 h-10 text-[14.5px] text-accent underline" onClick={() => onFresh(true)}>
        No, a different person
      </button>
    </div>
  );
}

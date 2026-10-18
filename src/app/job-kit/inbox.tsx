'use client';
/* eslint-disable @next/next/no-img-element -- attachment photos are blob URLs fetched behind the PIN, not site images */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Client, CurrentJob } from '@/lib/servicem8';
import type { FullMail, InboxMail, ThreadMail, Who } from '@/lib/outlook';
import { SIGN_OFF } from '@/lib/mail-text';
import { Icon } from './icons';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { parseBrief } from './brief-paste';
import { whatOf, type Enquiry, type TodayLine } from './current';

/* The Inbox: Raf's info@rafcarpentry.com (Microsoft 365) in the Job Kit (server: /api/job-kit/inbox and
   src/lib/outlook.ts). The newest emails, unread first to the eye; an email with its photos and the rest of its
   conversation; who it is in ServiceM8 (or New enquiry from it); and a reply, written by Raf or drafted by Claude,
   that only goes when he presses Send from info@ (or Save as a draft in Outlook). Opening an email marks it read
   in Outlook too; nothing is deleted or moved from here.
   On this phone: the list (raf_jobkit_inbox), the last emails opened (raf_jobkit_inbox_open, so they open with no
   signal), what's being written per email (raf_jobkit_inbox_drafts) and replies sent from here until the
   conversation shows them (raf_jobkit_inbox_sent). */

const LIST_KEY = 'raf_jobkit_inbox';
const OPEN_KEY = 'raf_jobkit_inbox_open';
const DRAFTS_KEY = 'raf_jobkit_inbox_drafts';
const SENT_KEY = 'raf_jobkit_inbox_sent';
const API = '/api/job-kit/inbox';
export const INBOX_FRESH = 2 * 60_000;

export type Inbox = { mails: InboxMail[]; more: boolean; unread: number | null; mailbox: string; at: number; error?: string; detail?: string };
const EMPTY: Inbox = { mails: [], more: false, unread: null, mailbox: '', at: 0 };

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
    /* no storage, or full: the next fetch brings it back */
  }
};
function keep<T>(key: string, id: string, v: T | undefined, max: number) {
  const all = read<Record<string, T>>(key, {});
  delete all[id];
  write(key, Object.fromEntries(Object.entries(v === undefined ? all : { [id]: v, ...all }).slice(0, max)));
}

export const savedInbox = () => read<Inbox>(LIST_KEY, EMPTY);
export const openedMail = (id: string) => read<Record<string, FullMail>>(OPEN_KEY, {})[id];

/* The first page, or more of it (skip): kept on the phone; an error keeps what was there. */
export async function fetchInbox(pin: string, prev: Inbox, skip = 0): Promise<Inbox> {
  const r = await post<Omit<Inbox, 'error' | 'detail'>>(pin, { action: 'list', skip }, API);
  if (!r.ok) return { ...prev, error: r.error, detail: r.detail };
  const mails = skip ? [...prev.mails, ...r.data.mails.filter((m) => !prev.mails.some((p) => p.id === m.id))] : r.data.mails;
  const next: Inbox = { mails, more: r.data.more, unread: skip ? prev.unread : r.data.unread, mailbox: r.data.mailbox, at: r.data.at };
  write(LIST_KEY, { ...next, mails: next.mails.slice(0, 90) });
  return next;
}
export function markReadHere(inbox: Inbox, id: string, isRead: boolean): Inbox {
  const was = inbox.mails.find((m) => m.id === id);
  if (!was || was.read === isRead) return inbox;
  const next = { ...inbox, mails: inbox.mails.map((m) => (m.id === id ? { ...m, read: isRead } : m)), unread: inbox.unread === null ? null : Math.max(0, inbox.unread + (isRead ? -1 : 1)) };
  write(LIST_KEY, { ...next, mails: next.mails.slice(0, 90) });
  return next;
}

/* Who wrote it, for replies and matching: the Reply-To when there is one (ServiceM8's 'New brief' emails). */
const replyWho = (m: Pick<InboxMail, 'from' | 'replyTo'>) => m.replyTo ?? m.from;
const shownName = (w: Who) => w.name || w.email;
/* Raf himself: info@ (or another rafcarpentry.com address) or his own name, as on emails he sends from his iPhone
   with info@ copied in. The server marks those `mine` (src/lib/outlook.ts isMine). */
const OWN = /^(raf(a[lł])?\s+janczy|raf\s+carpentry|rafal\s+solutions(\s+ltd)?)$/i;
const meWho = (w: Who) => /@rafcarpentry\.com$/i.test(w.email) || OWN.test(w.name.trim());
/* Who an email is with: whoever it's from (the Reply-To first), or for one Raf sent, the person he sent it to. */
const withWho = (m: Pick<InboxMail, 'from' | 'replyTo' | 'to' | 'mine'>): Who | null => (m.mine ? ((m.to ?? []).find((w) => !meWho(w)) ?? null) : replyWho(m));
const rowName = (m: InboxMail) => {
  if (!m.mine) return shownName(replyWho(m));
  const o = withWho(m);
  return o ? `You to ${shownName(o)}` : 'You';
};
const NO_REPLY = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|notifications?|alerts?|bounce)[@+.]/i;
export const noReply = (m: Pick<InboxMail, 'from' | 'replyTo'>) => NO_REPLY.test(replyWho(m).email);
/* A first name for "Hi Kasia,": the first word of a name with a surname ("Kasia Nowak"), or a one-word name the
   address starts with (Kasia, kasia.n@...), else from kasia.nowak@...; nothing for Screwfix, info@, sales@ and the like
   (a business sends from an address that isn't its name). */
export function firstOf(w: Who) {
  if (NO_REPLY.test(w.email)) return '';
  const words = w.name
    .replace(/["']/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/[\s,]+/)
    .filter((x) => x && !x.includes('@'));
  while (words.length > 2 && /^(mr|mrs|ms|miss|dr)\.?$/i.test(words[0])) words.shift();
  const local = w.email.split('@')[0] ?? '';
  const person = words.length >= 2 || (words.length === 1 && local.toLowerCase().startsWith(words[0].toLowerCase()));
  const fromName = person ? words[0] : '';
  const fromLocal = /[._-]/.test(local) ? (local.split(/[._-]/)[0] ?? '') : '';
  const pick = /^[A-Za-zÀ-ž][a-zà-ž'-]{1,}$/.test(fromName) ? fromName : !words.length && /^[a-z]{2,}$/i.test(fromLocal) ? fromLocal : '';
  if (!pick || /^(info|sales|hello|hi|admin|office|accounts?|support|team|contact|enquiries|orders?|service|the|mr|mrs|ms|dr)$/i.test(pick)) return '';
  return pick[0].toUpperCase() + pick.slice(1).toLowerCase();
}

/* Who this is in ServiceM8: a customer whose person has this email, and their open jobs. */
export function matchCustomer(email: string, clients: Client[], jobs: CurrentJob[]) {
  const e = email.trim().toLowerCase();
  if (!e) return { client: undefined, jobs: [] as CurrentJob[] };
  const theirJobs = jobs.filter((j) => j.email.trim().toLowerCase() === e);
  const client = clients.find((c) => c.people.some((p) => p.email.trim().toLowerCase() === e)) ?? (theirJobs[0]?.client ? clients.find((c) => c.uuid === theirJobs[0].client) : undefined);
  const more = client ? jobs.filter((j) => j.client === client.uuid && !theirJobs.includes(j)) : [];
  return { client, jobs: [...theirJobs, ...more] };
}
export const customerEmails = (clients: Client[], jobs: CurrentJob[]) =>
  new Set([...clients.flatMap((c) => c.people.map((p) => p.email.trim().toLowerCase())), ...jobs.map((j) => j.email.trim().toLowerCase())].filter(Boolean));

/* "Today 21:40", "Yesterday 08:12", "Tue 13 Oct". */
export function whenText(iso: string, withTime = false) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const day = d.toLocaleDateString('sv-SE');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (day === new Date().toLocaleDateString('sv-SE')) return time;
  if (day === new Date(Date.now() - 864e5).toLocaleDateString('sv-SE')) return withTime ? `Yesterday ${time}` : 'Yesterday';
  const date = `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
  return withTime ? `${date}, ${time}` : date;
}

/* "today at 09:10", "yesterday at 08:12", "on Tue 13 Oct at 14:22", for sentences. */
export function whenSaid(iso: string) {
  const s = whenText(iso, true);
  if (/^\d/.test(s)) return `today at ${s}`;
  if (s.startsWith('Yesterday ')) return `yesterday at ${s.slice(10)}`;
  return s ? `on ${s.replace(', ', ' at ')}` : '';
}

/* New, in the main (Focused) inbox, from the last 14 days: what the Today list and the card count. */
const freshUnread = (inbox: Inbox) => inbox.mails.filter((m) => !m.read && !m.other && !m.mine && Date.now() - Date.parse(m.at) < 14 * 864e5);

export function inboxLine(inbox: Inbox) {
  if (inbox.error === 'outlook-not-set-up') return 'Connect info@rafcarpentry.com: a few steps left';
  if (!inbox.at) return inbox.error ? 'Couldn’t open the mailbox: tap to see why' : 'Your info@rafcarpentry.com emails';
  const n = freshUnread(inbox).length;
  const newest = inbox.mails.find((m) => !m.other && !m.mine);
  return [n ? `${n} unread` : 'All read', newest ? `newest ${shownName(replyWho(newest))}, ${whenText(newest.at)}` : ''].filter(Boolean).join(' · ');
}

export function inboxTodayLine(inbox: Inbox, customers: Set<string>): TodayLine | null {
  const list = freshUnread(inbox);
  if (!list.length) return null;
  const tag = (m: InboxMail) => `${shownName(replyWho(m))}${customers.has(replyWho(m).email) ? ' (customer)' : ''}`;
  // Customers first, then people, automatic emails last.
  const rank = (m: InboxMail) => (customers.has(replyWho(m).email) ? 0 : noReply(m) ? 2 : 1);
  list.sort((a, b) => rank(a) - rank(b));
  if (list.length === 1) return { text: `Email from ${tag(list[0])}`, go: 'inbox', id: list[0].id, urgent: true, icon: 'mail' };
  const names = [...new Set(list.map(tag))];
  return { text: `${list.length} new emails: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ` and ${names.length - 2} more` : ''}`, go: 'inbox', urgent: true, icon: 'mail' };
}

/* ---------- the list ---------- */

export function InboxList({
  inbox,
  loading,
  onRefresh,
  onMore,
  onOpen,
  customers,
}: {
  inbox: Inbox;
  loading: boolean;
  onRefresh: () => void;
  onMore: () => void;
  onOpen: (id: string) => void;
  customers: Set<string>;
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'customers'>(() => {
    try {
      return (sessionStorage.getItem('raf_jobkit_inbox_filter') as 'all' | 'unread' | 'customers') || 'all';
    } catch {
      return 'all';
    }
  });
  const choose = (f: typeof filter) => {
    setFilter(f);
    try {
      sessionStorage.setItem('raf_jobkit_inbox_filter', f);
    } catch {
      /* no storage */
    }
  };
  const unreadList = inbox.mails.filter((m) => !m.read && !m.mine);
  const unread = unreadList.length;
  const fresh = freshUnread(inbox).length;
  const fromCustomers = inbox.mails.filter((m) => customers.has(withWho(m)?.email ?? ''));
  const list = filter === 'unread' ? unreadList : filter === 'customers' ? fromCustomers : inbox.mails;
  return (
    <div className="pt-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
            <Icon name="mail" className="h-[30px] w-[30px] jk-sec-ink" />
            Inbox
          </h1>
          <p className="mt-1.5 truncate font-mono text-[12.5px] text-faint">
            {inbox.mailbox || 'info@rafcarpentry.com'}
            {fresh ? ` · ${fresh} new` : ''}
          </p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="h-10 shrink-0 font-mono text-[13px] text-accent underline">
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {inbox.error ? <Problem error={inbox.error} detail={inbox.detail} at={inbox.at} /> : null}
      {!inbox.at && loading ? <p className="mt-6 font-mono text-[13.5px] text-faint">Opening info@…</p> : null}

      {inbox.at ? (
        <>
          <div role="radiogroup" aria-label="Show" className="mt-5 flex gap-1.5">
            {(
              [
                ['all', 'All'],
                ['unread', `Unread${unread ? ` (${unread})` : ''}`],
                ['customers', `Customers${fromCustomers.length ? ` (${fromCustomers.length})` : ''}`],
              ] as const
            ).map(([k, t]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={filter === k}
                onClick={() => choose(k)}
                className={`h-10 rounded-sm border px-3 text-[14.5px] ${filter === k ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line-strong text-ink'}`}
              >
                {t}
              </button>
            ))}
          </div>
          {list.length ? (
            <ul className="mt-3 divide-y divide-line rounded-sm border border-line-strong bg-mount">
              {list.map((m) => {
                const w = withWho(m) ?? { name: '', email: '' };
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => onOpen(m.id)} className="relative block w-full px-3.5 py-3 pl-6 text-left">
                      {!m.read && !m.mine ? <span aria-label="Unread" className="absolute left-2 top-[19px] h-2 w-2 rounded-full bg-accent" /> : null}
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`min-w-0 truncate text-[16px] ${m.read || m.mine ? '' : 'font-semibold'} ${m.mine ? 'text-muted' : ''}`}>{rowName(m)}</span>
                        <span className={`shrink-0 font-mono text-[12px] ${m.read || m.mine ? 'text-faint' : 'font-semibold text-accent'}`}>{whenText(m.at)}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-[14.5px] ${m.read || m.mine ? 'text-muted' : 'text-ink'}`}>{m.subject || '(no subject)'}</span>
                      {m.preview ? <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-faint [overflow-wrap:anywhere]">{m.preview}</span> : null}
                      {customers.has(w.email) || m.attachments || m.other || m.flagged ? (
                        <span className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[11.5px]">
                          {customers.has(w.email) ? <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-accent">Customer</span> : null}
                          {m.attachments ? <span className="rounded-sm border border-line px-1.5 py-0.5 text-faint">Attachment</span> : null}
                          {m.flagged ? <span className="rounded-sm border border-line px-1.5 py-0.5 text-faint">Flagged</span> : null}
                          {m.other ? <span className="rounded-sm border border-line px-1.5 py-0.5 text-faint">Other</span> : null}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] text-muted">{filter === 'unread' ? 'Nothing unread.' : filter === 'customers' ? 'No emails from ServiceM8 customers in these.' : 'The Inbox is empty.'}</p>
          )}
          {inbox.more ? (
            <button type="button" onClick={onMore} disabled={loading} className="btn btn-ghost btn-sm mt-4 w-full">
              {loading ? 'Getting more…' : 'Show older emails'}
            </button>
          ) : null}
          <p className="mt-6 font-mono text-[12px] leading-relaxed text-faint">
            Opening an email marks it read in Outlook too. Nothing is deleted or moved from here, and nothing is sent until you press Send.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Problem({ error, detail, at }: { error: string; detail?: string; at?: number }) {
  return (
    <div role="alert" className="mt-5 rounded-sm border border-ink bg-mount px-3.5 py-3 text-[14.5px] leading-relaxed">
      <p>{problemText(error, detail, at)}</p>
      {error === 'outlook-not-set-up' ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>Entra: Raf Job Kit, API permissions, Mail.ReadWrite and Mail.Send, Grant admin consent.</li>
          <li>Entra: Certificates &amp; secrets, New client secret, copy the Value.</li>
          <li>Vercel: raf-carpentry, Settings, Environment Variables: MS_CLIENT_SECRET (Sensitive, Production). Then tell Claude to redeploy.</li>
        </ol>
      ) : null}
    </div>
  );
}

/* Their newest email in the list, or Raf's newest to them (the list is newest first): for the job screen's
   'Reply from info@' line. */
export function lastWith(inbox: Inbox, email: string): InboxMail | undefined {
  const e = email.trim().toLowerCase();
  return e ? inbox.mails.find((m) => (withWho(m)?.email ?? '') === e) : undefined;
}

/* ---------- one email ---------- */

type Draft = { text?: string };
/* What a reply answers: their newest email in the conversation, whichever email of it Raf opened, so he always
   replies to the last thing they said. When they haven't written back to an email Raf sent himself, it's that one
   (the server sends it to the people he sent it to). */
type Target = { id: string; to: Who; at: string; subject: string; text: string; mine: boolean; opened: boolean };
const fileSize = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const isPhoto = (type: string) => /^image\/(jpe?g|png|heic|heif|webp|gif)$/i.test(type);

/* A new enquiry from an email: their name, email and anything the email says (a mobile, an address). */
export function enquiryFromMail(m: FullMail): Enquiry {
  const w = replyWho(m);
  const b = parseBrief(m.text);
  const said = b.description.trim() || m.text.trim();
  return {
    name: b.name || (w.name && !w.name.includes('@') ? w.name : ''),
    mobile: b.mobile,
    email: b.email || w.email,
    address: b.address,
    description: `${m.subject ? `${m.subject}\n\n` : ''}${said}`.slice(0, 3500) + '\n\nFrom an email to info@.',
  };
}

export function EmailView({
  id,
  fallback,
  clients,
  jobs,
  onRead,
  onCustomer,
  onJob,
  onEnquiry,
}: {
  id: string;
  fallback?: InboxMail; // the list's copy, shown while the email comes
  clients: Client[];
  jobs: CurrentJob[];
  onRead: (id: string, read: boolean) => void;
  onCustomer: (uuid: string) => void;
  onJob: (uuid: string) => void;
  onEnquiry: (m: FullMail) => void;
}) {
  const [mail, setMail] = useState<FullMail | null>(() => openedMail(id) ?? null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const [whole, setWhole] = useState(false);
  const [allThread, setAllThread] = useState(false);
  const [sent, setSent] = useState<ThreadMail[]>(() => read<Record<string, ThreadMail[]>>(SENT_KEY, {})[id] ?? []);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => read<Record<string, Draft>>(DRAFTS_KEY, {}));
  const [quoteAll, setQuoteAll] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'' | 'send' | 'draft'>('');
  const [sendProblem, setSendProblem] = useState('');
  const [done, setDone] = useState<'' | 'sent' | 'draft'>('');
  const [doneTo, setDoneTo] = useState('');
  const [replyAnyway, setReplyAnyway] = useState(false);
  const [aiOpen, setAiOpen] = useState<boolean | null>(null);
  const [aiNote, setAiNote] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProblem, setAiProblem] = useState('');
  const [aiDone, setAiDone] = useState(false);
  const before = useRef<string | undefined>(undefined);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [fileBusy, setFileBusy] = useState('');
  const [fileProblem, setFileProblem] = useState('');
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  const load = useCallback(() => {
    setLoading(true);
    setProblem('');
    void post<{ mail: FullMail }>(readPin(), { action: 'open', id }, API).then((r) => {
      setLoading(false);
      if (!r.ok) return setProblem(problemText(r.error, r.detail));
      setMail(r.data.mail);
      keep<FullMail>(OPEN_KEY, id, r.data.mail, 15);
      onReadRef.current(id, true);
      // Sent from here and now in the conversation: the phone's copy isn't needed.
      setSent((list) => {
        const left = list.filter((s) => !r.data.mail.thread.some((t) => t.dir === 'out' && Math.abs(Date.parse(t.at) - Date.parse(s.at)) < 20 * 60e3));
        keep<ThreadMail[]>(SENT_KEY, id, left.length ? left : undefined, 30);
        return left;
      });
    });
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  const head: InboxMail | undefined = mail ?? fallback;
  const mine = Boolean(head?.mine);
  const w = (head ? withWho(head) : null) ?? { name: '', email: '' };
  const match = matchCustomer(w.email, clients, jobs);
  const thread = [...(mail?.thread ?? []), ...sent].sort((a, b) => a.at.localeCompare(b.at));
  const earlier = allThread ? thread : thread.slice(-4);
  const automatic = head ? noReply(head) : false;

  // Until the email comes (no signal, first open), the list's copy stands in; one Raf sent waits for its conversation.
  const target: Target | null =
    !head || (mine && !mail)
      ? null
      : ([
          ...(mine ? [] : [{ id: head.id, to: replyWho(head), at: head.at, subject: head.subject, text: mail ? mail.text : head.preview, mine: false, opened: true }]),
          ...(mail?.thread ?? [])
            .filter((t) => t.dir === 'in' && !NO_REPLY.test(t.from.email))
            .map((t) => ({ id: t.id, to: t.from, at: t.at, subject: t.subject, text: t.text, mine: false, opened: false })),
        ].sort((a, b) => b.at.localeCompare(a.at))[0] ?? (w.email && mail ? { id: mail.id, to: w, at: mail.at, subject: mail.subject, text: mail.text, mine: true, opened: true } : null));
  const toWho = target?.to ?? w;
  const first = firstOf(toWho);
  const calledBy = first || shownName(toWho);
  const start = first ? `Hi ${first},\n\n` : 'Hi,\n\n';
  const draft = (target ? drafts[target.id] : undefined) ?? drafts[id] ?? {};
  const text = draft.text ?? start;
  const written = Boolean(text.trim()) && text.trim() !== start.trim();
  const setDraft = (t: string | undefined) => {
    const key = target?.id ?? id;
    setDrafts((all) => {
      const next = { ...all };
      delete next[id];
      if (t === undefined) delete next[key];
      else next[key] = { text: t };
      return next;
    });
    if (key !== id) keep<Draft>(DRAFTS_KEY, id, undefined, 40);
    keep<Draft>(DRAFTS_KEY, key, t === undefined ? undefined : { text: t }, 40);
    setDone('');
    setSendProblem('');
  };
  // Raf already answered their last email (from here, Outlook or his iPhone): say when, so it isn't sent twice.
  const repliedSince = target && !target.mine ? thread.filter((t) => t.dir === 'out' && t.at > target.at).pop() : undefined;
  const youReplied = Boolean(repliedSince);
  const showReply = Boolean(target) && (!(target?.opened && !target.mine && automatic) || replyAnyway);
  const aiShown = aiOpen ?? !youReplied;
  const quoteLong = Boolean(target && (target.text.length > 520 || target.text.split('\n').length > 9));
  // 'Reply to Kasia' at the top: down to her email, with the cursor in the box right under it.
  const startReply = () => {
    quoteRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    const box = textRef.current;
    if (!box) return;
    box.focus({ preventScroll: true });
    box.setSelectionRange(box.value.length, box.value.length);
  };

  const writeDraft = () => {
    if (!mail || !target) return;
    setAiBusy(true);
    setAiProblem('');
    setAiDone(false);
    const had = written ? text : undefined;
    const all = [...thread, { dir: mine ? ('out' as const) : ('in' as const), from: mail.from, to: mail.to, subject: mail.subject, at: mail.at, text: mail.text, id: mail.id }].sort((a, b) => a.at.localeCompare(b.at));
    void post<{ text: string }>(
      readPin(),
      {
        mode: 'email',
        source: 'inbox',
        first,
        name: toWho.name,
        what: target.subject,
        status: '',
        area: '',
        description: match.jobs[0] ? `${match.jobs[0].status}: ${match.jobs[0].description}` : '',
        note: aiNote,
        thread: all.slice(-8).map((t) => ({ dir: t.dir, via: 'email', subject: t.subject, text: t.text })),
      },
      '/api/job-kit/draft',
    ).then((r) => {
      setAiBusy(false);
      if (!r.ok) return setAiProblem(problemText(r.error, r.detail));
      before.current = had;
      setDraft(r.data.text);
      setAiDone(true);
      textRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const send = (really: boolean) => {
    setSendProblem('');
    if (!target) return;
    if (!written) {
      setSendProblem('Write the reply first.');
      textRef.current?.focus({ preventScroll: true });
      textRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(really ? 'send' : 'draft');
    void post<{ sent: { to: Who[]; subject: string; draft: boolean; at: string } }>(readPin(), { action: 'reply', id: target.id, text: text.trim(), send: really }, API).then((r) => {
      setBusy('');
      if (!r.ok) return setSendProblem(`${problemText(r.error, r.detail)}${/Drafts/.test(r.detail ?? '') ? '' : ' It wasn’t sent; what you wrote is kept here.'}`);
      const to = r.data.sent.to.map(shownName).join(', ') || shownName(toWho);
      setDoneTo(to);
      if (really) {
        const mine: ThreadMail = { id: `here-${Date.now()}`, dir: 'out', from: { name: 'You', email: '' }, to: r.data.sent.to, subject: r.data.sent.subject, at: r.data.sent.at, text: text.trim() };
        setSent((list) => {
          const next = [...list, mine];
          keep<ThreadMail[]>(SENT_KEY, id, next, 30);
          return next;
        });
      }
      setDraft(undefined);
      setDone(really ? 'sent' : 'draft');
      setAiDone(false);
      setAiNote('');
      before.current = undefined;
    });
  };

  const openFile = async (att: FullMail['files'][number]) => {
    if (!mail) return;
    setFileBusy(att.id);
    setFileProblem('');
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'x-job-kit-pin': readPin(), 'content-type': 'application/json' }, body: JSON.stringify({ action: 'file', id: mail.id, att: att.id }), cache: 'no-store' });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(problemText(e.error || 'outlook-error', e.detail));
      }
      const blob = await res.blob();
      setPhoto({ url: URL.createObjectURL(blob), name: att.name });
    } catch (e) {
      setFileProblem(e instanceof Error && e.message !== 'Failed to fetch' ? e.message : problemText('offline'));
    }
    setFileBusy('');
  };

  if (!head) {
    return (
      <div className="pt-7">
        {problem ? (
          <p role="alert" className="rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
            {problem}
          </p>
        ) : (
          <p className="pt-10 text-center font-mono text-[14px] text-faint">Opening the email…</p>
        )}
      </div>
    );
  }
  const body = mail ? (whole ? mail.full : mail.text) : head.preview;
  const photos = mail?.files.filter((f) => isPhoto(f.type)) ?? [];
  const others = mail?.files.filter((f) => !isPhoto(f.type) && !f.inline) ?? [];
  return (
    <div className="pt-7">
      <h1 className="font-display text-[26px] font-[680] leading-[1.12] tracking-[-0.02em] [overflow-wrap:anywhere]">{head.subject || '(no subject)'}</h1>
      <div className="mt-3 grid gap-0.5 text-[14.5px]">
        <p className="[overflow-wrap:anywhere]">
          <span className="font-semibold">{mine ? 'You' : head.from.name || head.from.email}</span>
          {mine || head.from.name ? <span className="font-mono text-[12.5px] text-faint"> {head.from.email}</span> : null}
        </p>
        {mine && w.email ? (
          <p className="text-muted [overflow-wrap:anywhere]">
            To {w.name ? `${w.name} ` : ''}
            <span className="font-mono text-[12.5px]">{w.email}</span>
          </p>
        ) : null}
        {head.replyTo ? (
          <p className="text-muted [overflow-wrap:anywhere]">
            Replies go to {head.replyTo.name ? `${head.replyTo.name} ` : ''}
            <span className="font-mono text-[12.5px]">{head.replyTo.email}</span>
          </p>
        ) : null}
        <p className="font-mono text-[12.5px] text-faint">{whenText(head.at, true)}</p>
      </div>
      {showReply && target ? (
        <button type="button" onClick={startReply} className="btn btn-primary btn-sm mt-3 h-auto min-h-10 whitespace-normal py-2 text-left leading-snug">
          {target.mine ? `Write to ${calledBy} again` : target.opened ? `Reply to ${calledBy}` : `Reply to ${calledBy}’s last email`}
        </button>
      ) : null}

      {problem ? (
        <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
          {mail ? ' Showing the copy on this phone.' : ''}
          <button type="button" onClick={load} className="ml-2 text-accent underline">
            Try again
          </button>
        </p>
      ) : null}

      {/* Who it is in ServiceM8 */}
      <div className="mt-4 rounded-sm border border-line-strong bg-mount px-3.5 py-3">
        {match.client || match.jobs.length ? (
          <>
            <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">In ServiceM8</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {match.client ? (
                <button type="button" onClick={() => onCustomer(match.client!.uuid)} className="flex h-10 items-center gap-1.5 rounded-sm border border-accent bg-accent-soft px-3 text-[14.5px] font-semibold text-accent">
                  <Icon name="person" className="h-[18px] w-[18px]" />
                  {match.client.name}
                </button>
              ) : null}
              {match.jobs.slice(0, 3).map((j) => (
                <button key={j.uuid} type="button" onClick={() => onJob(j.uuid)} className="h-10 max-w-full truncate rounded-sm border border-line-strong px-3 text-[14px]">
                  {j.status}: {whatOf(j.description) || `job ${j.number}`}
                </button>
              ))}
            </div>
          </>
        ) : mine ? (
          <p className="text-[14.5px] leading-relaxed text-muted">{w.email ? `You sent this to ${shownName(w)}, who isn’t in ServiceM8 by this email address.` : 'You sent this one.'}</p>
        ) : mail && !automatic ? (
          <>
            <p className="text-[14.5px] leading-relaxed text-muted">{shownName(w)} isn’t in ServiceM8 by this email address.</p>
            <button type="button" onClick={() => onEnquiry(mail)} className="btn btn-ghost btn-sm mt-2.5">
              New enquiry from this email
            </button>
          </>
        ) : (
          <p className="text-[14.5px] text-muted">{automatic ? 'An automatic email: not a customer.' : 'Checking ServiceM8…'}</p>
        )}
      </div>

      <div className="mt-5 rounded-sm border border-line-strong bg-paper px-3.5 py-3">
        <p className="whitespace-pre-line text-[15.5px] leading-relaxed [overflow-wrap:anywhere]">{body || (loading ? '…' : '(no text)')}</p>
        {mail && mail.full && mail.full.length > mail.text.length + 20 ? (
          <button type="button" onClick={() => setWhole(!whole)} className="mt-2 h-9 text-[14px] text-accent underline">
            {whole ? 'Show less' : 'Show the whole email'}
          </button>
        ) : null}
      </div>

      {photos.length || others.length ? (
        <div className="mt-4">
          <p className={label}>Attachments</p>
          <ul className="mt-2 grid gap-2">
            {[...photos, ...others].map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 rounded-sm border border-line-strong bg-mount px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px]">{f.name}</span>
                  <span className="font-mono text-[12px] text-faint">{fileSize(f.size)}</span>
                </span>
                {isPhoto(f.type) ? (
                  <button type="button" onClick={() => void openFile(f)} disabled={Boolean(fileBusy)} className="btn btn-ghost btn-sm shrink-0">
                    {fileBusy === f.id ? 'Opening…' : 'View'}
                  </button>
                ) : mail?.link ? (
                  <a href={mail.link} target="_blank" rel="noopener" className="shrink-0 text-[14px] text-accent underline">
                    Open in Outlook
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          {fileProblem ? <p className="mt-2 text-[14px]">{fileProblem}</p> : null}
        </div>
      ) : null}

      {thread.length ? (
        <section className="mt-6">
          <h2 className="text-[17px] font-[650]">The rest of this conversation</h2>
          {thread.length > earlier.length ? (
            <button type="button" onClick={() => setAllThread(true)} className="mt-1 h-10 text-[14.5px] text-accent underline">
              Show {thread.length - earlier.length} earlier
            </button>
          ) : null}
          <ol className="mt-2 grid gap-2.5">
            {earlier.map((t) => (
              <li key={t.id} className={t.dir === 'out' ? 'ml-5' : 'mr-5'}>
                <div className={`rounded-sm border px-3 py-2.5 ${t.dir === 'out' ? 'border-accent/30 bg-accent-soft' : 'border-line-strong bg-paper'}`}>
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[12px] text-faint">
                    <span className={t.dir === 'in' ? 'font-semibold text-ink' : ''}>{t.dir === 'out' ? 'You' : t.from.name || t.from.email}</span>
                    <span>{whenText(t.at, true)}</span>
                  </p>
                  <p className="mt-1 line-clamp-[12] whitespace-pre-line text-[14.5px] leading-relaxed [overflow-wrap:anywhere]">{t.text || '(no text)'}</p>
                  {t.id.startsWith('here-') ? <p className="mt-1 font-mono text-[11.5px] text-faint">Sent from the Job Kit</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-4 flex flex-wrap gap-x-4 font-mono text-[12.5px]">
        <button
          type="button"
          className="h-10 text-accent underline"
          onClick={() => {
            onRead(id, false);
            void post(readPin(), { action: 'read', id, read: false }, API);
          }}
        >
          Mark as unread
        </button>
        {mail?.link ? (
          <a href={mail.link} target="_blank" rel="noopener" className="flex h-10 items-center text-accent underline">
            Open in Outlook
          </a>
        ) : null}
      </p>

      {/* The reply */}
      <section id="reply" className="mt-5 grid scroll-mt-4 grid-cols-[minmax(0,1fr)] gap-3 rounded-sm border border-line-strong bg-mount p-4">
        <h2 className="flex items-center gap-2 text-[19px] font-[650]">
          <Icon name="mail" className="h-[22px] w-[22px] text-accent" />
          Reply from info@
        </h2>
        {done ? (
          <p role="status" className="rounded-sm border border-accent bg-accent-soft px-3 py-2.5 text-[14.5px] leading-relaxed">
            {done === 'sent' ? `Sent to ${doneTo} from info@rafcarpentry.com. It’s in Sent Items in Outlook.` : `Saved in Drafts in Outlook, addressed to ${doneTo}. Finish it and send it there.`}
          </p>
        ) : null}
        {!target ? (
          <p className="text-[14.5px] leading-relaxed text-muted">
            {mail ? `You sent this one${head.from.email ? ` from ${head.from.email}` : ''} to nobody else, so there’s nobody to reply to.` : loading ? 'Opening the conversation…' : 'The conversation isn’t on this phone yet: try again when there’s signal.'}
          </p>
        ) : !showReply ? (
          <div>
            <p className="text-[14.5px] leading-relaxed text-muted">This came from an address that doesn’t take replies ({w.email}).</p>
            <button type="button" onClick={() => setReplyAnyway(true)} className="mt-1 h-10 text-[14.5px] text-accent underline">
              Reply anyway
            </button>
          </div>
        ) : (
          <>
            <p className="text-[14.5px] text-muted [overflow-wrap:anywhere]">
              To: <span className="text-ink">{shownName(toWho)}</span>
              {toWho.name ? <span className="font-mono text-[12.5px] text-faint"> {toWho.email}</span> : null}
            </p>
            <div className="rounded-sm border border-line-strong bg-paper px-3 py-1.5">
              <button type="button" onClick={() => setAiOpen(!aiShown)} aria-expanded={aiShown} className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-[15px] font-semibold">
                <span>Draft a reply with Claude</span>
                <span aria-hidden className="font-mono text-[12.5px] font-normal text-faint">
                  {aiShown ? 'Hide' : 'Show'}
                </span>
              </button>
              {aiShown ? (
                <div className="grid gap-2.5 pb-2 pt-1">
                  <label className="grid gap-1.5">
                    <span className="text-[14px] leading-snug text-muted">Anything it should say? (optional)</span>
                    <input className={`${field} h-11 text-[15px]`} value={aiNote} maxLength={600} placeholder="e.g. Yes, I can come Tuesday at 10" onChange={(e) => setAiNote(e.target.value)} />
                  </label>
                  <button type="button" className={`btn btn-sm w-full ${written ? 'btn-ghost' : 'btn-primary'}`} disabled={aiBusy || !mail} onClick={writeDraft}>
                    {aiBusy ? 'Writing…' : written ? 'Write a new draft' : 'Write the reply'}
                  </button>
                  {aiProblem ? (
                    <p role="alert" className="rounded-sm border border-ink px-3 py-2 text-[14px] leading-relaxed">
                      {aiProblem}
                    </p>
                  ) : null}
                  <p className="font-mono text-[11.5px] leading-relaxed text-faint">
                    The email, the conversation and their first name go to Claude; phone numbers, email addresses, addresses and their surname are taken out first. Nothing goes until you press Send.
                  </p>
                </div>
              ) : null}
            </div>
            {/* What this answers, right above the box, so it's in view while writing. */}
            <div ref={quoteRef} className="scroll-mt-[calc(env(safe-area-inset-top)_-_20px)] rounded-sm border border-line-strong border-l-[3px] border-l-accent bg-paper px-3 py-2.5">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[12px] text-faint">
                <span className="font-semibold text-ink">{target.mine ? `No reply from ${calledBy} yet. Your last email:` : `Replying to ${calledBy}’s last email`}</span>
                <span>{whenText(target.at, true)}</span>
              </p>
              {target.subject && target.subject !== head.subject ? <p className="mt-0.5 text-[13.5px] text-muted [overflow-wrap:anywhere]">{target.subject}</p> : null}
              <p className={`mt-1 whitespace-pre-line text-[14.5px] leading-relaxed [overflow-wrap:anywhere] ${quoteLong && !quoteAll ? 'line-clamp-[9]' : ''}`}>{target.text || '(no text)'}</p>
              {quoteLong ? (
                <button type="button" onClick={() => setQuoteAll(!quoteAll)} className="mt-1 h-9 text-[14px] text-accent underline">
                  {quoteAll ? 'Show less' : 'Show all of it'}
                </button>
              ) : null}
              {!target.opened ? <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-faint">Their newest email in this conversation, so your reply answers this one.</p> : null}
              {target.mine ? <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-faint">Your new email goes to the people you sent this to, from info@.</p> : null}
            </div>
            {repliedSince ? (
              <p className="-mt-1 text-[14px] leading-relaxed text-muted">
                You replied {whenSaid(repliedSince.at)}. Anything you send now goes as another email.
              </p>
            ) : null}
            <label className="grid gap-1.5">
              <span className={label}>Your reply</span>
              <textarea ref={textRef} className={`${field} min-h-[170px] py-2.5 leading-relaxed`} rows={7} value={text} onChange={(e) => setDraft(e.target.value)} />
            </label>
            {aiDone ? (
              <p role="status" className="-mt-1 flex flex-wrap items-center gap-x-3 text-[14px] leading-relaxed text-muted">
                <span>Claude’s draft is in the box: check it, change anything, then send.</span>
                {before.current !== undefined ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(before.current);
                      before.current = undefined;
                      setAiDone(false);
                    }}
                    className="h-9 text-accent underline"
                  >
                    Put back what you had
                  </button>
                ) : null}
              </p>
            ) : null}
            <p className="font-mono text-[12px] leading-relaxed text-faint">Signed off with: {SIGN_OFF.join(' · ')}. Their email is quoted underneath, as Outlook does.</p>
            {sendProblem ? (
              <p role="alert" className="rounded-sm border border-ink px-3 py-2.5 text-[14.5px] leading-relaxed">
                {sendProblem}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary w-full" disabled={Boolean(busy) || !mail} onClick={() => send(true)}>
              {busy === 'send' ? 'Sending…' : 'Send from info@'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm w-full" disabled={Boolean(busy) || !mail} onClick={() => send(false)}>
              {busy === 'draft' ? 'Saving…' : 'Save as a draft in Outlook instead'}
            </button>
          </>
        )}
      </section>

      {photo ? (
        <div role="dialog" aria-label={photo.name} className="fixed inset-0 z-50 flex flex-col bg-ink">
          <div className="flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] text-on-accent">
            <span className="min-w-0 truncate font-mono text-[12.5px]">{photo.name}</span>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(photo.url);
                setPhoto(null);
              }}
              className="h-11 px-2 text-[15px] font-semibold"
            >
              Close
            </button>
          </div>
          <img src={photo.url} alt={photo.name} className="min-h-0 flex-1 object-contain" />
          <p className="px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 text-center font-mono text-[12px] text-on-accent/70">Press and hold the photo to save it.</p>
        </div>
      ) : null}
    </div>
  );
}

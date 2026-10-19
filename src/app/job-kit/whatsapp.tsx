'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import { isNumber, kindOf, lastStretch, POSTCODE, withoutGreeting, type WaMsg } from '@/lib/whatsapp-chat';
import { Icon } from './icons';
import { label } from './parts';
import { parseBrief } from './brief-paste';
import { whatOf, type Enquiry } from './current';
import { indexClients, personName, postcodeOf, sameCustomers, searchClients, type Client } from './customers';
import { problemText } from './sm8-post';
import {
  bringIn,
  fileOf,
  firstName,
  getWaFile,
  noteText,
  pending,
  pickedOf,
  pickedText,
  removeChat,
  retrySend,
  sendBusy,
  updateChat,
  WaImportError,
  type WaChat,
  type WaSend,
} from './wa-store';

/* The WhatsApp section (19 Oct 2026, Raf: 'add whatsapp separate section and from the dialog pick info for job
   needed and pictures or drawings to create as well job in service m8 ... client search ... so it would be much easier
   create new job with returning client ... smartly connected with all jobkit features').
   WhatsApp lets no app read the chats on a phone (only Meta's business API, through a paid partner), so a chat comes
   in through WhatsApp's own Export Chat: the zip goes into the Job Kit, the conversation shows with its photos and
   PDFs, Raf ticks what's for the job (the last stretch of the chat is ticked to start with), says who it is in
   ServiceM8 (found by their number or name, or searched like Today's box), and sends it: a new Quote job with the
   words as its description, or a note on one of their open jobs; the photos and PDFs go into the job's diary either
   way. The photos can also start a 3D design request. Storage and sending: wa-store.ts; reading the export:
   src/lib/whatsapp-chat.ts. */

const STEPS = ['In WhatsApp, open the chat and tap their name at the top.', 'Tap Export Chat, then Attach Media.', 'Tap Save to Files, then pick that file here.'];
const ago = (t: number) => {
  const d = Math.floor((Date.now() - t) / 864e5);
  const time = new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d <= 0 ? `today ${time}` : d === 1 ? `yesterday ${time}` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dayLine = (at: string) => new Date(`${at.slice(0, 10)}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/^(\w+),/, '$1');
const filesWords = (photos: number, pdfs: number) => [photos ? count(photos, 'photo') : '', pdfs ? count(pdfs, 'PDF') : ''].filter(Boolean).join(' and ');

/* One line for a chat: where it went, or that it hasn't yet. */
export function chatStatus(c: WaChat): { text: string; tone: 'todo' | 'busy' | 'done' | 'warn' } {
  const last = c.sends[c.sends.length - 1];
  if (!last) return { text: 'Not in ServiceM8 yet', tone: 'todo' };
  const where = last.mode === 'new' ? `New job${last.number ? ` #${last.number}` : ''}` : `Added to #${last.number ?? 'a job'}`;
  if (pending(last).length) return { text: `${where}: sending ${last.sent.length + 1} of ${last.files.length}`, tone: 'busy' };
  if (last.failed.length) return { text: `${where}: ${count(last.failed.length, 'file')} didn’t go`, tone: 'warn' };
  return { text: `${where} in ServiceM8`, tone: 'done' };
}

/* Today: chats brought in but not sent to a job yet (last two weeks). */
export function waTodayLines(chats: WaChat[]) {
  const fresh = chats.filter((c) => !c.sends.length && Date.now() - c.updatedAt < 14 * 864e5 && c.picked.length);
  const failed = chats.filter((c) => c.sends.some((s) => s.failed.length));
  const lines: { text: string; id: string; urgent?: boolean }[] = [];
  for (const c of fresh.slice(0, 2)) lines.push({ text: `WhatsApp from ${c.clientName || c.name}: not in ServiceM8 yet`, id: c.id, urgent: true });
  for (const c of failed.slice(0, 1)) lines.push({ text: `WhatsApp files for ${c.clientName || c.name} didn’t all go`, id: c.id });
  return lines;
}
export function waHomeLine(chats: WaChat[]) {
  if (!chats.length) return 'Bring a customer’s chat in: the photos and words go into ServiceM8';
  const todo = chats.filter((c) => !c.sends.length).length;
  return `${count(chats.length, 'chat')}${todo ? ` · ${todo} not in ServiceM8 yet` : ''} · newest ${chats[0].clientName || chats[0].name}`;
}

/* The job a chat went to, on the job's own screen. */
export function chatsForJob(chats: WaChat[], job: string) {
  return chats.filter((c) => c.sends.some((s) => s.job === job));
}

/* ---------- bringing a chat in (the list screen, and Bring in again) ---------- */

function useBringIn(onDone: (id: string, added: number, isNew: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setProblem('');
    try {
      const r = await bringIn(f);
      onDone(r.id, r.added, r.isNew);
    } catch (e) {
      setProblem(e instanceof WaImportError ? e.message : 'The phone couldn’t read that file. Export the chat again and try once more.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, pick };
}

export function WaList({ chats, onOpen }: { chats: WaChat[]; onOpen: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const { busy, problem, pick } = useBringIn((id, added, isNew) => {
    if (isNew) onOpen(id);
    else setNote(added ? `${count(added, 'new message')} added to that chat.` : 'Nothing new in that chat since last time.');
  });
  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="chat" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        WhatsApp
      </h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">Bring in a customer’s chat, tick what’s for the job, and it goes into ServiceM8 with the photos and drawings.</p>

      <section className="mt-5 rounded-sm border border-line-strong bg-mount p-4">
        <h2 className="text-[19px] font-[650]">Bring in a chat</h2>
        <ol className="mt-2.5 grid gap-1.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-2.5 text-[15px] leading-snug">
              <span className="w-5 shrink-0 font-mono text-[13px] leading-[1.5] jk-sec-ink">{String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <input
          ref={input}
          type="file"
          accept=".zip,.txt,application/zip,text/plain"
          className="sr-only"
          aria-label="The exported WhatsApp chat"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn btn-primary mt-4 w-full" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Reading the chat…' : 'Choose the exported chat'}
        </button>
        <p className="mt-2 font-mono text-[12px] leading-snug text-faint">It stays on this phone until you send it to a job. Videos and voice notes stay in WhatsApp.</p>
        {problem ? (
          <p role="alert" className="mt-2.5 text-[14.5px] font-semibold leading-snug">
            {problem}
          </p>
        ) : null}
        {note ? (
          <p role="status" className="mt-2.5 text-[14.5px] font-semibold leading-snug jk-sec-ink">
            {note}
          </p>
        ) : null}
      </section>

      {chats.length ? (
        <section className="mt-7">
          <h2 className={label}>Chats on this phone ({chats.length})</h2>
          <ul className="mt-2.5 grid grid-cols-1 gap-2.5">
            {chats.map((c) => {
              const st = chatStatus(c);
              const last = [...c.msgs].reverse().find((m) => !m.system && (m.text || m.file));
              const photos = c.files.filter((f) => f.kind === 'photo').length;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => onOpen(c.id)} className="block w-full rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-left">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[16.5px] font-semibold leading-snug">{c.clientName || c.name}</span>
                      <span className="shrink-0 font-mono text-[12px] text-faint">{ago(c.updatedAt)}</span>
                    </span>
                    {last ? <span className="mt-0.5 block truncate text-[14.5px] text-muted">{last.text || (last.kind === 'photo' ? 'Photo' : last.file)}</span> : null}
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12.5px]">
                      <span className="text-faint">
                        {count(c.msgs.filter((m) => !m.system).length, 'message')}
                        {photos ? ` · ${count(photos, 'photo')}` : ''}
                      </span>
                      <span className={`rounded-sm border px-1.5 py-0.5 ${st.tone === 'todo' ? 'border-ink text-ink' : st.tone === 'warn' ? 'border-ink font-semibold text-ink' : 'border-line-strong jk-sec-ink'}`}>{st.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/* ---------- one chat ---------- */

function useBlobUrl(chat: string, name: string | undefined) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!name) return;
    let gone = false;
    let made = '';
    void getWaFile(chat, name).then((b) => {
      if (gone || !b) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [chat, name]);
  return url;
}

function Photo({ chat, name, onView }: { chat: string; name: string; onView: (url: string) => void }) {
  const url = useBlobUrl(chat, name);
  return (
    <span className="relative block w-[180px] max-w-full overflow-hidden rounded-sm bg-raised" style={{ aspectRatio: url ? undefined : '4 / 3' }}>
      {/* a photo from the phone's own storage (object URL): next/image can't load it */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="block h-auto w-full" /> : null}
      {url ? (
        <span
          role="button"
          tabIndex={0}
          aria-label="View the photo"
          className="absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-sm bg-ink/70 text-on-accent"
          onClick={(e) => {
            e.stopPropagation();
            onView(url);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onView(url);
            }
          }}
        >
          <Icon name="search" className="h-4 w-4" />
        </span>
      ) : null}
    </span>
  );
}

/* What a chat's new job starts with: a pasted website brief in it is read as one; else the ticked words, with the
   name, number, email and an address with a postcode picked out of what they wrote. */
export function enquiryFromChat(c: WaChat, client?: Client): Enquiry {
  const { texts, photos, pdfs, msgs } = pickedOf(c);
  const theirs = texts.filter((m) => m.from !== c.me).map((m) => m.text);
  const b = parseBrief(theirs.join('\n') || pickedText(c));
  const addressLine = [...theirs].reverse().flatMap((t) => t.split('\n')).find((l) => POSTCODE.test(l));
  // "Great, we're at 12 Park Road, N8 8JD" -> "12 Park Road, N8 8JD"; just the postcode when no street is given
  const address = addressLine
    ? (addressLine.match(/((?:flat|apartment)\s+\w+,?\s*)?\d+[a-z]?\s+[A-Z][^\n]*?\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i)?.[0] ?? addressLine.match(POSTCODE)?.[0] ?? '').trim()
    : '';
  const person = client?.people.find((p) => p.mobile) ?? client?.people[0];
  const when = msgs.length ? dayLine(msgs[msgs.length - 1].at) : '';
  const files = filesWords(photos, pdfs);
  const words = b.fromBrief ? b.description : withoutGreeting(pickedText(c));
  return {
    name: client?.name || b.name || (isNumber(c.name) ? '' : c.name),
    mobile: b.mobile || c.number || person?.mobile || '',
    email: b.email || person?.email || '',
    address: b.address || client?.address || address,
    description: `${words.slice(0, 3400)}\n\nFrom a WhatsApp chat${when ? `, ${when}` : ''}.${files ? ` ${files[0].toUpperCase()}${files.slice(1)} in the job’s diary.` : ''}`,
    client: client?.uuid,
    clientName: client?.name,
  };
}

export function WaChatView({
  chat,
  clients,
  jobs,
  onNewJob,
  onAdded,
  onDesign,
  onOpenJob,
  onCustomer,
  onGone,
}: {
  chat: WaChat;
  clients: Client[];
  jobs: CurrentJob[]; // the current jobs, for their open ones
  onNewJob: () => void; // New enquiry, filled in from the chat (enquiryFromChat)
  onAdded: (job: CurrentJob) => void; // sent to one of their open jobs
  onDesign: () => void; // a 3D design request from the photos
  onOpenJob: (uuid: string) => void;
  onCustomer: (uuid: string) => void;
  onGone: () => void;
}) {
  const index = useMemo(() => indexClients(clients), [clients]);
  const client = useMemo(
    () => (chat.client ? (clients.find((c) => c.uuid === chat.client) ?? { uuid: chat.client, name: chat.clientName ?? chat.name, address: '', people: [], edited: null }) : undefined),
    [chat.client, chat.clientName, chat.name, clients],
  );
  const them = chat.people.filter((p) => p !== chat.me);
  const themFirst = firstName(chat.clientName || chat.name) || 'them';
  const picked = useMemo(() => new Set(chat.picked), [chat.picked]);
  const sel = pickedOf(chat);
  const start = lastStretch(chat.msgs);
  const [from, setFrom] = useState(() => Math.max(0, start - 2));
  const shown = chat.msgs.slice(from);
  const [view, setView] = useState('');
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState('');
  const [sure, setSure] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(chat.added && chat.sends.length ? `${count(chat.added, 'new message')} since it went to ServiceM8: those are ticked now.` : '');
  const bring = useBringIn((_id, added) => setNote(added ? `${count(added, 'new message')} added.` : 'Nothing new since last time.'));

  // Who it is: their number, or a name in the chat, found in ServiceM8.
  const theirMobile = chat.number || parseBrief(chat.msgs.filter((m) => m.from !== chat.me).map((m) => m.text).join('\n')).mobile;
  const same = useMemo(() => (client ? [] : sameCustomers(index, { name: isNumber(chat.name) ? '' : chat.name, mobile: theirMobile, email: '' })), [client, index, chat.name, theirMobile]);
  const hits = q.trim().length >= 2 ? searchClients(index, q).slice(0, 6) : [];
  const open = client ? jobs.filter((j) => j.client === client.uuid && (j.status === 'Quote' || j.status === 'Work Order')) : [];

  const toggle = (id: string) => void updateChat(chat.id, (c) => ({ ...c, picked: c.picked.includes(id) ? c.picked.filter((x) => x !== id) : [...c.picked, id] }));
  const tickable = (m: WaMsg) => !m.system && !m.omitted && (Boolean(fileOf(chat, m)) || Boolean(m.text));
  const setAll = (on: boolean) =>
    void updateChat(chat.id, (c) => {
      const ids = c.msgs.slice(from).filter((m) => tickable(m) && (m.from !== c.me || fileOf(c, m))).map((m) => m.id);
      return { ...c, picked: on ? [...new Set([...c.picked, ...ids])] : c.picked.filter((x) => !ids.includes(x)) };
    });
  const pickClient = (c: Client | undefined) => {
    setQ('');
    void updateChat(chat.id, (x) => ({ ...x, client: c?.uuid, clientName: c?.name }), true);
  };
  const remove = () => {
    if (!sure) {
      setSure(true);
      setTimeout(() => setSure(false), 5000);
      return;
    }
    void removeChat(chat.id).then(onGone);
  };

  // a day's heading over its first message
  const heads = new Map<string, string>();
  for (let i = 0, prev = ''; i < shown.length; i++) {
    const d = shown[i].at.slice(0, 10);
    if (d !== prev) heads.set(shown[i].id, dayLine(shown[i].at));
    prev = d;
  }
  return (
    <div className="pt-7 pb-24">
      <p className="kicker">WhatsApp chat</p>
      <h1 className="mt-1 font-display text-[30px] font-[680] leading-[1.05] tracking-[-0.025em]">{chat.clientName || chat.name}</h1>
      <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-faint">
        {count(chat.msgs.filter((m) => !m.system).length, 'message')}
        {chat.files.length ? ` · ${filesWords(chat.files.filter((f) => f.kind === 'photo').length, chat.files.filter((f) => f.kind === 'pdf').length)}` : ''} · brought in {ago(chat.updatedAt)}
      </p>
      <input
        ref={input}
        type="file"
        accept=".zip,.txt,application/zip,text/plain"
        className="sr-only"
        aria-label="The exported chat, again"
        onChange={(e) => {
          void bring.pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="h-9 font-mono text-[13px] text-accent underline" onClick={() => input.current?.click()} disabled={bring.busy}>
        {bring.busy ? 'Reading…' : 'Bring it in again for newer messages'}
      </button>
      {note || bring.problem ? (
        <p role="status" className="text-[14.5px] font-semibold leading-snug jk-sec-ink">
          {bring.problem || note}
        </p>
      ) : null}

      {chat.sends.length || chat.design ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-mount p-3.5">
          <h2 className={label}>In ServiceM8</h2>
          <ul className="mt-2 grid gap-2.5">
            {chat.sends.map((s) => (
              <SendRow key={s.at} s={s} onOpen={() => onOpenJob(s.job)} onRetry={() => void retrySend(chat.id, s.at)} />
            ))}
          </ul>
          {chat.design ? <p className="mt-2 text-[14.5px]">A 3D design request was started from these photos (Designs).</p> : null}
        </section>
      ) : null}

      <section className="mt-4 rounded-sm border border-line-strong bg-mount p-3.5">
        <h2 className={label}>Who is it in ServiceM8?</h2>
        {client ? (
          <div className="mt-2">
            <p className="text-[16px] font-semibold leading-snug">{client.name}</p>
            <p className="text-[14px] text-muted">
              {[postcodeOf(client.address), client.people.find((p) => p.mobile)?.mobile].filter(Boolean).join(' · ') || 'A customer in ServiceM8'}
              {open.length ? ` · ${count(open.length, 'open job')}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 text-[14.5px]">
              <button type="button" className="h-10 text-accent underline" onClick={() => onCustomer(client.uuid)}>
                See their jobs
              </button>
              <button type="button" className="h-10 text-muted underline" onClick={() => pickClient(undefined)}>
                Not them
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            {same.length ? (
              <ul className="grid gap-2">
                {same.map((s) => (
                  <li key={s.client.uuid} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold">{s.client.name}</span>
                      <span className="block truncate text-[13.5px] text-muted">
                        {s.why === 'mobile' ? 'Same mobile' : s.why === 'same name' ? 'Same name' : 'A name like it'}
                        {postcodeOf(s.client.address) ? ` · ${postcodeOf(s.client.address)}` : ''}
                      </span>
                    </span>
                    <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => pickClient(s.client)}>
                      It’s them
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14.5px] leading-snug text-muted">No customer with this {theirMobile ? 'number or name' : 'name'} yet. Search, or it’ll be a new customer.</p>
            )}
            <input
              type="search"
              className="mt-3 h-11 w-full min-w-0 rounded-sm border border-line-strong bg-paper px-3 text-[16px] focus:border-accent focus:outline-none"
              placeholder="Find a customer: name, mobile, postcode"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Find a customer in ServiceM8"
            />
            {hits.length ? (
              <ul className="mt-1.5 divide-y divide-line">
                {hits.map((h) => (
                  <li key={h.client.uuid}>
                    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left" onClick={() => pickClient(h.client)}>
                      <span className="min-w-0">
                        <span className="block truncate text-[15.5px] font-semibold">{h.client.name}</span>
                        <span className="block truncate text-[13.5px] text-muted">
                          {[postcodeOf(h.client.address), h.client.people.map(personName).filter((n) => n && n !== h.client.name)[0]].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-[14px] text-accent">Pick</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : q.trim().length >= 2 ? (
              <p className="mt-2 text-[14px] text-muted">Nobody found: it’ll be a new customer.</p>
            ) : null}
          </div>
        )}
      </section>

      {chat.people.length > 1 && !chat.me ? (
        <section className="mt-4 rounded-sm border border-ink bg-mount p-3.5">
          <h2 className="text-[15.5px] font-semibold">Which one is you?</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {chat.people.map((p) => (
              <button key={p} type="button" className="btn btn-ghost btn-sm" onClick={() => void updateChat(chat.id, (c) => ({ ...c, me: p }))}>
                {p}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[19px] font-[650]">Tick what’s for the job</h2>
          <span className="flex gap-3 font-mono text-[13px]">
            <button type="button" className="h-9 text-accent underline" onClick={() => setAll(true)}>
              Tick all from {themFirst}
            </button>
            <button type="button" className="h-9 text-muted underline" onClick={() => setAll(false)}>
              None
            </button>
          </span>
        </div>
        {from > 0 ? (
          <button type="button" className="mt-2 h-10 w-full rounded-sm border border-dashed border-line-strong font-mono text-[13px] text-muted" onClick={() => setFrom(Math.max(0, from - 100))}>
            Show {count(Math.min(100, from), 'earlier message')}
            {from > 100 ? ` (of ${from})` : ''}
          </button>
        ) : null}
        {start > 0 && from <= start ? <p className="mt-2 font-mono text-[12px] leading-snug text-faint">Ticked to start with: from {dayLine(chat.msgs[start].at)}, after a gap of a week or more.</p> : null}
        <ol className="mt-2 grid grid-cols-1 gap-1.5">
          {shown.map((m) => {
            const head = heads.get(m.id);
            const mine = m.from === chat.me;
            const file = fileOf(chat, m);
            const can = tickable(m);
            const on = picked.has(m.id);
            return (
              <li key={m.id}>
                {head ? <p className="mb-1 mt-3 text-center font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">{head}</p> : null}
                {m.system ? (
                  <p className="px-6 text-center text-[12.5px] leading-snug text-faint">{m.text}</p>
                ) : (
                  <div className={`flex items-start gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {can ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={`${on ? 'Ticked' : 'Not ticked'}: ${m.text.slice(0, 40) || (file ? (kindOf(file) === 'pdf' ? 'PDF' : 'photo') : 'message')}`}
                        onClick={() => toggle(m.id)}
                        className={`jk-wa-tick mt-1.5 ${on ? 'is-on' : ''}`}
                      >
                        {on ? '✓' : ''}
                      </button>
                    ) : (
                      <span className="w-7 shrink-0" />
                    )}
                    <div
                      className={`jk-wa-bubble ${mine ? 'is-mine' : ''} ${on ? 'is-on' : ''} ${can ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (can) toggle(m.id);
                      }}
                    >
                      {!mine && them.length > 1 ? <p className="mb-0.5 font-mono text-[11.5px] jk-sec-ink">{m.from}</p> : null}
                      {file && kindOf(file) === 'photo' ? <Photo chat={chat.id} name={file} onView={setView} /> : null}
                      {file && kindOf(file) === 'pdf' ? (
                        <span className="flex items-center gap-2 rounded-sm border border-line-strong bg-paper px-2.5 py-2 text-[14px]">
                          <span className="rounded-sm bg-ink px-1 font-mono text-[10.5px] text-on-accent">PDF</span>
                          <span className="min-w-0 truncate">{file.replace(/^\d{8}-/, '')}</span>
                        </span>
                      ) : null}
                      {m.file && !file ? (
                        <span className="block font-mono text-[12.5px] text-faint">{m.kind === 'audio' ? 'Voice note: stays in WhatsApp' : m.kind === 'video' ? 'Video: stays in WhatsApp' : m.kind === 'sticker' ? 'Sticker' : 'A file: stays in WhatsApp'}</span>
                      ) : null}
                      {m.omitted ? <span className="block font-mono text-[12.5px] text-faint">{m.kind === 'video' ? 'Video' : m.kind === 'audio' ? 'Voice note' : 'Photo'} not in the export</span> : null}
                      {m.text ? <p className={`whitespace-pre-wrap break-words text-[15px] leading-snug ${file ? 'mt-1.5' : ''}`}>{m.text}</p> : null}
                      <p className="mt-0.5 text-right font-mono text-[11px] text-faint">{m.at.slice(11, 16)}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-10 border-t border-line pt-4">
        <button type="button" className={`h-10 text-[14px] underline ${sure ? 'font-semibold text-ink' : 'text-muted'}`} onClick={remove}>
          {sure ? 'Tap again to take it off this phone' : 'Take this chat off this phone'}
        </button>
        <p className="font-mono text-[12px] leading-snug text-faint">WhatsApp and ServiceM8 keep everything; only this phone’s copy goes.</p>
      </div>

      {/* what's ticked, and where it can go */}
      <div className="jk-wa-bar">
        <div className="mx-auto flex max-w-[620px] items-center gap-3 px-4">
          <p className="min-w-0 flex-1 text-[14px] leading-snug">
            <span className="block font-semibold">
              {sel.msgs.length ? [count(sel.texts.length, 'message'), sel.photos ? count(sel.photos, 'photo') : '', sel.pdfs ? count(sel.pdfs, 'PDF') : ''].filter(Boolean).join(' · ') : 'Nothing ticked'}
            </span>
            <span className="block truncate text-muted">{client ? `For ${client.name}` : 'Tick the bits for the job'}</span>
          </p>
          <button type="button" className="btn btn-primary btn-sm shrink-0 disabled:opacity-40" disabled={!sel.msgs.length} onClick={() => setSheet(true)}>
            Send to ServiceM8
          </button>
        </div>
      </div>

      {sheet ? (
        <SendSheet
          chat={chat}
          client={client}
          open={open}
          onClose={() => setSheet(false)}
          onNewJob={() => {
            setSheet(false);
            onNewJob();
          }}
          onAddTo={(j) => {
            setSheet(false);
            onAdded(j);
          }}
          onDesign={() => {
            setSheet(false);
            onDesign();
          }}
        />
      ) : null}
      {view ? (
        <div className="jk-wa-view" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setView('')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view} alt="" />
          <button type="button" className="btn btn-sm absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] bg-mount" onClick={() => setView('')}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SendRow({ s, onOpen, onRetry }: { s: WaSend; onOpen: () => void; onRetry: () => void }) {
  const left = pending(s).length;
  const busy = sendBusy(s) && !s.failed.length;
  const where = s.mode === 'new' ? `New job${s.number ? ` #${s.number}` : ''}` : `Added to #${s.number ?? 'a job'}`;
  return (
    <li className="text-[14.5px] leading-snug">
      <p>
        <span className="font-semibold">{where}</span>
        {s.what ? `: ${s.what}` : ''}
      </p>
      <p className={`font-mono text-[12.5px] ${s.failed.length ? 'font-semibold text-ink' : 'text-muted'}`}>
        {s.files.length ? (left ? `Sending ${s.sent.length + 1} of ${s.files.length}…` : `${s.sent.length} of ${count(s.files.length, 'file')} in the job’s diary`) : 'No files'}
        {s.note ? (s.noteDone ? ' · messages added as a note' : ' · note to add') : ''}
        {s.failed.length ? ` · ${s.failed.length} didn’t go${s.error ? ` (${problemText(s.error)})` : ''}` : busy && s.error ? ` · waiting: ${problemText(s.error)}` : ''}
      </p>
      <div className="flex gap-4">
        <button type="button" className="h-9 text-accent underline" onClick={onOpen}>
          Open the job
        </button>
        {s.failed.length || (s.error && left) ? (
          <button type="button" className="h-9 text-accent underline" onClick={onRetry}>
            Send again
          </button>
        ) : null}
      </div>
    </li>
  );
}

function SendSheet({
  chat,
  client,
  open,
  onClose,
  onNewJob,
  onAddTo,
  onDesign,
}: {
  chat: WaChat;
  client?: Client;
  open: CurrentJob[];
  onClose: () => void;
  onNewJob: () => void;
  onAddTo: (j: CurrentJob) => void;
  onDesign: () => void;
}) {
  const sel = pickedOf(chat);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const files = filesWords(sel.photos, sel.pdfs);
  return (
    <div className="jk-key-back" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="jk-wa-send" className="jk-key" onClick={(e) => e.stopPropagation()}>
        <h2 id="jk-wa-send" ref={title} tabIndex={-1} className="font-display text-[22px] font-[680] leading-tight tracking-[-0.02em]">
          Send to ServiceM8
        </h2>
        <p className="mt-1 text-[14.5px] leading-snug text-muted">
          {count(sel.texts.length, 'message')}
          {files ? `, ${files}` : ''}
          {client ? `, for ${client.name}` : ''}.
        </p>
        <div className="mt-4 grid gap-2.5">
          <button type="button" className="jk-wa-choice is-main" onClick={onNewJob}>
            <span className="block font-semibold">New job{client ? ` for ${client.name}` : ''}</span>
            <span className="block text-[13.5px] leading-snug">A Quote job with the messages as its description{files ? `, the ${files} in its diary` : ''}. You check it first.</span>
          </button>
          {open.map((j) => (
            <button key={j.uuid} type="button" className="jk-wa-choice" onClick={() => onAddTo(j)}>
              <span className="block font-semibold">
                Add to #{j.number}: {whatOf(j.description) || 'their job'}
              </span>
              <span className="block text-[13.5px] leading-snug text-muted">
                {j.status} · the messages as a note{files ? `, the ${files} in its diary` : ''}.
              </span>
            </button>
          ))}
          {sel.photos ? (
            <button type="button" className="jk-wa-choice" onClick={onDesign}>
              <span className="block font-semibold">A 3D design request from the photos</span>
              <span className="block text-[13.5px] leading-snug text-muted">The {count(sel.photos, 'photo')} as the space, the messages as the brief.</span>
            </button>
          ) : null}
        </div>
        {!client ? <p className="mt-3 font-mono text-[12px] leading-snug text-faint">Pick who it is above to add to one of their open jobs.</p> : null}
        <button type="button" className="btn btn-ghost mt-4 w-full" onClick={onClose}>
          Not yet
        </button>
      </div>
    </div>
  );
}

/* On a job's screen: the chat it came from, and how its files are getting on. */
export function WaJobBox({ chats, job, onOpen }: { chats: WaChat[]; job: string; onOpen: (id: string) => void }) {
  const list = chatsForJob(chats, job);
  if (!list.length) return null;
  return (
    <section className="jk-sec-whatsapp mt-4 rounded-sm border border-line-strong bg-mount p-3.5">
      <h2 className="flex items-center gap-2 font-mono text-[12.5px] uppercase tracking-[0.06em] jk-sec-ink">
        <Icon name="chat" className="h-[18px] w-[18px]" /> From WhatsApp
      </h2>
      <ul className="mt-2 grid gap-2">
        {list.map((c) =>
          c.sends
            .filter((s) => s.job === job)
            .map((s) => {
              const left = pending(s).length;
              return (
                <li key={`${c.id}-${s.at}`}>
                  <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
                      <span className="block font-semibold">{c.name}’s chat</span>
                      <span className={`block font-mono text-[12.5px] ${s.failed.length ? 'font-semibold text-ink' : 'text-muted'}`}>
                        {s.files.length ? (left ? `Sending ${s.sent.length + 1} of ${s.files.length}…` : `${s.sent.length} of ${count(s.files.length, 'file')} in the diary`) : 'Words only'}
                        {s.failed.length ? ` · ${s.failed.length} didn’t go` : ''}
                      </span>
                    </span>
                    <span aria-hidden className="jk-sec-ink">
                      →
                    </span>
                  </button>
                </li>
              );
            }),
        )}
      </ul>
    </section>
  );
}

/* What an added-to-a-job trip carries. */
export const addSend = (c: WaChat, j: CurrentJob): Omit<WaSend, 'at' | 'sent' | 'failed'> => {
  const { files, texts } = pickedOf(c);
  return { job: j.uuid, number: j.number, what: whatOf(j.description), mode: 'added', files, note: texts.length ? noteText(c) : undefined };
};

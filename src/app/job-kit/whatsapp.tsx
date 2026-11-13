'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import { isNumber, kindOf, lastStretch, POSTCODE, withoutGreeting, type WaMsg } from '@/lib/whatsapp-chat';
import { Icon } from './icons';
import { label } from './parts';
import { parseBrief } from './brief-paste';
import { whatOf, type Enquiry } from './current';
import { indexClients, personName, postcodeOf, sameCustomers, searchClients, type Client } from './customers';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { fillTemplate, TEMPLATES, windowLeft } from '@/lib/wa-live';
import {
  bringIn,
  hideLive,
  loadThread,
  pullLive,
  readLive,
  sendLive,
  useLiveInfo,
  type WaRead,
  fileOf,
  firstName,
  getWaFile,
  getWaThumb,
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

/* The device that has a chat's photos and PDFs, for one on the other device ('your iPhone'). */
export const holder = (c: WaChat) => (c.remote ? `your ${c.importedOn || 'phone'}` : '');

/* One line for a chat: where it went, or that it hasn't yet. */
export function chatStatus(c: WaChat): { text: string; tone: 'todo' | 'busy' | 'done' | 'warn' } {
  const last = c.sends[c.sends.length - 1];
  if (!last) return { text: 'Not in ServiceM8 yet', tone: 'todo' };
  const where = last.mode === 'new' ? `New job${last.number ? ` #${last.number}` : ''}` : `Added to #${last.number ?? 'a job'}`;
  if (pending(last).length && c.remote) return { text: `${where}: ${count(pending(last).length, 'file')} to go from ${holder(c)}`, tone: 'busy' };
  if (pending(last).length) return { text: `${where}: sending ${last.sent.length + 1} of ${last.files.length}`, tone: 'busy' };
  if (last.failed.length) return { text: `${where}: ${count(last.failed.length, 'file')} didn’t go`, tone: 'warn' };
  return { text: `${where} in ServiceM8`, tone: 'done' };
}

/* ---------- live chats: what Claude made of them ---------- */

export const KIND_WORDS: Record<WaRead['kind'], string> = { new_enquiry: 'New enquiry', customer_update: 'Customer', supplier: 'Supplier or trade', personal: 'Not work', other: 'Other' };
/* A chat for the job list: exported ones always; live ones once Claude reads them as an enquiry or a customer (and
   before it has read them). */
export const isWork = (c: WaChat) => !c.live || !c.read?.kind || c.read.kind === 'new_enquiry' || c.read.kind === 'customer_update';
const lastSendAt = (c: WaChat) => c.sends[c.sends.length - 1]?.at ?? 0;
/* A live chat with something for Raf: an enquiry or a customer's news since it last went to ServiceM8, not waiting
   on them. */
export function needsYou(c: WaChat) {
  const r = c.read;
  if (!c.live || c.hidden || !r || r.error || !(r.kind === 'new_enquiry' || r.kind === 'customer_update')) return false;
  if ((r.upto ?? 0) <= lastSendAt(c) || r.waiting === 'them') return false;
  // a customer's news: answered once Raf has written after it (an enquiry waits until it's in ServiceM8)
  const mine = [...c.msgs].reverse().find((m) => m.from === c.me && !m.system);
  return !(r.kind === 'customer_update' && (mine?.ts ?? 0) > (r.upto ?? 0));
}
const lowerFirst = (s: string) => (s && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/* Today: live chats that need Raf; chats brought in but not sent to a job yet (last two weeks). */
export function waTodayLines(chats: WaChat[]) {
  const lines: { text: string; id: string; urgent?: boolean }[] = [];
  for (const c of chats.filter(needsYou).slice(0, 3)) {
    const who = c.clientName || c.name;
    lines.push({
      text: c.read!.kind === 'new_enquiry' ? `WhatsApp enquiry from ${who}${c.read!.what ? `: ${lowerFirst(c.read!.what)}` : ''}` : `WhatsApp from ${who}${c.read!.what ? `: ${lowerFirst(c.read!.what)}` : ''}`,
      id: c.id,
      urgent: true,
    });
  }
  const fresh = chats.filter((c) => !c.live && !c.sends.length && Date.now() - c.updatedAt < 14 * 864e5 && c.picked.length);
  const failed = chats.filter((c) => c.sends.some((s) => s.failed.length));
  for (const c of fresh.slice(0, 2)) lines.push({ text: `WhatsApp from ${c.clientName || c.name}: not in ServiceM8 yet`, id: c.id, urgent: true });
  for (const c of failed.slice(0, 1)) lines.push({ text: `WhatsApp files for ${c.clientName || c.name} didn’t all go`, id: c.id });
  return lines;
}
export function waHomeLine(chats: WaChat[]) {
  if (!chats.length) return 'Bring a customer’s chat in: the photos and words go into ServiceM8';
  const live = chats.filter((c) => c.live && !c.hidden && isWork(c));
  const need = chats.filter(needsYou).length;
  if (live.length) return `${count(live.length, 'chat')}${need ? ` · ${need} need${need === 1 ? 's' : ''} you` : ''} · newest ${live[0].clientName || live[0].name}`;
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
  const info = useLiveInfo();
  const [showOther, setShowOther] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const { busy, problem, pick } = useBringIn((id, added, isNew) => {
    if (isNew) onOpen(id);
    else setNote(added ? `${count(added, 'new message')} added to that chat.` : 'Nothing new in that chat since last time.');
  });
  useEffect(() => {
    void pullLive(true);
  }, []);
  const live = chats.filter((c) => c.live);
  const brought = chats.filter((c) => !c.live);
  const need = live.filter(needsYou);
  const work = live.filter((c) => !c.hidden && !needsYou(c) && isWork(c));
  const other = live.filter((c) => !c.hidden && !isWork(c));
  const hidden = live.filter((c) => c.hidden);
  const linked = info.linked === true || live.length > 0;
  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="chat" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        WhatsApp
      </h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        {linked
          ? 'Your chats come in by themselves. Claude reads the new ones, and an enquiry goes into ServiceM8 with its photos in a couple of taps.'
          : 'Bring in a customer’s chat, tick what’s for the job, and it goes into ServiceM8 with the photos and drawings.'}
      </p>

      <LiveCard />

      {need.length ? <ChatGroup title={`Need you (${need.length})`} list={need} onOpen={onOpen} /> : null}
      {work.length ? <ChatGroup title={need.length ? 'Other chats' : 'Chats'} list={work} onOpen={onOpen} /> : null}
      {other.length ? (
        <section className="mt-6">
          <button type="button" className="flex h-10 w-full items-center justify-between text-left" aria-expanded={showOther} onClick={() => setShowOther(!showOther)}>
            <span className={label}>Not work ({other.length})</span>
            <span className="font-mono text-[13px] text-accent">{showOther ? 'Hide' : 'Show'}</span>
          </button>
          {showOther ? <ChatGroup list={other} onOpen={onOpen} /> : <p className="font-mono text-[12px] text-faint">Friends, family, suppliers: Claude read them as not a job.</p>}
        </section>
      ) : null}
      {hidden.length ? (
        <section className="mt-4">
          <button type="button" className="flex h-10 w-full items-center justify-between text-left" aria-expanded={showHidden} onClick={() => setShowHidden(!showHidden)}>
            <span className={label}>Hidden ({hidden.length})</span>
            <span className="font-mono text-[13px] text-accent">{showHidden ? 'Hide' : 'Show'}</span>
          </button>
          {showHidden ? <ChatGroup list={hidden} onOpen={onOpen} /> : null}
        </section>
      ) : null}

      <section className={`mt-7 rounded-sm border border-line-strong bg-mount p-4 ${linked ? 'border-dashed' : ''}`}>
        <h2 className="text-[19px] font-[650]">{linked ? 'Bring in an older chat' : 'Bring in a chat'}</h2>
        {linked ? <p className="mt-1 text-[14.5px] leading-snug text-muted">Only for a chat from before WhatsApp was linked that isn’t above.</p> : null}
        <ol className="mt-2.5 grid gap-1.5">
          {STEPS.map((st, i) => (
            <li key={st} className="flex gap-2.5 text-[15px] leading-snug">
              <span className="w-5 shrink-0 font-mono text-[13px] leading-[1.5] jk-sec-ink">{String(i + 1).padStart(2, '0')}</span>
              <span>{st}</span>
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
        <button type="button" className={`btn mt-4 w-full ${linked ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => input.current?.click()}>
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

      {brought.length ? <ChatGroup title={`${linked ? 'Brought in' : 'Chats on this phone'} (${brought.length})`} list={brought} onOpen={onOpen} /> : null}
    </div>
  );
}

function ChatGroup({ title, list, onOpen }: { title?: string; list: WaChat[]; onOpen: (id: string) => void }) {
  return (
    <section className={title ? 'mt-7' : 'mt-1'}>
      {title ? <h2 className={label}>{title}</h2> : null}
      <ul className="mt-2.5 grid grid-cols-1 gap-2.5">
        {list.map((c) => (
          <ChatRow key={c.id} c={c} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}

function ChatRow({ c, onOpen }: { c: WaChat; onOpen: (id: string) => void }) {
  const st = chatStatus(c);
  const last = [...c.msgs].reverse().find((m) => !m.system && (m.text || m.file));
  const photos = c.files.filter((f) => f.kind === 'photo').length;
  const need = needsYou(c);
  return (
    <li>
      <button type="button" data-jk-id={c.id} onClick={() => onOpen(c.id)} className={`block w-full rounded-sm border bg-mount px-3.5 py-3 text-left ${need ? 'border-ink' : 'border-line-strong'}`}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[16.5px] font-semibold leading-snug">{c.clientName || c.name}</span>
          <span className="shrink-0 font-mono text-[12px] text-faint">{ago(c.updatedAt)}</span>
        </span>
        {c.live && c.read?.what ? <span className="mt-0.5 block truncate text-[14.5px] font-semibold jk-sec-ink">{c.read.what}</span> : null}
        {last ? (
          <span className="mt-0.5 block truncate text-[14.5px] text-muted">
            {c.live && last.from === c.me ? 'You: ' : ''}
            {last.text || (last.kind === 'photo' ? 'Photo' : last.kind === 'pdf' ? 'PDF' : last.kind === 'video' ? 'Video' : last.kind === 'audio' ? 'Voice note' : last.file)}
          </span>
        ) : null}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12.5px]">
          <span className="text-faint">
            {count(c.msgs.filter((m) => !m.system).length, 'message')}
            {photos ? ` · ${count(photos, 'photo')}` : ''}
          </span>
          {c.live && c.read?.kind && !c.read.error ? <span className="rounded-sm border border-line-strong px-1.5 py-0.5 text-muted">{KIND_WORDS[c.read.kind]}</span> : null}
          {c.live && c.readState === 'working' ? <span className="rounded-sm border border-line-strong px-1.5 py-0.5 text-muted">Claude is reading it</span> : null}
          {!c.live || c.sends.length || need ? (
            <span className={`rounded-sm border px-1.5 py-0.5 ${st.tone === 'todo' ? 'border-ink text-ink' : st.tone === 'warn' ? 'border-ink font-semibold text-ink' : 'border-line-strong jk-sec-ink'}`}>{st.text}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/* The link: is WhatsApp linked, is it set up to send here, how much has come in, and the message templates. */
type LiveStatus = {
  linked: boolean;
  webhook: 'ok' | 'other' | 'none' | 'unknown';
  templates: { name: string; label: string; status: string; category: string; reason?: string }[] | null;
  store: { chats: number; msgs: number; inbound: number; files: number; history: number; lastAt: number | null; meta: Record<string, { value: unknown; at: number }> };
};
function LiveCard() {
  const [st, setSt] = useState<LiveStatus | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState('');
  const take = (r: Awaited<ReturnType<typeof post<LiveStatus>>>) => {
    if (r.ok) {
      setSt(r.data);
      setProblem('');
    } else if (r.error !== 'sync-not-set-up' && r.error !== 'no-pin') setProblem(problemText(r.error, r.detail));
  };
  const load = () => post<LiveStatus>(readPin(), { action: 'status' }, '/api/job-kit/wa').then(take);
  useEffect(() => {
    let gone = false;
    const ask = () =>
      void post<LiveStatus>(readPin(), { action: 'status' }, '/api/job-kit/wa').then((r) => {
        if (!gone) take(r);
      });
    ask();
    // the card stays on screen beside a chat on a computer, so its counts are asked for again every minute
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ask();
    }, 60000);
    return () => {
      gone = true;
      clearInterval(t);
    };
  }, []);
  const act = async (action: 'setup' | 'templates-make') => {
    setBusy(action);
    const r = await post<{ ok?: true }>(readPin(), { action }, '/api/job-kit/wa');
    setBusy('');
    if (!r.ok) setProblem(problemText(r.error, r.detail));
    await load();
  };
  if (!st) return problem ? <p className="mt-4 text-[14.5px] font-semibold">{problem}</p> : null;
  if (!st.linked)
    return (
      <section className="mt-5 rounded-sm border border-dashed border-line-strong p-4" data-wa-live="off">
        <h2 className="text-[17px] font-[650]">Live WhatsApp isn’t linked yet</h2>
        <p className="mt-1 text-[14.5px] leading-snug text-muted">Once your number is linked through 360dialog, every chat comes in here by itself and Claude turns new enquiries into jobs. Until then, bring a chat in below.</p>
      </section>
    );
  const history = st.store.meta.history?.value as { off?: boolean; progress?: number } | undefined;
  const templates = st.templates ?? [];
  const missing = templates.some((t) => t.status === 'MISSING');
  return (
    <section className="mt-5 rounded-sm border border-line-strong bg-mount p-4" data-wa-live="on">
      <h2 className="flex items-center gap-2 text-[17px] font-[650]">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-whatsapp" aria-hidden />
        Live: chats come in by themselves
      </h2>
      <p className="mt-1 font-mono text-[12.5px] leading-relaxed text-faint">
        {st.store.lastAt ? `Last message ${ago(st.store.lastAt)}` : 'Nothing in yet'} · {count(st.store.chats, 'chat')} · {count(st.store.files, 'photo or PDF', 'photos and PDFs')} kept
        {history?.off ? ' · past chats weren’t shared' : st.store.history ? ` · ${count(st.store.history, 'past message')}${history?.progress && history.progress < 100 ? ` (${history.progress}% in)` : ''}` : ''}
      </p>
      {st.webhook !== 'ok' ? (
        <div className="mt-3 rounded-sm border border-ink p-3">
          <p className="text-[14.5px] font-semibold leading-snug">{st.webhook === 'unknown' ? 'Couldn’t check where WhatsApp sends your messages.' : 'WhatsApp isn’t sending your messages here yet.'}</p>
          <button type="button" className="btn btn-primary btn-sm mt-2" disabled={busy === 'setup'} onClick={() => void act('setup')}>
            {busy === 'setup' ? 'Setting up…' : 'Finish setting up'}
          </button>
        </div>
      ) : null}
      {templates.length ? (
        <div className="mt-3">
          <h3 className={label}>Message templates (for after 24 hours)</h3>
          <ul className="mt-1.5 grid gap-1">
            {templates.map((t) => (
              <li key={t.name} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate">{t.label}</span>
                <span className={`shrink-0 font-mono text-[12px] ${t.status === 'APPROVED' ? 'jk-sec-ink' : t.status === 'REJECTED' ? 'font-semibold text-ink' : 'text-faint'}`}>
                  {t.status === 'APPROVED' ? `Approved · ${t.category === 'MARKETING' ? '£0.0458' : '£0.0159'} each` : t.status === 'MISSING' ? 'Not made yet' : t.status === 'REJECTED' ? `Turned down${t.reason ? `: ${t.reason.toLowerCase().replace(/_/g, ' ')}` : ''}` : 'Meta is checking it'}
                </span>
              </li>
            ))}
          </ul>
          {missing ? (
            <button type="button" className="btn btn-ghost btn-sm mt-2" disabled={busy === 'templates-make'} onClick={() => void act('templates-make')}>
              {busy === 'templates-make' ? 'Sending them to Meta…' : 'Make the message templates'}
            </button>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold leading-snug">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

/* ---------- one chat ---------- */

/* The photo from this device's storage, or (a chat brought in on the other device) its small preview. */
function useBlobUrl(chat: string, name: string | undefined) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!name) return;
    let gone = false;
    let made = '';
    void getWaFile(chat, name).then(async (b) => {
      if (gone) return;
      if (!b) {
        const t = await getWaThumb(chat, name).catch(() => undefined);
        if (!gone && t) setUrl(t);
        return;
      }
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
  // a live chat Claude has read: what they want as the first line (the job's name in the lists), then their words
  const said = withoutGreeting(pickedText(c));
  const words = b.fromBrief ? b.description : c.live && c.read?.what && !c.read.error ? `${c.read.what}\n\n${said}` : said;
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
  links = [],
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
  links?: { label: string; href: string }[]; // for the reply box: their design, the 3D library
}) {
  const index = useMemo(() => indexClients(clients), [clients]);
  const info = useLiveInfo();
  const [readProblem, setReadProblem] = useState('');
  // a live chat: the whole thread from the server the first time it's opened (a pull brings only the last 30 days)
  useEffect(() => {
    if (chat.live && (!chat.threadAt || Date.now() - chat.threadAt > 10 * 60000)) void loadThread(chat.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);
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
      <p className="kicker">{chat.live ? 'WhatsApp · live' : 'WhatsApp chat'}</p>
      <h1 className="mt-1 font-display text-[30px] font-[680] leading-[1.05] tracking-[-0.025em]">{chat.clientName || chat.name}</h1>
      <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-faint">
        {count(chat.msgs.filter((m) => !m.system).length, 'message')}
        {chat.files.length ? ` · ${filesWords(chat.files.filter((f) => f.kind === 'photo').length, chat.files.filter((f) => f.kind === 'pdf').length)}` : ''}
        {chat.live ? ` · ${chat.number} · last message ${ago(chat.updatedAt)}` : ` · brought in ${ago(chat.updatedAt)}`}
        {chat.remote ? ` on ${holder(chat)}` : ''}
      </p>
      {chat.remote && chat.files.length ? (
        <p className="mt-1 text-[14px] leading-snug text-muted">The photos show as small previews here. The full ones are on {holder(chat)} and go into ServiceM8 from there, even when you send from here.</p>
      ) : null}
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
      {chat.live ? null : (
        <button type="button" className="h-9 font-mono text-[13px] text-accent underline" onClick={() => input.current?.click()} disabled={bring.busy}>
          {bring.busy ? 'Reading…' : 'Bring it in again for newer messages'}
        </button>
      )}
      {note || bring.problem ? (
        <p role="status" className="text-[14.5px] font-semibold leading-snug jk-sec-ink">
          {bring.problem || note}
        </p>
      ) : null}

      {chat.live ? (
        <ReadCard
          chat={chat}
          reading={info.reading === chat.id || chat.readState === 'working'}
          problem={readProblem}
          onAdd={() => setSheet(true)}
          onRead={async () => {
            setReadProblem('');
            const e = await readLive(chat.id);
            if (e) setReadProblem(problemText(e));
          }}
          onHide={() => void hideLive(chat.id, true)}
        />
      ) : null}

      {chat.sends.length || chat.design ? (
        <section className="mt-4 rounded-sm border border-line-strong bg-mount p-3.5">
          <h2 className={label}>In ServiceM8</h2>
          <ul className="mt-2 grid gap-2.5">
            {chat.sends.map((s) => (
              <SendRow key={s.at} s={s} there={holder(chat)} onOpen={() => onOpenJob(s.job)} onRetry={() => void retrySend(chat.id, s.at)} />
            ))}
          </ul>
          {chat.design ? <p className="mt-2 text-[14.5px]">A 3D design request was started from these photos (Designs).</p> : null}
          {chat.remote && chat.sends.some((x) => pending(x).length) ? (
            <p className="mt-2 font-mono text-[12.5px] leading-snug text-faint">The photos and PDFs are on {holder(chat)}: they go into ServiceM8 from there when the Job Kit is open on it.</p>
          ) : null}
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
                          <span className="min-w-0 truncate">{chat.live ? file.replace(/^[A-Za-z0-9]+-/, '') : file.replace(/^\d{8}-/, '')}</span>
                        </span>
                      ) : null}
                      {m.file && !file ? (
                        <span className="block font-mono text-[12.5px] text-faint">{m.kind === 'audio' ? 'Voice note: stays in WhatsApp' : m.kind === 'video' ? 'Video: stays in WhatsApp' : m.kind === 'sticker' ? 'Sticker' : 'A file: stays in WhatsApp'}</span>
                      ) : null}
                      {m.omitted ? <span className="block font-mono text-[12.5px] text-faint">{chat.live ? 'A photo: open it in WhatsApp' : `${m.kind === 'video' ? 'Video' : m.kind === 'audio' ? 'Voice note' : 'Photo'} not in the export`}</span> : null}
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

      {chat.live ? <LiveReply chat={chat} links={links} /> : null}

      {chat.live ? (
        <div className="mt-10 border-t border-line pt-4">
          <button type="button" className="h-10 text-[14px] text-muted underline" onClick={() => void hideLive(chat.id, !chat.hidden)}>
            {chat.hidden ? 'Show it in the list again' : 'Hide this chat from the Job Kit'}
          </button>
          <p className="font-mono text-[12px] leading-snug text-faint">{chat.hidden ? 'Hidden: new messages still come in, folded away under Hidden.' : 'It stays in WhatsApp; here it folds away under Hidden.'}</p>
        </div>
      ) : (
        <div className="mt-10 border-t border-line pt-4">
          <button type="button" className={`h-10 text-[14px] underline ${sure ? 'font-semibold text-ink' : 'text-muted'}`} onClick={remove}>
            {sure ? 'Tap again to take it off your phone and computer' : 'Take this chat off the Job Kit'}
          </button>
          <p className="font-mono text-[12px] leading-snug text-faint">WhatsApp and ServiceM8 keep everything; only the Job Kit’s copy goes, on your phone and computer.</p>
        </div>
      )}

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

/* ---------- a live chat: Claude's reading, and replying ---------- */

function readWords(error?: string) {
  if (error === 'ai-not-set-up') return 'Claude isn’t switched on here: ANTHROPIC_API_KEY is missing in Vercel.';
  if (error === 'nothing') return 'Nothing from them to read yet.';
  return problemText(error) || 'Claude couldn’t read it.';
}

function ReadCard({ chat, reading, problem, onAdd, onRead, onHide }: { chat: WaChat; reading: boolean; problem: string; onAdd: () => void; onRead: () => void; onHide: () => void }) {
  const r = chat.read;
  const work = r?.kind === 'new_enquiry' || r?.kind === 'customer_update';
  const need = needsYou(chat);
  return (
    <section className="mt-4 rounded-sm border border-line-strong bg-mount p-3.5" data-wa-read>
      <h2 className="flex items-baseline justify-between gap-3">
        <span className={label}>Claude read it</span>
        {r?.at && !reading ? <span className="font-mono text-[11.5px] text-faint">{ago(r.at)}</span> : null}
      </h2>
      {reading ? (
        <p className="mt-2 text-[15px] text-muted">Claude is reading it…</p>
      ) : r?.kind && !r.error ? (
        <>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="rounded-sm border border-ink px-1.5 font-mono text-[12px]">{KIND_WORDS[r.kind]}</span>
            {r.what ? <span className="text-[17px] font-semibold leading-snug">{r.what}</span> : null}
          </p>
          {r.summary ? <p className="mt-1.5 text-[15px] leading-snug">{r.summary}</p> : null}
          {r.details?.length ? (
            <ul className="mt-2 grid gap-1">
              {r.details.map((d) => (
                <li key={d} className="flex gap-2 text-[14.5px] leading-snug">
                  <span aria-hidden className="jk-sec-ink">
                    ·
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {r.photos ? <p className="mt-1.5 text-[14px] leading-snug text-muted">Photos: {r.photos}</p> : null}
          {r.next ? (
            <p className="mt-1.5 text-[14.5px] leading-snug">
              <span className="font-semibold">Next:</span> {r.next}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {work && need ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
                {r.kind === 'new_enquiry' && !chat.sends.length ? 'Add to ServiceM8' : 'Send to ServiceM8'}
              </button>
            ) : null}
            {!work && !chat.hidden ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onHide}>
                Not a job: hide it
              </button>
            ) : null}
            <button type="button" className="h-9 px-1 font-mono text-[13px] text-accent underline" onClick={onRead}>
              Read it again
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[14.5px] leading-snug text-muted">{r?.error ? readWords(r.error) : 'Not read yet: Claude reads a chat a minute or two after it goes quiet.'}</p>
          <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={onRead}>
            Read it with Claude
          </button>
        </>
      )}
      {problem ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold leading-snug">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

const whenWord = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const tom = new Date(Date.now() + 864e5);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === today.toDateString() ? `today ${time}` : d.toDateString() === tom.toDateString() ? `tomorrow ${time}` : `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
};

function LiveReply({ chat, links }: { chat: WaChat; links: { label: string; href: string }[] }) {
  const left = windowLeft(chat.liveInAt);
  const open = left > 0;
  const first = chat.read?.first || firstName(chat.clientName || chat.name) || '';
  const [text, setText] = useState('');
  const [tpl, setTpl] = useState(TEMPLATES[0].name);
  const t = TEMPLATES.find((x) => x.name === tpl) ?? TEMPLATES[0];
  const [a, setA] = useState(first);
  const second = (name: string) => (name === 'raf_follow_up' ? (chat.read?.what ? `the ${lowerFirst(chat.read.what)}` : '') : (links[0]?.href ?? ''));
  const [b, setB] = useState(() => second(TEMPLATES[0].name));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState('');
  const send = async () => {
    setBusy(true);
    setProblem('');
    setDone('');
    const e = open ? await sendLive(chat.id, { text: text.trim() }) : await sendLive(chat.id, { template: t.name, values: [a.trim(), b.trim()] });
    setBusy(false);
    if (e) setProblem(problemText(e.error, e.detail));
    else {
      setText('');
      setDone(open ? 'Sent: it’s in the chat above and in WhatsApp on your phone.' : `Sent. A ${t.category === 'MARKETING' ? 'marketing' : 'utility'} message: about ${t.category === 'MARKETING' ? '4.6p' : '1.6p'}.`);
    }
  };
  const can = open ? Boolean(text.trim()) : Boolean(a.trim() && b.trim());
  return (
    <section className="mt-6 rounded-sm border border-line-strong bg-mount p-3.5" data-wa-reply>
      <h2 className="text-[17px] font-[650]">Reply on WhatsApp</h2>
      {open ? (
        <>
          <p className="mt-1 text-[14px] leading-snug text-muted">You can write freely until {whenWord((chat.liveInAt ?? 0) + 24 * 3600 * 1000)}, 24 hours after their last message. Replies you type in the WhatsApp app show here too.</p>
          <textarea
            className="mt-2.5 min-h-[96px] w-full min-w-0 rounded-sm border border-line-strong bg-paper px-3 py-2 text-[16px] leading-snug focus:border-accent focus:outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={first ? `Hi ${first}, ` : 'Your message'}
            aria-label="Your reply"
          />
        </>
      ) : (
        <>
          <p className="mt-1 text-[14px] leading-snug text-muted">
            {chat.liveInAt ? 'It’s more than 24 hours since they last wrote' : 'They haven’t written since WhatsApp was linked'}, so WhatsApp only lets you start again with an approved template (or write from the WhatsApp app).
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Template">
            {TEMPLATES.map((x) => (
              <button
                key={x.name}
                type="button"
                role="radio"
                aria-checked={x.name === tpl}
                className={`rounded-sm border px-2.5 py-1.5 text-[14px] ${x.name === tpl ? 'border-ink bg-ink text-on-accent' : 'border-line-strong'}`}
                onClick={() => {
                  setTpl(x.name);
                  setB(second(x.name));
                }}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-2">
            <label className="grid gap-1 text-[13.5px] text-muted">
              Their first name
              <input className="h-11 min-w-0 rounded-sm border border-line-strong bg-paper px-3 text-[16px] text-ink focus:border-accent focus:outline-none" value={a} onChange={(e) => setA(e.target.value)} />
            </label>
            <label className="grid gap-1 text-[13.5px] text-muted">
              {t.second}
              <input className="h-11 min-w-0 rounded-sm border border-line-strong bg-paper px-3 text-[16px] text-ink focus:border-accent focus:outline-none" value={b} onChange={(e) => setB(e.target.value)} />
            </label>
          </div>
          <p className="mt-2 whitespace-pre-wrap rounded-sm border border-dashed border-line-strong px-3 py-2 text-[14px] leading-snug text-muted" aria-label="What they get">
            {fillTemplate(t, a.trim() || '…', b.trim() || '…')}
          </p>
        </>
      )}
      {links.length && (open || t.name !== 'raf_follow_up') ? (
        <div className="mt-2">
          <p className="font-mono text-[12px] text-faint">Add a link</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {links.map((l) => (
              <button key={l.href} type="button" className="rounded-sm border border-line-strong px-2 py-1 text-[13px]" onClick={() => (open ? setText((x) => `${x.trim()}${x.trim() ? ' ' : ''}${l.href}`) : setB(l.href))}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button type="button" className="btn btn-whatsapp mt-3 w-full disabled:opacity-40" disabled={!can || busy} onClick={() => void send()}>
        {busy ? 'Sending…' : open ? 'Send on WhatsApp' : 'Send the template'}
      </button>
      {problem ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold leading-snug">
          {problem}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-2 text-[14px] leading-snug jk-sec-ink">
          {done}
        </p>
      ) : null}
    </section>
  );
}

function SendRow({ s, there, onOpen, onRetry }: { s: WaSend; there?: string; onOpen: () => void; onRetry: () => void }) {
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
        {s.files.length ? (left ? (there ? `${count(left, 'file')} to go from ${there}` : `Sending ${s.sent.length + 1} of ${s.files.length}…`) : `${s.sent.length} of ${count(s.files.length, 'file')} in the job’s diary`) : 'No files'}
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
          {sel.photos && !chat.remote ? (
            <button type="button" className="jk-wa-choice" onClick={onDesign}>
              <span className="block font-semibold">A 3D design request from the photos</span>
              <span className="block text-[13.5px] leading-snug text-muted">The {count(sel.photos, 'photo')} as the space, the messages as the brief.</span>
            </button>
          ) : sel.photos ? (
            <p className="rounded-sm border border-dashed border-line-strong px-3.5 py-3 text-[13.5px] leading-snug text-muted">
              A 3D design request from the photos: start it on {holder(chat)}, where the full photos are.
            </p>
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
    <section id="whatsapp" data-jsec="whatsapp" className="jk-sec-whatsapp mt-4 rounded-sm border border-line-strong bg-mount p-3.5">
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

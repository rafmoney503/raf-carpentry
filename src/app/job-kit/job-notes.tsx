'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentJob, Staff } from '@/lib/servicem8';
import type { DiaryEntry, DiaryFile, DiaryKind, JobDiary, JobNote, Missing } from '@/lib/servicem8-diary';
import { Icon } from './icons';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';

/* Notes and the Job diary on a job's screen (Current jobs, the job; Raf, 23 Oct 2026: "notes card where i can add
   notes, saved automatically in servicem8 ... a minimised section when i press and read whole diary").
   Notes: type or dictate; two seconds after the last change the note is saved in the job's diary in ServiceM8 as
   ServiceM8's own note, and while Raf keeps typing the same note is updated (one diary entry). New note starts the
   next one; a note left alone for 30 minutes is finished, so the box is empty next time. With no signal the note
   waits on this phone and goes when the phone is back online (flushNotes, also called by the app when it comes
   back). Earlier notes are listed under the box (Edit puts one back in it).
   Job diary: folded to one line; opened, the job's whole ServiceM8 diary, newest first, by day (notes, photos and
   files, emails and texts, bookings and check-ins, payments, the job's dates), with filters. It loads only when
   opened and is kept on this phone (the last one per job, photos' thumbnails in the browser's cache), so it opens
   with no signal. The server side is src/lib/servicem8-diary.ts. */

const DRAFTS_KEY = 'raf_jobkit_notes'; // job uuid -> Draft[]: notes written here, until ServiceM8 has them
const LIST_KEY = 'raf_jobkit_notes_list'; // job uuid -> { notes, at }: the job's notes as ServiceM8 last sent them
const DIARY_KEY = 'raf_jobkit_diary'; // job uuid -> { diary, at }: the last diary
const THUMBS = 'raf-jobkit-thumbs-v1'; // the browser's cache: diary photos made small
const SAVE_AFTER = 2000;
const FINISHED_AFTER = 30 * 60e3;
const SHOW_NOTES = 3;
const PAGE = 30;

type Draft = {
  uuid: string;
  text: string;
  sent: string; // what ServiceM8 has
  exists: boolean; // made in ServiceM8 (later saves update it)
  open: boolean; // in the box now
  started: number;
  edited: number;
  savedAt?: number;
  at?: string | null; // ServiceM8's date, for an earlier note put back in the box
};
type Outcome = { ok: true } | { ok: false; error: string; detail?: string };

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
    /* no storage */
  }
};
function keep<T>(key: string, job: string, v: T | undefined, max: number) {
  const all = read<Record<string, T>>(key, {});
  delete all[job];
  write(key, Object.fromEntries(Object.entries(v === undefined ? all : { [job]: v, ...all }).slice(0, max)));
}

const londonNow = (t = Date.now()) => new Date(t).toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T').slice(0, 16);
const todayKey = () => londonNow().slice(0, 10);
const newUuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16).slice(-1));
const pending = (d: Draft) => d.text.trim() !== '' && d.text.trim() !== d.sent.trim();
const clockOf = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const hm = (at: string) => at.slice(11, 16).replace(/^0(\d)/, '$1');

/* ---------- notes waiting on this phone ---------- */

const allDrafts = () => read<Record<string, Draft[]>>(DRAFTS_KEY, {});
const draftsOf = (job: string) => allDrafts()[job] ?? [];
function putDrafts(job: string, list: Draft[]) {
  const all = allDrafts();
  // finished ones ServiceM8 has had for three days go; at most 20 a job
  const old = Date.now() - 3 * 864e5;
  const kept = list.filter((d) => d.open || pending(d) || (d.savedAt ?? d.edited) > old).slice(-20);
  if (kept.length) all[job] = kept;
  else delete all[job];
  write(DRAFTS_KEY, all);
  for (const f of subs) f(job);
}
const subs = new Set<(job: string) => void>();

/* keepalive: a note typed just before the app is closed still reaches the server. If the answer never comes back,
   the note is still waiting here and goes again (a 409 on the first save makes it an update), so nothing doubles. */
async function saveNote(job: string, d: Draft, text: string): Promise<Outcome> {
  const pin = readPin();
  if (!pin) return { ok: false, error: 'no-pin' };
  try {
    const res = await fetch('/api/job-kit/sm8', {
      method: 'POST',
      headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'note-save', job, uuid: d.uuid, text, isNew: !d.exists }),
      cache: 'no-store',
      keepalive: true,
    });
    if (res.ok) return { ok: true };
    const e = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    return { ok: false, error: e.error || 'sm8-error', detail: e.detail };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

async function sendOnce(job: string): Promise<Outcome> {
  for (let i = 0; i < 20; i++) {
    const d = draftsOf(job).find(pending);
    if (!d) return { ok: true };
    const text = d.text;
    const r = await saveNote(job, d, text);
    if (!r.ok) return r;
    const now = draftsOf(job);
    const x = now.find((y) => y.uuid === d.uuid);
    if (!x) return { ok: true };
    x.sent = text;
    x.exists = true;
    x.savedAt = Date.now();
    putDrafts(job, now);
  }
  return { ok: true };
}
/* One save at a time per job, in order; each sends every note still waiting. */
const chains = new Map<string, Promise<Outcome>>();
export function sendNotes(job: string): Promise<Outcome> {
  const next = (chains.get(job) ?? Promise.resolve<Outcome>({ ok: true })).then(
    () => sendOnce(job),
    () => sendOnce(job),
  );
  chains.set(job, next);
  return next;
}
/* Every note waiting on this phone, for any job: when the app comes back online or back on screen. */
export function flushNotes() {
  if (!readPin()) return;
  for (const [job, list] of Object.entries(allDrafts())) if (list.some(pending)) void sendNotes(job);
}

/* ---------- the diary on this phone ---------- */

type Item = {
  id: string;
  kind: DiaryKind | 'payment' | 'job';
  at: string | null;
  text?: string;
  subject?: string;
  dir?: 'in' | 'out';
  end?: string | null;
  staff?: string;
  file?: DiaryFile;
  amount?: number;
  method?: string;
  deposit?: boolean;
  waiting?: boolean; // a note still on this phone
};
type Filter = 'all' | 'notes' | 'files' | 'messages' | 'bookings' | 'money';
const FILTERS: { key: Filter; name: string; kinds: Item['kind'][] }[] = [
  { key: 'all', name: 'All', kinds: [] },
  { key: 'notes', name: 'Notes', kinds: ['note'] },
  { key: 'files', name: 'Photos and files', kinds: ['file'] },
  { key: 'messages', name: 'Messages', kinds: ['email', 'sms'] },
  { key: 'bookings', name: 'Bookings', kinds: ['visit', 'checkin'] },
  { key: 'money', name: 'Money', kinds: ['payment'] },
];
const MISSING_WORDS: Record<Missing, string> = { notes: 'the notes', files: 'the photos and files', messages: 'the emails and texts', bookings: 'the bookings' };

const newestFirst = (a: { at: string | null }, b: { at: string | null }) => (b.at ?? '').localeCompare(a.at ?? '');
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
function dayName(key: string) {
  if (key === 'none') return 'No date';
  if (key === 'soon') return 'Coming up';
  const today = todayKey();
  if (key === today) return 'Today';
  const y = new Date(Date.parse(`${today}T12:00`) - 864e5).toLocaleDateString('sv-SE');
  if (key === y) return 'Yesterday';
  const d = new Date(`${key}T12:00`);
  const words = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  return key.slice(0, 4) === today.slice(0, 4) ? words : `${words} ${key.slice(0, 4)}`;
}
const whenWords = (at: string | null) => {
  if (!at) return '';
  const d = dayName(at.slice(0, 10));
  return `${d === 'Today' || d === 'Yesterday' ? d.toLowerCase() : d} ${hm(at)}`;
};
const noteDate = (at: string | null) => (at ? `${dayName(at.slice(0, 10))}, ${hm(at)}` : '');

/* The job's own dates and payments, from the job the phone already has. */
function fromJob(job: CurrentJob): Item[] {
  const at = (s: string | null) => (s ? s.replace(' ', 'T').slice(0, 16) : null);
  const steps: [string | null, string][] = [
    [job.created, 'Enquiry came in'],
    [job.quoteSent, 'Quote sent'],
    [job.workOrder, 'Moved to Work Order'],
    [job.completed, 'Completed'],
    [job.lost, 'Marked unsuccessful'],
  ];
  const out: Item[] = steps.filter(([t]) => t).map(([t, text]) => ({ id: `job-${text}`, kind: 'job', at: at(t), text }));
  for (const [i, p] of (job.payments ?? []).entries()) out.push({ id: `pay-${p.uuid ?? i}`, kind: 'payment', at: at(p.date), amount: p.amount, method: p.method, deposit: p.deposit, text: p.note });
  return out;
}

/* ---------- photos ---------- */

async function fileBlob(uuid: string, size: 'thumb' | 'full'): Promise<{ blob: Blob } | { error: string; detail?: string }> {
  const pin = readPin();
  if (!pin) return { error: 'no-pin' };
  try {
    const res = await fetch('/api/job-kit/sm8', { method: 'POST', headers: { 'x-job-kit-pin': pin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'file', uuid, size }), cache: 'no-store' });
    if (!res.ok) {
      const e = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      return { error: e.error || 'sm8-error', detail: e.detail };
    }
    return { blob: await res.blob() };
  } catch {
    return { error: 'offline' };
  }
}
const thumbKey = (uuid: string) => `/__jk-thumb/${uuid}`;
async function cachedThumb(uuid: string): Promise<Blob | null> {
  try {
    const hit = await (await caches.open(THUMBS)).match(thumbKey(uuid));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}
async function keepThumb(uuid: string, blob: Blob) {
  try {
    const c = await caches.open(THUMBS);
    await c.put(thumbKey(uuid), new Response(blob, { headers: { 'content-type': blob.type || 'image/jpeg' } }));
    const keys = await c.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - 400))) await c.delete(k);
  } catch {
    /* no cache: it's fetched again next time */
  }
}
const thumbUrls = new Map<string, string>(); // this visit's thumbnails
const notPhotos = new Set<string>();

function Thumb({ file, onOpen }: { file: DiaryFile; onOpen: () => void }) {
  const box = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState(() => thumbUrls.get(file.uuid) ?? '');
  const [state, setState] = useState<'wait' | 'none' | 'offline'>(notPhotos.has(file.uuid) ? 'none' : 'wait');
  useEffect(() => {
    if (url || state === 'none') return;
    const el = box.current;
    if (!el) return;
    let gone = false;
    const load = async () => {
      let blob = await cachedThumb(file.uuid);
      if (!blob) {
        const r = await fileBlob(file.uuid, 'thumb');
        if ('error' in r) {
          if (r.error === 'not-photo') notPhotos.add(file.uuid);
          if (!gone) setState(r.error === 'not-photo' ? 'none' : 'offline');
          return;
        }
        blob = r.blob;
        void keepThumb(file.uuid, blob);
      }
      const u = URL.createObjectURL(blob);
      thumbUrls.set(file.uuid, u);
      if (!gone) setUrl(u);
    };
    const seen = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          seen.disconnect();
          void load();
        }
      },
      { rootMargin: '300px' },
    );
    seen.observe(el);
    return () => {
      gone = true;
      seen.disconnect();
    };
  }, [file.uuid, url, state]);
  return (
    <button ref={box} type="button" onClick={onOpen} data-thumb={file.uuid} className="relative aspect-square overflow-hidden rounded-sm border border-line bg-raised" aria-label={`Photo: ${file.name}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center p-1 text-center font-mono text-[10.5px] leading-tight text-faint">{state === 'offline' ? 'No signal' : state === 'none' ? file.name : ''}</span>
      )}
    </button>
  );
}

type Shown = { file: DiaryFile; url: string; error: string } | null;

/* ---------- the two sections ---------- */

export function JobNotes({ job, staff }: { job: CurrentJob; staff: Staff[] }) {
  const id = job.uuid;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [server, setServer] = useState<{ notes: JobNote[]; at: number } | null>(null);
  const [listProblem, setListProblem] = useState('');
  const [state, setState] = useState<'idle' | 'typing' | 'saving' | 'saved' | 'offline' | 'error'>('idle');
  const [problem, setProblem] = useState('');
  const [allNotes, setAllNotes] = useState(false);
  const [more, setMore] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const box = useRef<HTMLTextAreaElement>(null);

  const [open, setOpen] = useState(false);
  const [diary, setDiary] = useState<{ diary: JobDiary; at: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [diaryProblem, setDiaryProblem] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(PAGE);
  const [shown, setShown] = useState<Shown>(null);
  const [whole, setWhole] = useState<Record<string, boolean>>({});

  const settle = (o: Outcome) => {
    const now = draftsOf(id).find((d) => d.open);
    if (o.ok) {
      setProblem('');
      setState(now && pending(now) ? 'typing' : 'saved');
    } else if (o.error === 'offline' || o.error === 'sm8-down') {
      setState('offline');
    } else {
      setState('error');
      setProblem(problemText(o.error, o.detail));
    }
  };
  const save = () => {
    if (timer.current) clearTimeout(timer.current);
    if (!draftsOf(id).some(pending)) return;
    setState('saving');
    void sendNotes(id).then(settle);
  };

  /* On opening the job: this phone's notes and last lists at once, then ServiceM8's notes. */
  useEffect(() => {
    let list = draftsOf(id);
    const cur = list.find((d) => d.open);
    if (cur && !pending(cur) && Date.now() - cur.edited > FINISHED_AFTER) {
      list = list.map((d) => (d === cur ? { ...d, open: false } : d)).filter((d) => d.text.trim() || !d.open);
      putDrafts(id, list);
    }
    setDrafts(list);
    setServer(read<Record<string, { notes: JobNote[]; at: number }>>(LIST_KEY, {})[id] ?? null);
    setDiary(read<Record<string, { diary: JobDiary; at: number }>>(DIARY_KEY, {})[id] ?? null);
    const follow = (job: string) => {
      if (job !== id) return;
      const now = draftsOf(id);
      setDrafts(now);
      // sent from elsewhere (back online, the app coming back on screen): no longer waiting
      if (!now.some(pending)) setState((s) => (s === 'offline' || s === 'error' ? 'saved' : s));
    };
    subs.add(follow);
    let gone = false;
    if (readPin()) {
      void post<{ notes: JobNote[]; at: number }>(readPin(), { action: 'notes', job: id }).then((r) => {
        if (gone) return;
        if (r.ok) {
          setServer(r.data);
          keep(LIST_KEY, id, r.data, 30);
          setListProblem('');
        } else if (r.error !== 'offline' && r.error !== 'sm8-down') setListProblem(problemText(r.error, r.detail));
      });
      if (list.some(pending)) {
        setState('saving');
        void sendNotes(id).then((o) => !gone && settle(o));
      }
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden' && draftsOf(id).some(pending)) void sendNotes(id);
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      gone = true;
      subs.delete(follow);
      document.removeEventListener('visibilitychange', hidden);
      if (timer.current) clearTimeout(timer.current);
      if (draftsOf(id).some(pending)) void sendNotes(id); // leaving the job: what's typed still goes
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const current = drafts.find((d) => d.open);
  const type = (text: string) => {
    const list = draftsOf(id);
    const cur = list.find((d) => d.open);
    if (cur) {
      cur.text = text;
      cur.edited = Date.now();
    } else if (text.trim()) list.push({ uuid: newUuid(), text, sent: '', exists: false, open: true, started: Date.now(), edited: Date.now() });
    putDrafts(id, list);
    setDrafts(draftsOf(id));
    if (timer.current) clearTimeout(timer.current);
    if (list.some(pending)) {
      setState((s) => (s === 'offline' ? s : 'typing'));
      timer.current = setTimeout(save, SAVE_AFTER);
    }
  };
  /* Finishes the note in the box (it still goes if it's waiting), so the box is empty for the next. */
  const finish = (andOpen?: Draft) => {
    let list = draftsOf(id).map((d) => (d.open ? { ...d, open: false } : d)).filter((d) => d.text.trim() || d.exists);
    if (andOpen) {
      const had = list.find((d) => d.uuid === andOpen.uuid);
      list = had ? list.map((d) => (d.uuid === andOpen.uuid ? { ...d, open: true, edited: Date.now() } : d)) : [...list, andOpen];
    }
    putDrafts(id, list);
    setDrafts(draftsOf(id));
    if (list.some(pending)) save();
    else setState('idle');
    setTimeout(() => box.current?.focus(), 0);
  };

  /* Earlier notes: ServiceM8's, with this phone's newer copies and the ones still waiting. */
  const earlier = useMemo(() => {
    const out = new Map<string, { uuid: string; text: string; at: string | null; waiting: boolean }>();
    for (const n of server?.notes ?? []) out.set(n.uuid, { uuid: n.uuid, text: n.text, at: n.at, waiting: false });
    for (const d of drafts) {
      if (d.open || !d.text.trim()) continue;
      const had = out.get(d.uuid);
      const newer = pending(d) || !server || (d.savedAt ?? d.edited) > server.at;
      if (!had || newer) out.set(d.uuid, { uuid: d.uuid, text: d.text, at: had?.at ?? d.at ?? londonNow(d.started), waiting: pending(d) });
    }
    if (current) out.delete(current.uuid);
    return [...out.values()].sort(newestFirst);
  }, [server, drafts, current]);

  /* The diary: ServiceM8's (its notes swapped for the freshest ones above), the job's dates and payments. */
  const items = useMemo(() => {
    const notes: Item[] = earlier.map((n) => ({ id: `note-${n.uuid}`, kind: 'note', at: n.at, text: n.text, waiting: n.waiting }));
    if (current?.text.trim()) notes.push({ id: `note-${current.uuid}`, kind: 'note', at: current.at ?? londonNow(current.started), text: current.text, waiting: pending(current) });
    const rest: Item[] = (diary?.diary.entries ?? []).filter((e: DiaryEntry) => e.kind !== 'note');
    return [...notes, ...rest, ...fromJob(job)].sort(newestFirst);
  }, [earlier, current, diary, job]);

  const loadDiary = async () => {
    setLoading(true);
    setDiaryProblem('');
    const r = await post<{ diary: JobDiary; at: number }>(readPin(), { action: 'diary', job: id, email: job.email, mobile: job.mobile });
    setLoading(false);
    if (!r.ok) {
      setDiaryProblem(problemText(r.error, r.detail, diary?.at));
      return;
    }
    setDiary(r.data);
    keep(DIARY_KEY, id, r.data, 10);
    // the notes in it are ServiceM8's latest too
    if (!r.data.diary.missing.includes('notes')) {
      const notes = r.data.diary.entries.filter((e) => e.kind === 'note').map((e): JobNote => ({ uuid: e.id.slice(5), text: e.text ?? '', at: e.at, edited: null }));
      const next = { notes, at: r.data.at };
      setServer(next);
      keep(LIST_KEY, id, next, 30);
    }
  };
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (!diary || Date.now() - diary.at > 2 * 60e3)) void loadDiary();
  };

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, f.key === 'all' ? items.length : items.filter((x) => f.kinds.includes(x.kind)).length])) as Record<Filter, number>, [items]);
  const list = filter === 'all' ? items : items.filter((x) => FILTERS.find((f) => f.key === filter)!.kinds.includes(x.kind));
  const photos = list.filter((x) => x.kind === 'file' && x.file?.photo).map((x) => x.file!);

  /* Days, newest first; photos in a row on the same day go together in a grid. */
  /* Bookings still to come go first under Coming up (soonest first), then the diary newest first. */
  const days = useMemo(() => {
    const now = londonNow();
    const ahead = (x: Item) => x.kind === 'visit' && Boolean(x.at && x.at > now);
    const out: { key: string; blocks: (Item | { id: string; photos: Item[] })[] }[] = [];
    for (const x of [...list.filter(ahead).reverse(), ...list.filter((y) => !ahead(y))].slice(0, page)) {
      const key = ahead(x) ? 'soon' : x.at ? x.at.slice(0, 10) : 'none';
      let day = out[out.length - 1];
      if (!day || day.key !== key) out.push((day = { key, blocks: [] }));
      const last = day.blocks[day.blocks.length - 1];
      if (x.kind === 'file' && x.file?.photo) {
        if (last && 'photos' in last) last.photos.push(x);
        else day.blocks.push({ id: `photos-${x.id}`, photos: [x] });
      } else day.blocks.push(x);
    }
    return out;
  }, [list, page]);

  const openFile = async (file: DiaryFile) => {
    setShown({ file, url: '', error: '' });
    const r = await fileBlob(file.uuid, 'full');
    setShown((s) => {
      if (!s || s.file.uuid !== file.uuid) return s; // moved on to another photo
      if ('error' in r) return { ...s, error: r.error === 'too-big' ? 'Too big to show here: open it in ServiceM8.' : problemText(r.error, r.detail) };
      return { ...s, url: URL.createObjectURL(r.blob) };
    });
  };
  const closeFile = () => {
    if (shown?.url) URL.revokeObjectURL(shown.url);
    setShown(null);
  };
  const step = (by: number) => {
    if (!shown) return;
    const i = photos.findIndex((p) => p.uuid === shown.file.uuid);
    const next = photos[i + by];
    if (!next) return;
    if (shown.url) URL.revokeObjectURL(shown.url);
    void openFile(next);
  };

  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFile();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const who = job.first || 'them';
  const staffName = (uuid?: string) => staff.find((s) => s.uuid === uuid)?.name.split(' ')[0] ?? '';
  const latest = items.find((x) => x.kind !== 'visit' || !x.at || x.at <= londonNow());
  const lastWord = (x: Item) =>
    x.kind === 'note' ? 'note' : x.kind === 'file' ? (x.file?.photo ? 'photo' : 'file') : x.kind === 'email' ? (x.dir === 'in' ? `email from ${who}` : 'email') : x.kind === 'sms' ? (x.dir === 'in' ? `text from ${who}` : 'text') : x.kind === 'visit' ? 'booking' : x.kind === 'checkin' ? 'check-in' : x.kind === 'payment' ? 'payment' : (x.text ?? '').toLowerCase();

  const status =
    state === 'error'
      ? `${problem} Kept on this phone.`
      : state === 'offline' && drafts.some(pending)
        ? 'No signal: kept on this phone. It goes to ServiceM8 when you’re back online.'
        : state === 'saving'
          ? 'Saving in ServiceM8…'
          : current && pending(current)
            ? 'Saves when you stop typing'
            : current && !current.text.trim() && current.exists
              ? 'An empty note isn’t saved: ServiceM8 keeps the last words.'
            : current?.savedAt
              ? `Saved in ServiceM8 ${clockOf(current.savedAt)}`
              : '';
  const editing = current?.at;

  return (
    <>
      <section id="notes" className="mt-6 scroll-mt-[calc(env(safe-area-inset-top)-20px)] rounded-sm border border-line-strong bg-mount p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-[650]">Notes</h2>
          {current?.text.trim() ? (
            <button type="button" onClick={() => finish()} className="btn btn-ghost btn-sm shrink-0" data-new-note>
              {editing ? 'Done' : '+ New note'}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-[14px] leading-snug text-muted">{editing ? `Changing the note from ${noteDate(current?.at ?? null)}.` : 'Saved in the job’s diary in ServiceM8 as you type.'}</p>
        <textarea
          ref={box}
          data-note-box
          className={`${field} mt-3 min-h-[112px] py-2.5 leading-snug`}
          rows={4}
          value={current?.text ?? ''}
          onChange={(e) => type(e.target.value)}
          onBlur={save}
          placeholder="Type a note, or tap the microphone on the keyboard to talk"
          autoCapitalize="sentences"
          aria-label="Note on this job"
        />
        <p aria-live="polite" data-note-status={state} className={`mt-1.5 min-h-[20px] font-mono text-[12.5px] leading-snug ${state === 'error' ? 'text-ink' : 'text-faint'}`}>
          {current?.savedAt && !pending(current) && state !== 'error' ? <span className="text-accent">✓ </span> : null}
          {status}
          {(state === 'error' || state === 'offline') && drafts.some(pending) ? (
            <button type="button" onClick={save} className="ml-2 text-accent underline">
              Try again
            </button>
          ) : null}
        </p>

        {earlier.length ? (
          <div className="mt-3 border-t border-line pt-3">
            <p className={label}>Earlier notes</p>
            <ul className="mt-2 grid gap-3" data-earlier-notes>
              {(allNotes ? earlier : earlier.slice(0, SHOW_NOTES)).map((n) => {
                const long = n.text.length > 220 || n.text.split('\n').length > 4;
                return (
                  <li key={n.uuid} data-note={n.uuid}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[12px] text-faint">
                        {noteDate(n.at)}
                        {n.waiting ? <span className="ml-1.5 text-ink">· waiting for signal</span> : null}
                      </span>
                      <button type="button" onClick={() => finish({ uuid: n.uuid, text: n.text, sent: n.waiting ? '' : n.text, exists: !n.waiting, open: true, started: Date.now(), edited: Date.now(), at: n.at })} className="h-8 shrink-0 px-1 text-[13.5px] text-accent underline">
                        Edit
                      </button>
                    </div>
                    <p className={`whitespace-pre-line text-[15px] leading-snug [overflow-wrap:anywhere] ${long && !more[n.uuid] ? 'line-clamp-4' : ''}`}>{n.text}</p>
                    {long ? (
                      <button type="button" onClick={() => setMore((m) => ({ ...m, [n.uuid]: !m[n.uuid] }))} className="h-8 text-[13.5px] text-accent underline">
                        {more[n.uuid] ? 'Less' : 'More'}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {earlier.length > SHOW_NOTES ? (
              <button type="button" onClick={() => setAllNotes(!allNotes)} className="mt-2 h-9 text-[14px] text-accent underline">
                {allNotes ? 'Show fewer' : `Show all ${earlier.length} notes`}
              </button>
            ) : null}
          </div>
        ) : null}
        {listProblem ? <p className="mt-2 text-[13.5px] text-muted">{listProblem}</p> : null}
      </section>

      <section id="job-diary" className="mt-6 scroll-mt-[calc(env(safe-area-inset-top)-20px)] rounded-sm border border-line-strong bg-mount">
        <button type="button" onClick={toggle} aria-expanded={open} data-diary-toggle className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-[650]">Job diary from ServiceM8</span>
            <span className="block text-[14px] leading-snug text-muted" data-diary-summary>
              {diary && latest ? `${items.length} ${items.length === 1 ? 'entry' : 'entries'} · last: ${lastWord(latest)}${latest.at ? ` ${whenWords(latest.at)}` : ''}` : 'Notes, photos, emails and texts, bookings and payments'}
            </span>
          </span>
          <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 fill-none stroke-current text-faint transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open ? (
          <div className="border-t border-line px-4 pb-4 pt-3" data-diary>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  disabled={!counts[f.key] && f.key !== 'all'}
                  onClick={() => {
                    setFilter(f.key);
                    setPage(PAGE);
                  }}
                  data-filter={f.key}
                  className={`h-9 rounded-sm border px-2.5 text-[13.5px] disabled:opacity-40 ${filter === f.key ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink'}`}
                >
                  {f.name} <span className="font-mono text-[12px] opacity-75">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 font-mono text-[12px] text-faint">
              <span>{loading ? 'Getting the diary from ServiceM8…' : diary ? `From ServiceM8 ${new Date(diary.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
              <button type="button" onClick={() => void loadDiary()} disabled={loading} className="h-8 shrink-0 text-[13.5px] text-accent underline disabled:opacity-50">
                Refresh
              </button>
            </div>
            {diaryProblem ? (
              <p role="alert" className="mt-2 rounded-sm border border-ink px-3 py-2 text-[14px] leading-relaxed">
                {diaryProblem}
              </p>
            ) : null}

            {days.length ? (
              <div className="mt-1">
                {days.map((d) => (
                  <div key={d.key} className="mt-4" data-day={d.key}>
                    <h3 className={`${label} border-b border-line pb-1`}>{dayName(d.key)}</h3>
                    <ul>
                      {d.blocks.map((b) =>
                        'photos' in b ? (
                          <li key={b.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2 border-b border-line py-2.5 last:border-b-0">
                            <span className="pt-0.5 font-mono text-[12.5px] text-faint">{b.photos[0].at ? hm(b.photos[0].at) : ''}</span>
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-semibold">{b.photos.length === 1 ? 'Photo' : `${b.photos.length} photos`}</p>
                              <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                                {b.photos.map((p) => (
                                  <Thumb key={p.id} file={p.file!} onOpen={() => void openFile(p.file!)} />
                                ))}
                              </div>
                            </div>
                          </li>
                        ) : (
                          <li key={b.id} data-entry={b.kind} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2 border-b border-line py-2.5 last:border-b-0">
                            <span className="pt-0.5 font-mono text-[12.5px] text-faint">{b.at && d.key !== 'soon' && !((b.kind === 'payment' || b.kind === 'job') && b.at.endsWith('00:00')) ? hm(b.at) : ''}</span>
                            <div className="min-w-0 [overflow-wrap:anywhere]">
                              <Entry item={b} soon={d.key === 'soon'} who={who} staffName={staffName} whole={Boolean(whole[b.id])} onWhole={() => setWhole((w) => ({ ...w, [b.id]: !w[b.id] }))} onFile={(f) => void openFile(f)} jobKind={job.status === 'Quote' || job.status === 'Unsuccessful' ? 'Visit' : 'Work'} />
                            </div>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ))}
                {list.length > page ? (
                  <button type="button" onClick={() => setPage(page + PAGE)} className="btn btn-ghost btn-sm mt-3 w-full">
                    Show {Math.min(PAGE, list.length - page)} more
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-[14.5px] text-muted">{loading ? '' : filter === 'all' ? 'Nothing in the diary yet.' : 'Nothing of this kind yet.'}</p>
            )}
            {diary?.diary.missing.length ? (
              <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">
                ServiceM8 didn’t send {diary.diary.missing.map((m) => MISSING_WORDS[m]).join(' or ')} this time; Refresh to try again.
              </p>
            ) : null}
            <p className="mt-3 font-mono text-[12px] leading-relaxed text-faint">ServiceM8 keeps no history of status changes; the job’s dates show when it moved on.</p>
          </div>
        ) : null}
      </section>

      {shown ? (
        <div role="dialog" aria-label={shown.file.name} className="fixed inset-0 z-50 flex flex-col bg-ink" data-viewer>
          <div className="flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] text-on-accent">
            <span className="min-w-0 truncate font-mono text-[12.5px]">{shown.file.name}</span>
            <button type="button" onClick={closeFile} className="h-11 px-2 text-[15px] font-semibold">
              Close
            </button>
          </div>
          {shown.error ? (
            <p className="m-auto max-w-sm px-6 text-center text-[15px] text-on-accent">{shown.error}</p>
          ) : !shown.url ? (
            <p className="m-auto font-mono text-[13px] text-on-accent/70">Opening…</p>
          ) : shown.file.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.url} alt={shown.file.name} className="min-h-0 flex-1 object-contain" />
          ) : (
            <div className="m-auto grid gap-3 px-6 text-center">
              <a href={shown.url} target="_blank" rel="noopener" className="btn btn-primary">
                Open {shown.file.name}
              </a>
              <a href={shown.url} download={shown.file.name} className="text-[15px] text-on-accent underline">
                Save it to the phone
              </a>
            </div>
          )}
          {shown.file.photo ? (
            <div className="flex items-center justify-between gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 text-on-accent">
              <button type="button" onClick={() => step(-1)} disabled={photos.findIndex((p) => p.uuid === shown.file.uuid) <= 0} className="h-11 px-3 text-[15px] disabled:opacity-30" aria-label="Newer photo">
                ← Newer
              </button>
              <span className="font-mono text-[12px] text-on-accent/70">
                {photos.findIndex((p) => p.uuid === shown.file.uuid) + 1} of {photos.length}
              </span>
              <button type="button" onClick={() => step(1)} disabled={photos.findIndex((p) => p.uuid === shown.file.uuid) >= photos.length - 1} className="h-11 px-3 text-[15px] disabled:opacity-30" aria-label="Older photo">
                Older →
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function Entry({ item: x, soon, who, staffName, whole, onWhole, onFile, jobKind }: { item: Item; soon: boolean; who: string; staffName: (u?: string) => string; whole: boolean; onWhole: () => void; onFile: (f: DiaryFile) => void; jobKind: 'Visit' | 'Work' }) {
  const head = 'text-[13.5px] font-semibold';
  if (x.kind === 'note')
    return (
      <>
        <p className={`${head} flex items-center gap-1.5`}>
          <Icon name="note" className="h-4 w-4 text-accent" />
          Note{x.waiting ? <span className="font-normal text-muted"> · waiting for signal</span> : null}
        </p>
        <p className="mt-0.5 whitespace-pre-line text-[15px] leading-snug">{x.text}</p>
      </>
    );
  if (x.kind === 'file')
    return (
      <button type="button" onClick={() => onFile(x.file!)} className="flex w-full items-center gap-2 rounded-sm border border-line-strong bg-paper px-2.5 py-2 text-left">
        <Icon name="file" className="h-5 w-5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-[14.5px]">{x.file!.name}</span>
        <span className="shrink-0 text-[13.5px] text-accent">Open</span>
      </button>
    );
  if (x.kind === 'email' || x.kind === 'sms') {
    const what = x.kind === 'sms' ? 'Text' : 'Email';
    const long = (x.text ?? '').length > 280 || (x.text ?? '').split('\n').length > 5;
    return (
      <>
        <p className={head}>{x.dir === 'in' ? `${what} from ${who}` : `${what} to ${who}`}</p>
        {x.subject ? <p className="mt-0.5 text-[14.5px] font-medium">{x.subject}</p> : null}
        {x.text ? <p className={`mt-0.5 whitespace-pre-line text-[14.5px] leading-snug text-muted ${long && !whole ? 'line-clamp-5' : ''}`}>{x.text}</p> : null}
        {long ? (
          <button type="button" onClick={onWhole} className="h-8 text-[13.5px] text-accent underline">
            {whole ? 'Less' : 'Read it all'}
          </button>
        ) : null}
      </>
    );
  }
  if (x.kind === 'visit' || x.kind === 'checkin') {
    const end = x.end ? (x.end.slice(0, 10) === x.at?.slice(0, 10) ? hm(x.end) : `${dayName(x.end.slice(0, 10))} ${hm(x.end)}`) : '';
    const mins = x.at && x.end ? Math.round((Date.parse(x.end) - Date.parse(x.at)) / 60e3) : 0;
    const long = mins > 0 && x.end?.slice(0, 10) === x.at?.slice(0, 10) ? ` (${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ''}`.trim() : `${mins} min`})` : '';
    const name = staffName(x.staff);
    return x.kind === 'visit' ? (
      <>
        <p className={head}>{jobKind === 'Visit' ? 'Visit booked' : 'Work booked'}</p>
        <p className="mt-0.5 text-[14.5px] text-muted">
          {x.at ? `${soon ? `${dayName(x.at.slice(0, 10))}, ` : ''}${hm(x.at)}` : ''}
          {end ? ` to ${end}` : ''}
          {name ? ` · ${name}` : ''}
        </p>
      </>
    ) : (
      <>
        <p className={head}>On site</p>
        <p className="mt-0.5 text-[14.5px] text-muted">
          Checked in {x.at ? hm(x.at) : ''}
          {end ? `, out ${end}${long}` : ''}
        </p>
      </>
    );
  }
  if (x.kind === 'payment')
    return (
      <>
        <p className={head}>Payment {x.amount !== undefined ? gbp(x.amount) : ''}</p>
        <p className="mt-0.5 text-[14.5px] text-muted">
          {[x.method, x.deposit ? 'deposit' : ''].filter(Boolean).join(' · ')}
          {x.text ? <span className="block">{x.text}</span> : null}
        </p>
      </>
    );
  return <p className="text-[14.5px] text-muted">{x.text}</p>;
}

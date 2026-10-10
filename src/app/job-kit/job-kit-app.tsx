'use client';
/* eslint-disable @next/next/no-img-element -- the pictures here are small thumbnails kept on the phone (data URLs), not site images */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clipInfo, shrinkPhoto } from './media';
import { KINDS, progress, REVIEW_OPTIONS, SECTIONS, SHOW_OPTIONS, TOOLS, type Section, type SectionId, type Slot } from './plan';
import {
  allItems,
  allJobs,
  delFile,
  delItem,
  delJob,
  emptyNotes,
  extFor,
  getJob,
  mb,
  monthName,
  newJobId,
  putFile,
  putItem,
  putJob,
  uid,
  type Item,
  type Job,
  type Notes,
} from './store';
import { CHUNK, checkSetup, onChange, onStatus, readPin, savePin, sendDetails, wake, type SendState, type Status } from './uploader';
import { R_MARK } from '@/lib/r-logo';
import './job-kit.css';

type Tab = SectionId | 'notes' | 'send';
type Screen = { name: 'home' } | { name: 'new' } | { name: 'job'; id: string; tab: Tab } | { name: 'settings' };

const field =
  'w-full min-w-0 rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint/55 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
const label = 'font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint';

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* Where Raf was, so the app comes back to the same job and tab if the phone reloads it
   (iPhones sometimes do, after the camera). */
const SCREEN_KEY = 'raf_jobkit_screen';
function loadScreen(): Screen {
  try {
    const s = JSON.parse(sessionStorage.getItem(SCREEN_KEY) || localStorage.getItem(SCREEN_KEY) || 'null') as Screen | null;
    if (s && (s.name === 'home' || s.name === 'job' || s.name === 'settings')) return s;
  } catch {
    /* no storage */
  }
  return { name: 'home' };
}
function keepScreen(s: Screen) {
  try {
    localStorage.setItem(SCREEN_KEY, JSON.stringify(s));
  } catch {
    /* no storage */
  }
}

const STATE_TEXT: Record<SendState, string> = {
  idle: 'All sent',
  sending: 'Sending',
  offline: 'No signal, will send later',
  'no-pin': 'Add your PIN',
  'not-set-up': 'Inbox not set up yet',
  'wrong-pin': 'Wrong PIN',
  'inbox-key': 'Inbox key not working',
  'inbox-missing': 'Inbox not found',
  busy: 'GitHub busy, trying again soon',
  error: 'Could not send, trying again soon',
};

/* Jobs already made into pages on the site: Job Kit id -> the page. */
export type Done = Record<string, { slug: string; title: string }>;

export default function JobKitApp({ done = {} }: { done?: Done }) {
  const [ready, setReady] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [screen, setScreenState] = useState<Screen>({ name: 'home' });
  const [pin, setPinState] = useState('');
  const [busy, setBusy] = useState<Record<string, number>>({}); // slot key -> photos still being saved
  const [problem, setProblem] = useState('');

  const reload = useCallback(async () => {
    try {
      const [j, i] = await Promise.all([allJobs(), allItems()]);
      setJobs(j.sort((a, b) => b.updatedAt - a.updatedAt));
      setItems(i);
    } catch {
      setProblem('This phone would not open the app’s storage. In Safari, turn off Private Browsing and open the app again.');
    }
  }, []);

  /* Screens are history entries, so the phone's back gesture works. depth counts the ones made since the
     app opened: "‹ Jobs" goes back through them, or straight home if the app was reopened on a job. */
  const depth = useRef(0);
  const go = useCallback((s: Screen, push = true) => {
    setScreenState(s);
    keepScreen(s);
    if (push) {
      history.pushState({ jk: s }, '');
      depth.current += 1;
    } else history.replaceState({ jk: s }, '');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const home = useCallback(() => {
    if (depth.current > 0) history.back();
    else go({ name: 'home' }, false);
  }, [go]);

  useEffect(() => {
    setPinState(readPin());
    const first = loadScreen();
    setScreenState(first);
    history.replaceState({ jk: first }, '');
    void reload().then(() => setReady(true));
    const offStatus = onStatus(setStatus);
    const offChange = onChange(() => void reload());
    const online = () => wake();
    const visible = () => {
      if (document.visibilityState === 'visible') {
        void reload();
        wake();
      }
    };
    const back = (e: PopStateEvent) => {
      depth.current = Math.max(0, depth.current - 1);
      const s = (e.state?.jk as Screen | undefined) ?? { name: 'home' };
      setScreenState(s);
      keepScreen(s);
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('popstate', back);
    wake();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/job-kit-sw.js', { scope: '/job-kit' }).catch(() => {});
    navigator.storage?.persist?.().catch(() => {});
    return () => {
      offStatus();
      offChange();
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('popstate', back);
    };
  }, [reload]);

  const job = screen.name === 'job' ? jobs.find((j) => j.id === screen.id) : undefined;
  useEffect(() => {
    if (ready && screen.name === 'job' && !job) go({ name: 'home' }, false);
  }, [ready, screen, job, go]);

  const waiting = useMemo(() => items.filter((i) => !i.sent && !i.lost), [items]);
  const waitingBytes = waiting.reduce((n, i) => n + Math.max(0, i.bytes - i.sentParts * CHUNK), 0);

  /* ---------- changes ---------- */

  const touch = useCallback(
    async (id: string, change: (j: Job) => Job) => {
      const j = await getJob(id);
      if (!j) return;
      await putJob({ ...change(j), updatedAt: Date.now() });
      await reload();
    },
    [reload],
  );

  const addFiles = useCallback(
    async (jobId: string, section: Section, slot: Slot, files: File[]) => {
      const key = `${jobId}:${slot.id}`;
      setBusy((b) => ({ ...b, [key]: (b[key] || 0) + files.length }));
      for (const f of files) {
        try {
          const isClip = f.type.startsWith('video/') || (section.kind === 'video' && !f.type.startsWith('image/'));
          const kind = isClip ? 'video' : 'photo';
          let blob: Blob = f;
          let w: number | undefined;
          let h: number | undefined;
          let duration: number | undefined;
          let thumb: string | undefined;
          if (kind === 'photo') {
            const p = await shrinkPhoto(f);
            ({ blob, w, h, thumb } = p);
          } else {
            ({ duration, w, h, thumb } = await clipInfo(f));
          }
          const j = await getJob(jobId);
          if (!j) break;
          const seq = j.seq + 1;
          const id = uid();
          const item: Item = {
            id,
            jobId,
            section: section.id,
            slot: slot.id,
            slotLabel: slot.label,
            kind,
            path: `${section.id}/${String(seq).padStart(3, '0')}-${slot.id}${extFor(f.type, kind)}`,
            mime: kind === 'photo' ? 'image/jpeg' : f.type || 'video/quicktime',
            bytes: blob.size,
            w,
            h,
            duration,
            takenAt: f.lastModified || Date.now(),
            caption: '',
            thumb,
            createdAt: Date.now(),
            parts: Math.max(1, Math.ceil(blob.size / CHUNK)),
            sentParts: 0,
            sent: false,
          };
          await putFile(id, blob);
          await putItem(item);
          await putJob({ ...j, seq, updatedAt: Date.now() });
          await reload();
          wake();
        } catch (e) {
          setProblem(e instanceof Error && e.message ? e.message : 'That one could not be saved. Try again.');
        } finally {
          setBusy((b) => ({ ...b, [key]: Math.max(0, (b[key] || 1) - 1) }));
        }
      }
    },
    [reload],
  );

  const removeItem = useCallback(
    async (item: Item) => {
      await delFile(item.id);
      await delItem(item.id);
      await touch(item.jobId, (j) => j);
      wake();
    },
    [touch],
  );

  const setCaption = useCallback(
    async (item: Item, caption: string) => {
      await putItem({ ...item, caption });
      await touch(item.jobId, (j) => j);
      wake(16_000);
    },
    [touch],
  );

  /* ---------- screens ---------- */

  return (
    <div className="jk min-h-[100dvh] bg-paper text-ink">
      <TopBar
        status={status}
        waiting={waiting.length}
        waitingBytes={waitingBytes}
        onHome={screen.name === 'home' ? undefined : home}
        onStatus={() => go({ name: 'settings' })}
      />
      {problem ? (
        <div className="mx-auto max-w-[620px] px-4 pt-3">
          <p role="alert" className="flex items-start justify-between gap-3 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14.5px]">
            <span>{problem}</span>
            <button type="button" className="font-mono text-[13px] text-accent" onClick={() => setProblem('')}>
              OK
            </button>
          </p>
        </div>
      ) : null}
      <main className="mx-auto max-w-[620px] px-4 pb-[calc(env(safe-area-inset-bottom)+48px)]">
        {!ready ? (
          <p className="pt-16 text-center font-mono text-[14px] text-faint">Opening…</p>
        ) : screen.name === 'home' ? (
          <Home
            jobs={jobs}
            items={items}
            done={done}
            pin={pin}
            status={status}
            waitingBytes={waitingBytes}
            onNew={() => go({ name: 'new' })}
            onOpen={(id) => go({ name: 'job', id, tab: 'before' })}
            onSettings={() => go({ name: 'settings' })}
          />
        ) : screen.name === 'new' ? (
          <NewJob
            onCancel={home}
            onCreate={async (j) => {
              await putJob(j);
              await reload();
              wake(QUIET_START);
              go({ name: 'job', id: j.id, tab: 'before' }, false);
            }}
          />
        ) : screen.name === 'settings' ? (
          <Settings
            pin={pin}
            status={status}
            onPin={(p) => {
              savePin(p);
              setPinState(p);
            }}
          />
        ) : job ? (
          <JobView
            job={job}
            done={done[job.id]}
            items={items.filter((i) => i.jobId === job.id)}
            tab={screen.tab}
            busy={busy}
            onTab={(tab) => {
              const s: Screen = { name: 'job', id: job.id, tab };
              setScreenState(s);
              keepScreen(s);
              history.replaceState({ jk: s }, '');
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
            onAdd={addFiles}
            onRemove={removeItem}
            onCaption={setCaption}
            onJob={(change) => touch(job.id, change)}
            onNotes={async (notes) => {
              await touch(job.id, (j) => ({ ...j, notes }));
              wake(16_000);
            }}
            onSend={async () => {
              await touch(job.id, (j) => ({ ...j, readyAt: Date.now() }));
              wake();
            }}
            onForget={async () => {
              for (const i of items.filter((x) => x.jobId === job.id)) {
                await delFile(i.id);
                await delItem(i.id);
              }
              await delJob(job.id);
              await reload();
              home();
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

const QUIET_START = 2000;

/* ---------- top bar ---------- */

function TopBar({ status, waiting, waitingBytes, onHome, onStatus }: { status: Status; waiting: number; waitingBytes: number; onHome?: () => void; onStatus: () => void }) {
  const s = status.state;
  const text = s === 'sending' ? `Sending, ${waiting} left` : s === 'idle' && waiting ? `${waiting} waiting` : STATE_TEXT[s];
  const good = s === 'idle' && !waiting;
  const stuck = s === 'wrong-pin' || s === 'no-pin' || s === 'not-set-up' || s === 'inbox-key' || s === 'inbox-missing';
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[620px] items-center justify-between gap-3 px-4">
        {onHome ? (
          <button type="button" onClick={onHome} className="-ml-2 flex h-11 items-center gap-1.5 px-2 text-[15px] font-semibold" aria-label="All jobs">
            <span aria-hidden className="text-[18px] leading-none">‹</span> Jobs
          </button>
        ) : (
          <p className="flex items-center gap-2 font-display text-[19px] font-[680] tracking-[-0.02em]">
            <span aria-hidden className="jk-r">
              <svg viewBox={`-110 -20 ${R_MARK.w + 220} 1040`} className="h-[19px] w-[19px]">
                <path d={R_MARK.stem} className="fill-on-accent" />
                <path d={R_MARK.bowl} className="fill-on-accent" />
              </svg>
            </span>
            Job Kit
          </p>
        )}
        <button
          type="button"
          onClick={onStatus}
          className={`flex h-9 min-w-0 items-center gap-2 rounded-sm border px-3 font-mono text-[12.5px] ${stuck ? 'border-ink text-ink' : 'border-line-strong text-muted'}`}
          aria-label={`Sending: ${text}. Open settings`}
        >
          <Mark state={good ? 'sent' : s === 'sending' ? 'sending' : stuck ? 'lost' : 'waiting'} />
          <span className="truncate">
            {text}
            {waiting && s !== 'sending' && !stuck ? `, ${mb(waitingBytes)}` : ''}
          </span>
        </button>
      </div>
    </header>
  );
}

function Mark({ state }: { state: 'waiting' | 'sending' | 'sent' | 'lost' }) {
  if (state === 'sent')
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="8" className="fill-accent" />
        <path d="M4.5 8.2l2.3 2.3 4.7-4.9" className="fill-none stroke-on-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === 'sending')
    return (
      <svg viewBox="0 0 16 16" className="jk-spin h-4 w-4 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="6.5" className="fill-none stroke-line-strong" strokeWidth="2" />
        <path d="M8 1.5a6.5 6.5 0 016.5 6.5" className="fill-none stroke-accent" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (state === 'lost')
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="8" className="fill-ink" />
        <path d="M8 4v5M8 11.5v.5" className="fill-none stroke-on-accent" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6.5" className="fill-none stroke-faint" strokeWidth="1.8" />
    </svg>
  );
}

/* ---------- home ---------- */

/* Home only renders once the app has opened in the browser, so reading the window here is safe. */
function useStandalone() {
  const [standalone] = useState(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  });
  const [ios] = useState(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  return { standalone, ios };
}

function Home({
  jobs,
  items,
  done,
  pin,
  status,
  waitingBytes,
  onNew,
  onOpen,
  onSettings,
}: {
  jobs: Job[];
  items: Item[];
  done: Done;
  pin: string;
  status: Status;
  waitingBytes: number;
  onNew: () => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
}) {
  const { standalone, ios } = useStandalone();
  const [install, setInstall] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault();
      setInstall(e as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', keep);
    return () => window.removeEventListener('beforeinstallprompt', keep);
  }, []);

  return (
    <div className="pt-7">
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Your jobs</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        Photos, clips and sizes for each job, sent to your inbox as you go. Everything saves by itself: close the app and carry on from here any time, until the job is finished.
      </p>

      {!standalone ? (
        <div className="mt-5 rounded-sm border border-accent bg-accent-soft px-4 py-3.5 text-[15px] leading-relaxed">
          {install ? (
            <>
              <p className="font-semibold">Put the Job Kit on your home screen</p>
              <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => void install.prompt().finally(() => setInstall(null))}>
                Install
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">Put the Job Kit on your home screen first</p>
              <p className="mt-1 text-muted">
                {ios ? 'In Safari tap Share, then Add to Home Screen. ' : 'In the browser menu tap Add to Home screen. '}
                Then open it from the icon and use it from there: the icon and the browser keep separate copies.
              </p>
            </>
          )}
        </div>
      ) : null}

      {!pin ? (
        <button type="button" onClick={onSettings} className="mt-5 block w-full rounded-sm border border-ink bg-mount px-4 py-3.5 text-left">
          <span className="block font-semibold">Add your PIN</span>
          <span className="mt-0.5 block text-[14.5px] text-muted">Once, so the app can send. Photos you take before that wait on the phone.</span>
        </button>
      ) : null}

      <button type="button" onClick={onNew} className="btn btn-primary mt-6 w-full">
        New job
      </button>

      {jobs.length ? (
        <ul className="mt-7 grid gap-3">
          {jobs.map((j) => {
            const mine = items.filter((i) => i.jobId === j.id && !i.lost);
            const photos = mine.filter((i) => i.kind === 'photo').length;
            const clips = mine.filter((i) => i.kind === 'video').length;
            const left = mine.filter((i) => !i.sent).length;
            const sizes = j.notes.sizes.filter((s) => s.w || s.h || s.d).length;
            const cover = mine.find((i) => i.slot === 'main-upright') ?? [...mine].reverse().find((i) => i.thumb);
            return (
              <li key={j.id}>
                <button type="button" onClick={() => onOpen(j.id)} className="flex w-full items-stretch gap-3 rounded-sm border border-line-strong bg-mount p-2.5 text-left transition-colors hover:border-ink">
                  <span className="relative block h-[76px] w-[76px] shrink-0 overflow-hidden rounded-sm bg-raised">
                    {cover?.thumb ? <img src={cover.thumb} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-[16.5px] font-semibold leading-snug">{j.what}</span>
                    <span className="block truncate text-[14.5px] text-muted">
                      {j.area} · {monthName(j.month)}
                    </span>
                    <span className="mt-1 block font-mono text-[12.5px] text-faint">
                      {photos} photo{photos === 1 ? '' : 's'} · {clips} clip{clips === 1 ? '' : 's'} · {sizes} size{sizes === 1 ? '' : 's'}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[12.5px] text-faint">
                      <Mark state={left ? 'waiting' : 'sent'} />
                      {left ? `${left} waiting to send` : done[j.id] ? 'Done: on your website' : j.readyAt ? 'Sent to Claude, waiting for the page' : 'All sent, still open'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-7 font-mono text-[13.5px] text-faint">No jobs yet. Start one on the first visit, before anything moves.</p>
      )}

      <p className="mt-8 border-t border-line pt-4 font-mono text-[12.5px] leading-relaxed text-faint">
        On this phone: {waitingBytes ? `${mb(waitingBytes)} waiting to send` : 'nothing waiting, all sent'}.
        {status.state === 'offline' ? ' It sends when the signal is back and the app is open.' : ''}
      </p>
    </div>
  );
}

/* ---------- new job ---------- */

function NewJob({ onCancel, onCreate }: { onCancel: () => void; onCreate: (j: Job) => void | Promise<void> }) {
  const [what, setWhat] = useState('');
  const [area, setArea] = useState('');
  const [month, setMonth] = useState(thisMonth());
  const [kinds, setKinds] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const whatRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);
  const ok = what.trim() && area.trim();

  return (
    <form
      className="pt-7"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!ok) {
          (what.trim() ? areaRef : whatRef).current?.focus();
          return;
        }
        const now = Date.now();
        void onCreate({
          id: newJobId(month, what, area),
          what: what.trim(),
          area: area.trim(),
          month,
          kinds,
          notes: emptyNotes(),
          createdAt: now,
          updatedAt: now,
          seq: 0,
        });
      }}
    >
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">New job</h1>
      <div className="mt-6 grid gap-5">
        <label className="grid gap-1.5">
          <span className={label}>What</span>
          <input ref={whatRef} className={`${field} h-12 ${tried && !what.trim() ? 'border-ink' : ''}`} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Alcove wardrobes" autoCapitalize="sentences" />
          {tried && !what.trim() ? <Missing>Type what you are building.</Missing> : null}
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Area</span>
          <input ref={areaRef} className={`${field} h-12 ${tried && !area.trim() ? 'border-ink' : ''}`} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. East Finchley" autoCapitalize="words" />
          <span className="text-[13.5px] text-faint">Area only, never the client’s name or street.</span>
          {tried && !area.trim() ? <Missing>Type the area.</Missing> : null}
        </label>
        <fieldset className="grid gap-2">
          <legend className={`${label} mb-2`}>Kind of job</legend>
          <Chips options={KINDS} value={kinds} onChange={setKinds} multi />
        </fieldset>
        <label className="grid gap-1.5">
          <span className={label}>Finished (month)</span>
          <input type="month" className={`${field} jk-month h-12`} value={month} onChange={(e) => setMonth(e.target.value || thisMonth())} />
        </label>
      </div>
      <div className="mt-8 flex gap-3">
        <button type="submit" className="btn btn-primary flex-1">
          Start the job
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* A box that still needs filling in, said plainly under it. */
function Missing({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
      <Mark state="lost" />
      {children}
    </span>
  );
}

function Chips({ options, value, onChange, multi }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o) : [...value, o]) : on ? [] : [o])}
            className={`min-h-10 rounded-sm border px-3 py-1.5 text-[15px] transition-colors ${on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-ink'}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- one job ---------- */

const TABS: { id: Tab; title: string }[] = [...SECTIONS.map((s) => ({ id: s.id as Tab, title: s.title })), { id: 'notes', title: 'Notes' }, { id: 'send', title: 'Send' }];

function JobView({
  job,
  done,
  items,
  tab,
  busy,
  onTab,
  onAdd,
  onRemove,
  onCaption,
  onJob,
  onNotes,
  onSend,
  onForget,
}: {
  job: Job;
  done?: { slug: string; title: string };
  items: Item[];
  tab: Tab;
  busy: Record<string, number>;
  onTab: (t: Tab) => void;
  onAdd: (jobId: string, section: Section, slot: Slot, files: File[]) => Promise<void>;
  onRemove: (i: Item) => Promise<void>;
  onCaption: (i: Item, c: string) => Promise<void>;
  onJob: (change: (j: Job) => Job) => Promise<void>;
  onNotes: (n: Notes) => Promise<void>;
  onSend: () => Promise<void>;
  onForget: () => Promise<void>;
}) {
  const live = items.filter((i) => !i.lost);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Bring the open tab into the middle of the tab row (sideways only; the page itself stays put).
    const row = tabsRef.current;
    const on = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (row && on) row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, [tab]);
  const idx = TABS.findIndex((t) => t.id === tab);
  const next = TABS[idx + 1];

  return (
    <div>
      <div className="pt-5">
        <p className="kicker">{monthName(job.month)}</p>
        <h1 className="mt-1 font-display text-[28px] font-[680] leading-[1.05] tracking-[-0.025em]">{job.what}</h1>
        <p className="mt-0.5 text-[15.5px] text-muted">{job.area}</p>
        <p className="mt-1.5 font-mono text-[12.5px] text-faint">Saves by itself as you go. Come back to it any time from Jobs.</p>
      </div>

      <nav ref={tabsRef} className="jk-tabs sticky top-[calc(env(safe-area-inset-top)+56px)] z-20 -mx-4 mt-4 flex gap-1 overflow-x-auto border-b border-line bg-paper px-4" aria-label="Parts of the job">
        {TABS.map((t) => {
          const sec = SECTIONS.find((s) => s.id === t.id);
          const n = sec ? progress(sec, live) : 0;
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => onTab(t.id)}
              className={`flex h-12 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[15px] ${on ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted'}`}
            >
              {t.title}
              {sec ? <span className={`font-mono text-[12px] ${n >= sec.goal ? 'text-accent' : 'text-faint'}`}>{n < sec.goal && sec.goal > 1 ? `${n}/${sec.goal}` : n}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="pt-5">
        {tab === 'notes' ? (
          <NotesForm job={job} onNotes={onNotes} />
        ) : tab === 'send' ? (
          <SendPanel job={job} done={done} items={items} onSend={onSend} onForget={onForget} onJob={onJob} />
        ) : (
          <SectionView section={SECTIONS.find((s) => s.id === tab)!} job={job} items={live} busy={busy} onAdd={onAdd} onRemove={onRemove} onCaption={onCaption} />
        )}
      </div>

      {next ? (
        <button type="button" onClick={() => onTab(next.id)} className="btn btn-ghost mt-8 w-full">
          Next: {next.title}
        </button>
      ) : null}
    </div>
  );
}

function SectionView({
  section,
  job,
  items,
  busy,
  onAdd,
  onRemove,
  onCaption,
}: {
  section: Section;
  job: Job;
  items: Item[];
  busy: Record<string, number>;
  onAdd: (jobId: string, section: Section, slot: Slot, files: File[]) => Promise<void>;
  onRemove: (i: Item) => Promise<void>;
  onCaption: (i: Item, c: string) => Promise<void>;
}) {
  const slots: Slot[] = [...section.slots, ...(section.extra ? [{ id: 'extra', label: section.extra, hint: 'Add a few words so it’s clear what it shows.' }] : [])];
  return (
    <div>
      <p className="text-[15.5px] leading-relaxed text-muted">{section.intro}</p>
      {section.note ? <p className="mt-2 font-mono text-[13px] leading-relaxed text-faint">{section.note}</p> : null}
      <ul className="mt-5 grid gap-3">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            job={job}
            section={section}
            slot={slot}
            items={items.filter((i) => i.section === section.id && i.slot === slot.id)}
            guide={slot.pairWith ? items.find((i) => i.slot === slot.pairWith) : undefined}
            saving={busy[`${job.id}:${slot.id}`] || 0}
            onAdd={onAdd}
            onRemove={onRemove}
            onCaption={onCaption}
          />
        ))}
      </ul>
    </div>
  );
}

function SlotCard({
  job,
  section,
  slot,
  items,
  guide,
  saving,
  onAdd,
  onRemove,
  onCaption,
}: {
  job: Job;
  section: Section;
  slot: Slot;
  items: Item[];
  guide?: Item;
  saving: number;
  onAdd: (jobId: string, section: Section, slot: Slot, files: File[]) => Promise<void>;
  onRemove: (i: Item) => Promise<void>;
  onCaption: (i: Item, c: string) => Promise<void>;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const video = section.kind === 'video';
  const accept = video ? 'video/*' : 'image/*';
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) void onAdd(job.id, section, slot, files);
  };
  const done = items.length > 0;
  const shown = items.find((i) => i.id === open);

  return (
    <li className={`rounded-sm border bg-mount p-3.5 ${done ? 'border-line-strong' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[16.5px] font-semibold leading-snug">
            {done ? <Mark state="sent" /> : null}
            {slot.label}
          </p>
          {slot.hint ? <p className="mt-1 text-[14.5px] leading-snug text-muted">{slot.hint}</p> : null}
          {slot.target ? <p className="mt-1 font-mono text-[12.5px] text-faint">{slot.target}</p> : null}
        </div>
        {guide?.thumb ? (
          <figure className="shrink-0 text-center">
            <img src={guide.thumb} alt="Your before photo from this spot" className="h-[64px] w-[64px] rounded-sm object-cover opacity-90" />
            <figcaption className="mt-0.5 font-mono text-[11px] text-faint">before</figcaption>
          </figure>
        ) : null}
      </div>

      {items.length || saving ? (
        <ul className="jk-thumbs mt-3">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setOpen(open === i.id ? null : i.id)} className={`jk-thumb ${open === i.id ? 'is-open' : ''}`} aria-label={`${i.kind === 'video' ? 'Clip' : 'Photo'}${i.caption ? `: ${i.caption}` : ''}. Tap for options`}>
                {i.thumb ? <img src={i.thumb} alt="" /> : <span className="jk-thumb-blank">{i.kind === 'video' ? 'Clip' : 'Photo'}</span>}
                {i.kind === 'video' ? <span className="jk-len">{i.duration ? `${Math.round(i.duration)} s` : 'clip'}</span> : null}
                <span className="jk-mark">
                  <Mark state={i.sent ? 'sent' : 'waiting'} />
                </span>
              </button>
            </li>
          ))}
          {Array.from({ length: saving }).map((_, n) => (
            <li key={`s${n}`}>
              <span className="jk-thumb jk-saving" aria-label="Saving">
                <Mark state="sending" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {shown ? <ItemPanel key={shown.id} item={shown} onRemove={() => void onRemove(shown).then(() => setOpen(null))} onCaption={(c) => void onCaption(shown, c)} /> : null}

      <div className="mt-3 flex gap-2">
        {slot.camera !== false ? (
          <button type="button" className={`btn btn-sm flex-1 ${done ? 'btn-ghost' : 'btn-primary'}`} onClick={() => cam.current?.click()}>
            {video ? (done ? 'Film another' : 'Film') : done ? 'Take another' : 'Take photo'}
          </button>
        ) : null}
        <button type="button" className={`btn btn-sm btn-ghost ${slot.camera === false ? 'flex-1' : ''}`} onClick={() => lib.current?.click()}>
          From Photos
        </button>
      </div>
      <input ref={cam} type="file" accept={accept} capture="environment" className="hidden" onChange={pick} />
      <input ref={lib} type="file" accept={accept} multiple className="hidden" onChange={pick} />
    </li>
  );
}

function ItemPanel({ item, onRemove, onCaption }: { item: Item; onRemove: () => void; onCaption: (c: string) => void }) {
  const [caption, setCaption] = useState(item.caption);
  const [sure, setSure] = useState(false);
  const long = item.kind === 'video' && item.duration && item.duration > 30;
  return (
    <div className="mt-3 rounded-sm border border-line bg-paper p-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12.5px] text-faint">
        <span>{mb(item.bytes)}</span>
        {item.w && item.h ? <span>{item.w} x {item.h}</span> : null}
        {item.duration ? <span>{Math.round(item.duration)} s</span> : null}
        <span>{item.sent ? 'sent' : item.sentParts ? `sending, ${item.sentParts} of ${item.parts} pieces` : 'waiting to send'}</span>
      </div>
      {long ? <p className="mt-2 text-[14px] leading-snug text-ink">Longer than 30 s. Fine for the time-lapse; the site plays up to 24 s of any other clip, so it will be cut.</p> : null}
      <label className="mt-2.5 grid gap-1">
        <span className={label}>What it shows (optional)</span>
        <input
          className={`${field} h-11`}
          value={caption}
          placeholder={item.slot === 'extra' ? 'e.g. Cut round the boiler pipe' : 'e.g. Left alcove'}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== item.caption && onCaption(caption.trim())}
        />
      </label>
      <button type="button" className={`mt-3 h-10 px-0 text-[14.5px] font-semibold ${sure ? 'text-ink underline' : 'text-muted'}`} onClick={() => (sure ? onRemove() : setSure(true))}>
        {sure ? 'Tap again to delete it' : `Delete this ${item.kind === 'video' ? 'clip' : 'photo'}`}
      </button>
    </div>
  );
}

/* ---------- notes ---------- */

function NotesForm({ job, onNotes }: { job: Job; onNotes: (n: Notes) => Promise<void> }) {
  const [n, setN] = useState<Notes>(job.notes);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(n);
  const save = (next: Notes) => {
    setN(next);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void onNotes(latest.current), 700);
  };
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void onNotes(latest.current);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const text = (k: keyof Notes) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => save({ ...n, [k]: e.target.value });
  const size = (i: number, k: 'what' | 'w' | 'h' | 'd', v: string) => save({ ...n, sizes: n.sizes.map((s, j) => (j === i ? { ...s, [k]: k === 'what' ? v : v.replace(/[^\d.]/g, '') } : s)) });

  return (
    <div className="grid gap-6">
      <p className="text-[15.5px] leading-relaxed text-muted">Two minutes here means the 3D model is drawn to your real sizes and the page says what you actually used. Leave out what you don’t know.</p>

      <fieldset>
        <legend className={label}>Sizes in mm (W x H x D)</legend>
        <div className="mt-2 grid gap-3">
          {n.sizes.map((s, i) => (
            <div key={i} className="rounded-sm border border-line bg-mount p-2.5">
              <input className={`${field} h-11`} value={s.what} onChange={(e) => size(i, 'what', e.target.value)} placeholder="What (e.g. Left alcove, the space)" aria-label="What this size is" />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['w', 'h', 'd'] as const).map((k) => (
                  <label key={k} className="grid gap-1">
                    <span className="font-mono text-[11.5px] text-faint">{k === 'w' ? 'Width' : k === 'h' ? 'Height' : 'Depth'}</span>
                    <input className={`${field} h-11 font-mono`} inputMode="numeric" value={s[k]} onChange={(e) => size(i, k, e.target.value)} placeholder="mm" />
                  </label>
                ))}
              </div>
              {n.sizes.length > 1 ? (
                <button type="button" className="mt-1.5 h-9 text-[14px] text-muted" onClick={() => save({ ...n, sizes: n.sizes.filter((_, j) => j !== i) })}>
                  Remove this size
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => save({ ...n, sizes: [...n.sizes, { what: '', w: '', h: '', d: '' }] })}>
            Add a size
          </button>
        </div>
      </fieldset>

      <Area label="Before photo spots" value={n.spots} onChange={text('spots')} placeholder="e.g. Doorway, chest height. By the window. From the bed." />
      <Area label="Materials" value={n.materials} onChange={text('materials')} placeholder="e.g. 18 mm MDF, MR MDF for the plinth, birch ply shelves" />
      <Area label="Hardware" value={n.hardware} onChange={text('hardware')} placeholder="e.g. Soft-close hinges, full-extension runners, knobs, LED strip" />

      <fieldset>
        <legend className={`${label} mb-2`}>Tools that did the work</legend>
        <Chips options={TOOLS} value={n.tools} onChange={(tools) => save({ ...n, tools })} multi />
        <input className={`${field} mt-2.5 h-11`} value={n.toolsOther} onChange={text('toolsOther')} placeholder="Anything else" aria-label="Other tools" />
      </fieldset>

      <Area label="What was tricky" value={n.tricky} onChange={text('tricky')} placeholder="e.g. Wall 25 mm out of plumb, boiler pipe in the corner" />
      <Area label="What the client wanted" value={n.wanted} onChange={text('wanted')} placeholder="What it is for, in their words. No names." />

      <fieldset>
        <legend className={`${label} mb-2`}>OK to show photos on the website</legend>
        <Chips options={SHOW_OPTIONS} value={n.okToShow ? [n.okToShow] : []} onChange={(v) => save({ ...n, okToShow: v[0] || '' })} />
      </fieldset>
      <fieldset>
        <legend className={`${label} mb-2`}>Google review</legend>
        <Chips options={REVIEW_OPTIONS} value={n.review ? [n.review] : []} onChange={(v) => save({ ...n, review: v[0] || '' })} />
        <a href="/review/send" className="link-more mt-3 text-[15px]">
          Ask for a review <span aria-hidden>→</span>
        </a>
      </fieldset>
    </div>
  );
}

function Area({ label: l, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={label}>{l}</span>
      <textarea className={`${field} min-h-[76px] py-2.5 leading-snug`} rows={2} value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}

/* ---------- send ---------- */

function SendPanel({
  job,
  done,
  items,
  onSend,
  onForget,
  onJob,
}: {
  job: Job;
  done?: { slug: string; title: string };
  items: Item[];
  onSend: () => Promise<void>;
  onForget: () => Promise<void>;
  onJob: (change: (j: Job) => Job) => Promise<void>;
}) {
  const live = items.filter((i) => !i.lost);
  const lost = items.length - live.length;
  const left = live.filter((i) => !i.sent);
  const leftBytes = left.reduce((n, i) => n + Math.max(0, i.bytes - i.sentParts * CHUNK), 0);
  const sizes = job.notes.sizes.filter((s) => s.w || s.h || s.d).length;
  const notesFilled = [job.notes.materials, job.notes.hardware, job.notes.tricky, job.notes.wanted, job.notes.okToShow].filter((v) => v.trim()).length;
  const sentToClaude = job.readyAt && (job.detailsSentAt || 0) >= job.readyAt && !left.length;
  const [copied, setCopied] = useState(false);
  const [sure, setSure] = useState(false);
  const say = `process job kit: ${job.what}, ${job.area}`;

  const rows: [string, string, boolean][] = [
    ...SECTIONS.map((s): [string, string, boolean] => {
      const n = progress(s, live);
      const what = s.id === 'before' ? ' spots' : s.id === 'build' ? ' stages' : '';
      return [s.title, n < s.goal && s.goal > 1 ? `${n} of ${s.goal}${what}` : `${n}${what}`, n >= s.goal];
    }),
    ['Sizes', String(sizes), sizes > 0],
    ['Notes', `${notesFilled} of 5`, notesFilled >= 3],
  ];

  return (
    <div>
      <p className="text-[15.5px] leading-relaxed text-muted">When the job is finished: check the list, then send. Gaps are fine, the page is made from what is there.</p>
      <table className="mt-5 w-full border-collapse text-[15.5px]">
        <tbody>
          {rows.map(([name, value, ok]) => (
            <tr key={name} className="border-b border-line">
              <td className="py-2.5">{name}</td>
              <td className="py-2.5 text-right font-mono text-[14px] text-muted">
                <span className="inline-flex items-center gap-2">
                  {value}
                  {ok ? <Mark state="sent" /> : <Mark state="waiting" />}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 font-mono text-[13px] leading-relaxed text-faint">
        {left.length ? `${left.length} still on this phone (${mb(leftBytes)}). Keep the app open with signal and they go.` : 'Every photo and clip is in your inbox, none left on this phone.'}
        {lost ? ` ${lost} could not be sent (the phone cleared them).` : ''}
      </p>

      {done ? (
        <div className="mt-6 rounded-sm border border-accent bg-accent-soft p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Mark state="sent" /> Done: it’s on your website
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted">Claude made the job page from it: {done.title}.</p>
          <a href={`/portfolio/${done.slug}`} className="btn btn-primary btn-sm mt-3">
            See the job page
          </a>
        </div>
      ) : sentToClaude ? (
        <div className="mt-6 rounded-sm border border-accent bg-accent-soft p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Mark state="sent" /> Received in your inbox
          </p>
          <p className="mt-1 font-mono text-[12.5px] text-faint">{when(job.detailsSentAt)}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">Last step: tell Claude</p>
          <p className="mt-2 rounded-sm border border-line bg-mount px-3 py-2.5 font-mono text-[14px]">{say}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(say)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => {})
            }
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">When the job page is live, this box changes to “Done” with a link to it.</p>
        </div>
      ) : null}

      <button type="button" className={`btn mt-6 w-full ${job.readyAt ? 'btn-ghost' : 'btn-primary'}`} onClick={() => void onSend()}>
        {job.readyAt ? 'Added more? Send again' : 'Send to Claude'}
      </button>
      {job.readyAt && !sentToClaude ? (
        <p className="mt-2 font-mono text-[13px] text-faint">{left.length ? 'Marked as finished. Sending the last files first…' : 'Sending the details…'}</p>
      ) : null}

      <div className="mt-10 border-t border-line pt-5">
        <p className="text-[14.5px] leading-relaxed text-muted">
          Wrong name or area? <RenameJob job={job} onJob={onJob} />
        </p>
        {sentToClaude ? (
          <button type="button" className={`mt-4 h-10 text-[14.5px] font-semibold ${sure ? 'text-ink underline' : 'text-muted'}`} onClick={() => (sure ? void onForget() : setSure(true))}>
            {sure ? 'Tap again to remove it from this phone' : 'Remove this job from the phone (it stays in the inbox)'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RenameJob({ job, onJob }: { job: Job; onJob: (change: (j: Job) => Job) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState(job.what);
  const [area, setArea] = useState(job.area);
  if (!open)
    return (
      <button type="button" className="font-semibold text-accent" onClick={() => setOpen(true)}>
        Change it
      </button>
    );
  return (
    <span className="mt-3 grid gap-2">
      <input className={`${field} h-11`} value={what} onChange={(e) => setWhat(e.target.value)} aria-label="What" />
      <input className={`${field} h-11`} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area" />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          if (what.trim() && area.trim()) void onJob((j) => ({ ...j, what: what.trim(), area: area.trim() })).then(() => setOpen(false));
        }}
      >
        Save
      </button>
    </span>
  );
}

const when = (t?: number) =>
  t ? new Date(t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/* ---------- settings ---------- */

const CHECK_TEXT: Record<string, string> = {
  ok: 'All good: the PIN is right and the inbox takes files.',
  'wrong-pin': 'That PIN is not the one in Vercel (JOBKIT_PIN).',
  'not-set-up': 'The inbox is not set up yet: JOBKIT_GITHUB_TOKEN and JOBKIT_PIN need adding in Vercel, then a redeploy.',
  'inbox-key': 'The GitHub key in Vercel is not working (expired, or it cannot write to raf-job-inbox).',
  'inbox-missing': 'The GitHub key cannot see raf-job-inbox. Check the repo exists and the key is allowed to use it.',
  offline: 'No signal. Try again when you are online.',
  busy: 'GitHub is busy. Try again in a minute.',
  error: 'Something went wrong. Try again in a minute.',
};

function Settings({ pin, status, onPin }: { pin: string; status: Status; onPin: (p: string) => void }) {
  const [value, setValue] = useState(pin);
  const [result, setResult] = useState('');
  const [checking, setChecking] = useState(false);
  const check = async (p: string) => {
    setChecking(true);
    setResult('');
    const r = await checkSetup(p);
    setChecking(false);
    setResult(CHECK_TEXT[r] || CHECK_TEXT.error);
    if (r === 'ok') wake();
  };
  return (
    <div className="pt-7">
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Sending</h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        Right now: <span className="font-semibold text-ink">{STATE_TEXT[status.state]}</span>
      </p>
      <form
        className="mt-6 grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onPin(value.trim());
          void check(value.trim());
        }}
      >
        <label className="grid gap-1.5">
          <span className={label}>PIN</span>
          <input className={`${field} h-12 font-mono`} value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="The PIN you put in Vercel" />
        </label>
        <button type="submit" className="btn btn-primary mt-2" disabled={checking || !value.trim()}>
          {checking ? 'Checking…' : 'Save and check'}
        </button>
      </form>
      {result ? (
        <p role="status" className="mt-4 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[15px] leading-relaxed">
          {result}
        </p>
      ) : null}
      <div className="mt-10 grid gap-3 border-t border-line pt-5 text-[14.5px] leading-relaxed text-muted">
        <p>Photos are made smaller on the phone (2400 px, about 0.5 to 1 MB) and their hidden location data is dropped. Clips are sent as filmed, in 3 MB pieces, so film them at 1080p, not 4K.</p>
        <p>Anything taken with Take photo or Film goes straight into the app, not your camera roll. Once it is sent, the phone deletes its copy.</p>
        <p>The app only sends: nobody can see the photos through it, even with the PIN.</p>
      </div>
      <p className="mt-6 font-mono text-[12.5px] text-faint">
        <SendNow />
      </p>
    </div>
  );
}

function SendNow() {
  const [sent, setSent] = useState(false);
  return (
    <button
      type="button"
      className="underline"
      onClick={async () => {
        const jobs = await allJobs();
        for (const j of jobs) await sendDetails(j.id);
        wake();
        setSent(true);
      }}
    >
      {sent ? 'Details sent again' : 'Send every job’s details again'}
    </button>
  );
}

'use client';
/* eslint-disable @next/next/no-img-element -- the pictures here are small thumbnails kept on the phone (data URLs), not site images */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { clipInfo, shrinkPhoto } from './media';
import { DESIGN_SPACE, KINDS, progress, REVIEW_OPTIONS, SECTIONS, SHOW_OPTIONS, TOOLS, type Section, type SectionId, type Slot } from './plan';
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
import type { Status as CurrentStatus } from '@/lib/servicem8';
import Mark from './mark';
import { Icon, type IconName } from './icons';
import { Area, Chips, field, label, Missing, SectionView, TalkBox } from './parts';
import { PostsList, PostView, postedEverywhere, type Pack } from './posts';
import { designFor, DesignsList, DesignView, designState, fetchDesigns, kitJobFor, NewDesign, savedLibrary, savedReady, similarDesigns, type DesignsReady } from './designs';
import { DesignPlaces } from './design-places';
import { Library, type LibraryJob } from './library';
import type { KindCount } from '@/lib/design-kinds';
import type { LibraryDesign } from '@/lib/designs';
import {
  CurrentList,
  CurrentView,
  Diary,
  bookingsOn,
  dayLabel,
  hm,
  localDay,
  sendBooking,
  sendCancel,
  sendMove,
  fetchSm8,
  keepSm8,
  NewEnquiry,
  problemText,
  readMarks,
  saveMarks,
  savedSm8,
  sendEnquiry,
  sendStatus,
  shown,
  stage,
  todayLines,
  whatOf,
  withoutDone,
  type Booking,
  type Marks,
  type Sm8,
  type TodayLine,
} from './current';
import { CLIENTS_FRESH, CustomerSearch, fetchClients, savedClients, savedCustomers, withCurrent, type Clients, type CustomerDetail } from './customers';
import { CustomerView } from './customer-view';
import type { InboxMail } from '@/lib/outlook';
import { binOnServer, customerEmails, dropHere, EmailView, enquiryFromMail, fetchInbox, firstOf, freshUnread, INBOX_FRESH, InboxList, inboxLine, inboxTodayLine, lastWith, markReadHere, openedMail, putBackHere, savedInbox, unbinOnServer, whenSaid, type Inbox } from './inbox';
import type { CurrentJob } from '@/lib/servicem8';
import { StatsPageView, StatsView, statsLine } from './stats';
import { setStatsOff } from '@/lib/site-stats';
import { JobTimeline, TimelineMini } from './job-timeline';
import { withoutGreeting } from '@/lib/whatsapp-chat';
import { addSend, enquiryFromChat, WaChatView, waHomeLine, WaJobBox, WaList, waTodayLines } from './whatsapp';
import { getWaFile as getWaFileBlob, pickedOf, pickedText, sendToJob, updateChat, useWaChats, waChat, type WaChat } from './wa-store';
import type { Change } from '@/lib/job-timeline';
import { ColourKey, KeyDots, secClass, secOfLine, secOfScreen, TintSwitch, useColourKey, useTint, type SecId } from './sections';
import { LIST_SCREENS, PickNote, Sidebar, sideOf, useWide, type SideId } from './desktop';
import './job-kit.css';

type Tab = SectionId | 'notes' | 'send';
type Screen =
  | { name: 'home' }
  | { name: 'new'; from?: string; design?: string } // design: started from a design request ("Start the Job Kit for it")
  | { name: 'kit' } // the Job Kit jobs on their own (a computer's sidebar; on the phone they're on Today)
  | { name: 'job'; id: string; tab: Tab }
  | { name: 'settings' }
  | { name: 'posts' }
  | { name: 'post'; slug: string }
  | { name: 'designs' }
  | { name: 'design'; id: string }
  | { name: 'new-design'; from?: string; wa?: string } // wa: started from a WhatsApp chat's photos
  | { name: 'current' }
  | { name: 'sm8'; id: string; from?: 'diary' | 'home' | 'customer' | 'timeline' | 'wa' | 'design'; client?: string; chat?: string; design?: string }
  | { name: 'enquiry'; client?: string; named?: string; mail?: string; wa?: string } // client: started from a customer's page; named: from a search that found nobody; mail: from an email in the Inbox
  | { name: 'customer'; id: string; from?: 'home' } // one customer from ServiceM8 (customer-view.tsx)
  | { name: 'diary' }
  | { name: 'whatsapp' } // WhatsApp chats brought in (whatsapp.tsx)
  | { name: 'wa-chat'; id: string }
  | { name: 'timeline'; job?: string } // Job timeline, a Gantt chart of the jobs going ahead (job-timeline.tsx); job: open its sheet
  | { name: 'inbox' } // info@rafcarpentry.com (inbox.tsx)
  | { name: 'email'; id: string; from?: 'home' | 'job'; job?: string } // job: opened from a ServiceM8 job's 'Reply from info@'
  | { name: 'library'; from?: 'designs'; for?: string } // for: a current job (ServiceM8 uuid) to send to
  | { name: 'stats' } // Website stats (stats.tsx)
  | { name: 'stats-page'; path: string }; // one page of the website: its heatmap

/* On a computer (desktop.tsx), the list drawn beside a screen: the one it's opened from. */
function listFor(s: Screen): Screen | null {
  switch (s.name) {
    case 'sm8':
      return s.from === 'diary' ? { name: 'diary' } : s.from === 'customer' && s.client ? { name: 'customer', id: s.client } : s.from === 'wa' ? { name: 'whatsapp' } : s.from === 'design' ? { name: 'designs' } : { name: 'current' };
    case 'customer':
      return { name: 'current' };
    case 'enquiry':
      return s.wa ? { name: 'whatsapp' } : s.mail ? { name: 'inbox' } : { name: 'current' };
    case 'email':
      return s.from === 'job' && s.job ? { name: 'current' } : { name: 'inbox' };
    case 'design':
      return { name: 'designs' };
    case 'new-design':
      return s.wa ? { name: 'whatsapp' } : { name: 'designs' };
    case 'wa-chat':
      return { name: 'whatsapp' };
    case 'post':
      return { name: 'posts' };
    case 'job':
      return { name: 'kit' };
    case 'new':
      return s.design ? { name: 'designs' } : s.from ? { name: 'current' } : { name: 'kit' };
    default:
      return null;
  }
}
/* Screens that get the whole width on a computer. */
const ROOMY = ['home', 'timeline', 'library', 'stats', 'stats-page'];

/* Where "‹ Back" goes when the app was reopened straight onto a screen (no history to go back through). */
const parentOf = (s: Screen): Screen =>
  s.name === 'wa-chat'
    ? { name: 'whatsapp' }
    : (s.name === 'enquiry' || s.name === 'new-design') && s.wa
    ? { name: 'wa-chat', id: s.wa }
    : s.name === 'sm8' && s.from === 'wa' && s.chat
    ? { name: 'wa-chat', id: s.chat }
    : s.name === 'sm8' && s.from === 'design' && s.design
    ? { name: 'design', id: s.design }
    : s.name === 'stats-page'
    ? { name: 'stats' }
    : s.name === 'email'
    ? s.from === 'job' && s.job
      ? { name: 'sm8', id: s.job }
      : { name: 'inbox' }
    : s.name === 'enquiry' && s.mail
    ? { name: 'email', id: s.mail }
    : s.name === 'library' && s.for
    ? { name: 'sm8', id: s.for }
    : s.name === 'design' || s.name === 'new-design' || (s.name === 'library' && s.from === 'designs')
    ? { name: 'designs' }
    : s.name === 'post'
      ? { name: 'posts' }
      : s.name === 'sm8' && s.from === 'customer' && s.client
        ? { name: 'customer', id: s.client }
        : s.name === 'enquiry' && s.client
          ? { name: 'customer', id: s.client }
          : s.name === 'customer'
            ? s.from === 'home'
              ? { name: 'home' }
              : { name: 'current' }
            : s.name === 'sm8' && s.from === 'diary'
        ? { name: 'diary' }
        : s.name === 'sm8' && s.from === 'timeline'
        ? { name: 'timeline' }
        : (s.name === 'sm8' && s.from !== 'home') || s.name === 'enquiry'
          ? { name: 'current' }
          : { name: 'home' };
const backLabel = (s: Screen) => {
  const p = parentOf(s).name;
  return p === 'stats' ? 'Stats' : p === 'designs' ? 'Designs' : p === 'design' ? 'Design' : p === 'posts' ? 'Posts' : p === 'current' ? 'Current jobs' : p === 'diary' ? 'Diary' : p === 'timeline' ? 'Timeline' : p === 'whatsapp' ? 'WhatsApp' : p === 'wa-chat' ? 'Chat' : p === 'sm8' ? 'Job' : p === 'customer' ? 'Customer' : p === 'inbox' ? 'Inbox' : p === 'email' ? 'Email' : 'Today';
};

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
    if (s && ['home', 'job', 'settings', 'posts', 'post', 'designs', 'design', 'current', 'sm8', 'diary', 'timeline', 'whatsapp', 'wa-chat', 'library', 'customer', 'inbox', 'email', 'stats', 'stats-page', 'kit'].includes(s.name)) return s;
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

export default function JobKitApp({ done = {}, posts = [], models = [], kinds = [] }: { done?: Done; posts?: Pack[]; models?: LibraryJob[]; kinds?: KindCount[] }) {
  const [ready, setReady] = useState(false);
  const wide = useWide(); // a computer: the desktop layout (desktop.tsx)
  const colourKey = useColourKey(ready);
  const [tint, setTint] = useTint();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [screen, setScreenState] = useState<Screen>({ name: 'home' });
  const screenNow = useRef(screen);
  useEffect(() => {
    screenNow.current = screen;
  }, [screen]);
  const [pin, setPinState] = useState('');
  const [busy, setBusy] = useState<Record<string, number>>({}); // slot key -> photos still being saved
  const [problem, setProblem] = useState('');
  const [designs, setDesigns] = useState<DesignsReady>({}); // design request id -> its page, once made
  const [library, setLibrary] = useState<LibraryDesign[]>([]); // the customer designs, for the Design library
  const checkDesigns = useCallback(() => {
    void fetchDesigns(readPin()).then((r) => {
      if (!r) return;
      setDesigns(r.ready);
      setLibrary(r.library);
    });
  }, []);
  // Current jobs from ServiceM8: the last list at once from the phone, then a fresh one (at most once a minute).
  const [sm8, setSm8] = useState<Sm8>({ jobs: [], at: 0 });
  const [marks, setMarks] = useState<Marks>({});
  const [sm8Loading, setSm8Loading] = useState(false);
  const lastSm8 = useRef(0);
  const checkSm8 = useCallback((force = false) => {
    const pin = readPin();
    if (!pin || (!force && Date.now() - lastSm8.current < 60_000)) return;
    lastSm8.current = Date.now();
    setSm8Loading(true);
    void fetchSm8(pin, { jobs: [], at: 0 }).then((r) => {
      setSm8((prev) => (r.error ? { ...prev, error: r.error, detail: r.detail } : r));
      setSm8Loading(false);
    });
  }, []);
  // Customers from ServiceM8 for the search: the list kept on the phone, fetched again when the box is used and
  // it's over 10 minutes old. Jobs of customers opened (any age) are kept too, so an old job opens like a current one.
  const [clients, setClients] = useState<Clients>({ clients: [], at: 0 });
  const [clientsLoading, setClientsLoading] = useState(false);
  const lastClients = useRef(0);
  const checkClients = useCallback((force = false) => {
    const pin = readPin();
    if (!pin) return setClients((c) => ({ ...c, error: 'no-pin' }));
    if (!force && Date.now() - lastClients.current < CLIENTS_FRESH) return;
    lastClients.current = Date.now();
    setClientsLoading(true);
    void fetchClients(pin, savedClients()).then((r) => {
      setClients(r);
      setClientsLoading(false);
      if (r.error) lastClients.current = 0; // try again next time the box is used
    });
  }, []);
  // info@rafcarpentry.com: the list kept on the phone, then a fresh one (at most every 2 minutes).
  const [inbox, setInbox] = useState<Inbox>({ mails: [], more: false, unread: null, mailbox: '', at: 0 });
  const [inboxLoading, setInboxLoading] = useState(false);
  const lastInbox = useRef(0);
  const checkInbox = useCallback((force = false) => {
    const pin = readPin();
    if (!pin || (!force && Date.now() - lastInbox.current < INBOX_FRESH)) return;
    lastInbox.current = Date.now();
    setInboxLoading(true);
    void fetchInbox(pin, savedInbox()).then((r) => {
      setInbox(r);
      setInboxLoading(false);
      if (r.error) lastInbox.current = 0;
    });
  }, []);
  const moreInbox = useCallback(() => {
    setInboxLoading(true);
    setInbox((cur) => {
      void fetchInbox(readPin(), cur, cur.mails.length).then((r) => {
        setInbox(r);
        setInboxLoading(false);
      });
      return cur;
    });
  }, []);
  /* Delete an email: into Deleted Items in Outlook, then off the list here; a bar at the bottom offers Undo for 12 s. */
  const [binned, setBinned] = useState<null | { binId: string; mail?: InboxMail; what: string; busy?: boolean; problem?: string }>(null);
  const binTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inboxNow = useRef(inbox);
  useEffect(() => {
    inboxNow.current = inbox;
  }, [inbox]);
  const removeMail = useCallback(async (id: string) => {
    const m = inboxNow.current.mails.find((x) => x.id === id);
    const r = await binOnServer(readPin(), id);
    if (!r.ok && r.error !== 'outlook-gone') return problemText(r.error, r.detail);
    setInbox((cur) => dropHere(cur, id));
    if (binTimer.current) clearTimeout(binTimer.current);
    if (r.ok) {
      const name = m ? (m.mine ? m.subject || 'your email' : `the email from ${m.from.name || m.from.email}`) : 'the email';
      setBinned({ binId: r.data.id || id, mail: m, what: name });
      binTimer.current = setTimeout(() => setBinned(null), 12000);
    }
    return '';
  }, []);
  const undoBin = useCallback(() => {
    if (!binned || binned.busy) return;
    if (binTimer.current) clearTimeout(binTimer.current);
    setBinned({ ...binned, busy: true, problem: '' });
    void unbinOnServer(readPin(), binned.binId).then((r) => {
      if (!r.ok) {
        setBinned({ ...binned, busy: false, problem: `${problemText(r.error, r.detail)} It’s still in Deleted Items in Outlook.` });
        return;
      }
      if (binned.mail) {
        const back = { ...binned.mail, id: r.data.id || binned.mail.id };
        setInbox((cur) => putBackHere(cur, back));
      }
      setBinned(null);
      checkInbox(true);
    });
  }, [binned, checkInbox]);
  const [customerJobs, setCustomerJobs] = useState<CurrentJob[]>([]);
  const customerLoaded = useCallback((d: CustomerDetail) => {
    setCustomerJobs((list) => [...d.jobs, ...list.filter((j) => !d.jobs.some((x) => x.uuid === j.uuid))]);
  }, []);
  const sm8Ref = useRef(sm8);
  sm8Ref.current = sm8;
  const mark = useCallback((uuid: string, patch: Marks[string]) => {
    setMarks((m) => {
      const next = { ...m, [uuid]: { ...m[uuid], ...patch } };
      saveMarks(next);
      return next;
    });
  }, []);

  /* A visit marked Done (or put back): on the phone only, see isVisitDone in current.tsx. */
  const markVisit = useCallback((b: Booking, done: boolean) => {
    setMarks((m) => {
      const was = (m[b.jobUuid]?.visitsDone ?? []).filter((x) => x !== b.uuid);
      const next = { ...m, [b.jobUuid]: { ...m[b.jobUuid], visitsDone: done ? [...was, b.uuid] : was } };
      saveMarks(next);
      return next;
    });
  }, []);
  // The schedule as the Diary, Today and a job's In the diary show it: without the visits marked done.
  const diarySm8 = useMemo(() => withoutDone(sm8, marks), [sm8, marks]);

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
     app opened: "‹ Back" goes back through them, or to the screen above if the app was reopened on one.
     Each entry keeps Next's own history fields (...history.state): without them Next's router took every back
     as a page it didn't make and reloaded the whole page (found 18 Oct 2026, when the email Undo bar vanished). */
  const depth = useRef(0);
  const go = useCallback((s: Screen, push = true) => {
    setScreenState(s);
    keepScreen(s);
    if (push) {
      history.pushState({ ...history.state, jk: s }, '');
      depth.current += 1;
    } else history.replaceState({ ...history.state, jk: s }, '');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const back = useCallback(() => {
    if (depth.current > 0) history.back();
    else go(parentOf(screen), false);
  }, [go, screen]);

  useEffect(() => {
    setPinState(readPin());
    setDesigns(savedReady());
    setLibrary(savedLibrary());
    checkDesigns();
    setSm8(savedSm8());
    setMarks(readMarks());
    checkSm8();
    const kept = savedClients();
    setClients(kept);
    lastClients.current = kept.at; // a list fetched in the last 10 minutes isn't fetched again
    setCustomerJobs(Object.values(savedCustomers()).flatMap((c) => c.jobs));
    const keptInbox = savedInbox();
    setInbox(keptInbox);
    checkInbox();
    if (readPin()) checkClients(); // so the first search is instant
    const first = loadScreen();
    setScreenState(first);
    history.replaceState({ ...history.state, jk: first }, '');
    /* Opening the app starts at the top (18 Oct 2026, Raf: 'when I open jobkit ... first thing it does goes to search
       bar in customers, I'd like it to be at the top of the app'): the phone mustn't put back an old scroll position,
       and a search box that had the keyboard when the app went into the background is let go, so coming back doesn't
       jump down to it with the keyboard up. Back from Today after more than 30 s away goes to the top too. */
    try {
      history.scrollRestoration = 'manual';
    } catch {
      /* older phones: nothing to change */
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    let hiddenAt = 0;
    const letGoOfSearch = () => {
      const a = document.activeElement;
      if (a instanceof HTMLInputElement && a.type === 'search') a.blur();
    };
    void reload().then(() => setReady(true));
    const offStatus = onStatus(setStatus);
    const offChange = onChange(() => void reload());
    const online = () => wake();
    const visible = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        letGoOfSearch();
        return;
      }
      if (document.visibilityState === 'visible') {
        if (hiddenAt && Date.now() - hiddenAt > 30_000 && screenNow.current.name === 'home') {
          letGoOfSearch();
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
        hiddenAt = 0;
        void reload();
        wake();
        checkDesigns();
        checkSm8();
        checkInbox();
        if (readPin()) checkClients();
      }
    };
    // the phone put the page back from its cache (iOS does this for a home-screen app): same as coming back
    const shown = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      letGoOfSearch();
      if (screenNow.current.name === 'home') window.scrollTo({ top: 0, behavior: 'instant' });
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
    window.addEventListener('pageshow', shown);
    wake();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/job-kit-sw.js', { scope: '/job-kit' }).catch(() => {});
    setStatsOff(true); // this phone's visits to the website aren't counted in the Website stats (src/lib/site-stats.ts)
    navigator.storage?.persist?.().catch(() => {});
    return () => {
      offStatus();
      offChange();
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('popstate', back);
      window.removeEventListener('pageshow', shown);
    };
  }, [reload, checkDesigns, checkSm8, checkClients, checkInbox]);
  // once the screens are drawn (they wait for the phone's storage), start at the top of the one the app opened on
  useEffect(() => {
    if (ready) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [ready]);

  const job = screen.name === 'job' || screen.name === 'design' ? jobs.find((j) => j.id === screen.id) : undefined;
  // A ServiceM8 job: in the Current jobs, or from a customer opened from the search (an older one).
  const findJob = (uuid: string) => sm8.jobs.find((j) => j.uuid === uuid) ?? customerJobs.find((j) => j.uuid === uuid);
  const cur = screen.name === 'sm8' ? findJob(screen.id) : undefined;
  const allClients = useMemo(() => withCurrent(clients.clients, sm8.jobs), [clients.clients, sm8.jobs]);
  const customerOf = (uuid: string) => allClients.find((c) => c.uuid === uuid) ?? savedCustomers()[uuid]?.client;
  const customers = useMemo(() => customerEmails(allClients, sm8.jobs), [allClients, sm8.jobs]);
  useEffect(() => {
    if (ready && (screen.name === 'job' || screen.name === 'design') && !job) go(parentOf(screen), false);
    if (ready && screen.name === 'sm8' && !cur && sm8.at) go(parentOf(screen), false);
  }, [ready, screen, job, cur, sm8.at, go]);

  /* Moving a ServiceM8 job on: shown at once, put back if ServiceM8 says no. */
  const changeStatus = useCallback(
    async (uuid: string, status: CurrentStatus) => {
      const now = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T').slice(0, 16);
      const moved = (j: CurrentJob): CurrentJob => ({ ...j, status, ...(status === 'Work Order' ? { workOrder: now } : status === 'Completed' ? { completed: now } : status === 'Unsuccessful' ? { lost: now } : {}) });
      if (!sm8Ref.current.jobs.some((j) => j.uuid === uuid)) {
        // An older job opened from a customer's page: moved there, then the Current jobs are fetched again,
        // because a job brought back to Quote (or on to Work Order) belongs in them now.
        let old: CurrentJob | undefined;
        setCustomerJobs((list) => list.map((j) => (j.uuid === uuid ? ((old = j), moved(j)) : j)));
        const r = await sendStatus(readPin(), uuid, status);
        if (!r.ok) {
          if (old) setCustomerJobs((list) => list.map((j) => (j.uuid === uuid ? old! : j)));
          setProblem(problemText(r.error, r.detail));
        } else checkSm8(true);
        return;
      }
      let before: Sm8 = { jobs: [], at: 0 };
      setSm8((s) => {
        before = s;
        const next = {
          ...s,
          jobs: s.jobs.map((j) => (j.uuid === uuid ? moved(j) : j)),
        };
        keepSm8(next);
        return next;
      });
      const r = await sendStatus(readPin(), uuid, status);
      if (!r.ok) {
        setSm8(before);
        keepSm8(before);
        setProblem(problemText(r.error, r.detail));
      }
    },
    [checkSm8],
  );
  /* The diary: a booking added, moved or cancelled goes to ServiceM8 first, then shows here. */
  const setBookings = useCallback((change: (b: NonNullable<Sm8['bookings']>) => NonNullable<Sm8['bookings']>) => {
    setSm8((s) => {
      const next = { ...s, bookings: change(s.bookings ?? []).sort((a, b) => a.start.localeCompare(b.start)) };
      keepSm8(next);
      return next;
    });
  }, []);
  const book = useCallback(
    async (jobUuid: string, start: string, end: string, staff?: string) => {
      const r = await sendBooking(readPin(), { job: jobUuid, start, end, staff });
      if (!r.ok) return problemText(r.error, r.detail);
      setBookings((list) => [...list.filter((b) => b.uuid !== r.data.booking.uuid), r.data.booking]);
      return '';
    },
    [setBookings],
  );
  const moveBooking = useCallback(
    async (uuid: string, start: string, end: string) => {
      const r = await sendMove(readPin(), uuid, start, end);
      if (!r.ok) return problemText(r.error, r.detail);
      setBookings((list) => list.map((b) => (b.uuid === uuid ? { ...b, start, end } : b)));
      return '';
    },
    [setBookings],
  );
  const cancelBooking = useCallback(
    async (uuid: string) => {
      const r = await sendCancel(readPin(), uuid);
      if (!r.ok) return problemText(r.error, r.detail);
      setBookings((list) => list.filter((b) => b.uuid !== uuid));
      return '';
    },
    [setBookings],
  );
  /* The Job timeline's dates: each booking added or moved in turn (ServiceM8 first, then here); stops at the first
     ServiceM8 turns down and says why. */
  const saveTimeline = useCallback(
    async (job: CurrentJob, changes: Change[]) => {
      for (const c of changes) {
        const err = c.uuid ? await moveBooking(c.uuid, c.start, c.end) : await book(job.uuid, c.start, c.end);
        if (err) return err;
      }
      return '';
    },
    [book, moveBooking],
  );
  const designJobs = useMemo(() => jobs.filter((j) => j.kind === 'design'), [jobs]);
  // Customer designs not built yet: a built one is counted (and listed) as its finished job.
  const libraryOwn = library.filter((d) => !(d.job && models.some((m) => m.slug === d.job!.slug))).length;
  const waChats = useWaChats();

  /* Off this phone only: the inbox and the website keep everything. */
  const removeJobs = useCallback(
    async (ids: string[]) => {
      for (const id of ids) {
        for (const i of items.filter((x) => x.jobId === id)) {
          await delFile(i.id);
          await delItem(i.id);
        }
        await delJob(id);
      }
      await reload();
    },
    [items, reload],
  );
  const forget = useCallback(
    async (id: string) => {
      await removeJobs([id]);
      back();
    },
    [removeJobs, back],
  );

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

  /* Any screen, drawn from its own Screen (the param shadows the current one), so on a computer the list can sit beside
     the screen opened from it (desktop.tsx). */
  const renderScreen = (screen: Screen): React.ReactNode => {
    const job = screen.name === 'job' || screen.name === 'design' ? jobs.find((j) => j.id === screen.id) : undefined;
    const cur = screen.name === 'sm8' ? findJob(screen.id) : undefined;
    const sendTo = screen.name === 'library' && screen.for ? findJob(screen.for) : undefined;
    const from = (screen.name === 'new' || screen.name === 'new-design') && screen.from ? findJob(screen.from) : undefined;
    const fromDesign = screen.name === 'new' && screen.design ? jobs.find((j) => j.id === screen.design && j.kind === 'design') : undefined;
    return screen.name === 'home' ? (
              <Home
                jobs={jobs.filter((j) => j.kind !== 'design')}
                items={items}
                done={done}
                posts={posts}
                onPosts={() => go({ name: 'posts' })}
                onClear={removeJobs}
                sm8={diarySm8}
                marks={marks}
                inbox={inbox}
                customers={customers}
                onInbox={() => {
                  checkInbox();
                  go({ name: 'inbox' });
                }}
                find={
                  <CustomerSearch
                    place="today"
                    clients={clients}
                    jobs={sm8.jobs}
                    loading={clientsLoading}
                    onNeed={() => checkClients()}
                    onRefresh={() => checkClients(true)}
                    onOpen={(id) => go({ name: 'customer', id, from: 'home' })}
                    onNewNamed={(named) => go({ name: 'enquiry', named })}
                  />
                }
                onCurrent={() => {
                  checkSm8();
                  go({ name: 'current' });
                }}
                onDiary={() => {
                  checkSm8();
                  go({ name: 'diary' });
                }}
                onTimeline={() => {
                  checkSm8();
                  go({ name: 'timeline' });
                }}
                waChats={waChats}
                onWhatsApp={() => go({ name: 'whatsapp' })}
                onToday={(l) => {
                  if (l.go === 'current') {
                    checkSm8();
                    go({ name: 'current' });
                  } else if (l.go === 'diary') {
                    checkSm8();
                    go({ name: 'diary' });
                  } else if (l.go === 'timeline') {
                    checkSm8();
                    go({ name: 'timeline' });
                  } else if (l.go === 'whatsapp') {
                    if (l.id) {
                      checkClients();
                      go({ name: 'wa-chat', id: l.id });
                    } else go({ name: 'whatsapp' });
                  } else if (l.go === 'sm8' && l.id) go({ name: 'sm8', id: l.id, from: 'home' });
                  else if (l.go === 'inbox') {
                    if (l.id) go({ name: 'email', id: l.id, from: 'home' });
                    else {
                      checkInbox();
                      go({ name: 'inbox' });
                    }
                  }
                  else if (l.go === 'designs') go(l.id ? { name: 'design', id: l.id } : { name: 'designs' });
                  else if (l.go === 'posts') go({ name: 'posts' });
                  else document.getElementById('kit-jobs')?.scrollIntoView({ behavior: 'instant', block: 'start' });
                }}
                designJobs={designJobs}
                designs={designs}
                onDesigns={() => {
                  checkDesigns();
                  go({ name: 'designs' });
                }}
                libraryCount={libraryOwn + models.length}
                libraryLine={`${libraryOwn ? `${libraryOwn} made for customers, ` : ''}${models.length} from finished jobs`}
                onLibrary={() => {
                  checkDesigns();
                  go({ name: 'library' });
                }}
                pin={pin}
                status={status}
                waitingBytes={waitingBytes}
                onNew={() => go({ name: 'new' })}
                onOpen={(id) => go({ name: 'job', id, tab: 'before' })}
                onSettings={() => go({ name: 'settings' })}
                onStats={() => go({ name: 'stats' })}
              />
            ) : screen.name === 'new' ? (
              <NewJob
                key={screen.design ?? screen.from ?? 'new'}
                initial={
                  fromDesign
                    ? { what: fromDesign.what, area: fromDesign.area, sm8: fromDesign.sm8, design: fromDesign.what }
                    : from
                      ? { what: whatOf(from.description), area: from.area, sm8: from.uuid, design: designJobs.find((k) => k.sm8 === from.uuid)?.what }
                      : undefined
                }
                onCancel={back}
                onCreate={async (j) => {
                  // Built from a design: started from it, or the design on the same ServiceM8 job (job-kit-fetch.py
                  // then finds the design to reuse and link on the job page).
                  const dj = fromDesign ?? (j.sm8 ? designJobs.find((k) => k.sm8 === j.sm8) : undefined);
                  await putJob(dj ? { ...j, fromDesign: dj.id } : j);
                  await reload();
                  wake(QUIET_START);
                  go({ name: 'job', id: j.id, tab: 'before' }, false);
                }}
              />
            ) : screen.name === 'designs' ? (
              <DesignsList
                jobs={designJobs}
                items={items}
                ready={designs}
                onNew={() => go({ name: 'new-design' })}
                onOpen={(id) => go({ name: 'design', id })}
                onLibrary={() => {
                  checkDesigns();
                  go({ name: 'library', from: 'designs' });
                }}
              />
            ) : screen.name === 'library' ? (
              <Library designs={library} models={models} kinds={kinds} hasPin={Boolean(pin)} to={sendTo ? { name: sendTo.name, first: sendTo.first, mobile: sendTo.mobile || sendTo.phone } : undefined} />
            ) : screen.name === 'new-design' ? (
              <NewDesign
                key={screen.wa ?? screen.from ?? 'new'}
                similar={(n) => similarDesigns(n, designJobs, library, designs)}
                onOpenRequest={(id) => go({ name: 'design', id }, false)}
                initial={
                  screen.wa && waChat(screen.wa)
                    ? (() => {
                        // From a WhatsApp chat: what from the ticked words, the area and mobile from the job or the chat.
                        const c = waChat(screen.wa)!;
                        const text = pickedText(c);
                        return {
                          what: from ? whatOf(from.description) : whatOf(withoutGreeting(text)),
                          area: from?.area ?? '',
                          mobile: from?.mobile || c.number || '',
                          sm8: from?.uuid,
                        };
                      })()
                    : from
                      ? { what: whatOf(from.description), area: from.area, mobile: from.mobile, sm8: from.uuid }
                      : undefined
                }
                onCancel={back}
                onCreate={async (j) => {
                  const c = screen.wa ? waChat(screen.wa) : undefined;
                  await putJob(c ? { ...j, design: { ...j.design!, brief: pickedText(c) } } : j);
                  await reload();
                  if (c) {
                    // the ticked photos become the photos of the space
                    const files: File[] = [];
                    for (const name of pickedOf(c).files.filter((f) => /\.(jpe?g|png|gif|heic|heif)$/i.test(f))) {
                      const b = await getWaFileBlob(c.id, name);
                      if (b) files.push(new File([b], name, { type: b.type || 'image/jpeg', lastModified: Date.now() }));
                    }
                    if (files.length) await addFiles(j.id, DESIGN_SPACE, DESIGN_SPACE.slots[0], files);
                    await updateChat(c.id, (x) => ({ ...x, design: j.id }));
                  }
                  wake(QUIET_START);
                  go({ name: 'design', id: j.id }, false);
                }}
              />
            ) : screen.name === 'design' ? (
              job ? (
                <DesignView
                  key={job.id}
                  job={job}
                  items={items.filter((i) => i.jobId === job.id)}
                  ready={designs[job.id]}
                  busy={busy}
                  onAdd={addFiles}
                  onRemove={removeItem}
                  onCaption={setCaption}
                  onJob={async (change) => {
                    await touch(job.id, change);
                    wake(16_000);
                  }}
                  onSend={async () => {
                    await touch(job.id, (j) => ({ ...j, readyAt: Date.now() }));
                    wake();
                  }}
                  onForget={() => forget(job.id)}
                  places={({ job: dj, onPublish, onLink }) => {
                    const kitJob = kitJobFor(dj, jobs);
                    return (
                      <DesignPlaces
                        job={dj}
                        ready={designs[dj.id]!}
                        kitJob={kitJob}
                        kitDone={kitJob ? done[kitJob.id] : undefined}
                        sm8Job={dj.sm8 ? findJob(dj.sm8) : undefined}
                        sm8Jobs={sm8.jobs}
                        designOn={(uuid) => designJobs.find((k) => k.sm8 === uuid)}
                        onPublish={onPublish}
                        onLink={onLink}
                        onStartKit={() => go({ name: 'new', from: dj.sm8, design: dj.id })}
                        onOpenKit={(id) => go({ name: 'job', id, tab: 'before' })}
                        onOpenSm8={(uuid) => go({ name: 'sm8', id: uuid, from: 'design', design: dj.id })}
                        onOpenDesign={(id) => go({ name: 'design', id })}
                        onLibrary={() => {
                          checkDesigns();
                          go({ name: 'library', from: 'designs' });
                        }}
                      />
                    );
                  }}
                />
              ) : null
            ) : screen.name === 'current' ? (
              <CurrentList
                sm8={sm8}
                marks={marks}
                kit={jobs}
                designs={designs}
                done={done}
                loading={sm8Loading}
                onRefresh={() => checkSm8(true)}
                onNew={() => go({ name: 'enquiry' })}
                onOpen={(id) => go({ name: 'sm8', id })}
                clients={clients}
                clientsLoading={clientsLoading}
                onFindNeed={() => checkClients()}
                onFindRefresh={() => checkClients(true)}
                onCustomer={(id) => go({ name: 'customer', id })}
                onNewNamed={(named) => go({ name: 'enquiry', named })}
              />
            ) : screen.name === 'inbox' ? (
              <InboxList
                inbox={inbox}
                loading={inboxLoading}
                customers={customers}
                onRefresh={() => checkInbox(true)}
                onMore={moreInbox}
                onOpen={(id) => go({ name: 'email', id })}
                onDelete={removeMail}
              />
            ) : screen.name === 'email' ? (
              <EmailView
                key={screen.id}
                id={screen.id}
                fallback={inbox.mails.find((m) => m.id === screen.id)}
                clients={allClients}
                jobs={[...sm8.jobs, ...customerJobs.filter((j) => !sm8.jobs.some((x) => x.uuid === j.uuid))]}
                onRead={(id, isRead) => setInbox((cur) => markReadHere(cur, id, isRead))}
                onCustomer={(id) => {
                  checkClients();
                  go({ name: 'customer', id });
                }}
                onJob={(id) => go({ name: 'sm8', id })}
                onEnquiry={() => go({ name: 'enquiry', mail: screen.id })}
                onDelete={async () => {
                  const err = await removeMail(screen.id);
                  if (!err) back();
                  return err;
                }}
              />
            ) : screen.name === 'diary' ? (
              <Diary
                sm8={diarySm8}
                onDone={markVisit}
                loading={sm8Loading}
                onRefresh={() => checkSm8(true)}
                onOpen={(id) => go({ name: 'sm8', id, from: 'diary' })}
                onCancel={cancelBooking}
                onRebook={book}
              />
            ) : screen.name === 'timeline' ? (
              <JobTimeline
                sm8={sm8}
                marks={marks}
                loading={sm8Loading}
                focus={screen.job}
                onRefresh={() => checkSm8(true)}
                onOpen={(id) => go({ name: 'sm8', id, from: 'timeline' })}
                onSave={saveTimeline}
                onProgress={(uuid, progress) => mark(uuid, { progress, progressAt: Date.now() })}
                onComplete={(uuid) => void changeStatus(uuid, 'Completed')}
              />
            ) : screen.name === 'whatsapp' ? (
              <WaList chats={waChats} onOpen={(id) => go({ name: 'wa-chat', id })} />
            ) : screen.name === 'wa-chat' ? (
              waChat(screen.id) ? (
                <WaChatView
                  key={screen.id}
                  chat={waChat(screen.id)!}
                  clients={allClients}
                  jobs={sm8.jobs}
                  onNewJob={() => {
                    checkClients();
                    go({ name: 'enquiry', wa: screen.id });
                  }}
                  onAdded={(j) => void sendToJob(screen.id, addSend(waChat(screen.id)!, j))}
                  onDesign={() => {
                    const c = waChat(screen.id)!;
                    const job = c.sends[c.sends.length - 1]?.job;
                    go({ name: 'new-design', wa: screen.id, from: job });
                  }}
                  onOpenJob={(id) => {
                    checkSm8();
                    go({ name: 'sm8', id, from: 'wa', chat: screen.id });
                  }}
                  onCustomer={(id) => {
                    checkClients();
                    go({ name: 'customer', id });
                  }}
                  onGone={() => go({ name: 'whatsapp' }, false)}
                />
              ) : (
                <p className="pt-16 text-center font-mono text-[14px] text-faint">{waChats.length ? 'That chat isn’t on this phone any more.' : 'Opening the chat…'}</p>
              )
            ) : screen.name === 'enquiry' ? (
              <NewEnquiry
                key={screen.client ?? screen.named ?? screen.mail ?? screen.wa ?? 'enquiry'}
                clients={allClients}
                forClient={screen.client ? customerOf(screen.client) : undefined}
                named={screen.named}
                seed={
                  screen.mail && openedMail(screen.mail)
                    ? enquiryFromMail(openedMail(screen.mail)!)
                    : screen.wa && waChat(screen.wa)
                      ? enquiryFromChat(waChat(screen.wa)!, allClients.find((c) => c.uuid === waChat(screen.wa!)!.client))
                      : undefined
                }
                seedFrom={screen.wa ? 'whatsapp' : 'email'}
                onCustomer={(id) => go({ name: 'customer', id })}
                onCancel={back}
                onCreate={async (e) => {
                  const r = await sendEnquiry(readPin(), e);
                  if (!r.ok) return problemText(r.error, r.detail);
                  lastClients.current = 0; // a new customer: the next search fetches the list again
                  setSm8((s) => {
                    const next = { ...s, jobs: [r.data.job, ...s.jobs.filter((j) => j.uuid !== r.data.job.uuid)] };
                    keepSm8(next);
                    return next;
                  });
                  const c = screen.wa ? waChat(screen.wa) : undefined;
                  if (c) {
                    // the ticked photos and PDFs follow the new job into its diary (wa-store.ts sends them)
                    const job = r.data.job;
                    await updateChat(c.id, (x) => ({ ...x, client: job.client ?? x.client, clientName: job.name }), true);
                    await sendToJob(c.id, { job: job.uuid, number: job.number, what: whatOf(job.description), mode: 'new', files: pickedOf(c).files });
                    go({ name: 'sm8', id: job.uuid, from: 'wa', chat: c.id }, false);
                    return '';
                  }
                  go({ name: 'sm8', id: r.data.job.uuid }, false);
                  return '';
                }}
              />
            ) : screen.name === 'sm8' ? (
              cur ? (
                <CurrentView
                  key={cur.uuid}
                  job={cur}
                  marks={marks}
                  kit={jobs}
                  designs={designs}
                  done={done}
                  onStatus={(s) => changeStatus(cur.uuid, s)}
                  onMark={(patch) => {
                    mark(cur.uuid, patch);
                    if (patch.hidden) back();
                  }}
                  onDesign={() => go({ name: 'new-design', from: cur.uuid })}
                  onLibrary={() => {
                    checkDesigns();
                    go({ name: 'library', for: cur.uuid });
                  }}
                  onKit={() => go({ name: 'new', from: cur.uuid })}
                  onTimeline={() => {
                    checkSm8();
                    go({ name: 'timeline', job: cur.uuid });
                  }}
                  extra={<WaJobBox chats={waChats} job={cur.uuid} onOpen={(id) => go({ name: 'wa-chat', id })} />}
                  onOpenKit={(k) => go(k.kind === 'design' ? { name: 'design', id: k.id } : { name: 'job', id: k.id, tab: 'before' })}
                  bookings={(diarySm8.bookings ?? []).filter((b) => b.jobUuid === cur.uuid)}
                  staff={sm8.staff ?? []}
                  bookingsLoaded={sm8.bookings !== null}
                  onBook={(start, end, staff) => book(cur.uuid, start, end, staff)}
                  onMove={moveBooking}
                  onCancel={cancelBooking}
                  replyAt={sm8.replies?.[cur.uuid] ?? undefined}
                  info={(() => {
                    // Their latest email to info@ (or Raf's latest to them): reply from info@ in the Inbox.
                    const m = cur.email ? lastWith(inbox, cur.email) : undefined;
                    if (!m) return undefined;
                    const name = cur.first || (m.mine ? '' : firstOf(m.from)) || cur.name;
                    return {
                      line: m.mine ? `You emailed ${name} ${whenSaid(m.at)}, info@ copied in` : `${name} emailed info@ ${whenSaid(m.at)}`,
                      subject: m.subject,
                      open: () => go({ name: 'email', id: m.id, from: 'job', job: cur.uuid }),
                    };
                  })()}
                  onCustomer={
                    cur.client && !(screen.from === 'customer' && screen.client === cur.client)
                      ? () => {
                          checkClients();
                          go({ name: 'customer', id: cur.client! });
                        }
                      : undefined
                  }
                />
              ) : (
                <p className="pt-16 text-center font-mono text-[14px] text-faint">Getting the job from ServiceM8…</p>
              )
            ) : screen.name === 'customer' ? (
              <CustomerView
                key={screen.id}
                uuid={screen.id}
                fallback={customerOf(screen.id)}
                onLoaded={customerLoaded}
                onOpenJob={(j) => go({ name: 'sm8', id: j.uuid, from: 'customer', client: screen.id })}
                onNew={(c) => go({ name: 'enquiry', client: c.uuid })}
              />
            ) : screen.name === 'posts' ? (
              <PostsList packs={posts} onOpen={(slug) => go({ name: 'post', slug })} />
            ) : screen.name === 'post' ? (
              posts.find((p) => p.slug === screen.slug) ? <PostView pack={posts.find((p) => p.slug === screen.slug)!} /> : <PostsList packs={posts} onOpen={(slug) => go({ name: 'post', slug })} />
            ) : screen.name === 'stats' ? (
              <StatsView onPage={(path) => go({ name: 'stats-page', path })} />
            ) : screen.name === 'stats-page' ? (
              <StatsPageView key={screen.path} path={screen.path} />
            ) : screen.name === 'settings' ? (
              <Settings
                pin={pin}
                status={status}
                tint={tint}
                onTint={setTint}
                onPin={(p) => {
                  savePin(p);
                  setPinState(p);
                }}
              />
            ) : screen.name === 'kit' ? (
              <div className="pt-7">
                <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
                  <Icon name="kit" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
                  Job Kit jobs
                </h1>
                <KitJobs
                  jobs={jobs.filter((j) => j.kind !== 'design')}
                  items={items}
                  done={done}
                  onClear={removeJobs}
                  onNew={() => go({ name: 'new' })}
                  onOpen={(id: string) => go({ name: 'job', id, tab: 'before' })}
                />
              </div>
            ) : job ? (
              <JobView
                job={job}
                fromDesign={(() => {
                  const dj = designFor(job, jobs);
                  return dj ? { what: dj.what, onOpen: () => go({ name: 'design', id: dj.id }) } : undefined;
                })()}
                done={done[job.id]}
                onPost={done[job.id] && posts.some((p) => p.slug === done[job.id].slug) ? () => go({ name: 'post', slug: done[job.id].slug }) : undefined}
                items={items.filter((i) => i.jobId === job.id)}
                tab={screen.tab}
                busy={busy}
                onTab={(tab) => {
                  const s: Screen = { name: 'job', id: job.id, tab };
                  setScreenState(s);
                  keepScreen(s);
                  history.replaceState({ ...history.state, jk: s }, '');
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
                onForget={() => forget(job.id)}
              />
            ) : null;
  };

  const sec = secOfScreen(screen.name);
  // A computer (desktop.tsx): the sidebar, the list beside what's opened from it, and more width.
  const list = wide ? listFor(screen) : null;
  const listOnly = wide && LIST_SCREENS.includes(screen.name);
  const left = list ?? (listOnly ? screen : null);
  const picked = 'id' in screen ? screen.id : 'slug' in screen ? screen.slug : '';
  const roomy = wide && ROOMY.includes(screen.name);
  const sideGo = (id: SideId) => {
    if (id === 'current' || id === 'diary' || id === 'timeline') checkSm8();
    if (id === 'inbox') checkInbox();
    if (id === 'designs' || id === 'library') checkDesigns();
    go(id === 'kit' ? { name: 'kit' } : id === 'stats' ? { name: 'stats' } : ({ name: id } as Screen));
  };
  const sideCounts: Partial<Record<SideId, number>> = wide
    ? {
        home:
          (inboxTodayLine(inbox, customers) ? 1 : 0) +
          waTodayLines(waChats).length +
          todayLines({ sm8: diarySm8, marks, kit: jobs, designs, done, postsLeft: posts.length - postedEverywhere(posts) }).length,
        inbox: freshUnread(inbox).length,
        whatsapp: waChats.filter((c) => !c.sends.length).length,
      }
    : {};
  return (
    <div
      className={`jk min-h-[100dvh] bg-paper text-ink ${secClass(sec)}${tint ? ' jk-tint' : ''}${wide ? ` jk-desk${left ? ' jk-split' : ''}${roomy ? ' jk-roomy' : ''}` : ''}`}
    >
      {wide ? <Sidebar active={sideOf(screen.name, 'from' in screen ? screen.from : undefined)} counts={sideCounts} onGo={sideGo} /> : null}
      {wide && left ? (
        <section className="jk-listpane" aria-label="List">
          {ready ? renderScreen(left) : null}
          {/* the one open beside it, picked out in the list */}
          {picked ? <style>{`.jk-listpane [data-jk-id=${JSON.stringify(picked)}]{box-shadow:inset 4px 0 0 var(--sec-mark,var(--sec));background-color:color-mix(in srgb,var(--sec) 12%,var(--color-mount))!important;border-color:var(--sec)!important}`}</style> : null}
        </section>
      ) : null}
      <div className="jk-main">
      <TopBar
        sec={sec}
        onKey={colourKey.show}
        status={status}
        waiting={waiting.length}
        waitingBytes={waitingBytes}
        onHome={screen.name === 'home' ? undefined : back}
        backLabel={backLabel(screen)}
        onStatus={() => go({ name: 'settings' })}
        wide={wide}
      />
      {problem ? (
        <div className="jk-wrap px-4 pt-3">
          <p role="alert" className="flex items-start justify-between gap-3 rounded-sm border border-line-strong bg-mount px-3 py-2.5 text-[14.5px]">
            <span>{problem}</span>
            <button type="button" className="font-mono text-[13px] text-accent" onClick={() => setProblem('')}>
              OK
            </button>
          </p>
        </div>
      ) : null}
      <main className="jk-wrap px-4 pb-[calc(env(safe-area-inset-bottom)+48px)]">
        {!ready ? (
          <p className="pt-16 text-center font-mono text-[14px] text-faint">Opening…</p>
        ) : listOnly ? (
          <PickNote name={screen.name} />
        ) : (
          renderScreen(screen)
        )}
      </main>
      </div>
      {binned ? (
        <div role="status" className="jk-fixbar fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[588px] items-center gap-3 rounded-sm bg-ink px-4 py-2.5 text-[14.5px] leading-snug text-mount shadow-[0_14px_30px_-12px_rgb(22_25_28/0.6)]">
            <span className="min-w-0 flex-1">
              {binned.problem || (
                <>
                  Deleted <b className="font-semibold">{binned.what}</b>. It’s in Deleted Items in Outlook.
                </>
              )}
            </span>
            <button type="button" onClick={undoBin} disabled={binned.busy} className="h-10 shrink-0 font-semibold underline">
              {binned.busy ? 'Putting it back…' : 'Undo'}
            </button>
            <button type="button" onClick={() => setBinned(null)} aria-label="Close" className="h-10 w-8 shrink-0 text-[20px] leading-none opacity-70">
              ×
            </button>
          </div>
        </div>
      ) : null}
      {colourKey.open ? <ColourKey onClose={colourKey.hide} tint={tint} onTint={setTint} /> : null}
    </div>
  );
}

const QUIET_START = 2000;
const noSubscribe = () => () => {};

/* ---------- top bar ---------- */

function TopBar({
  sec,
  onKey,
  status,
  waiting,
  waitingBytes,
  onHome,
  backLabel,
  onStatus,
  wide,
}: {
  sec?: SecId;
  wide?: boolean; // a computer: the sidebar has the name, so Today's top bar leaves it out
  onKey: () => void;
  status: Status;
  waiting: number;
  waitingBytes: number;
  onHome?: () => void;
  backLabel: string;
  onStatus: () => void;
}) {
  const s = status.state;
  const text = s === 'sending' ? `Sending, ${waiting} left` : s === 'idle' && waiting ? `${waiting} waiting` : STATE_TEXT[s];
  const good = s === 'idle' && !waiting;
  const stuck = s === 'wrong-pin' || s === 'no-pin' || s === 'not-set-up' || s === 'inbox-key' || s === 'inbox-missing';
  return (
    <header className="jk-top sticky top-0 z-30 border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
      <div className="jk-wrap flex h-14 items-center justify-between gap-3 px-4">
        {onHome ? (
          <button type="button" onClick={onHome} className={`-ml-2 flex h-11 min-w-0 items-center gap-1.5 px-2 text-[15px] font-semibold ${sec ? 'jk-sec-ink' : ''}`} aria-label={`Back to ${backLabel.toLowerCase()}`}>
            <span aria-hidden className="text-[18px] leading-none">‹</span> {backLabel}
          </button>
        ) : wide ? (
          <span />
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
        <span className="flex min-w-0 items-center gap-2">
        <KeyDots onClick={onKey} />
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
        </span>
      </div>
      {/* the screen's section colour (sections.tsx) */}
      {sec ? <div className="jk-secline" aria-hidden /> : null}
    </header>
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
  posts,
  onPosts,
  onClear,
  sm8,
  marks,
  inbox,
  customers,
  onInbox,
  find,
  onCurrent,
  onDiary,
  onTimeline,
  waChats,
  onWhatsApp,
  onToday,
  designJobs,
  designs,
  onDesigns,
  libraryCount,
  libraryLine,
  onLibrary,
  pin,
  status,
  waitingBytes,
  onNew,
  onOpen,
  onSettings,
  onStats,
}: {
  jobs: Job[];
  items: Item[];
  done: Done;
  posts: Pack[];
  onPosts: () => void;
  onClear: (ids: string[]) => Promise<void>;
  sm8: Sm8;
  marks: Marks;
  inbox: Inbox;
  customers: Set<string>;
  onInbox: () => void;
  find: React.ReactNode; // Find a customer (customers.tsx)
  onCurrent: () => void;
  onDiary: () => void;
  onTimeline: () => void;
  waChats: WaChat[];
  onWhatsApp: () => void;
  onToday: (l: TodayLine) => void;
  designJobs: Job[];
  designs: DesignsReady;
  onDesigns: () => void;
  libraryCount: number;
  libraryLine: string;
  onLibrary: () => void;
  pin: string;
  status: Status;
  waitingBytes: number;
  onNew: () => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
  onStats: () => void;
}) {
  const { standalone, ios } = useStandalone();
  const wide = useWide(); // a computer: no home-screen advice, and the boxes in columns
  // the last Website stats kept on this phone (stats.tsx), read straight from storage
  const webLine = useSyncExternalStore(noSubscribe, statsLine, () => 'Visitors, pages and heatmaps of rafcarpentry.com');
  const mailLine = inboxTodayLine(inbox, customers);
  const waLines: TodayLine[] = waTodayLines(waChats).map((l) => ({ text: l.text, go: 'whatsapp', id: l.id, urgent: l.urgent }));
  const lines = [...(mailLine ? [mailLine] : []), ...waLines, ...todayLines({ sm8, marks, kit: [...jobs, ...designJobs], designs, done, postsLeft: posts.length - postedEverywhere(posts) })];
  const goingAhead = sm8.jobs.filter((j) => j.status === 'Work Order').length;
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
      <p className="kicker">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 className="mt-1 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">Today</h1>

      {!standalone && !wide ? (
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

      <div className="jk-home-bands">
      <HomeBand tone="accent" label="To do" right={lines.length ? `${lines.length} thing${lines.length === 1 ? '' : 's'}` : 'All clear'}>
        <div className="px-4 py-1">
          {lines.length ? (
            <ul className="jk-todo divide-y divide-line">
              {lines.map((l) => (
                <li key={l.text} className={secClass(secOfLine(l.go))}>
                  <button type="button" onClick={() => onToday(l)} className="flex min-h-11 w-full items-center gap-2.5 py-2 text-left text-[16px]">
                    {l.time ? (
                      <span className="w-[46px] shrink-0 font-mono text-[14px] font-semibold jk-sec-ink">{l.time}</span>
                    ) : (
                      <Icon name={l.icon ?? LINE_ICON[l.go]} className="h-[22px] w-[22px] shrink-0 jk-sec-ink" />
                    )}
                    <span className={`flex-1 ${l.urgent ? 'font-semibold' : ''}`}>{l.text}</span>
                    <span aria-hidden className="jk-sec-ink">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex min-h-11 items-center gap-2 text-[16px]">
              <Mark state="sent" /> All clear: nothing waiting.
            </p>
          )}
          {sm8.error && sm8.error !== 'offline' && sm8.error !== 'sm8-down' ? (
            <button type="button" onClick={onCurrent} className="mt-1 block py-1.5 text-left font-mono text-[12.5px] text-faint underline">
              ServiceM8 needs a look
            </button>
          ) : null}
        </div>
      </HomeBand>

      <HomeBand sec="customers" icon="person" label="Customers" right="ServiceM8">
        <div className="px-4 pb-1">
          {find}
          <HomeRow onClick={onDiary} title="Diary" line={diaryLine(sm8)} />
          <HomeRow onClick={onCurrent} title="Current jobs" line={currentLine(sm8, marks)} />
          <HomeRow onClick={onInbox} title="Inbox" line={inboxLine(inbox)} truncate last />
        </div>
      </HomeBand>

      <HomeBand sec="whatsapp" icon="chat" label="WhatsApp" right={waChats.length ? `${waChats.length} chat${waChats.length === 1 ? '' : 's'}` : undefined}>
        <div className="px-4">
          <HomeRow onClick={onWhatsApp} title="WhatsApp chats" line={waHomeLine(waChats)} truncate last />
        </div>
      </HomeBand>

      <HomeBand sec="timeline" icon="gantt" label="Job timeline" right={goingAhead ? `${goingAhead} going ahead` : undefined}>
        <TimelineMini sm8={sm8} marks={marks} onOpen={onTimeline} />
      </HomeBand>

      <HomeBand sec="designs" icon="designs" label="Designs in 3D" right={libraryCount ? `${libraryCount} in the library` : undefined}>
        <div className="px-4">
          <HomeRow onClick={onDesigns} title="Designs for customers" line={designLine(designJobs, designs)} last={!libraryCount} />
          {libraryCount ? <HomeRow onClick={onLibrary} title="Design library" line={libraryLine} last /> : null}
        </div>
      </HomeBand>

      <HomeBand sec="website" icon="stats" label="Website" right="rafcarpentry.com">
        <div className="px-4">
          <HomeRow onClick={onStats} title="Website stats" line={webLine} last />
        </div>
      </HomeBand>

      <HomeBand sec="photos" id="kit-jobs" icon="kit" label="Photos and posts">
        <div className="px-4 pb-4">
          {posts.length ? <HomeRow onClick={onPosts} title="Posts for Instagram, TikTok and YouTube" line={postsLine(posts)} /> : null}
          <KitJobs heading jobs={jobs} items={items} done={done} onClear={onClear} onNew={onNew} onOpen={onOpen} />
        </div>
      </HomeBand>
      </div>

      <p className="mt-8 border-t border-line pt-4 font-mono text-[12.5px] leading-relaxed text-faint">
        On this {wide ? 'computer' : 'phone'}: {waitingBytes ? `${mb(waitingBytes)} waiting to send` : 'nothing waiting, all sent'}.
        {status.state === 'offline' ? ' It sends when the signal is back and the app is open.' : ''}
      </p>
    </div>
  );
}

/* The Job Kit jobs: New job, the list, and Clear finished. On Today's Photos and posts box on the phone, and a screen of
   its own on a computer ('kit', beside the job opened from it). */
function KitJobs({ jobs, items, done, onClear, onNew, onOpen, heading }: { jobs: Job[]; items: Item[]; done: Done; onClear: (ids: string[]) => Promise<void>; onNew: () => void; onOpen: (id: string) => void; heading?: boolean }) {
  // Finished: on the website, and nothing of it left to send.
  const finished = jobs.filter((j) => done[j.id] && !items.some((i) => i.jobId === j.id && !i.sent && !i.lost));
  const [sure, setSure] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clear = () => {
    if (disarm.current) clearTimeout(disarm.current);
    if (!sure) {
      setSure(true);
      disarm.current = setTimeout(() => setSure(false), 5000);
      return;
    }
    setSure(false);
    void onClear(finished.map((j) => j.id));
  };
  return (
    <>
      {heading ? <p className="mt-4 font-semibold">Job Kit jobs</p> : null}
      <p className={`${heading ? 'mt-1.5' : 'mt-2'} text-[15px] leading-relaxed text-muted`}>Photos, clips and sizes for each job, sent to your inbox as you go. Everything saves by itself.</p>
      <button type="button" onClick={onNew} className="btn btn-primary mt-4 w-full">
        New job
      </button>
      {jobs.length ? (
        <ul className="mt-5 grid gap-3">
          {jobs.map((j) => {
            const mine = items.filter((i) => i.jobId === j.id && !i.lost);
            const photos = mine.filter((i) => i.kind === 'photo').length;
            const clips = mine.filter((i) => i.kind === 'video').length;
            const left = mine.filter((i) => !i.sent).length;
            const sizes = j.notes.sizes.filter((s) => s.w || s.h || s.d).length;
            const cover = mine.find((i) => i.slot === 'main-upright') ?? [...mine].reverse().find((i) => i.thumb);
            return (
              <li key={j.id}>
                <button type="button" data-jk-id={j.id} onClick={() => onOpen(j.id)} className="flex w-full items-stretch gap-3 rounded-sm border border-line-strong bg-mount p-2.5 text-left transition-colors hover:border-ink">
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
        <p className="mt-5 font-mono text-[13.5px] text-faint">No jobs yet. Start one on the first visit, before anything moves.</p>
      )}

      {finished.length ? (
        <div className="mt-4 rounded-sm border border-line-strong bg-mount px-4 py-3.5">
          <p className="text-[14.5px] leading-relaxed text-muted">
            {finished.length === 1 ? '1 job is' : `${finished.length} jobs are`} finished and on your website. Clearing takes {finished.length === 1 ? 'it' : 'them'} off this phone only: the inbox and the website keep everything.
          </p>
          <button type="button" onClick={clear} className={`btn btn-sm mt-3 ${sure ? 'btn-primary' : 'btn-ghost'}`}>
            {sure ? `Tap again to clear ${finished.length === 1 ? 'it' : `all ${finished.length}`}` : `Clear finished (${finished.length})`}
          </button>
        </div>
      ) : null}
    </>
  );
}

function HomeBand({ label, right, icon, tone, sec, id, children }: { label: string; right?: string; icon?: IconName; tone?: 'accent'; sec?: SecId; id?: string; children: React.ReactNode }) {
  const accent = tone === 'accent';
  return (
    <section id={id} className={`mt-5 scroll-mt-20 rounded-sm border bg-mount ${accent ? 'border-accent' : 'border-line-strong'} ${sec ? `jk-band ${secClass(sec)}` : ''}`}>
      <div className={`flex h-11 items-center gap-2.5 px-4 ${accent ? 'bg-accent text-on-accent' : sec ? 'jk-band-head' : 'border-b border-line-strong bg-raised'}`}>
        {icon ? <Icon name={icon} className="h-5 w-5 shrink-0 jk-sec-ink" /> : null}
        <h2 className={`flex-1 font-mono text-[13px] font-semibold uppercase tracking-[0.08em] ${sec ? 'jk-sec-ink' : ''}`}>{label}</h2>
        {right ? <span className={`truncate font-mono text-[12.5px] ${accent ? '' : 'text-muted'}`}>{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

function HomeRow({ onClick, title, line, truncate, last }: { onClick: () => void; title: string; line: string; truncate?: boolean; last?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left ${last ? '' : 'border-b border-line'}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className={`mt-0.5 block text-[14.5px] text-muted ${truncate ? 'truncate' : ''}`}>{line}</span>
      </span>
      <span aria-hidden className="text-[20px] jk-sec-ink">→</span>
    </button>
  );
}

function currentLine(sm8: Sm8, marks: Marks) {
  if (!sm8.at) return sm8.error === 'sm8-not-set-up' ? 'ServiceM8 not connected yet' : 'Your ServiceM8 jobs: enquiries, quotes, going ahead';
  const list = shown(sm8, marks);
  const quotes = list.filter((j) => j.status === 'Quote');
  const going = list.filter((j) => j.status === 'Work Order').length;
  const follow = quotes.filter((j) => stage(j, marks) === 'follow').length;
  if (!quotes.length && !going) return 'Nothing open in ServiceM8';
  return [quotes.length ? `${quotes.length} enquir${quotes.length === 1 ? 'y' : 'ies'} and quotes` : '', follow ? `${follow} to follow up` : '', going ? `${going} on Work Order` : ''].filter(Boolean).join(' · ');
}

/* Each line on the Today list shows the icon of the section it opens. */
const LINE_ICON: Record<TodayLine['go'], IconName> = { current: 'jobs', designs: 'designs', posts: 'posts', jobs: 'kit', diary: 'diary', sm8: 'diary', inbox: 'mail', timeline: 'gantt', whatsapp: 'chat' };

function diaryLine(sm8: Sm8) {
  if (!sm8.at || sm8.bookings === undefined) return 'Visits and work booked in ServiceM8';
  if (sm8.bookings === null) return 'ServiceM8 didn’t send the schedule this time';
  const today = localDay();
  const week = Array.from({ length: 7 }, (_, i) => localDay(new Date(Date.now() + i * 864e5)));
  const now = bookingsOn(sm8.bookings, today).length;
  const soon = new Set(week.flatMap((k) => bookingsOn(sm8.bookings!, k).map((b) => b.uuid))).size;
  const next = sm8.bookings.find((b) => b.start.slice(0, 10) > today);
  if (!soon) return next ? `Nothing this week; next ${dayLabel(next.start.slice(0, 10))}, ${hm(next.start)}` : 'Nothing booked';
  return [`${now || 'Nothing'} today`, `${soon} in the next 7 days`].join(' · ');
}

function postsLine(posts: Pack[]) {
  const all = postedEverywhere(posts);
  const left = posts.length - all;
  if (!left) return 'All posted';
  return `${left} to post${all ? `, ${all} posted everywhere` : ''}`;
}

function designLine(list: Job[], ready: DesignsReady) {
  if (!list.length) return 'A 3D design they can turn round on their phone, before you quote';
  const states = list.map((j) => designState(j, ready[j.id]));
  const done = states.filter((s) => s === 'ready' || s === 'updating').length; // an update keeps the link working
  const coming = states.filter((s) => s === 'waiting' || s === 'sending').length;
  const parts = [done ? `${done} ready` : '', coming ? `${coming} on the way` : '', list.length - done - coming ? `${list.length - done - coming} not sent yet` : ''].filter(Boolean);
  return parts.join(' · ');
}

/* ---------- new job ---------- */

function NewJob({ onCancel, onCreate, initial }: { onCancel: () => void; onCreate: (j: Job) => void | Promise<void>; initial?: { what: string; area: string; sm8?: string; design?: string } }) {
  const [what, setWhat] = useState(initial?.what ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
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
          sm8: initial?.sm8,
          createdAt: now,
          updatedAt: now,
          seq: 0,
        });
      }}
    >
      <h1 className="font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">New job</h1>
      {initial?.design ? (
        <p className="mt-3 rounded-sm border border-line-strong bg-mount px-3.5 py-2.5 text-[14.5px] leading-relaxed text-muted">
          Built from the 3D design <span className="font-semibold text-ink">{initial.design}</span>: the job page will use it, and it comes off Designs in 3D once the job is on My Work.
        </p>
      ) : null}
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

/* ---------- one job ---------- */

const TABS: { id: Tab; title: string }[] = [...SECTIONS.map((s) => ({ id: s.id as Tab, title: s.title })), { id: 'notes', title: 'Notes' }, { id: 'send', title: 'Send' }];

function JobView({
  job,
  fromDesign,
  done,
  onPost,
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
  fromDesign?: { what: string; onOpen: () => void }; // the 3D design it was built from
  done?: { slug: string; title: string };
  onPost?: () => void;
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
        {fromDesign ? (
          <button type="button" onClick={fromDesign.onOpen} className="mt-2 flex w-full items-center gap-2 rounded-sm border border-line-strong bg-mount px-3 py-2 text-left text-[14.5px]">
            <Icon name="designs" className="h-[20px] w-[20px] shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              Built from the 3D design <span className="font-semibold">{fromDesign.what}</span>
            </span>
            <span aria-hidden className="text-accent">
              →
            </span>
          </button>
        ) : null}
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
          <SendPanel job={job} done={done} onPost={onPost} items={items} onSend={onSend} onForget={onForget} onJob={onJob} />
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

      <TalkBox
        value={n.talk ?? ''}
        onChange={(talk) => save({ ...n, talk })}
        hint="Easiest on site: say it instead of typing it. Sizes, materials, hardware, what was tricky, what the client wanted. Messy is fine, Claude sorts it into the right places."
      />

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

/* ---------- send ---------- */

function SendPanel({
  job,
  done,
  onPost,
  items,
  onSend,
  onForget,
  onJob,
}: {
  job: Job;
  done?: { slug: string; title: string };
  onPost?: () => void;
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
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/portfolio/${done.slug}`} className="btn btn-primary btn-sm">
              See the job page
            </a>
            {onPost ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onPost}>
                Post it
              </button>
            ) : null}
          </div>
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

function Settings({ pin, status, onPin, tint, onTint }: { pin: string; status: Status; onPin: (p: string) => void; tint: boolean; onTint: (on: boolean) => void }) {
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
      <h2 className="mt-9 font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">Colours</h2>
      <div className="mt-2">
        <TintSwitch on={tint} onChange={onTint} />
      </div>
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

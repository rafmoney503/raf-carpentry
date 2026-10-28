'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import SocialIcon from '@/components/SocialIcon';
import { EMAIL, whatsappUrl } from '@/lib/site';
import AddressFinder, { type Address } from './address-finder';
import { clearJobFromLink, jobUrl, useJobFromLink, type JobRef } from './job-from-link';
import { kindsIn, kindWords, type KindCount } from '@/lib/design-kinds';
import { removeSaved, savedUrl, useSaved } from '@/lib/saved';
import { Heart } from '@/components/SaveButton';
import WhatHappensNext, { type Direct } from './what-happens-next';
import { shrinkPhoto } from '@/app/job-kit/media';
import { closestDesigns, type MatchItem } from '@/lib/design-match';
import { paxLines } from '@/lib/pax-brief';
import { readCode } from '@/lib/pax-design';
import { mtoLines, usesFor, type InsideKey } from '@/lib/wardrobe-brief';
import { WardrobeCard, WardrobeWindow, wardrobeNow, withPlan, type Build, type WardrobeBrief } from './wardrobe-window';
import { whatIcon } from './what-icons';

export type BriefOptions = {
  what: string[];
  room: string[];
  uses: string[];
  material: string[];
  finish: string[];
  timing: string[];
  budget: string[];
  parking: string[];
  photoTips: string[];
};

/* A customer ticks what fits; the answers become a ready-written WhatsApp message or email to Raf. */

function Chips({ options, value, onPick, multi = false, label, icon }: { options: string[]; value: string | string[]; onPick: (v: string) => void; multi?: boolean; label: string; icon?: (o: string) => React.ReactNode }) {
  return (
    <div className={icon ? 'mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]' : 'mt-3 flex flex-wrap gap-2'} role="group" aria-label={label}>
      {options.map((o) => {
        const on = multi ? (value as string[]).includes(o) : value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o)}
            className={`min-h-10 rounded-sm border border-line-strong bg-mount py-2 text-left text-[14.5px] font-medium leading-snug text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent ${icon ? 'flex min-w-0 items-center gap-2.5 px-2.5' : 'px-3.5'}`}
          >
            {icon ? <span className="flex-none" aria-hidden="true">{icon(o)}</span> : null}
            {icon ? <span className="min-w-0">{o}</span> : o}
          </button>
        );
      })}
    </div>
  );
}

const input =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

/* The brief runs in three steps, one question to a screen (28 Oct 2026, Raf: people didn't know what to do,
   and 'make sure that people read all information through so they can give me most information I need').
   Sizes, a photo and the postcode can't be skipped (each says why), nor the name, mobile and email; the rest
   are optional. The message, the planners and every way of sending are as before; the send buttons only come
   on the last screen, after the answers have been checked. */
const PARTS = ['Your project', 'Your space', 'You'] as const;
type ScreenKey = 'what' | 'room' | 'size' | 'material' | 'photos' | 'where' | 'when' | 'details' | 'send';
const SCREENS: { key: ScreenKey; part: 0 | 1 | 2; label: string }[] = [
  { key: 'what', part: 0, label: 'What' },
  { key: 'room', part: 0, label: 'Room and use' },
  { key: 'size', part: 0, label: 'Size' },
  { key: 'material', part: 0, label: 'Material and finish' },
  { key: 'photos', part: 1, label: 'Photos' },
  { key: 'where', part: 1, label: 'Address' },
  { key: 'when', part: 2, label: 'When and budget' },
  { key: 'details', part: 2, label: 'Your details' },
  { key: 'send', part: 2, label: 'Check and send' },
];
const LAST = SCREENS.length - 1;
type Need = '' | 'what' | 'size' | 'photos' | 'where' | 'name' | 'mobile' | 'email';

/* Step 1 of 3 and a bar in three parts, each filling as its questions are answered. */
function Progress({ at }: { at: number }) {
  const part = SCREENS[at].part;
  return (
    <div data-brief-progress>
      <p className="font-mono text-[13px] text-accent" data-step-label>
        Step {part + 1} of 3 · {PARTS[part]}
      </p>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5" role="progressbar" aria-label="Your brief" aria-valuemin={1} aria-valuemax={3} aria-valuenow={part + 1} aria-valuetext={`Step ${part + 1} of 3, ${PARTS[part]}`}>
        {PARTS.map((p, i) => {
          const mine = SCREENS.flatMap((s, j) => (s.part === i ? [j] : []));
          const done = i < part ? 1 : i > part ? 0 : (mine.indexOf(at) + 1) / mine.length;
          return (
            <div key={p} className="min-w-0">
              <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${done * 100}%` }} />
              </div>
              <p className={`mt-1.5 truncate font-mono text-[11.5px] ${i === part ? 'text-ink' : 'text-faint'}`}>
                {i + 1} {p}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* One question: the heading (focused when its screen opens), whether it's needed and why, or what's missing. */
function Ask({ id, title, tag, why, err, children }: { id: ScreenKey; title: string; tag?: string; why?: string; err?: string; children?: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={`brief-${id}-q`} data-screen={id}>
      <h3 id={`brief-${id}-q`} tabIndex={-1} className="font-display text-[25px] font-[650] leading-[1.15] tracking-[-0.02em] outline-none md:text-[30px]">
        {title}
      </h3>
      {why ? (
        <p className={`mt-2.5 flex items-start gap-2.5 text-[14.5px] leading-snug ${err ? 'font-medium text-accent' : 'text-muted'}`} data-why={id} data-need={err ? id : undefined} aria-live="polite">
          <span className="mt-px flex-none rounded-[2px] border border-accent/50 px-1.5 py-px font-mono text-[11px] uppercase tracking-[0.06em] text-accent">Needed</span>
          <span>{err || why}</span>
        </p>
      ) : tag ? (
        <p className="mt-2 font-mono text-[12.5px] text-faint">{tag}</p>
      ) : null}
      {children}
    </div>
  );
}

type Sent = 'whatsapp' | 'email' | 'copy' | 'direct';
type Photo = { id: string; blob: Blob; thumb: string };
const MAX_PHOTOS = 10;

/* How long the page has been open (bots send in under a few seconds). */
const msSince = (t: number) => Date.now() - t;

/* POST that retries once after a short wait when the line drops or the server is busy. */
async function post(url: string, body: BodyInit, json = true): Promise<Response> {
  const go = () => fetch(url, { method: 'POST', body, ...(json ? { headers: { 'Content-Type': 'application/json' } } : {}) });
  try {
    const r = await go();
    if (r.status !== 429 && r.status < 500) return r;
  } catch {
    /* try again below */
  }
  await new Promise((res) => setTimeout(res, 1500));
  return go();
}

export default function BriefBuilder({
  options,
  jobs,
  designKinds = [],
  designTotal = 0,
  designs = [],
}: {
  options: BriefOptions;
  jobs: JobRef[];
  designKinds?: KindCount[];
  designTotal?: number;
  designs?: MatchItem[];
}) {
  // Came from "Get a quote" on a job page: that job goes at the top of the message.
  const job = useJobFromLink(jobs);
  // Jobs and 3D designs saved with the hearts (src/lib/saved.ts). The job from the link is already named, so it isn't listed twice.
  const saved = useSaved();
  const liked = useMemo(() => saved.filter((s) => !(job && s.href === `/portfolio/${job.slug}`)), [saved, job]);
  const [what, setWhat] = useState<string[]>([]);
  const [room, setRoom] = useState<string[]>([]);
  const [uses, setUses] = useState<string[]>([]);
  const [material, setMaterial] = useState<string[]>([]);
  const [finish, setFinish] = useState<string[]>([]);
  const [size, setSize] = useState({ w: '', h: '', d: '' });
  // Fitted wardrobe: how it's built (made to measure, IKEA PAX, not sure) and the plan (wardrobe-window.tsx).
  const [wb, setWb] = useState<WardrobeBrief>({ build: null, pax: null, mto: null });
  const [wbOpen, setWbOpen] = useState(false);
  // With IKEA PAX: the design code from IKEA's own planner, if they designed it there.
  const [ikeaCode, setIkeaCode] = useState('');
  const wbAsked = useRef(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [need, setNeed] = useState<Need>('');
  // Which screen of the brief is showing, and whether they've reached Check and send (then Next goes back there).
  const [at, setAt] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const moved = useRef(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  // Photos for "Send to Raf": made smaller on the phone (no GPS or other hidden data), kept only in this page.
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [adding, setAdding] = useState(0);
  const [photoNote, setPhotoNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // Sending straight to ServiceM8
  const [sending, setSending] = useState<null | { step: 'brief' } | { step: 'photos'; done: number; of: number }>(null);
  const [sendError, setSendError] = useState('');
  const [direct, setDirect] = useState<Direct | null>(null);
  const openedAt = useRef(0);
  const trap = useRef<HTMLInputElement>(null); // a box people never see; bots fill it in
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  const [addr, setAddr] = useState<Address>({ line1: '', area: '', postcode: '' });
  const [parking, setParking] = useState<string[]>([]);
  const [access, setAccess] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [timing, setTiming] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  // After Send on WhatsApp, Email it or Copy text: the "What happens next" card takes the message's place.
  const [sent, setSent] = useState<Sent | null>(null);
  const [showMsg, setShowMsg] = useState(false);
  const nextRef = useRef<HTMLDivElement>(null);
  const markSent = (how: Sent) => {
    setSent(how);
    setShowMsg(false);
    // On a phone the card sits above the buttons: bring it into view for when they come back from WhatsApp or email.
    window.setTimeout(() => nextRef.current?.scrollIntoView({ behavior: how === 'copy' || how === 'direct' ? 'smooth' : 'auto', block: 'start' }), 60);
  };

  // A search result like "Start a brief: hiding a boiler, radiator or cylinder" opens /how-it-works?for=...#brief
  // with that choice ticked (?what=, ?room= and ?for= work, only for choices that exist; each can come more than
  // once), and ?when= picks the timing the same way.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pick = (key: string, list: string[], set: React.Dispatch<React.SetStateAction<string[]>>) => {
      const vs = q.getAll(key).filter((v) => list.includes(v));
      if (vs.length) set((cur) => [...cur, ...vs.filter((v, i) => !cur.includes(v) && vs.indexOf(v) === i)]);
    };
    pick('what', options.what, setWhat);
    pick('room', options.room, setRoom);
    pick('for', options.uses, setUses);
    const pickOne = (key: string, list: string[], set: (v: string) => void) => {
      const v = q.get(key);
      if (v && list.includes(v)) set(v);
    };
    pickOne('when', options.timing, setTiming);
  }, [options]);

  const one = (set: (v: string) => void, cur: string) => (v: string) => set(cur === v ? '' : v);
  // Several answers can be ticked (two rooms, a bookcase and panelling...): tap again to untick.
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));
  const hasSize = Boolean(size.w || size.h || size.d);
  const wardrobeLabel = options.what.find((w) => /wardrobe/i.test(w)) ?? '';
  const wardrobeOn = Boolean(wardrobeLabel && what.includes(wardrobeLabel));
  const openPlanner = () => {
    const b: 'mto' | 'pax' = wb.build === 'pax' ? 'pax' : 'mto';
    setWb((w) => withPlan({ ...w, build: b }, b, size));
    setWbOpen(true);
  };
  // Picking Made to measure or IKEA PAX the first time opens the planner; Not sure yet doesn't.
  const pickBuild = (b: Build) => {
    setWb((w) => (b === 'unsure' ? { ...w, build: b } : withPlan({ ...w, build: b }, b, size)));
    if (b !== 'unsure' && !wbAsked.current) {
      wbAsked.current = true;
      setWbOpen(true);
    }
  };
  // An inside picked in the planner ticks what it's for in 03 (hanging clothes, folded clothes, shoes).
  const insidePicked = (k: InsideKey) => {
    const add = usesFor(k).flatMap((re) => options.uses.filter((u) => re.test(u)).slice(0, 1));
    if (add.length) setUses((cur) => [...cur, ...add.filter((a) => !cur.includes(a))]);
  };
  const wbNow = useMemo(() => wardrobeNow(wb, size, uses), [wb, size, uses]);
  const buildWords = wb.build === 'pax' ? 'IKEA PAX built in' : wb.build === 'mto' ? 'Made to measure' : wb.build === 'unsure' ? 'not sure yet, advise me' : '';
  const planText = useMemo(() => {
    if (!wardrobeOn) return [];
    if (wb.build === 'pax' && wbNow.pax) return paxLines(wbNow.pax, wbNow.wall, wbNow.ceiling);
    if (wb.build === 'mto' && wbNow.mto) return mtoLines(wbNow.mto, wbNow.wall, wbNow.ceiling);
    return [];
  }, [wardrobeOn, wb.build, wbNow]);
  // For "Designs like yours": an IKEA PAX wardrobe counts as that material, as when it was a Material chip.
  const materialFor = useMemo(() => (wardrobeOn && wb.build === 'pax' ? [...material, 'IKEA PAX built in'] : material), [wardrobeOn, wb.build, material]);

  // Some choices contain commas ("MDF only, no paint"), so several picks are joined with " + ".
  const join = (list: string[]) => list.join(' + ');

  const addressText = [addr.line1, addr.area, addr.postcode].map((x) => x.trim()).filter(Boolean).join(', ');

  // The designs closest to what they ticked (src/lib/design-match.ts): on the Brief sent card, and the server
  // works out the same three for the thank-you email. Saved ones and the job they came from count, but aren't shown.
  const likedHrefs = useMemo(() => [...liked.map((x) => x.href), ...(job ? [`/portfolio/${job.slug}`] : [])], [liked, job]);
  const picks = useMemo(
    () => (sent ? closestDesigns(designs, { what, room, uses, material: materialFor, liked: likedHrefs, address: addressText }) : null),
    [sent, designs, what, room, uses, materialFor, likedHrefs, addressText],
  );

  const message = useMemo(() => {
    const lines = [name.trim() ? `Hi Raf, this is ${name.trim()}. Here is my brief from your website.` : 'Hi Raf, here is my brief from your website.', ''];
    if (job) lines.push(`Something like your job: ${job.title}, ${job.area}`, jobUrl(job.slug), '');
    if (liked.length) lines.push('Things I liked:', ...liked.flatMap((s) => [s.area ? `${s.title}, ${s.area}` : s.title, savedUrl(s)]), '');
    if (what.length) lines.push(`What: ${join(what)}`);
    if (wardrobeOn && buildWords) lines.push(`Wardrobe: ${buildWords}`);
    const ikea = wardrobeOn && wb.build === 'pax' ? readCode(ikeaCode) : null;
    if (ikea?.value) lines.push(`IKEA design ${ikea.kind === 'link' ? 'link' : 'code'}: ${ikea.value}`);
    if (room.length) lines.push(`${room.length > 1 ? 'Rooms' : 'Room'}: ${join(room)}`);
    if (uses.length) lines.push(`For: ${join(uses)}`);
    if (hasSize) lines.push(`Rough size: ${size.w || '?'} wide x ${size.h || '?'} high x ${size.d || '?'} deep (mm)`);
    if (material.length) lines.push(`Material: ${join(material)}`);
    if (finish.length) lines.push(`Finish: ${join(finish)}`);
    if (timing) lines.push(`When: ${timing}`);
    if (budget) lines.push(`Budget: ${budget}`);
    if (planText.length) lines.push('', ...planText);
    const where = [
      mobile.trim() ? `Mobile: ${mobile.trim()}` : '',
      email.trim() ? `Email: ${email.trim()}` : '',
      addressText ? `Address: ${addressText}` : '',
      parking.length ? `Parking: ${join(parking)}` : '',
      access.trim() ? `Parking and access: ${access.trim()}` : '',
    ].filter(Boolean);
    if (where.length) lines.push('', ...where);
    if (notes.trim()) lines.push('', notes.trim());
    lines.push('', 'I will send photos of the space next.');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n'); // never two empty lines in a row
  }, [job, liked, what, wardrobeOn, buildWords, wb.build, ikeaCode, room, uses, material, finish, hasSize, size, planText, name, mobile, email, addressText, parking, access, timing, budget, notes]);

  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(`My project brief${what.length ? `: ${what.join(' + ')}` : ''}`.slice(0, 120))}&body=${encodeURIComponent(message.replace('I will send photos of the space next.', 'Photos of the space attached.'))}`;

  // Name, mobile and email are all needed (Raf, 22 Oct 2026); so are the sizes, a photo and the postcode (28 Oct 2026).
  const goodMobile = mobile.replace(/\D/g, '').length >= 10;
  const goodEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const goodPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(addr.postcode.trim());
  const sizeOk = Number(size.w) >= 10 && Number(size.h) >= 10;
  const missing: '' | 'name' | 'mobile' | 'email' = !name.trim() ? 'name' : !goodMobile ? 'mobile' : !goodEmail ? 'email' : '';
  const problem = (k: ScreenKey): Need =>
    k === 'what' ? (what.length ? '' : 'what')
      : k === 'size' ? (sizeOk ? '' : 'size')
        : k === 'photos' ? (photos.length ? '' : 'photos')
          : k === 'where' ? (goodPostcode ? '' : 'where')
            : k === 'details' ? missing
              : '';
  // Put the cursor where the answer goes (or on the first choice).
  const focusNeed = (n: Need) => {
    window.setTimeout(() => {
      const box = stepsRef.current;
      const el: HTMLElement | null | undefined =
        n === 'name' ? nameRef.current
          : n === 'mobile' ? mobileRef.current
            : n === 'email' ? emailRef.current
              : n === 'size' ? box?.querySelector<HTMLInputElement>(`[data-size="${!(Number(size.w) >= 10) ? 'w' : 'h'}"]`)
                : n === 'where' ? box?.querySelector<HTMLInputElement>('[data-postcode]')
                  : n === 'photos' ? box?.querySelector<HTMLElement>('[data-add-photos]')
                    : n === 'what' ? box?.querySelector<HTMLElement>('[data-screen="what"] button[aria-pressed]')
                      : null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 30);
  };
  const go = (i: number) => {
    moved.current = true;
    setNeed('');
    setAt(i);
    if (i === LAST) setReachedEnd(true);
  };
  const next = () => {
    const p = problem(SCREENS[at].key);
    if (p) {
      setNeed(p);
      focusNeed(p);
      return;
    }
    go(reachedEnd ? LAST : Math.min(LAST, at + 1));
  };
  // A new screen: bring its top into view (if the page has scrolled away from it) and put focus on the question.
  useEffect(() => {
    if (!moved.current) return;
    const box = stepsRef.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top;
    if (top < 72 || top > window.innerHeight * 0.45) box.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    document.getElementById(`brief-${SCREENS[at].key}-q`)?.focus({ preventScroll: true });
  }, [at]);
  // Before anything is sent: every needed answer is there, or that screen opens with what's missing.
  const gate = (e?: { preventDefault: () => void }) => {
    const bad = SCREENS.findIndex((s) => problem(s.key));
    if (bad < 0) return true;
    e?.preventDefault();
    const p = problem(SCREENS[bad].key);
    go(bad);
    setNeed(p);
    focusNeed(p);
    return false;
  };

  const copy = async () => {
    if (!gate()) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      markSent('copy');
    } catch {
      /* clipboard blocked */
    }
  };

  const addPhotos = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
    if (fileRef.current) fileRef.current.value = '';
    const room = MAX_PHOTOS - photos.length;
    if (!list.length || room <= 0) {
      if (room <= 0) setPhotoNote(`That's the most for one brief (${MAX_PHOTOS}). Send more on WhatsApp after.`);
      return;
    }
    const take = list.slice(0, room);
    setPhotoNote(list.length > room ? `Added ${room}: that's the most for one brief. Send the rest on WhatsApp after.` : '');
    setAdding(take.length);
    for (const f of take) {
      try {
        const p = await shrinkPhoto(f);
        setPhotos((cur) => (cur.length >= MAX_PHOTOS ? cur : [...cur, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blob: p.blob, thumb: p.thumb }]));
      } catch {
        setPhotoNote('One photo could not be opened. Try another, or send it on WhatsApp.');
      }
      setAdding((n) => Math.max(0, n - 1));
    }
  };

  // Send to Raf: the brief goes into ServiceM8 as a Quote job, then each photo onto that job.
  const sendDirect = async () => {
    if (sending || !gate()) return;
    setSendError('');
    setSending({ step: 'brief' });
    try {
      const r = await post(
        '/api/brief',
        JSON.stringify({
          name,
          mobile,
          email,
          address: addressText,
          message,
          choices: { what, room, uses, material: materialFor },
          liked: likedHrefs,
          photos: photos.length,
          company: trap.current?.value ?? '',
          ms: msSince(openedAt.current),
        }),
      );
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; token?: string; error?: string };
      if (!r.ok || !j.ok) {
        setSendError(
          j.error === 'contact'
            ? 'Add your mobile or email so I can reply.'
            : j.error === 'busy'
              ? 'Lots of briefs from here just now. Wait a minute and try again, or send it on WhatsApp.'
              : 'That didn’t go through. Try again, or send it on WhatsApp.',
        );
        setSending(null);
        return;
      }
      let ok = 0;
      for (let i = 0; i < photos.length && j.token; i++) {
        setSending({ step: 'photos', done: i, of: photos.length });
        const fd = new FormData();
        fd.set('token', j.token);
        fd.set('i', String(i));
        fd.set('file', photos[i].blob, `photo-${i + 1}.jpg`);
        try {
          const pr = await post('/api/brief/photo', fd, false);
          if (pr.ok) ok++;
        } catch {
          /* counted as not sent; the card says so */
        }
      }
      if (j.token && photos.length) await post('/api/brief/done', JSON.stringify({ token: j.token })).catch(() => null);
      setDirect({ photosSent: ok, photosTotal: photos.length, mobile: goodMobile ? mobile.trim() : '', email: goodEmail ? email.trim() : '', name: name.trim() });
      setSending(null);
      markSent('direct');
    } catch {
      setSendError('That didn’t go through. Check your signal and try again, or send it on WhatsApp.');
      setSending(null);
    }
  };

  const reset = () => {
    setWhat([]); setRoom([]); setUses([]); setMaterial([]); setFinish([]);
    setSize({ w: '', h: '', d: '' }); setName(''); setAddr({ line1: '', area: '', postcode: '' }); setParking([]); setAccess('');
    setTiming(''); setBudget(''); setNotes(''); setNeed(''); setSent(null); setReachedEnd(false); go(0);
    setWb({ build: null, pax: null, mto: null }); wbAsked.current = false; setIkeaCode('');
    setMobile(''); setEmail(''); setPhotos([]); setPhotoNote(''); setSendError(''); setDirect(null);
  };


  const key = SCREENS[at].key;
  // What's missing on this screen, while it still is.
  const errFor = (n: Need, text: string) => (need === n && problem(key) === n ? text : undefined);
  const nextLabel = reachedEnd
    ? 'Back to check and send'
    : at === LAST - 1
      ? 'Check and send'
      : SCREENS[at + 1].part !== SCREENS[at].part
        ? `Next: ${PARTS[SCREENS[at + 1].part]}`
        : 'Next';
  // Each answer in a line, for the Check and send screen.
  const summary = (k: ScreenKey): string => {
    switch (k) {
      case 'what':
        return [join(what), wardrobeOn && buildWords ? `wardrobe: ${buildWords}` : ''].filter(Boolean).join(', ');
      case 'room':
        return [join(room), join(uses)].filter(Boolean).join(' · ');
      case 'size':
        return sizeOk ? `${size.w} wide x ${size.h} high${size.d ? ` x ${size.d} deep` : ''} (mm)` : '';
      case 'material':
        return [join(material), join(finish)].filter(Boolean).join(' · ');
      case 'photos':
        return photos.length ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}` : '';
      case 'where':
        return [addressText, join(parking), access.trim()].filter(Boolean).join(' · ');
      case 'when':
        return [timing, budget].filter(Boolean).join(' · ');
      case 'details':
        return [name.trim(), mobile.trim(), email.trim(), notes.trim() ? 'and a note' : ''].filter(Boolean).join(' · ');
      default:
        return '';
    }
  };
  const smallMm = (v: string) => Boolean(v) && Number(v) > 0 && Number(v) < 400;
  const label = 'font-mono text-[12px] text-faint';
  const camera = (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="4" width="15" height="11" rx="1.5" />
      <path d="M6 4l1.2-2h3.6L12 4" />
      <circle cx="9" cy="9.5" r="2.7" />
    </svg>
  );

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
      <form
        className="min-w-0 md:col-span-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (at < LAST) next();
        }}
        aria-label="Project brief"
        noValidate
      >
        {at === 0 && job ? (
          <div className="mb-4 flex items-center gap-3.5 rounded-sm border border-accent/40 bg-mount p-2.5 pr-3">
            <span className="relative h-14 w-14 flex-none overflow-hidden rounded-[2px] bg-raised">
              <Image src={job.cover} alt="" fill sizes="56px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
              <span className="block font-mono text-[12px] text-accent">Something like this job</span>
              <span className="line-clamp-2 block font-medium text-ink">{job.title}, {job.area}</span>
            </span>
            <button type="button" onClick={clearJobFromLink} className="flex-none rounded-sm px-2 py-1.5 font-mono text-[12px] text-faint transition-colors hover:text-ink">
              Remove
            </button>
          </div>
        ) : null}
        {at === 0 && liked.length ? (
          <section aria-label="Things you saved" className="mb-4 rounded-sm border border-line-strong bg-mount p-3.5">
            <p className="flex items-center gap-2 text-[16px] font-[620] text-ink">
              <span className="text-accent"><Heart on /></span>
              Things you saved ({liked.length})
            </p>
            <p className="mt-1 text-[14px] leading-snug text-muted">They go in your message with their links.</p>
            <ul className="mt-3 grid gap-2">
              {liked.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="relative h-12 w-16 flex-none overflow-hidden rounded-[2px] border border-line bg-white">
                    {s.image ? <Image src={s.image} alt="" fill sizes="64px" className="object-contain" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <a href={s.href} target="_blank" rel="noopener" className="line-clamp-2 block text-[14.5px] font-medium text-ink hover:text-accent">{s.title}</a>
                    {s.area ? <span className="block font-mono text-[12px] text-faint">{s.area}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSaved(s.id)}
                    aria-label={`Remove ${s.title}`}
                    className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-sm text-muted transition-colors hover:text-ink"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div ref={stepsRef} className="rounded-sm border border-line-strong bg-mount p-5 shadow-[0_24px_48px_-36px_rgb(22_25_28/0.45)] sm:p-7 md:p-8" data-brief-steps data-at={key}>
          <Progress at={at} />
          <div className="mt-7">
            {key === 'what' ? (
              <Ask
                id="what"
                title="What would you like made?"
                why="Tap all that fit. Not on the list? Pick Something else."
                err={errFor('what', 'Pick at least one to carry on. Not on the list? Pick Something else.')}
              >
                <Chips label="What would you like made?" options={options.what} value={what} onPick={toggle(setWhat)} multi icon={whatIcon} />
                {wardrobeOn ? <WardrobeCard wb={wb} size={size} uses={uses} onBuild={pickBuild} onOpen={openPlanner} code={ikeaCode} onCode={setIkeaCode} /> : null}
                {/* A nudge to the Designs in 3D page for what they picked; opens in a new tab so the brief stays filled in. */}
                {(() => {
                  const slugs = new Set(what.flatMap((w) => kindsIn(w).map((k) => k.slug)));
                  const show = designKinds.filter((k) => slugs.has(k.slug));
                  return show.length ? (
                    <>
                      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
                        {show.map((k) => (
                          <a key={k.slug} href={`/designs/${k.slug}`} target="_blank" rel="noopener" className="link-more">
                            See {k.count} {kindWords(k)} in 3D <span aria-hidden="true">→</span>
                          </a>
                        ))}
                      </p>
                      <p className="mt-1.5 text-[13.5px] leading-snug text-faint">Tap Save on any you like and they come into this brief.</p>
                    </>
                  ) : null;
                })()}
              </Ask>
            ) : null}

            {key === 'room' ? (
              <Ask id="room" title="Which room, and what is it for?" tag="Optional · tap all that fit">
                <p className={`${label} mt-5`}>Room</p>
                <Chips label="Which room?" options={options.room} value={room} onPick={toggle(setRoom)} multi />
                <p className={`${label} mt-6`}>What it’s for</p>
                <Chips label="What is it for?" options={options.uses} value={uses} onPick={toggle(setUses)} multi />
              </Ask>
            ) : null}

            {key === 'size' ? (
              <Ask
                id="size"
                title="Roughly how big is the space?"
                why="Width and height, so I know the size of the job before I come. Rough is fine: I measure properly on the free visit."
                err={errFor('size', 'Add the width and height in mm to carry on. A 2.4 metre wall is 2400.')}
              >
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {(['w', 'h', 'd'] as const).map((k) => (
                    <label key={k} className="block min-w-0">
                      <span className={label}>{k === 'w' ? 'Width' : k === 'h' ? 'Height' : 'Depth'}</span>
                      <input
                        className={`${input} mt-1 ${need === 'size' && k !== 'd' && !(Number(size[k]) >= 10) ? 'border-accent ring-2 ring-accent/20' : ''}`}
                        inputMode="numeric"
                        placeholder={k === 'w' ? '2400' : k === 'h' ? '2500' : '600'}
                        value={size[k]}
                        data-size={k}
                        aria-required={k !== 'd' || undefined}
                        aria-invalid={need === 'size' && k !== 'd' && !(Number(size[k]) >= 10) ? true : undefined}
                        onChange={(e) => setSize((s) => ({ ...s, [k]: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) }))}
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 font-mono text-[12px] text-faint">
                  In mm{smallMm(size.w) || smallMm(size.h) ? <span className="text-accent">: 2.4 metres is 2400</span> : '. Depth if you know it.'}
                </p>
                <p className="mt-4 text-[14.5px]">
                  <a href="/tips#measure-skirting-to-skirting" target="_blank" rel="noopener" className="link-more">
                    How I’d measure it <span aria-hidden="true">↗</span>
                  </a>
                </p>
              </Ask>
            ) : null}

            {key === 'material' ? (
              <Ask id="material" title="Any material or finish in mind?" tag="Optional · not sure is fine">
                {wardrobeOn && wb.build === 'pax' ? (
                  <p className="mt-3 text-[13.5px] leading-snug text-muted" data-pax-material-note>Your PAX frames come from IKEA. Pick the material for what I make: the top boxes, fillers and any made-to-measure doors.</p>
                ) : null}
                <p className={`${label} mt-5`}>Material</p>
                <Chips label="Material" options={options.material} value={material} onPick={toggle(setMaterial)} multi />
                <p className={`${label} mt-6`}>Finish</p>
                <Chips label="Finish" options={options.finish} value={finish} onPick={toggle(setFinish)} multi />
              </Ask>
            ) : null}

            {key === 'photos' ? (
              <Ask
                id="photos"
                title="Add a photo or two of the space"
                why="At least one, so I can see the walls, sockets and pipes before I come."
                err={errFor('photos', adding ? 'Your photos are still going in. One moment.' : 'Add at least one photo to carry on.')}
              >
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {options.photoTips.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-sm border border-line bg-paper px-3.5 py-3 text-[14.5px] leading-snug text-ink">
                      <span className="mt-px flex-none text-accent">{camera}</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" id="brief-photos" tabIndex={-1} onChange={(e) => addPhotos(e.target.files)} />
                  {photos.length || adding ? (
                    <ul className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-label="Your photos">
                      {photos.map((p, i) => (
                        <li key={p.id} className="relative aspect-square overflow-hidden rounded-[2px] border border-line bg-raised">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.thumb} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                            aria-label={`Remove photo ${i + 1}`}
                            className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-on-accent"
                          >
                            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg>
                          </button>
                        </li>
                      ))}
                      {Array.from({ length: adding }).map((_, i) => (
                        <li key={`adding-${i}`} className="flex aspect-square items-center justify-center rounded-[2px] border border-dashed border-line-strong font-mono text-[11px] text-faint">
                          Adding
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {photos.length < MAX_PHOTOS ? (
                    photos.length || adding ? (
                      <button type="button" data-add-photos onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-sm gap-2">
                        {camera}
                        Add more photos
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-add-photos
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          addPhotos(e.dataTransfer.files);
                        }}
                        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-sm border-2 border-dashed bg-paper px-4 py-7 text-center transition-colors hover:border-accent ${need === 'photos' ? 'border-accent' : 'border-line-strong'}`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent [&_svg]:h-5 [&_svg]:w-5">{camera}</span>
                        <span className="text-[16px] font-semibold text-ink">Add photos</span>
                        <span className="text-[13.5px] text-muted">From your camera or gallery, up to {MAX_PHOTOS}</span>
                      </button>
                    )
                  ) : null}
                  {photoNote ? <p className="mt-2 text-[13.5px] font-medium text-accent" role="status">{photoNote}</p> : null}
                </div>
                <p className="mt-4 text-[14px] leading-relaxed text-muted">
                  They go with your brief when you press <span className="font-medium text-ink">Send to Raf</span> at the end. On WhatsApp, add them in the chat after you send; by email, attach them.
                </p>
              </Ask>
            ) : null}

            {key === 'where' ? (
              <Ask
                id="where"
                title="Where is the job?"
                why="Your postcode, so I know how far you are and can plan the visit."
                err={errFor('where', addr.postcode.trim() ? 'That postcode looks short. Add the whole postcode, both halves.' : 'Add your postcode to carry on.')}
              >
                <div className="mt-5">
                  <AddressFinder value={addr} onChange={(a) => { setAddr(a); }} inputClass={input} required invalid={need === 'where' && !goodPostcode} />
                  <p className="mt-2 text-[13px] leading-snug text-faint">To prepare your quote I may check public records for the property, like its energy certificate and planning history.</p>
                </div>
                <p className={`${label} mt-5`}>Parking</p>
                <Chips label="Parking" options={options.parking} value={parking} onPick={toggle(setParking)} multi />
                <label className="mt-3 block">
                  <span className="sr-only">Anything else about parking or access</span>
                  <input
                    className={input}
                    placeholder="Anything else? e.g. 3rd floor, no lift; bay behind the shop"
                    value={access}
                    onChange={(e) => setAccess(e.target.value.slice(0, 160))}
                  />
                </label>
              </Ask>
            ) : null}

            {key === 'when' ? (
              <Ask id="when" title="When would you like it, and roughly what budget?" tag="Optional · helps me plan">
                <p className={`${label} mt-5`}>When</p>
                <Chips label="When?" options={options.timing} value={timing} onPick={one(setTiming, timing)} />
                <p className={`${label} mt-6`}>Rough budget</p>
                <Chips label="Rough budget" options={options.budget} value={budget} onPick={one(setBudget, budget)} />
              </Ask>
            ) : null}

            {key === 'details' ? (
              <Ask
                id="details"
                title="Who should I reply to?"
                why="Name, mobile and email, so I can reply the way that suits you. Only sent to me; nothing is kept on this website."
                err={
                  errFor('name', 'Add your name to carry on.') ??
                  errFor('mobile', 'Add your mobile (10 digits or more) to carry on.') ??
                  errFor('email', 'Add your email to carry on.')
                }
              >
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={label}>Name</span>
                    <input
                      ref={nameRef}
                      className={`${input} mt-1 ${need === 'name' && !name.trim() ? 'border-accent ring-2 ring-accent/20' : ''}`}
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => { setName(e.target.value.slice(0, 80)); setNeed(''); }}
                      autoComplete="name"
                      aria-required="true"
                      aria-invalid={need === 'name' && !name.trim() ? true : undefined}
                    />
                  </label>
                  <label className="block">
                    <span className={label}>Mobile</span>
                    <input
                      ref={mobileRef}
                      className={`${input} mt-1 ${need === 'mobile' && !goodMobile ? 'border-accent ring-2 ring-accent/20' : ''}`}
                      type="tel"
                      inputMode="tel"
                      placeholder="So I can call you back"
                      value={mobile}
                      onChange={(e) => { setMobile(e.target.value.replace(/[^\d+ ()-]/g, '').slice(0, 20)); setNeed(''); }}
                      autoComplete="tel"
                      aria-required="true"
                      aria-invalid={need === 'mobile' && !goodMobile ? true : undefined}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={label}>Email</span>
                    <input
                      ref={emailRef}
                      className={`${input} mt-1 ${need === 'email' && !goodEmail ? 'border-accent ring-2 ring-accent/20' : ''}`}
                      type="email"
                      inputMode="email"
                      placeholder="For your quote and the 3D drawing"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value.replace(/\s/g, '').slice(0, 120)); setNeed(''); }}
                      autoComplete="email"
                      aria-required="true"
                      aria-invalid={need === 'email' && !goodEmail ? true : undefined}
                    />
                  </label>
                </div>
                {/* People never see this box; bots fill it in, and their brief goes nowhere. */}
                <input ref={trap} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />
                <label className="mt-6 block">
                  <span className={label}>Anything else? (optional)</span>
                  <textarea
                    className={`${input} mt-1 h-28 resize-y py-2.5`}
                    placeholder="Sloping ceiling, a boiler on the wall, a colour you have in mind..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 600))}
                  />
                </label>
              </Ask>
            ) : null}

            {key === 'send' ? (
              <Ask id="send" title={sent ? 'Your brief' : 'Check it and send'}>
                <p className="mt-2.5 text-[15px] leading-snug text-muted">
                  {sent === 'direct' ? 'It’s with me. Here is what you sent.' : 'Here is everything you told me. Change anything, then send it.'}
                </p>
                <ul className="mt-5 border-t border-line" data-check-list>
                  {SCREENS.slice(0, LAST).map((s, i) => {
                    const v = summary(s.key);
                    return (
                      <li key={s.key} className="flex items-start gap-3 border-b border-line py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-[12px] text-faint">{s.label}</span>
                          <span className={`block break-words text-[15px] leading-snug ${v ? 'text-ink' : 'text-faint'}`}>{v || 'Skipped'}</span>
                        </span>
                        {sent === 'direct' ? null : (
                          <button type="button" onClick={() => go(i)} className="flex-none rounded-sm px-1.5 py-1 font-mono text-[12.5px] text-accent transition-colors hover:text-accent-hover hover:underline" aria-label={`Change ${s.label.toLowerCase()}`}>
                            Change
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 text-[14px] text-muted md:hidden">Your message and the send buttons are just below.</p>
              </Ask>
            ) : null}
          </div>

          {at < LAST ? (
            <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
              {at > 0 ? (
                <button type="button" onClick={() => go(at - 1)} className="btn btn-ghost gap-2" data-back>
                  <span aria-hidden="true">←</span> Back
                </button>
              ) : null}
              <button type="submit" className="btn btn-primary flex-1 gap-2 sm:ml-auto sm:flex-none" data-next>
                {nextLabel} <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : sent === 'direct' ? null : (
            <div className="mt-6">
              <button type="button" onClick={() => go(at - 1)} className="btn btn-ghost gap-2" data-back>
                <span aria-hidden="true">←</span> Back
              </button>
            </div>
          )}
        </div>
      </form>
      <WardrobeWindow open={wbOpen} onClose={() => setWbOpen(false)} wb={wb} setWb={setWb} size={size} setSize={setSize} uses={uses} onInsidePicked={insidePicked} />

      {/* The message as it will arrive: beside the questions on a computer, building up as they go; on a phone
          only on the last screen, with the ways to send it. */}
      <aside className={`min-w-0 md:col-span-5 ${at === LAST ? '' : 'hidden md:block'}`} aria-label="Your message" data-brief-aside>
        {/* Stays in view while the brief is filled in; once sent, the card makes it too tall to stick, so it scrolls normally. */}
        <div className={sent ? '' : 'md:sticky md:top-28'}>
          <p className="font-mono text-[13px] text-faint">Your message</p>
          {sent ? (
            <div ref={nextRef} className="mt-3 scroll-mt-24">
              <WhatHappensNext how={sent} photoTips={options.photoTips} designTotal={designTotal} direct={direct} picks={picks} />
              <button type="button" onClick={() => setShowMsg((v) => !v)} aria-expanded={showMsg} className="mt-3 font-mono text-[12.5px] text-faint transition-colors hover:text-ink">
                {showMsg ? 'Hide my message' : 'Show my message'}
              </button>
            </div>
          ) : null}
          {!sent || showMsg ? (
            <pre className={`mt-3 whitespace-pre-wrap break-words rounded-sm border border-line-strong bg-mount p-5 font-mono text-[13.5px] leading-relaxed text-ink ${at === LAST ? 'min-h-[220px]' : 'max-h-[60vh] overflow-auto opacity-80'}`}>{message}</pre>
          ) : null}
          {at < LAST ? (
            <p className="mt-3 text-[13.5px] leading-snug text-faint">It builds up as you answer. You check it and send it at the end.</p>
          ) : sent === 'direct' ? null : (
            /* Once it has gone straight to Raf, the other ways to send are hidden so it can't arrive twice. */
            <div className="mt-4 grid gap-2.5">
              <button type="button" onClick={sendDirect} disabled={Boolean(sending)} aria-describedby="send-direct-note" className="btn btn-primary w-full gap-2.5 disabled:opacity-80">
                {sending
                  ? sending.step === 'brief'
                    ? 'Sending your brief...'
                    : `Sending photo ${sending.done + 1} of ${sending.of}...`
                  : photos.length
                    ? `Send to Raf, with ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
                    : 'Send to Raf'}
              </button>
              <p id="send-direct-note" className="-mt-1 text-center text-[13px] leading-snug text-faint">
                Straight to me, photos and all.
              </p>
              {sendError ? <p className="text-[14px] font-medium text-accent" role="alert">{sendError}</p> : null}
              <a href={whatsappUrl(message)} target="_blank" rel="noopener" onClick={(e) => gate(e) && markSent('whatsapp')} className="btn btn-whatsapp w-full gap-2.5">
                <SocialIcon network="whatsapp" size={18} />
                Send on WhatsApp
              </a>
              <div className="grid grid-cols-2 gap-2.5">
                <a href={mailto} onClick={(e) => gate(e) && markSent('email')} className="btn btn-ghost">Email it</a>
                <button type="button" onClick={copy} className="btn btn-ghost">{copied ? 'Copied' : 'Copy text'}</button>
              </div>
            </div>
          )}
          {at > 0 || what.length ? (
            <button type="button" onClick={reset} className="mt-3 font-mono text-[12px] text-faint transition-colors hover:text-ink">
              Start again
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

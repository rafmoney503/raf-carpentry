'use client';
/* eslint-disable @next/next/no-img-element -- pictures from Instagram's, Facebook's and Threads' own servers, shown as they come */
import { useEffect, useMemo, useRef, useState } from 'react';
import { post } from './sm8-post';
import { readPin } from './uploader';
import { Icon } from './icons';
import { field } from './parts';
import type { TodayLine } from './current';
import type { Platform, SocialAccount, SocialComment, SocialDay, SocialOverview, SocialPost, SocialProfile } from '@/lib/social-types';

/* The Job Kit's Social screen: Raf Carpentry's Instagram and Facebook Page (20 Oct 2026, Raf: 'is there a way to see in
   job kit social media profiles with followers and comments as a separate section', then 'start with instagram and
   facebook') and Threads (21 Oct 2026, Raf: 'Let's go with threads'), through /api/job-kit/social (src/lib/social.ts).
   Followers and how they've moved (counted each day the overview is fetched), the latest posts, and the comments on
   them (on Threads, the replies people left) with what was said back, newest first; a reply goes from here only when
   Raf presses Send reply. The last overview is kept on this device (raf_jobkit_social) so Today can say what's new,
   and so a platform that doesn't answer this time still shows its last numbers; which comments he has seen is kept on
   the server (and on the device at once), so the phone and the computer agree. YouTube and TikTok come later. */

const API = '/api/job-kit/social';
const KEY = 'raf_jobkit_social';
const SEEN_KEY = 'raf_jobkit_social_seen';
export const SOCIAL_FRESH = 10 * 60_000;

export type Social = {
  data: SocialOverview | null;
  at: number;
  error?: string;
  detail?: string;
};

const ORDER: Platform[] = ['ig', 'fb', 'th'];
const metaOf = (p: Platform) => p === 'ig' || p === 'fb';
const NOT_SET_UP: SocialAccount = { setUp: false, missing: [], connected: false };

/* An overview kept from before 21 Oct 2026 (Instagram and Facebook only) in today's shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toV2(d: any): SocialOverview | null {
  if (!d || typeof d !== 'object') return null;
  if (d.v === 2) return d as SocialOverview;
  const empty = { profiles: [], posts: [], comments: [], seenAt: 0, problems: [], at: 0 };
  if (d.connected === false) return { v: 2, meta: { setUp: Boolean(d.setUp), missing: d.missing ?? [], connected: false }, threads: NOT_SET_UP, ...empty };
  if (d.connected === true)
    return {
      v: 2,
      meta: { setUp: true, missing: [], connected: true, who: d.user, connectedAt: d.connectedAt, pages: d.pages ?? [], page: d.page, notGranted: d.notGranted ?? [] },
      threads: NOT_SET_UP,
      ...empty,
      profiles: d.profiles ?? [],
      posts: d.posts ?? [],
      comments: d.comments ?? [],
      seenAt: d.seenAt ?? 0,
      problems: d.problems ?? [],
    };
  return null;
}

export function savedSocial(): Social {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Social | null;
    if (s && typeof s.at === 'number') return { ...s, data: toV2(s.data) };
  } catch {
    /* none kept */
  }
  return { data: null, at: 0 };
}
function keep(s: Social) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}
const localSeen = () => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};

/* A platform that didn't come this time (its login stopped working, or it was busy) keeps what this device had last,
   with the problem said beside it. */
function carry(next: SocialOverview, prev: SocialOverview | null): SocialOverview {
  if (!prev) return next;
  const failed = ORDER.filter((p) => {
    if (next.profiles.some((x) => x.platform === p)) return false;
    const acc = metaOf(p) ? next.meta : next.threads;
    return acc.connected && (Boolean(acc.error) || next.problems.some((x) => x.platform === p));
  });
  const take = failed.filter((p) => prev.profiles.some((x) => x.platform === p));
  if (!take.length) return next;
  const has = (x: { platform: Platform }) => take.includes(x.platform);
  return {
    ...next,
    profiles: [...next.profiles, ...prev.profiles.filter(has)].sort((a, b) => ORDER.indexOf(a.platform) - ORDER.indexOf(b.platform)),
    posts: [...next.posts, ...prev.posts.filter(has)].sort((a, b) => b.at - a.at),
    comments: [...next.comments, ...prev.comments.filter(has)].sort((a, b) => (b.activeAt ?? b.at) - (a.activeAt ?? a.at)),
  };
}

/* A fresh overview; on a problem the last one stays, with the problem beside it. */
export async function fetchSocial(pin: string, prev: Social): Promise<Social> {
  const r = await post<SocialOverview>(pin, { action: 'overview' }, API);
  if (!r.ok) return { ...prev, error: r.error, detail: r.detail };
  const data = toV2(r.data);
  if (!data) return { ...prev, error: 'social-error' };
  const next: Social = { data: carry(data, prev.data), at: Date.now() };
  keep(next);
  return next;
}

/* What the screen is drawn from scratch on (job-kit-app.tsx key): which accounts are connected, and the Page. */
export function socialKey(s: Social) {
  const d = s.data;
  if (!d) return 'none';
  return `${d.meta.connected ? `m-${d.meta.page?.id ?? ''}` : 'm0'}|${d.threads.connected ? 't' : 't0'}`;
}

export function socialProblem(error?: string, detail?: string) {
  switch (error) {
    case undefined:
    case '':
      return '';
    case 'meta-not-set-up':
      return `Instagram and Facebook aren’t set up yet${detail ? `: ${detail} ${detail.includes(',') ? 'are' : 'is'} missing in Vercel` : ''}.`;
    case 'meta-expired':
      return 'Facebook wants you to connect again (a changed Facebook password, the app removed, or it simply asks every so often). Tap Connect again.';
    case 'meta-permission':
      return `Facebook says the Job Kit isn’t allowed to do that${detail ? ` (${detail})` : ''}. Tap Connect again and leave every box ticked.`;
    case 'meta-busy':
      return 'Facebook is busy or didn’t answer. Try again in a minute.';
    case 'meta-gone':
      return 'That isn’t on Facebook or Instagram any more (deleted or hidden). Refresh.';
    case 'meta-no-page':
      return 'Facebook didn’t share any Page. Tap Connect again and, where Facebook asks which Pages, tick Raf Carpentry.';
    case 'meta-no-ig':
      return 'No Instagram account is linked to this Facebook Page. In the Instagram app: Settings, Account type and tools (or Business tools), Connect or change Facebook Page, then Connect again here.';
    case 'meta-store':
    case 'threads-store':
    case 'social-store':
      return 'The Job Kit’s own store didn’t answer. Try again in a minute.';
    case 'meta-not-connected':
      return 'Instagram and Facebook aren’t connected. Tap Connect.';
    case 'threads-not-set-up':
      return `Threads isn’t set up yet${detail ? `: ${detail} ${detail.includes(',') ? 'are' : 'is'} missing in Vercel` : ''}.`;
    case 'threads-expired':
      return 'Threads wants you to connect again (a changed password, the app removed, or two months without opening this screen). Tap Connect Threads again.';
    case 'threads-permission':
      return `Threads says the Job Kit isn’t allowed to do that${detail ? ` (${detail})` : ''}. Tap Connect Threads again and allow everything it asks.`;
    case 'threads-busy':
      return 'Threads is busy or didn’t answer. Try again in a minute.';
    case 'threads-gone':
      return 'That isn’t on Threads any more (deleted or hidden). Refresh.';
    case 'threads-not-connected':
      return 'Threads isn’t connected. Tap Connect Threads.';
    case 'cancelled':
      return 'Not connected: the login was closed, or Not now or Cancel was pressed.';
    case 'expired':
      return 'That login took too long, or was started somewhere else. Tap Connect again.';
    case 'missing-text':
      return 'Write the reply first.';
    case 'no-pin':
      return 'Add your PIN in Settings first.';
    case 'wrong-pin':
      return 'Wrong PIN: check it in Settings.';
    case 'offline':
      return 'No signal. Showing what this device had last.';
    default:
      return `${/^threads/.test(error) ? 'Threads' : /^meta/.test(error) ? 'Facebook' : 'The Job Kit'} sent back an error${detail ? `: ${detail}` : '.'}`;
  }
}

/* ---------- what's new ---------- */

const seenOf = (s: Social) => Math.max(s.data?.seenAt ?? 0, localSeen());
const lastWord = (c: SocialComment) => c.activeAt ?? c.at;
const DAY = 864e5;
/* Comments Raf hasn't had in front of him yet (the last 30 days), or that someone wrote under again after his reply. */
export function newComments(s: Social): SocialComment[] {
  if (!s.data) return [];
  const seen = seenOf(s);
  return s.data.comments.filter((c) => lastWord(c) > seen && lastWord(c) > Date.now() - 30 * DAY && !c.answered);
}
const asks = (t: string) => /\?|how much|price|cost|quote|available|do you (do|cover|work)|interested|contact/i.test(t);
export const platformName = (p: Platform) => (p === 'ig' ? 'Instagram' : p === 'fb' ? 'Facebook' : 'Threads');

export function socialTodayLine(s: Social): TodayLine | null {
  const list = newComments(s);
  if (!list.length) return null;
  if (list.length === 1) {
    const c = list[0];
    const q = asks(c.text) || Boolean(c.activeAt && c.replies.length && asks(c.replies[c.replies.length - 1].text));
    return {
      text: `${c.activeAt ? `${c.who} wrote again` : `${asks(c.text) ? 'Question' : 'Comment'} from ${c.who}`} on ${platformName(c.platform)}`,
      go: 'social',
      urgent: q,
      icon: 'social',
    };
  }
  const by = ORDER.map((p) => [p, list.filter((c) => c.platform === p).length] as const).filter(([, k]) => k);
  return {
    text: `${list.length} new comments${by.length > 1 ? `: ${by.map(([p, k]) => `${k} on ${platformName(p)}`).join(', ')}` : ` on ${platformName(by[0][0])}`}`,
    go: 'social',
    urgent: list.some((c) => asks(c.text)),
    icon: 'social',
  };
}

const n = (v: number | null | undefined) => (typeof v === 'number' ? v.toLocaleString('en-GB') : '–');

/* The line under Social media on Today. */
export function socialLine(s: Social) {
  const d = s.data;
  if (!d) return /not-set-up/.test(s.error ?? '') ? 'Social media: not set up yet' : 'Followers and comments on Instagram, Facebook and Threads';
  if (!d.meta.connected && !d.threads.connected) return d.meta.setUp || d.threads.setUp ? 'Connect Instagram, Facebook and Threads' : 'Social media: not set up yet';
  const parts = d.profiles.map((p) => {
    const w = change(p.history, 7);
    return `${platformName(p.platform)} ${n(p.followers)}${w && w.n ? ` (${w.n > 0 ? '+' : '−'}${Math.abs(w.n)})` : ''}`;
  });
  if (d.meta.connected && !d.meta.page) parts.unshift('Pick which Facebook Page');
  const fresh = newComments(s).length;
  return [parts.join(' · '), fresh ? `${fresh} new comment${fresh === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Followers and comments';
}

/* ---------- followers over time ---------- */

const addDays = (day: string, k: number) => new Date(Date.parse(`${day}T12:00:00Z`) + k * DAY).toISOString().slice(0, 10);
const dayWords = (day: string) => new Date(`${day}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/* How far the followers moved over the last `days`: from the count on or before that day, or from the first count
   when the history is shorter (then `since` says from when). */
export function change(h: SocialDay[], days: number): { n: number; since?: string } | null {
  const pts = h.filter((x) => typeof x.followers === 'number') as { day: string; followers: number }[];
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const target = addDays(last.day, -days);
  const from = [...pts].reverse().find((x) => x.day <= target);
  if (from) return { n: last.followers - from.followers };
  return { n: last.followers - pts[0].followers, since: pts[0].day };
}

function Spark({ h }: { h: SocialDay[] }) {
  const pts = h.filter((x) => typeof x.followers === 'number').slice(-90) as { day: string; followers: number }[];
  if (pts.length < 2) return null;
  const t0 = Date.parse(pts[0].day);
  const span = Math.max(1, Date.parse(pts[pts.length - 1].day) - t0);
  const lo = Math.min(...pts.map((p) => p.followers));
  const hi = Math.max(...pts.map((p) => p.followers));
  const y = (v: number) => (hi === lo ? 20 : 36 - ((v - lo) / (hi - lo)) * 32);
  const line = pts.map((p) => `${(((Date.parse(p.day) - t0) / span) * 200).toFixed(1)},${y(p.followers).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="mt-3 block h-10 w-full" aria-hidden>
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="jk-sec-ink" />
    </svg>
  );
}

function moved(c: { n: number; since?: string } | null, words: string) {
  if (!c) return null;
  const v = c.n === 0 ? 'No change' : `${c.n > 0 ? '+' : '−'}${Math.abs(c.n).toLocaleString('en-GB')}`;
  return `${v} ${c.since ? `since ${dayWords(c.since)}` : words}`;
}

/* ---------- small pieces ---------- */

const BADGE: Record<Platform, [string, string]> = {
  ig: ['Insta', 'bg-ink text-paper'],
  fb: ['Facebook', 'border border-ink text-ink'],
  th: ['Threads', 'border border-line-strong bg-raised text-ink'],
};
function Badge({ p }: { p: Platform }) {
  return <span className={`inline-flex h-[22px] shrink-0 items-center rounded-sm px-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${BADGE[p][1]}`}>{BADGE[p][0]}</span>;
}

function Pic({ src, className, round }: { src?: string; className: string; round?: boolean }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <span aria-hidden className={`${className} block bg-raised ${round ? 'rounded-full' : 'rounded-sm'}`} />;
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`${className} bg-raised object-cover ${round ? 'rounded-full' : 'rounded-sm'}`} />;
}

function ago(t: number) {
  const s = Math.max(0, Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} day${Math.round(s / 86400) === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(Date.now() - t > 300 * DAY ? { year: 'numeric' } : {}) });
}
const onDay = (t?: number) => (t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const KIND: Record<SocialPost['kind'], string> = { reel: 'Reel', video: 'Video', photo: 'Photo', carousel: 'Photos', post: 'Post', thread: 'Thread' };

function ProfileCard({ p }: { p: SocialProfile }) {
  const week = moved(change(p.history, 7), 'this week');
  const month = change(p.history, 30);
  const monthWords = month && !month.since ? moved(month, 'in 30 days') : null;
  return (
    <div className="rounded-sm border border-line-strong bg-mount p-4">
      <div className="flex items-center gap-3">
        <Pic src={p.picture} round className="h-11 w-11 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-tight">{platformName(p.platform)}</span>
          <span className="block truncate text-[14.5px] text-muted">{p.platform === 'fb' ? p.name : `@${p.handle ?? ''}`}</span>
        </span>
        <a href={p.link} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-[13px] font-semibold underline jk-sec-ink">
          Open ↗
        </a>
      </div>
      <p className="mt-4 font-display text-[36px] font-[680] leading-none tracking-[-0.02em]">{n(p.followers)}</p>
      <p className="mt-1 text-[14.5px] text-muted">followers</p>
      <p className="mt-2 font-mono text-[13px] font-semibold jk-sec-ink">
        {p.followers === null ? `${platformName(p.platform)} didn’t give the count this time.` : week ?? 'Counting from today: the change shows from tomorrow.'}
      </p>
      {monthWords ? <p className="mt-0.5 font-mono text-[12.5px] text-muted">{monthWords}</p> : null}
      <Spark h={p.history} />
      {p.platform === 'ig' ? (
        <p className="mt-2 font-mono text-[12.5px] text-faint">
          {n(p.posts)} posts · following {n(p.following)}
        </p>
      ) : null}
    </div>
  );
}

/* A platform not connected yet: in the row of profiles, where its numbers will be. */
function ConnectCard({ platform, acc, starting, pinned, onConnect }: { platform: 'meta' | 'threads'; acc: SocialAccount; starting: boolean; pinned: boolean; onConnect: () => void }) {
  const meta = platform === 'meta';
  const title = meta ? 'Instagram and Facebook' : 'Threads';
  return (
    <div className="rounded-sm border border-dashed border-line-strong bg-mount p-4">
      <p className="font-semibold leading-tight">{title}</p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
        {meta ? 'Followers, your latest posts and every comment on them, with a Reply box.' : 'Followers, your latest threads and the replies people leave under them, with a Reply box.'}
      </p>
      {acc.setUp ? (
        <>
          <button type="button" onClick={onConnect} disabled={starting} className="btn btn-primary btn-sm mt-3.5 w-full disabled:opacity-60">
            {starting ? `Opening ${meta ? 'Facebook' : 'Threads'}…` : `Connect ${title}`}
          </button>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
            {meta
              ? 'Facebook asks you to log in, then which Pages and Instagram accounts to share: tick Raf Carpentry and @rafcarpentry and leave every permission on.'
              : 'Threads asks you to log in as @rafcarpentry and allow the Job Kit: tap Allow.'}
            {pinned ? ' On the iPhone it opens in a browser window: when that says Connected, close it and come back here. It’s easiest from the computer.' : ''}
          </p>
        </>
      ) : (
        <p className="mt-3 rounded-sm border border-line bg-paper px-3 py-2.5 text-[13.5px] leading-relaxed">
          Not set up yet{acc.missing.length ? `: ${acc.missing.join(', ')} ${acc.missing.length === 1 ? 'is' : 'are'} missing in Vercel` : ''}. These come from the {meta ? 'Meta' : 'Threads'} app made
          for the Job Kit; ask Claude to walk you through it.
        </p>
      )}
    </div>
  );
}

/* ---------- a comment ---------- */

const MAX: Record<Platform, number> = { ig: 2000, fb: 2000, th: 500 };

function CommentCard({
  c,
  postOf,
  isNew,
  from,
  onReply,
}: {
  c: SocialComment;
  postOf: (id: string) => SocialPost | undefined;
  isNew: boolean;
  from: string; // who the reply goes from
  onReply: (c: SocialComment, text: string) => Promise<string>;
}) {
  const p = postOf(c.post);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) box.current?.focus({ preventScroll: true });
  }, [open]);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr('');
    const e = await onReply(c, text.trim());
    setBusy(false);
    if (e) setErr(e);
    else {
      setText('');
      setOpen(false);
    }
  };
  const max = MAX[c.platform];
  const left = max - text.length;
  return (
    <li data-jk-id={c.id} className={`rounded-sm border bg-mount p-3.5 ${isNew ? 'border-ink' : 'border-line-strong'}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge p={c.platform} />
        <span className="min-w-0 truncate font-semibold">{c.who}</span>
        <span className="font-mono text-[12.5px] text-faint">{ago(c.at)}</span>
        {isNew ? <span className="rounded-sm bg-accent px-1.5 py-px font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-on-accent">New</span> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[16px] leading-relaxed">{c.text || <span className="text-faint">(a sticker or a photo)</span>}</p>
      {p ? (
        <a href={p.link} target="_blank" rel="noopener noreferrer" className="mt-2.5 flex items-center gap-2.5 rounded-sm border border-line bg-paper p-1.5 pr-2.5">
          {p.thumb ? <Pic src={p.thumb} className="h-10 w-10 shrink-0" /> : null}
          <span className={`min-w-0 flex-1 truncate text-[13.5px] text-muted ${p.thumb ? '' : 'py-1 pl-1'}`}>
            On your {KIND[p.kind].toLowerCase()}
            {p.text ? `: ${p.text}` : ''}
          </span>
        </a>
      ) : null}
      {c.replies.length ? (
        <ul className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-2 border-l-2 border-line-strong pl-3">
          {c.replies.map((r) => (
            <li key={r.id} className="text-[15px] leading-relaxed">
              <span className={`font-semibold ${r.mine ? 'jk-sec-ink' : ''}`}>{r.mine ? 'You' : r.who}</span> <span className="font-mono text-[12px] text-faint">{ago(r.at)}</span>
              <span className="block whitespace-pre-wrap break-words">{r.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={`font-mono text-[12.5px] ${c.answered ? 'text-muted' : 'font-semibold text-ink'}`}>{c.answered ? '✓ You replied' : c.activeAt ? 'They wrote again' : 'Not answered yet'}</span>
        <span className="ml-auto flex items-center gap-4">
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="h-9 font-semibold underline jk-sec-ink">
              Reply
            </button>
          ) : null}
          <a href={c.link} target="_blank" rel="noopener noreferrer" className="h-9 font-mono text-[13px] leading-9 text-muted underline">
            Open in {platformName(c.platform)} ↗
          </a>
        </span>
      </div>
      {open ? (
        <div className="mt-2">
          <textarea
            ref={box}
            className={`${field} min-h-[92px] py-2.5 leading-relaxed`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Reply to ${c.who}`}
            autoCapitalize="sentences"
            maxLength={max}
          />
          <p className="mt-1 text-[13px] text-faint">
            Goes under their {c.platform === 'th' ? 'reply' : 'comment'} on {platformName(c.platform)}, from {from}, as soon as you press Send.
            {c.platform === 'th' && text.length > 400 ? ` ${left} characters left.` : ''}
          </p>
          {err ? (
            <p role="alert" className="mt-2 text-[14.5px] font-semibold">
              {err}
            </p>
          ) : null}
          <div className="mt-2.5 flex gap-3">
            <button type="button" onClick={() => void send()} disabled={busy || !text.trim()} className="btn btn-primary btn-sm flex-1 disabled:opacity-50">
              {busy ? 'Sending…' : 'Send reply'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ---------- the screen ---------- */

type Filter = 'open' | 'all' | Platform;

export function SocialView({
  social,
  loading,
  onRefresh,
  onChange,
  wide,
  pinned,
}: {
  social: Social;
  loading: boolean;
  onRefresh: () => void;
  onChange: (next: Social) => void; // a reply added, a Page picked, disconnected
  wide: boolean;
  pinned: boolean; // the app's on the home screen (iPhone): the login opens in a browser window
}) {
  const d = social.data;
  const [problem, setProblem] = useState('');
  const [starting, setStarting] = useState<'meta' | 'threads' | null>(null);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [more, setMore] = useState(false);
  const [morePosts, setMorePosts] = useState(false);
  const [sure, setSure] = useState<'meta' | 'threads' | null>(null);
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // What was new when the screen opened stays marked New while it's open; the server then hears it's been seen.
  // (The screen is drawn again from scratch once the first overview arrives: key in job-kit-app.tsx.)
  const [newIds] = useState(() => new Set(newComments(social).map((x) => x.id)));
  const seenNewest = d?.comments.length ? Math.max(...d.comments.map(lastWord)) : 0;
  useEffect(() => {
    if (!seenNewest) return;
    if (seenNewest <= localSeen() && seenNewest <= (d?.seenAt ?? 0)) return;
    try {
      localStorage.setItem(SEEN_KEY, String(Math.max(seenNewest, localSeen())));
    } catch {
      /* no storage */
    }
    void post(readPin(), { action: 'seen', at: seenNewest }, API);
  }, [seenNewest, d?.seenAt]);

  const connect = async (platform: 'meta' | 'threads', again = false) => {
    setStarting(platform);
    setProblem('');
    const r = await post<{ url: string }>(readPin(), { action: 'start', platform, again }, API);
    if (!r.ok) {
      setStarting(null);
      setProblem(socialProblem(r.error, r.detail));
      return;
    }
    window.location.assign(r.data.url);
  };

  const pick = async (page: string) => {
    setProblem('');
    const r = await post(readPin(), { action: 'pick', page }, API);
    if (!r.ok) setProblem(socialProblem(r.error, r.detail));
    else onRefresh();
  };

  const disconnect = async (platform: 'meta' | 'threads') => {
    if (disarm.current) clearTimeout(disarm.current);
    if (sure !== platform) {
      setSure(platform);
      disarm.current = setTimeout(() => setSure(null), 5000);
      return;
    }
    setSure(null);
    const r = await post(readPin(), { action: 'disconnect', platform }, API);
    if (!r.ok) return setProblem(socialProblem(r.error, r.detail));
    if (!d) return;
    const gone = (x: { platform: Platform }) => (platform === 'meta' ? metaOf(x.platform) : x.platform === 'th');
    const off: SocialAccount = { setUp: true, missing: [], connected: false };
    const next: Social = {
      ...social,
      data: {
        ...d,
        ...(platform === 'meta' ? { meta: off } : { threads: off }),
        profiles: d.profiles.filter((x) => !gone(x)),
        posts: d.posts.filter((x) => !gone(x)),
        comments: d.comments.filter((x) => !gone(x)),
        problems: d.problems.filter((x) => !gone(x)),
      },
    };
    keep(next);
    onChange(next);
  };

  // answered while the screen is open: kept in 'Not answered' until the screen is left, so the reply can be seen
  const [justAnswered, setJustAnswered] = useState<Set<string>>(() => new Set());
  const reply = async (cm: SocialComment, text: string) => {
    // on Threads the reply goes under their newest word in the thread (a follow-up to Raf's answer), so it reads in order
    const to = cm.platform === 'th' ? [...cm.replies].reverse().find((x) => !x.mine)?.id ?? cm.id : cm.id;
    const r = await post<{ id: string }>(readPin(), { action: 'reply', platform: cm.platform, id: to, text }, API);
    if (!r.ok) return socialProblem(r.error, r.detail);
    setJustAnswered((s) => new Set(s).add(cm.id));
    if (d) {
      const comments = d.comments.map((x) =>
        x.id === cm.id ? { ...x, answered: true, replies: [...x.replies, { id: r.data.id || `new-${Date.now()}`, who: 'You', text, at: Date.now(), mine: true }] } : x
      );
      const next: Social = { ...social, data: { ...d, comments } };
      keep(next);
      onChange(next);
    }
    return '';
  };

  const posts = d?.posts ?? [];
  const postOf = (id: string) => posts.find((p) => p.id === id);
  const all = useMemo(() => d?.comments ?? [], [d]);
  const open = all.filter((x) => !x.answered);
  const f: Filter = filter ?? (open.length || justAnswered.size ? 'open' : 'all');
  const shownList = useMemo(() => (f === 'open' ? all.filter((x) => !x.answered || justAnswered.has(x.id)) : f === 'all' ? all : all.filter((x) => x.platform === f)), [all, f, justAnswered]);
  const SHOW = 10;
  const list = more ? shownList : shownList.slice(0, SHOW);

  const head = (
    <>
      <p className="kicker">Instagram, Facebook and Threads</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="social" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Social media
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12.5px] text-faint">
        <span>{loading ? 'Getting the latest…' : social.at ? `Updated ${ago(social.at)}` : ''}</span>
        {d || social.error ? (
          <button type="button" onClick={onRefresh} disabled={loading} className="h-8 underline disabled:opacity-50">
            Refresh
          </button>
        ) : null}
      </div>
      {social.error || problem ? (
        <p role="alert" className="mt-4 rounded-sm border border-ink bg-mount px-3.5 py-3 text-[15px] leading-relaxed">
          {problem || socialProblem(social.error, social.detail)}
        </p>
      ) : null}
    </>
  );

  if (!d) {
    return (
      <div className="pt-7">
        {head}
        {!social.error ? <p className="mt-10 text-center font-mono text-[14px] text-faint">{loading ? 'Asking Instagram, Facebook and Threads…' : 'Nothing here yet.'}</p> : null}
      </div>
    );
  }

  const meta = d.meta;
  const th = d.threads;
  const needsPage = meta.connected && !meta.page && !meta.error;
  const replyMissing = (meta.notGranted ?? []).filter((s) => s === 'instagram_manage_comments' || s === 'pages_manage_engagement' || s === 'pages_read_user_content');
  const thHandle = d.profiles.find((p) => p.platform === 'th')?.handle;
  const fromOf = (p: Platform) => (p === 'ig' ? 'your Instagram' : p === 'fb' ? 'the Page' : thHandle ? `@${thHandle}` : 'your Threads');
  const cards = [
    ...d.profiles.map((p) => <ProfileCard key={p.platform} p={p} />),
    ...(!meta.connected ? [<ConnectCard key="meta" platform="meta" acc={meta} starting={starting === 'meta'} pinned={pinned} onConnect={() => void connect('meta')} />] : []),
    ...(!th.connected ? [<ConnectCard key="threads" platform="threads" acc={th} starting={starting === 'threads'} pinned={pinned} onConnect={() => void connect('threads')} />] : []),
  ];
  const nothing = !meta.connected && !th.connected;
  const chips: [Filter, string][] = [
    ['open', `Not answered (${open.length})`],
    ['all', `All (${all.length})`],
    ...ORDER.filter((p) => all.some((x) => x.platform === p) || d.profiles.some((x) => x.platform === p)).map((p) => [p, platformName(p)] as [Filter, string]),
  ];

  const notice = (text: string, again: () => void, label: string) => (
    <div className="mt-4 rounded-sm border border-ink bg-mount px-4 py-3 text-[14.5px] leading-relaxed">
      {text}{' '}
      <button type="button" onClick={again} className="font-semibold underline jk-sec-ink">
        {label}
      </button>
    </div>
  );

  const comments = nothing ? null : (
    <section aria-labelledby="social-comments" className={wide ? '' : 'mt-7'}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="social-comments" className="font-display text-[24px] font-[680] tracking-[-0.02em]">
          Comments
        </h2>
        <span className="font-mono text-[12.5px] text-faint">on your latest posts</span>
      </div>
      <div role="group" aria-label="Show" className="mt-3 flex flex-wrap gap-1.5">
        {chips.map(([v, t]) => (
          <button
            key={v}
            type="button"
            aria-pressed={f === v}
            onClick={() => {
              setFilter(v);
              setMore(false);
            }}
            className={`h-9 rounded-sm border px-3 font-mono text-[13px] ${f === v ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount text-ink'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {list.length ? (
        <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
          {list.map((x) => (
            <CommentCard key={`${x.platform}-${x.id}`} c={x} postOf={postOf} isNew={newIds.has(x.id)} from={fromOf(x.platform)} onReply={reply} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-sm border border-line-strong bg-mount px-4 py-3.5 text-[15px] text-muted">
          {f === 'open' ? 'Every comment has a reply from you.' : all.length ? 'None here.' : 'No comments on your latest posts yet.'}
        </p>
      )}
      {shownList.length > SHOW && !more ? (
        <button type="button" onClick={() => setMore(true)} className="btn btn-ghost btn-sm mt-3 w-full">
          Show {shownList.length - SHOW} more
        </button>
      ) : null}
    </section>
  );

  const POSTS = 12;
  const latest = posts.length ? (
    <section aria-labelledby="social-posts" className={wide ? '' : 'mt-8'}>
      <h2 id="social-posts" className="font-display text-[24px] font-[680] tracking-[-0.02em]">
        Latest posts
      </h2>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {(morePosts ? posts : posts.slice(0, POSTS)).map((p) => (
          <li key={`${p.platform}-${p.id}`} className="min-w-0">
            <a href={p.link} target="_blank" rel="noopener noreferrer" className="block">
              <span className="relative block">
                {p.thumb || !p.text ? (
                  <Pic src={p.thumb} className="aspect-square w-full" />
                ) : (
                  // a thread or post with words only: its first words in the square
                  <span className="block aspect-square w-full overflow-hidden rounded-sm border border-line bg-paper px-2 pb-2 pt-8 text-[12.5px] leading-snug text-ink [overflow-wrap:anywhere]">
                    {p.text.slice(0, 160)}
                  </span>
                )}
                <span className="absolute left-1 top-1">
                  <Badge p={p.platform} />
                </span>
              </span>
              <span className="mt-1 block font-mono text-[11.5px] leading-snug text-muted">
                {p.likes !== null ? `${n(p.likes)} ♥ · ` : ''}
                {n(p.comments)} {p.platform === 'th' ? `repl${p.comments === 1 ? 'y' : 'ies'}` : `comment${p.comments === 1 ? '' : 's'}`}
              </span>
              <span className="block font-mono text-[11px] text-faint">
                {KIND[p.kind]} · {ago(p.at)}
              </span>
            </a>
          </li>
        ))}
      </ul>
      {posts.length > POSTS && !morePosts ? (
        <button type="button" onClick={() => setMorePosts(true)} className="btn btn-ghost btn-sm mt-3 w-full">
          Show {posts.length - POSTS} more
        </button>
      ) : null}
    </section>
  ) : null;

  const problemsFor = (p: Platform) => d.problems.filter((x) => x.platform === p);

  return (
    <div className="pt-7">
      {head}
      {nothing ? (
        <p className="mt-5 text-[15px] leading-relaxed text-muted">
          See your Instagram, Facebook and Threads here: followers and how they move, your latest posts, and every comment on them with a Reply box. Nothing is posted by itself: a reply only goes when
          you press Send reply.
        </p>
      ) : null}
      {meta.error === 'meta-expired' ? notice(socialProblem('meta-expired'), () => void connect('meta', true), 'Connect again') : null}
      {th.error === 'threads-expired' ? notice(socialProblem('threads-expired'), () => void connect('threads'), 'Connect Threads again') : null}
      {meta.connected && replyMissing.length && !meta.error ? (
        <div className="mt-4 rounded-sm border border-line-strong bg-mount px-4 py-3 text-[14.5px] leading-relaxed">
          Facebook wasn’t given every permission, so {replyMissing.includes('pages_read_user_content') ? 'Facebook names and ' : ''}
          some replies won’t work.{' '}
          <button type="button" onClick={() => void connect('meta', true)} className="font-semibold underline jk-sec-ink">
            Connect again
          </button>{' '}
          and leave every box ticked.
        </div>
      ) : null}
      {needsPage ? (
        <div className="mt-6 rounded-sm border border-line-strong bg-mount p-4">
          <p className="text-[17px] font-semibold">Which Page is Raf Carpentry?</p>
          <p className="mt-1.5 text-[15px] text-muted">Facebook shared {meta.pages?.length ?? 0} Pages. Pick the one whose Instagram you want here.</p>
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
            {(meta.pages ?? []).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void pick(p.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-sm border border-line-strong bg-paper px-3.5 py-2.5 text-left hover:border-ink"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block font-mono text-[12.5px] text-faint">{p.ig ? `Instagram @${p.ig}` : 'No Instagram linked'}</span>
                  </span>
                  <span aria-hidden className="jk-sec-ink">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {/* the profiles side by side (and a Connect card where one isn't connected), then the comments (beside the posts on a computer) */}
      {cards.length ? <div className={`mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 ${cards.length >= 3 ? 'lg:grid-cols-3' : ''}`}>{cards}</div> : null}
      {ORDER.flatMap((p) =>
        problemsFor(p).map((x, i) => (
          <p key={`${p}-${i}`} className="mt-3 rounded-sm border border-line-strong bg-mount px-3.5 py-3 text-[14.5px] leading-relaxed">
            {platformName(p)}: {socialProblem(x.error, x.detail)}
          </p>
        ))
      )}
      {wide && comments ? (
        <div className="mt-8 grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-8">
          <div>{latest}</div>
          {comments}
        </div>
      ) : (
        <>
          {comments}
          {latest}
        </>
      )}

      {meta.connected || th.connected ? (
        <div className="mt-8 grid gap-4 border-t border-line pt-4 font-mono text-[12.5px] leading-relaxed text-faint">
          {meta.connected ? (
            <div>
              <p>
                Instagram and Facebook: connected by {meta.who || 'you'}
                {meta.connectedAt ? ` on ${onDay(meta.connectedAt)}` : ''}
                {meta.page ? `, Page ${meta.page.name}` : ''}. Comments from the latest 12 Instagram posts and 10 Facebook posts.
              </p>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {(meta.pages?.length ?? 0) > 1 && meta.page ? (
                  <button type="button" onClick={() => onChange({ ...social, data: { ...d, meta: { ...meta, page: undefined } } })} className="h-9 underline">
                    Change Page
                  </button>
                ) : null}
                <button type="button" onClick={() => void connect('meta', true)} className="h-9 underline">
                  Connect again
                </button>
                <button type="button" onClick={() => void disconnect('meta')} className={`h-9 underline ${sure === 'meta' ? 'font-semibold text-ink' : ''}`}>
                  {sure === 'meta' ? 'Tap again to disconnect' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : null}
          {th.connected ? (
            <div>
              <p>
                Threads: connected as {th.who || 'you'}
                {th.connectedAt ? ` on ${onDay(th.connectedAt)}` : ''}. Replies on your latest 8 threads.
              </p>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                <button type="button" onClick={() => void connect('threads')} className="h-9 underline">
                  Connect again
                </button>
                <button type="button" onClick={() => void disconnect('threads')} className={`h-9 underline ${sure === 'threads' ? 'font-semibold text-ink' : ''}`}>
                  {sure === 'threads' ? 'Tap again to disconnect' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

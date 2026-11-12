'use client';
import { useSyncExternalStore } from 'react';
import { R_MARK } from '@/lib/r-logo';
import { Icon, type IconName } from './icons';
import { secClass, type SecId } from './sections';

/* The Job Kit on a computer (19 Oct 2026, Raf: 'Is there a possibility to create Desktop version of JobKit that syncs
   with current mobile one, as once i see it on desktop maybe i will come up with new ideas', then 'yes' to the layout
   first). The same app and the same screens: from 1024 px wide the sections sit down the left in their colours, a list
   (Current jobs, the Diary, the Inbox, Designs, WhatsApp chats, Posts, Job Kit jobs) stays beside what's opened from
   it, and Today, the timeline, the library and the stats get the whole width. Under 1024 px nothing changes. */

export const WIDE_QUERY = '(min-width: 1024px)';
const listenWide = (fire: () => void) => {
  const m = window.matchMedia(WIDE_QUERY);
  m.addEventListener('change', fire);
  return () => m.removeEventListener('change', fire);
};
/* A computer (or a tablet on its side): the desktop layout. */
export const useWide = () =>
  useSyncExternalStore(
    listenWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );

/* The places in the sidebar, in their sections. */
export type SideId = 'home' | 'assistant' | 'personal' | 'diary' | 'current' | 'receipt' | 'quotes' | 'cworkshop' | 'inbox' | 'whatsapp' | 'timeline' | 'board' | 'made' | 'designs' | 'library' | 'stats' | 'kit' | 'posts' | 'social' | 'settings';
/* Rafal Solutions HQ: every app's visitors, leads and whether the sites are up (its own Vercel project, rafal-hq,
   from the rafal-hq branch; signed in with the Job Kit PIN). Opened from Today's Website box and the sidebar. */
export const HQ_URL = 'https://rafal-hq.vercel.app';

const GROUPS: { sec?: SecId; label?: string; items: { id: SideId; title: string; icon?: IconName }[]; links?: { title: string; href: string; icon: IconName }[] }[] = [
  { sec: 'todo', items: [{ id: 'home', title: 'Today' }, { id: 'assistant', title: 'Assistant', icon: 'assistant' }] },
  { sec: 'personal', label: 'Personal', items: [{ id: 'personal', title: 'Personal to do', icon: 'home' }] },
  {
    sec: 'customers',
    label: 'Customers',
    items: [
      { id: 'diary', title: 'Diary', icon: 'diary' },
      { id: 'current', title: 'Current jobs', icon: 'jobs' },
      { id: 'receipt', title: 'Snap a receipt', icon: 'receipt' },
      { id: 'quotes', title: 'Quotes', icon: 'quote' },
      { id: 'cworkshop', title: 'Cworkshop', icon: 'swatch' },
      { id: 'inbox', title: 'Inbox', icon: 'mail' },
    ],
  },
  { sec: 'whatsapp', label: 'WhatsApp', items: [{ id: 'whatsapp', title: 'WhatsApp chats', icon: 'chat' }] },
  {
    sec: 'timeline',
    label: 'Job timeline',
    items: [
      { id: 'timeline', title: 'Gantt chart', icon: 'gantt' },
      { id: 'board', title: 'Clients board', icon: 'board' },
      { id: 'made', title: 'What jobs made', icon: 'made' },
    ],
  },
  {
    sec: 'designs',
    label: 'Designs in 3D',
    items: [
      { id: 'designs', title: 'Designs for customers', icon: 'designs' },
      { id: 'library', title: 'Design library', icon: 'library' },
    ],
  },
  { sec: 'website', label: 'Website', items: [{ id: 'stats', title: 'Website stats', icon: 'stats' }], links: [{ title: 'All apps in HQ', href: HQ_URL, icon: 'board' }] },
  {
    sec: 'photos',
    label: 'Photos and posts',
    items: [
      { id: 'kit', title: 'Job Kit jobs', icon: 'kit' },
      { id: 'posts', title: 'Posts', icon: 'posts' },
      { id: 'social', title: 'Social media', icon: 'social' },
    ],
  },
];

/* Which place a screen belongs to, for the highlight. */
export function sideOf(name: string, from?: string): SideId | undefined {
  if (name === 'home') return 'home';
  if (name === 'personal') return 'personal';
  if (name === 'assistant') return 'assistant';
  if (name === 'diary' || (name === 'sm8' && from === 'diary')) return 'diary';
  if (name === 'board' || (name === 'sm8' && from === 'board')) return 'board';
  if (name === 'made' || (name === 'sm8' && from === 'made')) return 'made';
  if (name === 'cworkshop') return 'cworkshop';
  if (name === 'receipt') return 'receipt';
  if (name === 'quotes' || name === 'quote-prices' || (name === 'quote' && from !== 'job')) return 'quotes';
  if (name === 'quote') return 'current';
  if (['current', 'sm8', 'customer', 'enquiry'].includes(name)) return 'current';
  if (name === 'inbox' || name === 'email') return 'inbox';
  if (name === 'whatsapp' || name === 'wa-chat') return 'whatsapp';
  if (name === 'timeline') return 'timeline';
  if (['designs', 'design', 'new-design'].includes(name)) return 'designs';
  if (name === 'library') return 'library';
  if (name === 'stats' || name === 'stats-blog' || name === 'stats-page') return 'stats';
  if (['kit', 'job', 'new'].includes(name)) return 'kit';
  if (name === 'posts' || name === 'post') return 'posts';
  if (name === 'social') return 'social';
  if (name === 'settings') return 'settings';
  return undefined;
}

export function Sidebar({ active, counts, onGo }: { active?: SideId; counts: Partial<Record<SideId, number>>; onGo: (id: SideId) => void }) {
  return (
    <aside className="jk-side" aria-label="Job Kit">
      <button type="button" onClick={() => onGo('home')} className="flex h-[59px] w-full items-center gap-2.5 border-b border-line px-4 text-left">
        <span aria-hidden className="jk-r">
          <svg viewBox={`-110 -20 ${R_MARK.w + 220} 1040`} className="h-[19px] w-[19px]">
            <path d={R_MARK.stem} className="fill-on-accent" />
            <path d={R_MARK.bowl} className="fill-on-accent" />
          </svg>
        </span>
        <span className="font-display text-[19px] font-[680] tracking-[-0.02em]">Job Kit</span>
      </button>
      <nav className="px-2.5 py-3">
        {GROUPS.map((g, i) => (
          <div key={g.label ?? i} className={`${secClass(g.sec)} ${i ? 'mt-3' : ''}`}>
            {g.label ? (
              <p className="flex items-center gap-2 px-2 pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] jk-sec-ink">
                <span aria-hidden className="jk-dot" />
                {g.label}
              </p>
            ) : null}
            <ul className="grid gap-0.5">
              {g.items.map((it) => {
                const on = active === it.id;
                const n = counts[it.id];
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => onGo(it.id)}
                      aria-current={on ? 'page' : undefined}
                      className={`jk-side-item flex h-10 w-full items-center gap-2.5 rounded-sm px-2 text-left text-[15px] ${on ? 'is-on font-semibold' : ''}`}
                    >
                      {it.icon ? <Icon name={it.icon} className="h-[19px] w-[19px] shrink-0 jk-sec-ink" /> : <span aria-hidden className="jk-dot ml-[5px] mr-[5px]" />}
                      <span className="min-w-0 flex-1 truncate">{it.title}</span>
                      {n ? <span className="jk-side-count">{n}</span> : null}
                    </button>
                  </li>
                );
              })}
              {g.links?.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener"
                    data-hq-link
                    className="jk-side-item flex h-10 w-full items-center gap-2.5 rounded-sm px-2 text-left text-[15px]"
                  >
                    <Icon name={l.icon} className="h-[19px] w-[19px] shrink-0 jk-sec-ink" />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    <span aria-hidden className="text-[14px] jk-sec-ink">↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-line px-2.5 py-3">
        <button
          type="button"
          onClick={() => onGo('settings')}
          aria-current={active === 'settings' ? 'page' : undefined}
          className={`jk-side-item flex h-10 w-full items-center rounded-sm px-2 text-left text-[15px] ${active === 'settings' ? 'is-on font-semibold' : ''}`}
        >
          Settings
        </button>
        <p className="px-2 pt-2 font-mono text-[11.5px] leading-snug text-faint">The same app as on your phone, kept in step with it, WhatsApp chats included.</p>
      </div>
    </aside>
  );
}

/* The right-hand side while only a list is open: what to pick. */
const PICK: Record<string, { icon: IconName; text: string }> = {
  current: { icon: 'jobs', text: 'Pick a job on the left: its diary, emails and texts, money and the property open here.' },
  diary: { icon: 'diary', text: 'Pick a booking on the left to open its job here.' },
  quotes: { icon: 'quote', text: 'Pick a quote on the left: the photos, what Claude read, your prices and the message to send.' },
  inbox: { icon: 'mail', text: 'Pick an email on the left. Opening one marks it read in Outlook, as on the phone.' },
  designs: { icon: 'designs', text: 'Pick a design request on the left, or start a New design.' },
  whatsapp: { icon: 'chat', text: 'Pick a chat on the left. Chats brought in on your phone show here too, their photos as small previews.' },
  posts: { icon: 'posts', text: 'Pick a post on the left. Sharing to Instagram and TikTok works best from the phone.' },
  kit: { icon: 'kit', text: 'Pick a job on the left. Photos and clips are best taken on the phone; notes and sizes type easily here.' },
};
export const LIST_SCREENS = Object.keys(PICK);

export function PickNote({ name }: { name: string }) {
  const p = PICK[name];
  if (!p) return null;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <Icon name={p.icon} className="h-12 w-12 jk-sec-ink opacity-70" />
      <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-muted">{p.text}</p>
    </div>
  );
}

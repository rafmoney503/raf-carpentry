'use client';
import { useEffect, useRef, useState } from 'react';

/* The Job Kit's main sections, each with its own colour (18 Oct 2026, Raf: 'everything looks same, can we distinguish the
   different sections with slightly different colors ... and maybe make a pop up legend to learn now and then the main
   sections colors, nothing too crazy but noticeable'). The colours live in job-kit.css (.jk-sec-<id> sets --sec and
   --sec-soft); a screen's section colours the line under the top bar, the back label and its title icon, and each box
   on Today. The colour key opens from the dots in the top bar, and by itself on the first open and twice more a week
   apart, while the colours are new. */

export type SecId = 'todo' | 'customers' | 'designs' | 'website' | 'photos';

export const SECTIONS: { id: SecId; name: string; what: string }[] = [
  { id: 'todo', name: 'To do', what: 'What needs doing now. Each line’s icon has the colour of where it takes you.' },
  { id: 'customers', name: 'Customers', what: 'Diary, Current jobs, Inbox, a customer’s jobs, emails and texts.' },
  { id: 'designs', name: 'Designs in 3D', what: 'Designs for customers and the Design library.' },
  { id: 'website', name: 'Website', what: 'Website stats and the page heatmaps.' },
  { id: 'photos', name: 'Photos and posts', what: 'Job Kit jobs (photos, clips, sizes) and posts for Instagram, TikTok and YouTube.' },
];

/* Which section a screen belongs to. */
export function secOfScreen(name: string): SecId | undefined {
  if (['diary', 'current', 'sm8', 'enquiry', 'customer', 'inbox', 'email'].includes(name)) return 'customers';
  if (['designs', 'design', 'new-design', 'library'].includes(name)) return 'designs';
  if (['stats', 'stats-page'].includes(name)) return 'website';
  if (['posts', 'post', 'job', 'new'].includes(name)) return 'photos';
  return undefined;
}

/* Which section a Today line opens. */
export const secOfLine = (go: string): SecId =>
  go === 'designs' ? 'designs' : go === 'posts' || go === 'jobs' ? 'photos' : 'customers';

export const secClass = (s?: SecId) => (s ? `jk-sec-${s}` : '');

/* ---------- the colour key ---------- */

const KEY = 'raf_jobkit_legend'; // times it was shown by itself
const AUTO_TIMES = 3;
const GAP = 7 * 864e5;

function seen(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}
function keepSeen(list: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* no storage: it just shows again next time */
  }
}

/* Shows the key by itself on the first open and twice more, a week apart. */
export function useColourKey(ready: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const list = seen();
    const last = list[list.length - 1] ?? 0;
    if (list.length < AUTO_TIMES && Date.now() - last > (list.length ? GAP : 0)) {
      keepSeen([...list, Date.now()]);
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);
  return { open, show: () => setOpen(true), hide: () => setOpen(false) };
}

/* The five dots in the top bar: tap to see what each colour means. */
export function KeyDots({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-9 shrink-0 items-center gap-[3px] rounded-sm border border-line-strong px-2" aria-label="What the colours mean">
      {SECTIONS.map((s) => (
        <span key={s.id} aria-hidden className={`jk-dot ${secClass(s.id)}`} />
      ))}
    </button>
  );
}

export function ColourKey({ onClose }: { onClose: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="jk-key-back" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="jk-key-title" className="jk-key" onClick={(e) => e.stopPropagation()}>
        <h2 id="jk-key-title" ref={title} tabIndex={-1} className="font-display text-[22px] font-[680] leading-tight tracking-[-0.02em]">
          Where things are
        </h2>
        <p className="mt-1 text-[14.5px] leading-snug text-muted">Each part of the Job Kit has its own colour, in the line at the top of every screen.</p>
        <ul className="mt-3 grid gap-1.5">
          {SECTIONS.map((s) => (
            <li key={s.id} className={`jk-key-row ${secClass(s.id)}`}>
              <span className="jk-key-swatch" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight jk-sec-ink">{s.name}</span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{s.what}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 font-mono text-[12px] leading-snug text-faint">Open this again with the coloured dots at the top.</p>
        <button type="button" onClick={onClose} className="btn btn-primary mt-3 w-full">
          Got it
        </button>
      </div>
    </div>
  );
}

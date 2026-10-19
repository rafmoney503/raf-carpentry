'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/* The Job Kit's main sections, each with its own colour (18 Oct 2026, Raf: 'everything looks same, can we distinguish the
   different sections with slightly different colors ... and maybe make a pop up legend to learn now and then the main
   sections colors, nothing too crazy but noticeable'). The colours live in job-kit.css (.jk-sec-<id> sets --sec and
   --sec-soft); a screen's section colours the line under the top bar, the back label and its title icon, and each box
   on Today. The colour key opens from the dots in the top bar, and by itself on the first open and twice more a week
   apart, while the colours are new.
   Coloured backgrounds (18 Oct 2026, Raf: 'I'd like the background to be same color as section ... in todo section
   ... backgrounds as well ... a switch so I can turn on and off the background in whole app if I get used to'): on by
   default, each screen washed in its section's colour, the Today boxes and each To do line too; the switch is in the
   colour key and in Settings (localStorage raf_jobkit_tint, '0' = off).
   Job timeline (19 Oct 2026): a sixth section, olive green, for the Gantt chart of the jobs going ahead. */

export type SecId = 'todo' | 'customers' | 'timeline' | 'designs' | 'website' | 'photos';

export const SECTIONS: { id: SecId; name: string; what: string }[] = [
  { id: 'todo', name: 'To do', what: 'What needs doing now.' },
  { id: 'customers', name: 'Customers', what: 'Diary, Current jobs, Inbox, emails and texts.' },
  { id: 'timeline', name: 'Job timeline', what: 'Start, finish and progress of each job.' },
  { id: 'designs', name: 'Designs in 3D', what: 'Designs for customers and the Design library.' },
  { id: 'website', name: 'Website', what: 'Website stats and page heatmaps.' },
  { id: 'photos', name: 'Photos and posts', what: 'Job Kit jobs and posts for social media.' },
];

/* Which section a screen belongs to. */
export function secOfScreen(name: string): SecId | undefined {
  if (['diary', 'current', 'sm8', 'enquiry', 'customer', 'inbox', 'email'].includes(name)) return 'customers';
  if (['designs', 'design', 'new-design', 'library'].includes(name)) return 'designs';
  if (name === 'timeline') return 'timeline';
  if (['stats', 'stats-page'].includes(name)) return 'website';
  if (['posts', 'post', 'job', 'new'].includes(name)) return 'photos';
  return undefined;
}

/* Which section a Today line opens. */
export const secOfLine = (go: string): SecId =>
  go === 'designs' ? 'designs' : go === 'posts' || go === 'jobs' ? 'photos' : go === 'timeline' ? 'timeline' : 'customers';

export const secClass = (s?: SecId) => (s ? `jk-sec-${s}` : '');

/* ---------- coloured backgrounds: on unless switched off ---------- */

const TINT_KEY = 'raf_jobkit_tint';
const TINT_EVENT = 'jk-tint';
const tintOn = () => {
  try {
    return localStorage.getItem(TINT_KEY) !== '0';
  } catch {
    return true; // no storage: stays on
  }
};
const tintListen = (fire: () => void) => {
  window.addEventListener(TINT_EVENT, fire);
  window.addEventListener('storage', fire);
  return () => {
    window.removeEventListener(TINT_EVENT, fire);
    window.removeEventListener('storage', fire);
  };
};
export function useTint() {
  const on = useSyncExternalStore(tintListen, tintOn, () => true);
  const set = (v: boolean) => {
    try {
      localStorage.setItem(TINT_KEY, v ? '1' : '0');
    } catch {
      /* no storage: can't be switched off */
    }
    window.dispatchEvent(new Event(TINT_EVENT));
  };
  return [on, set] as const;
}

export function TintSwitch({ on, onChange, compact }: { on: boolean; onChange: (on: boolean) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex w-full items-center justify-between gap-3 rounded-sm border border-line-strong bg-mount px-3 text-left ${compact ? 'py-2' : 'py-2.5'}`}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight">Coloured backgrounds</span>
        {compact ? null : (
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{on ? 'Each screen and To do line in its colour.' : 'Off: colour on the lines and icons only.'}</span>
        )}
      </span>
      <span aria-hidden className={`jk-switch${on ? ' on' : ''}`}>
        <span />
      </span>
    </button>
  );
}

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

/* The dots in the top bar, one per section: tap to see what each colour means. */
export function KeyDots({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-9 shrink-0 items-center gap-[3px] rounded-sm border border-line-strong px-2" aria-label="What the colours mean">
      {SECTIONS.map((s) => (
        <span key={s.id} aria-hidden className={`jk-dot ${secClass(s.id)}`} />
      ))}
    </button>
  );
}

export function ColourKey({ onClose, tint, onTint }: { onClose: () => void; tint: boolean; onTint: (on: boolean) => void }) {
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
        <div className="mt-3">
          <TintSwitch on={tint} onChange={onTint} compact />
        </div>
        <p className="mt-2.5 font-mono text-[12px] leading-snug text-faint">Open this again with the coloured dots at the top.</p>
        <button type="button" onClick={onClose} className="btn btn-primary mt-3 w-full">
          Got it
        </button>
      </div>
    </div>
  );
}

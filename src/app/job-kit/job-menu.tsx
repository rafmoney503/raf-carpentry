'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';
import { secClass, type SecId } from './sections';

/* The job screen's own menu (Raf, 3 Nov 2026: "can we make like a mini menu for the job sections so its easy to
   navigate and also distinguish the sections better"). A row of chips that sticks under the top bar once the
   customer's name has scrolled up: each section of the job with its icon, a word on what's in it ("£9,000 left",
   "22", "new") and the one being read lit up. A tap jumps there, opening a folded section (the Job diary, Property)
   on the way. The same icon heads each section, so the chip and the box it jumps to match.
   Sections join by themselves: any box on the job screen with data-jsec="<key>" is listed in screen order, with
   data-jsec-note for its word and data-jsec-alert="1" when it wants Raf (a new message, money owed). A box that
   isn't there (no money yet, no WhatsApp chat) has no chip. A fold button inside a box carries data-jsec-fold.
   Today has the same row (13 Nov 2026, Raf: 'is it a good idea to have something like in job quick buttons or tabs on
   main page of jobkit'): ChipMenu with its own attribute (data-tsec on Today's boxes, TODAY_SECS), each chip in its
   section's colour. */

export type SecKey = 'status' | 'quote' | 'whatsapp' | 'photos' | 'notes' | 'diary' | 'goodnotes' | 'property' | 'bookings' | 'emails' | 'money' | 'made' | 'more';

export const JOB_SECS: Record<SecKey, { label: string; icon: IconName }> = {
  status: { label: 'Status', icon: 'steps' },
  quote: { label: 'Quote', icon: 'quote' },
  whatsapp: { label: 'WhatsApp', icon: 'chat' },
  photos: { label: 'Photos', icon: 'kit' },
  notes: { label: 'Notes', icon: 'note' },
  diary: { label: 'Diary', icon: 'history' },
  goodnotes: { label: 'Goodnotes', icon: 'tablet' },
  property: { label: 'Property', icon: 'house' },
  bookings: { label: 'Bookings', icon: 'diary' },
  emails: { label: 'Messages', icon: 'mail' },
  money: { label: 'Money', icon: 'money' },
  made: { label: 'Made', icon: 'made' },
  more: { label: 'More', icon: 'more' },
};

/* The section's icon on a little square of graph paper, beside its title. */
export function SecIcon({ k, className = '' }: { k: SecKey; className?: string }) {
  return (
    <span aria-hidden="true" className={`jk-secicon grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-line bg-paper text-accent ${className}`}>
      <Icon name={JOB_SECS[k].icon} className="h-[19px] w-[19px]" />
    </span>
  );
}

/* Today's boxes, in the order they stand on the screen. */
export type TodayKey = 'assistant' | 'review' | 'todo' | 'personal' | 'customers' | 'whatsapp' | 'timeline' | 'designs' | 'website' | 'credit' | 'photos';
export const TODAY_SECS: Record<TodayKey, Def> = {
  assistant: { label: 'Assistant', icon: 'assistant', sec: 'todo' },
  review: { label: 'Review', icon: 'idea', sec: 'todo' },
  todo: { label: 'To do', icon: 'steps', sec: 'todo' },
  personal: { label: 'Personal', icon: 'home', sec: 'personal' },
  customers: { label: 'Customers', icon: 'person', sec: 'customers' },
  whatsapp: { label: 'WhatsApp', icon: 'chat', sec: 'whatsapp' },
  timeline: { label: 'Timeline', icon: 'gantt', sec: 'timeline' },
  designs: { label: 'Designs', icon: 'designs', sec: 'designs' },
  website: { label: 'Website', icon: 'stats', sec: 'website' },
  credit: { label: 'Credit', icon: 'money' },
  photos: { label: 'Photos', icon: 'kit', sec: 'photos' },
};

type Def = { label: string; icon: IconName; sec?: SecId };
type Item = { k: string; note: string; alert: boolean };
const same = (a: Item[], b: Item[]) => a.length === b.length && a.every((x, i) => x.k === b[i].k && x.note === b[i].note && x.alert === b[i].alert);
const sectionIn = (nav: HTMLElement | null, attr: string, k: string) => nav?.parentElement?.querySelector<HTMLElement>(`[data-${attr}="${k}"]`) ?? null;
const calm = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function JobMenu({ first }: { first: string }) {
  return <ChipMenu attr="jsec" defs={JOB_SECS} first={first} label="Sections of this job" />;
}

/* The row itself: chips for every box below it carrying data-<attr>="<key>" (with data-<attr>-note and -alert). */
export function ChipMenu({ attr, defs, first, label, className = 'mt-5' }: { attr: 'jsec' | 'tsec'; defs: Record<string, Def>; first: string; label: string; className?: string }) {
  const nav = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>('top');
  const [top, setTop] = useState(60);
  const [stuck, setStuck] = useState(false);
  const [ends, setEnds] = useState({ left: false, right: false });
  const jumping = useRef<{ k: string; until: number } | null>(null);

  const root = () => nav.current?.parentElement ?? null;
  const sectionOf = (k: string) => sectionIn(nav.current, attr, k);

  // the sections on the screen, in order, with their words
  useEffect(() => {
    const box = root();
    if (!box) return;
    const read = () => {
      const list = [...box.querySelectorAll<HTMLElement>(`[data-${attr}]`)]
        .map((el) => ({ k: el.dataset[attr] ?? '', note: el.dataset[`${attr}Note`] ?? '', alert: el.dataset[`${attr}Alert`] === '1' }))
        .filter((x, i, a) => x.k in defs && a.findIndex((y) => y.k === x.k) === i);
      setItems((prev) => (same(prev, list) ? prev : list));
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: [`data-${attr}`, `data-${attr}-note`, `data-${attr}-alert`] });
    return () => watch.disconnect();
  }, [attr, defs]);

  // where it sticks (just under the top bar, which is taller on an iPhone by its notch), and how much it covers,
  // so a jump to any box on the job (this menu's or the screen's own buttons) lands below it
  useLayoutEffect(() => {
    const measure = () => {
      const bar = document.querySelector<HTMLElement>('header.jk-top');
      const t = bar ? Math.round(bar.getBoundingClientRect().height) : 60;
      setTop(t);
      const h = nav.current?.getBoundingClientRect().height ?? 52;
      root()?.style.setProperty('--jk-stick', `${t + h}px`);
    };
    measure();
    const seen = new ResizeObserver(measure);
    const bar = document.querySelector('header.jk-top');
    if (bar) seen.observe(bar);
    if (nav.current) seen.observe(nav.current);
    window.addEventListener('resize', measure);
    return () => {
      seen.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // which box is being read: the last one whose top has gone under the menu
  useEffect(() => {
    let frame = 0;
    const look = () => {
      frame = 0;
      const n = nav.current;
      if (!n) return;
      const navBox = n.getBoundingClientRect();
      setStuck(window.scrollY > 4 && navBox.top <= top + 1);
      const j = jumping.current;
      if (j && Date.now() < j.until) return setActive(j.k);
      jumping.current = null;
      const line = navBox.bottom + 24;
      let now = 'top';
      for (const it of items) {
        const el = sectionIn(n, attr, it.k);
        if (el && el.getBoundingClientRect().top <= line) now = it.k;
      }
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (end && items.length && window.scrollY > 0) now = items[items.length - 1].k;
      setActive(now);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(look);
    };
    look();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items, top, attr]);

  // the chip being read stays in view in the row; the row's ends fade when there's more to slide to
  useEffect(() => {
    const r = row.current;
    if (!r) return;
    const chip = r.querySelector<HTMLElement>(`[data-${attr}-chip="${active}"]`);
    if (chip) {
      const pad = 44; // clear of the faded end
      if (chip.offsetLeft - pad < r.scrollLeft) r.scrollTo({ left: chip.offsetLeft - pad, behavior: calm() ? 'auto' : 'smooth' });
      else if (chip.offsetLeft + chip.offsetWidth + pad > r.scrollLeft + r.clientWidth) r.scrollTo({ left: chip.offsetLeft + chip.offsetWidth + pad - r.clientWidth, behavior: calm() ? 'auto' : 'smooth' });
    }
  }, [active, stuck, items, attr]);
  useEffect(() => {
    const r = row.current;
    if (!r) return;
    const ends = () => setEnds({ left: r.scrollLeft > 2, right: r.scrollLeft + r.clientWidth < r.scrollWidth - 2 });
    ends();
    r.addEventListener('scroll', ends, { passive: true });
    const seen = new ResizeObserver(ends);
    seen.observe(r);
    return () => {
      r.removeEventListener('scroll', ends);
      seen.disconnect();
    };
  }, [items, stuck]);

  const go = (k: string) => {
    jumping.current = { k, until: Date.now() + 900 };
    setActive(k);
    const behavior = calm() ? 'auto' : 'smooth';
    if (k === 'top') {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    const el = sectionOf(k);
    if (!el) return;
    const fold = el.querySelector<HTMLElement>(`[data-${attr}-fold][aria-expanded="false"]`);
    if (fold) fold.click();
    requestAnimationFrame(() => {
      const h = nav.current?.getBoundingClientRect().height ?? 52;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - top - h - 10), behavior });
    });
  };
  // a mouse wheel slides the row sideways (a computer has no finger to swipe it)
  const wheel = (e: React.WheelEvent) => {
    const r = row.current;
    if (!r || r.scrollWidth <= r.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    r.scrollLeft += e.deltaY;
  };
  const slide = (by: number) => row.current?.scrollBy({ left: by * Math.max(160, (row.current?.clientWidth ?? 300) * 0.6), behavior: calm() ? 'auto' : 'smooth' });

  // always there (it finds the sections from where it sits), shown once there are two to choose between
  const chip = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-[13.5px] leading-none whitespace-nowrap';
  return (
    <nav ref={nav} hidden={items.length < 2} aria-label={label} data-job-menu={attr === 'jsec' ? '' : undefined} data-today-menu={attr === 'tsec' ? '' : undefined} data-stuck={stuck ? '1' : undefined} className={`jk-jobnav sticky z-20 -mx-4 ${className}`} style={{ top }}>
      <div className="relative">
        <div ref={row} onWheel={wheel} className="jk-jobnav-row flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stuck ? (
            <button type="button" {...{ [`data-${attr}-chip`]: 'top' }} onClick={() => go('top')} className={`${chip} border-line-strong bg-mount font-semibold text-ink`} aria-label={`Back to the top: ${first}`}>
              <span aria-hidden>↑</span>
              <span className="max-w-[9ch] truncate">{first}</span>
            </button>
          ) : null}
          {items.map((it) => {
            const on = active === it.k;
            const s = defs[it.k];
            // a chip in its section's colour (Today), or the accent (the job's)
            const look = s.sec
              ? `jk-chip-sec ${secClass(s.sec)} ${on ? 'is-on' : it.alert ? 'is-alert text-ink' : 'border-line-strong bg-mount text-ink'}`
              : on
                ? 'border-accent bg-accent text-on-accent'
                : it.alert
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line-strong bg-mount text-ink';
            const ink = s.sec ? 'jk-sec-ink' : 'text-accent';
            return (
              <button key={it.k} type="button" {...{ [`data-${attr}-chip`]: it.k }} aria-current={on ? 'location' : undefined} onClick={() => go(it.k)} className={`${chip} ${look}`}>
                <Icon name={s.icon} className={`h-[17px] w-[17px] shrink-0 ${on ? '' : ink}`} />
                {s.label}
                {it.note ? <span className={`font-mono text-[11.5px] ${on ? 'opacity-85' : it.alert ? `font-semibold ${ink}` : 'text-faint'}`}>{it.note}</span> : it.alert ? <span aria-label="needs you" className={`jk-chip-dot h-2 w-2 rounded-full ${on ? 'bg-on-accent' : s.sec ? '' : 'bg-accent'}`} /> : null}
              </button>
            );
          })}
        </div>
        {ends.left ? (
          <button type="button" onClick={() => slide(-1)} aria-label="More sections to the left" className="jk-jobnav-end left-0 justify-start pl-1">
            <span aria-hidden>‹</span>
          </button>
        ) : null}
        {ends.right ? (
          <button type="button" onClick={() => slide(1)} aria-label="More sections to the right" className="jk-jobnav-end right-0 justify-end pr-1">
            <span aria-hidden>›</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}

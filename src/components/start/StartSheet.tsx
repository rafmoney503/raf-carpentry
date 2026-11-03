'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import StartProject, { PAINS, type StartPreset } from './StartProject';
import type { SketchPreset } from '../OpenSketch';

/* The floating "Start a project" button (bottom right, from the first scroll) and the sheet it opens with the seven
   questions. Buttons around the site open the same sheet (OpenSketch.tsx), sometimes with a trade or a problem
   already picked. The button steps aside while a form or the bottom band (anything marked data-hide-pill) is on
   screen, and on the /start page, which has the questions on the page itself. */

const PAIN_FROM: Record<string, string> = {
  'Writing quotes': 'Quoting',
  'Chasing payments': 'Chasing payments',
  'Booking visits and jobs': 'Booking visits',
  'Paperwork on site': 'Paperwork',
};

function toStart(p: SketchPreset): StartPreset {
  if (!p.trade && !p.pain) return {};
  const pain = p.pain ? PAIN_FROM[p.pain] : undefined;
  return {
    what: 'A system that joins my tools',
    business: 'A trade: carpenter, builder, decorator',
    pains: pain && PAINS.includes(pain) ? [pain] : [],
    note: [p.trade ? `I'm a ${p.trade.toLowerCase()}` : '', p.pain && !pain ? p.pain.toLowerCase() : ''].filter(Boolean).join(': '),
  };
}

export default function StartSheet() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pillHidden, setPillHidden] = useState(true);
  const [preset, setPreset] = useState<StartPreset>({});
  const [round, setRound] = useState(0); // a fresh set of questions each time it opens with a preset
  const [mounted, setMounted] = useState(false); // the questions stay as they were if it is closed and opened again

  const open = useCallback((p: SketchPreset = {}) => {
    const next = toStart(p);
    if (Object.keys(next).length) {
      setPreset(next);
      setRound((r) => r + 1);
    }
    setMounted(true);
    dialog.current?.showModal();
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => open((e as CustomEvent<SketchPreset>).detail ?? {});
    window.addEventListener('open-sketch', onOpen);
    return () => window.removeEventListener('open-sketch', onOpen);
  }, [open]);

  useEffect(() => {
    const onScreen = new Set<Element>();
    const update = () => setPillHidden(pathname === '/start' || window.scrollY < 480 || onScreen.size > 0);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      update();
    });
    document.querySelectorAll('[data-hide-pill]').forEach((el) => io.observe(el));
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', update);
      io.disconnect();
    };
  }, [pathname]);

  const close = () => {
    dialog.current?.close();
    setIsOpen(false);
  };

  return (
    <>
      <button type="button" className="float-pill" data-hidden={pillHidden || isOpen} onClick={() => open()} aria-haspopup="dialog">
        <span className="dot" aria-hidden="true" />
        Start a project <small>1 min</small>
      </button>

      <dialog
        ref={dialog}
        className="planner"
        aria-labelledby="start-sheet-title"
        onClose={() => setIsOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="planner-panel">
          <div className="planner-head">
            <b id="start-sheet-title">Start a project</b>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              Close
            </button>
          </div>
          <div className="planner-body">{mounted ? <StartProject key={round} preset={preset} idPrefix="ss" /> : null}</div>
        </div>
      </dialog>
    </>
  );
}

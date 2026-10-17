'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import PlannerGuide, { GuideIcon } from './planner-guide';
import './planner.css';

/* The planner's frame: view (3D or drawing) on top on phones, steps panel below; side by side from 900 px.
   planner-engine.ts fills it in and runs it. three.js loads with the engine, only on this page.
   The quick guide (planner-guide.tsx) covers the steps panel (under 900 px the 3D view too) on the first visit;
   Guide in the header brings it back. */

const GUIDE_SEEN = 'raf_wp_guide';

export default function WardrobePlanner() {
  const rootRef = useRef<HTMLDivElement>(null);
  // null until the browser has said whether the guide was seen, so neither the guide nor the steps flash.
  const [guide, setGuide] = useState<null | 'first' | 'open' | 'closed'>(null);
  const open = guide === 'first' || guide === 'open';

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    import('./planner-engine').then(({ mountPlanner }) => {
      if (!cancelled) stop = mountPlanner(root);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(GUIDE_SEEN) === '1';
    } catch {
      // storage blocked: show the guide each visit
    }
    setGuide(seen ? 'closed' : 'first');
  }, []);

  // While the guide covers the steps, the steps can't be reached by Tab or a screen reader.
  useEffect(() => {
    rootRef.current?.querySelector('.panel')?.toggleAttribute('inert', open);
  }, [open]);

  const close = useCallback(() => {
    setGuide('closed');
    try {
      localStorage.setItem(GUIDE_SEEN, '1');
    } catch {
      // nothing to keep
    }
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>('.steps [aria-selected="true"]')?.focus({ preventScroll: true }));
  }, []);

  return (
    <div className="wp" ref={rootRef}>
      <div className="wp-head">
        <h1>Wardrobe planner</h1>
        <p>Design your fitted wardrobe, then send it to me.</p>
        <button type="button" className="guide-btn" aria-expanded={open} aria-controls="wp-guide" onClick={() => (open ? close() : setGuide('open'))}>
          <GuideIcon />
          <span className="g-long">Quick guide</span>
          <span className="g-short">Guide</span>
        </button>
      </div>
      <PlannerFrame />
      <PlannerGuide open={open} first={guide === 'first'} onClose={close} />
    </div>
  );
}

/* The view and the steps panel. planner-engine.ts changes these by hand, so React renders them once and
   never again (memo with no props): opening or closing the guide doesn't touch them. */
const PlannerFrame = memo(function PlannerFrame() {
  return (
    <>
      <section className="view" aria-label="Your wardrobe">
        <div id="stage" aria-label="3D view of your wardrobe. Drag to turn it, pinch to zoom." />
        <div id="drawing" hidden />
        <div className="vtop">
          <div className="dims" id="dimsChip">2800 × 2400</div>
          <div className="seg" role="group" aria-label="View">
            <button type="button" data-view="3d" aria-pressed="true">3D</button>
            <button type="button" data-view="draw" aria-pressed="false">Drawing</button>
          </div>
        </div>
        <div className="vbot">
          <div className="fit" id="fitChip"><span id="fitText">Fits</span></div>
          <div className="vbtns">
            <button type="button" className="vbtn tog" id="offBtn" hidden aria-pressed="false">Doors off</button>
            <button type="button" className="vbtn ic" id="playBtn" hidden aria-pressed="false" aria-label="Watch each door slide" title="Watch each door slide">
              <svg className="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5z" /></svg>
              <svg className="i-stop" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5h7v7h-7z" /></svg>
            </button>
            <button type="button" className="vbtn" id="openBtn">Open doors</button>
          </div>
        </div>
        <div className="nogl" id="nogl" hidden>The 3D view needs WebGL, which this browser has turned off. The drawing view still works.</div>
      </section>

      <section className="panel">
        <nav className="steps" role="tablist" aria-label="Steps">
          <button type="button" role="tab" data-step="0" aria-selected="true"><i>1</i>Space</button>
          <button type="button" role="tab" data-step="1" aria-selected="false"><i>2</i>Units</button>
          <button type="button" role="tab" data-step="2" aria-selected="false"><i>3</i>Doors</button>
          <button type="button" role="tab" data-step="3" aria-selected="false"><i>4</i>Colour</button>
          <button type="button" role="tab" data-step="4" aria-selected="false"><i>5</i>Send</button>
        </nav>
        <div className="body" id="body" role="tabpanel" />
        <div className="foot">
          <button type="button" className="wbtn" id="backBtn">Back</button>
          <button type="button" className="wbtn primary" id="nextBtn">Next</button>
        </div>
      </section>
    </>
  );
});

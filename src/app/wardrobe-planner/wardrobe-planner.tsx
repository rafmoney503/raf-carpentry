'use client';
import { useEffect, useRef } from 'react';
import './planner.css';

/* The planner's frame: view (3D or drawing) on top on phones, steps panel below; side by side from 900 px.
   planner-engine.ts fills it in and runs it. three.js loads with the engine, only on this page. */
export default function WardrobePlanner() {
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="wp" ref={rootRef}>
      <div className="wp-head">
        <h1>Wardrobe planner</h1>
        <p>Design your fitted wardrobe, then send it to me.</p>
      </div>

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
          <button type="button" className="vbtn" id="openBtn">Open doors</button>
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
    </div>
  );
}

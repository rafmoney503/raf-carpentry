'use client';

/* A button anywhere on the page that opens the "Sketch my system" planner, optionally with a trade or a problem
   already picked. The planner (SystemSketch.tsx) listens for this event. */

export type SketchPreset = { trade?: string; pain?: string };

export const openSketch = (preset: SketchPreset = {}) => window.dispatchEvent(new CustomEvent<SketchPreset>('open-sketch', { detail: preset }));

export default function OpenSketch({ children, className, preset }: { children: React.ReactNode; className?: string; preset?: SketchPreset }) {
  return (
    <button type="button" className={className} onClick={() => openSketch(preset)}>
      {children}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { openSketch } from './OpenSketch';

/* The decorator's paint schedule, small enough to try on the page. Doors and fronts count both faces and the four
   edges (18 mm board); panels count one face. Coverage 10 m² per litre for primer, 12 for top coat (a typical tin;
   the real app reads it from the product picked). About 95% of the paint stays on the board by brush and roller,
   about 65% with an HVLP spray gun. */

const DOOR = 2 * 0.6 * 2.0 + 2 * (0.6 + 2.0) * 0.018; // 600 x 2000
const FRONT = 2 * 0.6 * 0.4 + 2 * (0.6 + 0.4) * 0.018; // 600 x 400
const EFF = { brush: 0.95, spray: 0.65 } as const;

function tins(L: number) {
  if (L <= 0) return 'nothing';
  const fives = Math.floor(L / 5);
  const rest = L - fives * 5;
  const parts: string[] = [];
  if (fives) parts.push(`${fives} × 5 L`);
  if (rest > 0.0001) {
    if (rest <= 1) parts.push('1 × 1 L');
    else if (rest <= 2) parts.push('2 × 1 L');
    else if (rest <= 2.5) parts.push('1 × 2.5 L');
    else if (rest <= 3.5) parts.push('1 × 2.5 L + 1 × 1 L');
    else parts.push('1 × 5 L');
  }
  return parts.join(' + ');
}

export default function PaintCalc() {
  const [doors, setDoors] = useState(4);
  const [fronts, setFronts] = useState(6);
  const [panels, setPanels] = useState(4);
  const [coats, setCoats] = useState(2);
  const [method, setMethod] = useState<'brush' | 'spray'>('brush');

  const area = doors * DOOR + fronts * FRONT + panels;
  const primer = area / 10 / EFF[method];
  const top = (area * coats) / 12 / EFF[method];
  const extra = (area * coats) / 12 / EFF.spray - (area * coats) / 12 / EFF.brush;
  const clamp = (v: number) => Math.max(0, Math.min(99, v));

  const rows = [
    { label: 'Tall doors', sub: '600 × 2000 mm each', value: doors, set: setDoors },
    { label: 'Drawer and cupboard fronts', sub: '600 × 400 mm each', value: fronts, set: setFronts },
    { label: 'End panels, plinths, fillers', sub: 'm², one face', value: panels, set: setPanels },
  ];

  return (
    <div className="paint">
      <div className="paint-controls">
        <h2 className="h3">Count what gets painted</h2>
        <p className="body">Doors and fronts at standard sizes; panels in square metres. Change any number and the schedule on the right follows.</p>
        <div className="counters">
          {rows.map((r) => (
            <div className="count-row" key={r.label}>
              <div>
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span className="mono small muted">{r.sub}</span>
              </div>
              <div className="stepper">
                <button type="button" aria-label={`Fewer: ${r.label}`} onClick={() => r.set(clamp(r.value - 1))}>
                  −
                </button>
                <output aria-live="polite">{r.value}</output>
                <button type="button" aria-label={`More: ${r.label}`} onClick={() => r.set(clamp(r.value + 1))}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="opt-groups">
          <div className="opt-group">
            <span>Top coats</span>
            <div className="opts">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={coats === n} onClick={() => setCoats(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="opt-group">
            <span>Method</span>
            <div className="opts">
              <button type="button" className="chip" aria-pressed={method === 'brush'} onClick={() => setMethod('brush')}>
                Brush and roller
              </button>
              <button type="button" className="chip" aria-pressed={method === 'spray'} onClick={() => setMethod('spray')}>
                Spray (HVLP)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sheet grid-paper" aria-live="polite">
        <div className="sheet-head">
          <b>Paint schedule</b>
          <span className="mono small muted">Sample: bedroom wardrobes</span>
        </div>
        <div className="row-between mono small" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span>Paintable area</span>
          <span>{area.toFixed(1)} m²</span>
        </div>
        <div className="litres">
          <div className="litre">
            <span className="small muted">Primer, 1 coat</span>
            <strong>{primer.toFixed(1)} L</strong>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              Buy {tins(primer)}
            </span>
          </div>
          <div className="litre">
            <span className="small muted">
              Top coat, {coats} {coats === 1 ? 'coat' : 'coats'}
            </span>
            <strong>
              <span className="hl">{top.toFixed(1)} L</span>
            </strong>
            <span className="mono" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              Buy {tins(top)}
            </span>
          </div>
        </div>
        <p className="small" style={{ color: 'var(--ink-2)' }}>
          {method === 'spray'
            ? `Sprayed: about 65% of the paint lands on the board, so you need ${extra.toFixed(1)} L more top coat than by brush.`
            : 'By brush and roller about 95% of the paint stays on the board. Switch to spray to see the difference.'}
        </p>
        <p className="mono" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' }}>
          Doors and fronts count both faces and edges. Coverage taken as 10 m² per litre for primer and 12 for top coat; the app reads the real figure from the tin you pick. Sizes can come straight from a CabinetOS job, so nobody measures twice.
        </p>
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openSketch({ trade: 'Decorator', pain: 'Working out materials' })}>
          I&apos;m a decorator: sketch mine
        </button>
      </div>
    </div>
  );
}

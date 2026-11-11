'use client';

import { useState } from 'react';
import { dayLetter, shortDay } from '@/lib/time';
import type { DayPoint } from '@/lib/types';

/* 15 days of one site (7 before, the last 7, today): the last 7 in its colour, the 7 before lighter. Tap a day to read it. */
export function SiteDays({ days, start, typical }: { days: DayPoint[]; start?: string; typical: number }) {
  const last = days.length - 1;
  const fromStart = start ? days.findIndex((d) => d.day === start) : -1;
  const [sel, setSel] = useState(fromStart >= 0 ? fromStart : last);
  const max = Math.max(1, ...days.map((d) => d.visitors));
  const d = days[sel];
  if (!d) return null;
  const times = typical > 0 ? d.visitors / typical : 0;
  let note = shortDay(d.day) + (sel === last ? ', today so far' : '');
  if (times >= 2.5 && d.visitors >= 20) note += ` · about ${Math.round(times)} times a normal day`;
  return (
    <section aria-label="Visitors a day" className="card">
      <div className="head">
        <h2>Visitors a day</h2>
        <span>Tap a day</span>
      </div>
      <p className="readout" aria-live="polite">
        <b>{d.visitors}</b>
        <span>{note}</span>
        <em>{d.views} page views</em>
      </p>
      <div className="daychart" style={{ height: 140, gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((x, i) => (
          <button key={x.day} type="button" aria-pressed={i === sel} aria-label={`${shortDay(x.day)}: ${x.visitors} visitors`} onClick={() => setSel(i)} style={{ height: 140 }}>
            <span
              className="top-bar"
              style={{
                height: Math.max(4, Math.round((x.visitors / max) * 132)),
                background: i >= days.length - 8 && i < last ? 'var(--app)' : i === last ? 'color-mix(in srgb, var(--app) 60%, var(--card))' : 'color-mix(in srgb, var(--app) 28%, var(--card))',
              }}
            />
          </button>
        ))}
      </div>
      <div className="daylabels" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((x, i) => (
          <span key={x.day} className={i === sel ? 'on' : undefined}>
            {dayLetter(x.day)}
          </span>
        ))}
      </div>
      <div className="key">
        <span>
          <i style={{ background: 'color-mix(in srgb, var(--app) 28%, var(--card))' }} />
          The 7 days before
        </span>
        <span>
          <i style={{ background: 'var(--app)' }} />
          Last 7 days
        </span>
        <span>
          <i style={{ background: 'color-mix(in srgb, var(--app) 60%, var(--card))' }} />
          Today
        </span>
      </div>
    </section>
  );
}

'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Magnetic from './Magnetic';

/* The home page's quote panel as a small start on the brief: tick what it is and when, and the message to me
   builds underneath (each new or changed line slides in, home-motion.css .qb-line). Get a quote then opens Plan
   your project at the brief with the same choices ticked (/how-it-works?what=...&when=...#brief; the brief reads
   them, src/app/how-it-works/brief-builder.tsx). Nothing ticked: it opens the top of Plan your project, as every
   Get a quote does. The choices are the brief's own (how-it-works.json briefWhat and briefTiming). */
export default function QuoteBrief({
  what,
  when,
  quoteHref,
  buttonLabel,
  whatsapp,
}: {
  what: string[];
  when: string[];
  quoteHref: string;
  buttonLabel: string;
  whatsapp: React.ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [timing, setTiming] = useState('');

  const toggle = (w: string) => setPicked((cur) => (cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w]));
  const lines = [picked.length ? `What: ${picked.join(' + ')}` : '', timing ? `When: ${timing}` : ''].filter(Boolean);

  const href = useMemo(() => {
    if (!picked.length && !timing) return quoteHref;
    const q = new URLSearchParams();
    picked.forEach((w) => q.append('what', w));
    if (timing) q.set('when', timing);
    return `/how-it-works?${q.toString()}#brief`;
  }, [picked, timing, quoteHref]);

  return (
    <div className="qb">
      <p className="qb-q">What is it?</p>
      <div className="qb-chips" role="group" aria-label="What is it?">
        {what.map((w) => (
          <Chip key={w} label={w} on={picked.includes(w)} onClick={() => toggle(w)} />
        ))}
      </div>
      <p className="qb-q">When?</p>
      <div className="qb-chips" role="group" aria-label="When?">
        {when.map((w) => (
          <Chip key={w} label={w} on={timing === w} onClick={() => setTiming((t) => (t === w ? '' : w))} />
        ))}
      </div>
      <div className="qb-msg" aria-live="polite">
        <p className="qb-msg-l">Your message</p>
        <p className="qb-line-static">Hi Raf, here is my brief from your website.</p>
        {lines.map((l) => (
          <p key={l} className="qb-line">
            {l}
          </p>
        ))}
        <p className="qb-line-static">I will send photos of the space next.</p>
      </div>
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Magnetic className="w-full md:w-auto">
          <Link href={href} className="btn btn-primary w-full gap-2 md:w-auto">
            {buttonLabel}
            <span aria-hidden="true">→</span>
          </Link>
        </Magnetic>
        {whatsapp}
      </div>
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`qb-chip${on ? ' qb-on' : ''}`}>
      <span className="qb-tick" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label}
    </button>
  );
}

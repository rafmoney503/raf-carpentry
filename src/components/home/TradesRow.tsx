'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { TRADES, statusClass } from '@/lib/content';

/* Home page: the trades as a row you can swipe, or step through with the arrows on a computer. Panels further from
   the middle sit back a little, so the one you are reading stands forward. */
export default function TradesRow() {
  const track = useRef<HTMLDivElement>(null);
  const target = useRef<number | null>(null);

  useEffect(() => {
    const tr = track.current;
    if (!tr) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panels = Array.from(tr.querySelectorAll<HTMLElement>('.tr-panel'));
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (target.current !== null) {
        const d = target.current - tr.scrollLeft;
        if (still || Math.abs(d) < 0.5) {
          tr.scrollLeft = target.current;
          target.current = null;
          tr.style.scrollSnapType = '';
        } else tr.scrollLeft += d * (1 - Math.exp(-dt * 7));
      }
      if (!still) {
        const r = tr.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        for (const p of panels) {
          const b = p.getBoundingClientRect();
          const k = Math.min(1, Math.abs(b.left + b.width / 2 - mid) / (r.width * 0.6));
          p.style.opacity = (1 - 0.45 * k * k).toFixed(3);
          p.style.transform = `scale(${(1 - 0.04 * k).toFixed(4)})`;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!e.isIntersecting && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    io.observe(tr);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const tr = track.current;
    const first = tr?.querySelector<HTMLElement>('.tr-panel');
    if (!tr || !first) return;
    const stepW = first.getBoundingClientRect().width + 16;
    const from = target.current ?? tr.scrollLeft;
    tr.style.scrollSnapType = 'none';
    target.current = Math.max(0, Math.min(tr.scrollWidth - tr.clientWidth, from + dir * stepW));
  };

  return (
    <section className="section tr" aria-labelledby="tr-title">
      <div className="wrap tr-head">
        <div className="tr-title">
          <p className="kicker">Who I build for</p>
          <h2 className="h2" id="tr-title">
            Trades that measure, quote and chase.
          </h2>
        </div>
        <div className="tr-arrows">
          <button type="button" aria-label="Previous trade" onClick={() => go(-1)}>
            ←
          </button>
          <button type="button" aria-label="Next trade" onClick={() => go(1)}>
            →
          </button>
        </div>
      </div>
      <div className="tr-track" ref={track}>
        {TRADES.map((t) => (
          <Link key={t.id} href={`/trades#${t.id}`} className="tr-panel">
            <span className={statusClass(t.status)}>{t.status}</span>
            <h3>{t.name}</h3>
            <p>{t.short}</p>
            <span className="link-more">
              Where the time goes <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STEPS5 } from '@/lib/steps';

/* Home page: the five steps as a staircase of cards, each with a plank in its own colour. On a computer the cards
   rise from left to right and the yellow ball hops from plank to plank: on its own every 2.6 seconds while the
   section is on screen, or straight to the card under the pointer or keyboard focus. On phones and iPads in portrait
   the cards stack and the ball rests on the plank of the card in the middle of the screen. People who ask for less
   motion see the ball move without the hop and it does not go round by itself. */

const AUTO_MS = 2600;

export default function StepsLadder() {
  const list = useRef<HTMLOListElement>(null);
  const ball = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const [hop, setHop] = useState(0);
  const held = useRef(0); // until when the pointer or focus holds the ball where it is
  const inView = useRef(false);
  const stacked = useRef(false);
  const now = useRef(0);

  const goTo = useCallback((i: number, hold = false) => {
    if (hold) held.current = performance.now() + 6000;
    if (i === now.current) return;
    now.current = i;
    setActive(i);
    setHop((h) => h + 1);
  }, []);

  // put the ball on the active card's plank
  const place = useCallback(() => {
    const ol = list.current;
    const b = ball.current;
    if (!ol || !b) return;
    const plank = ol.querySelectorAll<HTMLElement>('.stair-plank')[active];
    if (!plank) return;
    const o = ol.getBoundingClientRect();
    const p = plank.getBoundingClientRect();
    const x = p.left - o.left + p.width * (stacked.current ? 0.86 : 0.5);
    const y = p.top - o.top;
    b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }, [active]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mq = window.matchMedia('(max-width: 999px)');
    const setStacked = () => {
      stacked.current = mq.matches;
      place();
    };
    setStacked();
    mq.addEventListener('change', setStacked);
    const ro = new ResizeObserver(() => place());
    ro.observe(ol);
    const io = new IntersectionObserver(([e]) => (inView.current = e.isIntersecting), { threshold: 0.25 });
    io.observe(ol);

    // stacked: the card nearest the middle of the screen gets the ball
    const cards = Array.from(ol.querySelectorAll<HTMLElement>('.stair'));
    const mid = new IntersectionObserver(
      (entries) => {
        if (!stacked.current) return;
        for (const e of entries) if (e.isIntersecting) goTo(cards.indexOf(e.target as HTMLElement));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    cards.forEach((c) => mid.observe(c));

    let timer = 0;
    if (!still)
      timer = window.setInterval(() => {
        if (!inView.current || stacked.current || document.hidden || performance.now() < held.current) return;
        goTo((now.current + 1) % STEPS5.length);
      }, AUTO_MS);
    return () => {
      window.clearInterval(timer);
      mq.removeEventListener('change', setStacked);
      ro.disconnect();
      io.disconnect();
      mid.disconnect();
    };
  }, [goTo, place]);

  return (
    <ol className="stairs" ref={list}>
      {STEPS5.map((s, i) => {
        const inner = (
          <>
            <span className="stair-plank" aria-hidden="true" />
            <span className="stair-top">
              <span className="stair-n">
                {s.n} · {s.verb}
              </span>
              <span className="stair-badge">{s.badge}</span>
            </span>
            <h3 className="stair-name">{s.name}</h3>
            <p className="stair-line">{s.line}</p>
            <ul className="stair-points">
              {s.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <span className="stair-link">
              {s.linkLabel}
              <span aria-hidden="true">{s.external ? '↗' : '→'}</span>
              {s.external ? <span className="sr"> (opens in a new tab)</span> : null}
            </span>
          </>
        );
        return (
          <li
            key={s.id}
            id={s.id}
            className={`stair${i === active ? ' on' : ''}`}
            data-c={s.id}
            style={{ '--i': i } as React.CSSProperties}
            onPointerEnter={(e) => e.pointerType === 'mouse' && goTo(i, true)}
            onFocus={() => goTo(i, true)}
          >
            {s.external ? (
              <a href={s.href} target="_blank" rel="noopener" className="stair-card">
                {inner}
              </a>
            ) : (
              <Link href={s.href} className="stair-card">
                {inner}
              </Link>
            )}
          </li>
        );
      })}
      <li className="stairs-ball" aria-hidden="true" role="presentation">
        <span ref={ball} className="stairs-ball-pos">
          <span key={hop} className={hop ? 'hop' : undefined}>
            <i />
          </span>
        </span>
      </li>
    </ol>
  );
}

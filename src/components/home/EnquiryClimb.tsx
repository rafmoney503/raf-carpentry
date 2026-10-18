'use client';

import { useEffect, useRef, useState } from 'react';
import { FLOW } from '@/lib/content';

/* Home page: one enquiry, start to finish, as eight steps the yellow ball climbs while the page scrolls. The section
   stays pinned while you scroll through it; each step lights up as the ball lands on it and its words come up on the
   left. The first four happen by themselves, the last four take one tap from me. The ball hops one step at a time so
   it always lands on a step. Every step is also in a plain list for screen readers. People who ask for less motion
   see the ball move without the hop.
   Keep scrolling: on the first step, and whenever someone stops part way (2.2 s without scrolling, not after
   scrolling back up), the ball does small waiting hops on its step, the step it will jump to next lights up in
   yellow, and a tag in the empty corner says 'Keep scrolling' with 'step 4 of 8'. Gone at the last step. */

const SHORT = ['Brief', 'ServiceM8', 'Thank-you', 'Cut list', 'Today', 'Reply', 'Visit', 'Paid'];
const PW = 84;
const BR = 18;
const PX = (i: number) => 30 + i * 98;
const PY = (i: number) => 470 - i * 56;
const CX = (i: number) => PX(i) + PW / 2;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export default function EnquiryClimb() {
  const section = useRef<HTMLElement>(null);
  const ball = useRef<SVGGElement>(null);
  const shadow = useRef<SVGEllipseElement>(null);
  const glow = useRef<SVGEllipseElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const S = { idx: 0, cur: 0, hop: null as null | { from: number; to: number; t: number }, land: 1, txt: 1 };
    let frame = 0;
    let last = 0;
    // keep scrolling: time, when the page last moved and which way, the waiting hops
    const W = { clock: 0, movedAt: 0, lastP: -1, dir: 1, on: false, hopT: 0 };

    const place = (dt: number) => {
      const r = el.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
      const target = Math.min(FLOW.length - 1, Math.floor(p * FLOW.length * 0.999));
      W.clock += dt;
      if (Math.abs(p - W.lastP) > 0.0005) {
        if (W.lastP >= 0) W.dir = Math.sign(p - W.lastP);
        W.lastP = p;
        W.movedAt = W.clock;
      }
      const inView = r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.6;
      const wait = inView && target < FLOW.length - 1 && !S.hop && (target === 0 || (W.dir > 0 && W.clock - W.movedAt > 2.2));
      if (wait !== W.on) {
        W.on = wait;
        W.hopT = 0;
        setWaiting(wait);
      }
      if (target !== S.idx) {
        S.idx = target;
        S.txt = still ? 1 : 0;
        setIdx(target);
      }
      if (!S.hop && S.cur !== S.idx) {
        if (still) S.cur = S.idx;
        else S.hop = { from: S.cur, to: S.cur + Math.sign(S.idx - S.cur) * (Math.abs(S.idx - S.cur) > 2 ? 2 : 1), t: 0 };
      }
      let bx = CX(S.cur);
      let by = PY(S.cur);
      if (S.hop) {
        const h = S.hop;
        h.t += dt;
        const u = clamp(h.t / 0.42);
        const y0 = PY(h.from), y1 = PY(h.to);
        bx = CX(h.from) + (CX(h.to) - CX(h.from)) * u;
        by = y0 + (y1 - y0) * u - (y1 < y0 ? 70 : 40) * 4 * u * (1 - u);
        if (u >= 1) {
          S.cur = h.to;
          S.hop = null;
          S.land = 0;
        }
      }
      // waiting: a small hop on the spot every 1.3 s, as if it wants to go
      if (W.on && !S.hop && !still) {
        W.hopT += dt;
        const u = (W.hopT % 1.3) / 0.42;
        if (u < 1) by -= 16 * 4 * u * (1 - u);
        else if (u < 1.05 && S.land >= 1) S.land = 0.35;
      }
      let sq = 0;
      if (S.land < 1) {
        S.land = Math.min(1, S.land + dt / 0.35);
        sq = Math.sin(S.land * Math.PI) * 0.22 * (1 - S.land);
      }
      ball.current?.setAttribute('transform', `translate(${bx} ${by}) scale(${1 + sq * 0.5} ${1 - sq})`);
      const near = S.hop ? (Math.abs(bx - CX(S.hop.from)) < Math.abs(bx - CX(S.hop.to)) ? S.hop.from : S.hop.to) : S.cur;
      const surf = PY(near);
      shadow.current?.setAttribute('cx', String(bx));
      shadow.current?.setAttribute('cy', String(surf + 1));
      shadow.current?.setAttribute('opacity', String(Math.max(0, 1 - Math.max(0, surf - by) / 120)));
      glow.current?.setAttribute('cx', String(bx));
      glow.current?.setAttribute('cy', String(surf + 6));
      if (S.txt < 1 && words.current) {
        S.txt = Math.min(1, S.txt + dt / 0.45);
        const e = 1 - Math.pow(1 - S.txt, 3);
        words.current.style.opacity = String(e);
        words.current.style.transform = S.txt < 1 ? `translateY(${(1 - e) * 14}px)` : '';
      }
    };

    const tick = (now: number) => {
      place(Math.min(0.05, (now - last) / 1000));
      last = now;
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
    io.observe(el);
    place(0);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const s = FLOW[idx];
  return (
    <section ref={section} id="enquiry" className="ec" aria-labelledby="ec-title">
      <div className="ec-pin">
        <div className="wrap ec-grid">
          <div className="ec-copy">
            <p className="kicker">Inside one system</p>
            <h2 className="h2" id="ec-title">
              One enquiry, <span className="hl">typed once.</span>
            </h2>
            <div className="ec-who" aria-hidden="true">
              <span className={`ec-side${!s.mine ? ' on' : ''}`}>Happens by itself</span>
              <span className={`ec-side${s.mine ? ' on' : ''}`}>One tap from me</span>
            </div>
            <div className="ec-step" ref={words} aria-hidden="true">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div className="tags">
                {s.tags.map((t) => (
                  <span key={t} className="tag">
                    <span>#</span>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <ol className="sr">
              {FLOW.map((f) => (
                <li key={f.title}>
                  {f.title}. {f.text}
                </li>
              ))}
            </ol>
          </div>
          <div className="ec-art" aria-hidden="true">
            <p className={`ec-hint${waiting ? ' on' : ''}`}>
              <span className="ec-hint-arrow">
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 1.5v8.5M2.5 6.8L6 10.2l3.5-3.4" />
                </svg>
              </span>
              Keep scrolling
              <span className="ec-hint-n">
                step {Math.min(FLOW.length, idx + 2)} of {FLOW.length}
              </span>
            </p>
            <svg viewBox="0 -70 820 640">
              <defs>
                <linearGradient id="ecLit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f6f7f3" />
                  <stop offset="1" stopColor="#c9ccc6" />
                </linearGradient>
                <radialGradient id="ecBall" cx="0.36" cy="0.32" r="0.75">
                  <stop offset="0" stopColor="#fff7c7" />
                  <stop offset="0.45" stopColor="#ffe45c" />
                  <stop offset="1" stopColor="#d9b11f" />
                </radialGradient>
                <radialGradient id="ecGlow">
                  <stop offset="0" stopColor="#ffe45c" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#ffe45c" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="ecShadow">
                  <stop offset="0" stopColor="#000" stopOpacity="0.6" />
                  <stop offset="1" stopColor="#000" stopOpacity="0" />
                </radialGradient>
              </defs>
              <line x1={PX(4) - 7} x2={PX(4) - 7} y1={-40} y2={560} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 8" />
              <text x={PX(0)} y={-24} className="ec-cap">
                BY ITSELF
              </text>
              <text x={PX(4) + 6} y={-24} className="ec-cap">
                ONE TAP FROM ME
              </text>
              <ellipse ref={glow} cx={CX(0)} cy={PY(0) + 6} rx={120} ry={46} fill="url(#ecGlow)" />
              {FLOW.map((f, i) => (
                <g key={f.title}>
                  <rect
                    x={PX(i)}
                    y={PY(i)}
                    width={PW}
                    height={15}
                    rx={3}
                    fill={i <= idx ? 'url(#ecLit)' : 'rgba(255,255,255,0.05)'}
                    stroke={i <= idx ? 'none' : waiting && i === idx + 1 ? '#ffe45c' : 'rgba(255,255,255,0.2)'}
                    className={waiting && i === idx + 1 ? 'ec-next' : undefined}
                  />
                  <text x={CX(i)} y={PY(i) + 40} textAnchor="middle" className={`ec-lbl${i === idx ? ' on' : ''}`}>
                    {SHORT[i]}
                  </text>
                </g>
              ))}
              <ellipse ref={shadow} cx={CX(0)} cy={PY(0) + 1} rx={22} ry={5} fill="url(#ecShadow)" />
              <g ref={ball} transform={`translate(${CX(0)} ${PY(0)})`}>
                <circle cx={0} cy={-BR} r={BR} fill="url(#ecBall)" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { clamp01, useScrollFx } from '@/lib/use-scroll-fx';

/* "What I build" on the home page: on a computer (from 861 px) the three cards stick under the menu bar one
   after another, each a little lower than the last, and the one underneath sinks back (5% smaller, a little
   darker) as the next slides over it. --sp (0 to 1) is how far the next card has come over this one, written
   straight onto the card while it scrolls (src/lib/use-scroll-fx.ts). On phones and tablets they are a plain
   list of cards. Reduced motion: they still stick and stack, without the sinking. */
export type ServiceCard = { title: string; description: string; image: string; imageAlt: string; link?: string };

const STICK_TOP = 96; // under the 72 px menu bar
const STEP = 22; // each card sticks this much lower than the one before

export default function ServiceStack({ items }: { items: ServiceCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFx(ref, () => {
    const cards = ref.current ? [...ref.current.querySelectorAll<HTMLElement>('.sc-card')] : [];
    const wide = window.innerWidth > 860;
    cards.forEach((el, i) => {
      const next = cards[i + 1];
      let p = 0;
      if (wide && next) {
        const cur = el.getBoundingClientRect();
        p = clamp01(1 - (next.getBoundingClientRect().top - cur.top - STEP) / Math.max(1, cur.height - STEP));
      }
      el.style.setProperty('--sp', p.toFixed(3));
    });
  });

  return (
    <div ref={ref} className="sc-stack">
      {items.map((s, i) => (
        <article key={s.title} className="sc-card" style={{ '--sc-top': `${STICK_TOP + i * STEP}px` } as React.CSSProperties}>
          <div className="sc-in">
            <div className="sc-photo">
              <Image src={s.image} alt={s.imageAlt} fill sizes="(max-width: 860px) 100vw, 520px" />
            </div>
            <div className="sc-text">
              <div>
                <p className="kicker">{String(i + 1).padStart(2, '0')}</p>
                <h3>{s.link ? <Link href={s.link} className="sc-link">{s.title}</Link> : s.title}</h3>
                <p className="sc-desc">{s.description}</p>
              </div>
              {s.link ? (
                <span className="link-more sc-more" aria-hidden="true">
                  {s.title} <span>→</span>
                </span>
              ) : null}
            </div>
            <i className="sc-shade" aria-hidden="true" />
          </div>
        </article>
      ))}
    </div>
  );
}

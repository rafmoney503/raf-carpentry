'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Model3D from '@/components/project/Model3D';
import WhatsAppButton from '@/components/WhatsAppButton';
import type { Model3DInfo } from '@/lib/projects';
import { QUOTE_HREF } from '@/lib/site';

/* The Designs in 3D page: one 3D viewer at the top (only one ever runs) and every design of the kind picked
   as stills under it. Tapping a still loads it in the viewer and scrolls up to it; the address gets #<id> so a
   link opens on that design. "I'd like something like this" opens Plan your project with the job named in the
   brief (the same ?job= a job page's Get a quote uses). */

export type BrowserItem = { id: string; title: string; area: string; when: string; model: Model3DInfo; job?: string; code?: string };

const SITE = 'https://www.rafcarpentry.com';

export default function DesignBrowser({ items, heading }: { items: BrowserItem[]; heading: string }) {
  const [i, setI] = useState(0);
  const view = useRef<HTMLDivElement>(null);

  // A link with #<id> opens on that design.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const k = items.findIndex((it) => it.id === id);
    if (k > 0) setI(k);
  }, [items]);

  const cur = items[i];
  if (!cur) return null;
  const pick = (k: number) => {
    setI(k);
    history.replaceState(history.state, '', `${window.location.pathname}#${items[k].id}`);
    view.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const link = cur.job ? `${SITE}/portfolio/${cur.job}` : `${SITE}/d/${cur.code}/like`;
  const message = `Hi Raf, I'd like something like this: ${cur.title}, ${cur.area}.\n${link}\n\nMy room: `;

  return (
    <div>
      <div ref={view} id="view" className="scroll-mt-24">
        {/* key: a fresh viewer for each design, so the last one is shut down first */}
        <Model3D key={cur.model.src} src={cur.model.src} poster={cur.model.poster} label={cur.model.poster.alt} shape="gallery" skp={cur.model.skp} />
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
          <p className="text-[18px] leading-snug">
            <span className="font-[650]">{cur.title}</span>
            <span className="text-muted">, {cur.area}</span>
          </p>
          <p className="font-mono text-[12.5px] text-faint">
            {cur.when}
            {cur.model.standardSizes ? ' · drawn at standard sizes' : ''}
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {cur.job ? (
            <Link href={`${QUOTE_HREF}?job=${cur.job}`} className="btn btn-primary">
              I’d like something like this
            </Link>
          ) : null}
          <WhatsAppButton text={message} label={cur.job ? 'WhatsApp me about it' : 'I’d like something like this'} />
        </div>
        {cur.job ? (
          <p className="mt-4">
            <Link href={`/portfolio/${cur.job}`} className="link-more">
              See the finished job <span aria-hidden="true">→</span>
            </Link>
          </p>
        ) : null}
      </div>

      {items.length > 1 ? (
        <section className="mt-14 border-t border-line pt-8" aria-label={heading}>
          <h2 className="font-display text-[24px] font-[650] tracking-[-0.02em] md:text-[28px]">{heading}</h2>
          <p className="mt-1.5 text-[15px] text-muted">Tap one to see it in 3D.</p>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it, k) => {
              const on = k === i;
              return (
                <li key={it.id}>
                  <button type="button" onClick={() => pick(k)} aria-current={on ? 'true' : undefined} className="group block w-full text-left">
                    <span className={`mount block p-1.5 transition-colors ${on ? 'border-accent' : 'group-hover:border-ink'}`}>
                      <span className="relative block aspect-[4/3] overflow-hidden bg-white">
                        <Image src={it.model.poster.src} alt="" fill sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 280px" className="object-contain" />
                      </span>
                    </span>
                    <span className={`mt-2.5 block text-[15px] font-[620] leading-snug ${on ? 'text-accent' : ''}`}>{it.title}</span>
                    <span className="mt-0.5 block font-mono text-[12.5px] text-faint">{it.area}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

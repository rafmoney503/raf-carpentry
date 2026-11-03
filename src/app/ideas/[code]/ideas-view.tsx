'use client';
import { useState } from 'react';
import { ConceptDrawing } from '@/components/ConceptDrawing';
import SocialIcon from '@/components/SocialIcon';
import type { Option } from '@/lib/concept-plan';
import { PHONE_DISPLAY, PHONE_HREF, whatsappUrl } from '@/lib/site';

/* The customer's concept options: a tab each, the drawing with the doors on or off, what goes where, the rough
   price, and WhatsApp replies typed in for them. */
export default function IdeasView({
  title,
  link,
  width,
  height,
  options,
  inside,
  colour,
}: {
  title: string;
  link: string;
  width: number;
  height: number;
  options: { option: Option; price: string | null }[];
  inside: boolean;
  colour: string;
}) {
  const [i, setI] = useState(() => Math.max(0, options.findIndex((x) => x.option.pick)));
  const [view, setView] = useState<'front' | 'inside'>('front');
  const cur = options[i];
  const o = cur.option;
  const labels = o.bays.flatMap((b, bi) => b.sections.filter((s) => s.label).map((s) => ({ bay: bi + 1, text: s.label as string })));
  const named = options.length > 1 ? `option ${i + 1}, ${o.name}` : o.name;
  const like = `Hi Raf, I like ${named} for my ${title.toLowerCase()}.\n${link}`;
  const ask = `Hi Raf, a question about my ${title.toLowerCase()} ideas (${named}):\n${link}\n\n`;
  return (
    <div>
      {options.length > 1 ? (
        <div role="tablist" aria-label="Options" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {options.map((x, k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === i}
              onClick={() => setI(k)}
              className={`flex min-h-14 shrink-0 flex-col items-start justify-center rounded-sm border px-4 py-2 text-left transition-colors ${k === i ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount hover:border-ink'}`}
            >
              <span className="font-mono text-[11.5px] opacity-85">Option {k + 1}</span>
              <span className="text-[15px] font-semibold leading-tight">{x.option.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      {inside ? (
        <div className="mt-5 flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-sm border border-line-strong" role="group" aria-label="View">
            {(['front', 'inside'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`h-11 px-5 text-[15px] font-medium ${view === v ? 'bg-ink text-on-accent' : 'bg-mount'} ${v === 'inside' ? 'border-l border-line-strong' : ''}`}>
                {v === 'front' ? 'Doors closed' : 'Inside'}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="mount mt-4">
        <div className="bg-white p-2 sm:p-4">
          <ConceptDrawing option={o} width={width} height={height} view={inside ? view : 'front'} colour={colour} uid={`c${i}${view[0]}`} />
        </div>
      </div>
      <p className="mt-5 max-w-[62ch] text-[16.5px] leading-relaxed">
        <b className="font-semibold">{o.name}.</b> {o.summary}
        {o.pick && o.why && options.length > 1 ? <span className="mt-1 block text-accent">My pick: {o.why}</span> : null}
      </p>
      {labels.length ? (
        <ul className="mt-4 grid gap-1.5 border-t border-line pt-4 text-[15px] leading-snug text-muted sm:grid-cols-2">
          {labels.map((l, k) => (
            <li key={k}>
              <span className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">Section {l.bay} · </span>
              {l.text}
            </li>
          ))}
        </ul>
      ) : null}
      {cur.price ? (
        <dl className="mt-5 border-t border-line pt-5">
          <dt className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">Rough price</dt>
          <dd className="mt-0.5 font-mono text-[22px]">
            {cur.price} <span className="text-[15px] text-muted">+ VAT</span>
          </dd>
          <dd className="mt-1 text-[14px] text-muted">Supplied and fitted, ready for your decorator to paint. The written quote follows the visit.</dd>
        </dl>
      ) : null}
      <div className="mt-8 rounded-sm border border-line-strong bg-mount p-5">
        <p className="font-display text-[22px] font-[650] leading-snug tracking-[-0.02em]">What do you think?</p>
        <p className="mt-1.5 text-[15.5px] leading-relaxed text-muted">Tell me on WhatsApp which one you like, or what you’d change, and we’ll book the visit.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={whatsappUrl(like)} className="btn btn-whatsapp gap-2" target="_blank" rel="noopener">
            <SocialIcon network="whatsapp" size={20} />I like this one
          </a>
          <a href={whatsappUrl(ask)} className="btn btn-ghost" target="_blank" rel="noopener">
            Ask a question
          </a>
        </div>
        <p className="mt-4 font-mono text-[13px] text-faint">
          Or call me: <a href={PHONE_HREF} className="text-ink underline">{PHONE_DISPLAY}</a>
        </p>
      </div>
      <p className="mt-6 text-[13.5px] leading-relaxed text-faint">Concept drawings, roughly to scale. Shared privately with you; nothing is made until you sign off the final drawing.</p>
    </div>
  );
}

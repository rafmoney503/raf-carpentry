'use client';
import { useState } from 'react';
import Model3D from '@/components/project/Model3D';
import SocialIcon from '@/components/SocialIcon';
import type { DesignOption } from '@/lib/designs';
import { PHONE_DISPLAY, PHONE_HREF, whatsappUrl } from '@/lib/site';

/* The customer's design: a tab per option (when there is more than one), the same 3D viewer as the job pages
   (turn it, open the doors, take it apart, zoom, full screen), its sizes, and two ready-typed WhatsApp replies. */
export default function DesignView({ title, area, link, options }: { title: string; area: string; link: string; options: DesignOption[] }) {
  const [i, setI] = useState(0);
  const cur = options[i];
  const name = options.length > 1 ? `${title}, ${cur.name}` : title;
  const happy = `Hi Raf, I'm happy with the design: ${name} (${area}).\n${link}`;
  const change = `Hi Raf, about the design for ${title} (${area}):\n${link}\n\nI'd like to change: `;

  return (
    <div>
      {options.length > 1 ? (
        <div role="tablist" aria-label="Design options" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {options.map((o, k) => (
            <button
              key={o.name}
              type="button"
              role="tab"
              aria-selected={k === i}
              onClick={() => setI(k)}
              className={`min-h-11 shrink-0 rounded-sm border px-4 py-2 text-left text-[15px] transition-colors ${k === i ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount hover:border-ink'}`}
            >
              {o.name}
            </button>
          ))}
        </div>
      ) : null}

      {cur.text ? <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-muted">{cur.text}</p> : null}

      <div className="mt-5">
        {/* key: a fresh viewer for each option, so only one 3D view runs */}
        <Model3D key={cur.model.src} src={cur.model.src} poster={cur.model.poster} label={cur.model.poster.alt} shape={cur.model.shape ?? 'tall'} />
      </div>

      {cur.sizes?.length ? (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 sm:grid-cols-4">
          {cur.sizes.map((s) => (
            <div key={s.label}>
              <dt className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">{s.label}</dt>
              <dd className="mt-0.5 font-mono text-[16px]">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-8 rounded-sm border border-line-strong bg-mount p-5">
        <p className="font-display text-[22px] font-[650] leading-snug tracking-[-0.02em]">What do you think?</p>
        <p className="mt-1.5 text-[15.5px] leading-relaxed text-muted">Tell me on WhatsApp. If something needs changing, I’ll update the design and send you the same link again.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={whatsappUrl(happy)} className="btn btn-whatsapp gap-2" target="_blank" rel="noopener">
            <SocialIcon network="whatsapp" size={20} />
            I’m happy with it
          </a>
          <a href={whatsappUrl(change)} className="btn btn-ghost" target="_blank" rel="noopener">
            Change something
          </a>
        </div>
        <p className="mt-4 font-mono text-[13px] text-faint">
          Or call me: <a href={PHONE_HREF} className="text-ink underline">{PHONE_DISPLAY}</a>
        </p>
      </div>
    </div>
  );
}

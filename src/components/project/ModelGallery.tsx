'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Model3DInfo } from '@/lib/projects';
import Model3D from './Model3D';

/* The SketchUp page's "Real jobs, in 3D": every job that has a 3D model, one viewer at a time.
   Pick a job from the row of stills; the viewer swaps to its model (only one 3D view is ever
   running), and "See the job" goes to that job's page. The list is built from the job JSONs
   (plan.model3d or model3d), so a job that gets a model shows up here by itself.
   Also on each service page, with that service's jobs (just the viewer when there is only one). */

export type GalleryItem = { slug: string; title: string; area: string; model: Model3DInfo };

export default function ModelGallery({ items }: { items: GalleryItem[] }) {
  const [i, setI] = useState(0);
  const cur = items[i];
  if (!cur) return null;

  return (
    <div>
      {items.length > 1 ? (
        <div role="tablist" aria-label="Jobs in 3D" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
          {items.map((it, k) => {
            const on = k === i;
            return (
              <button
                key={it.slug}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="model-gallery-view"
                onClick={(e) => { setI(k); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }}
                className="group w-[46%] shrink-0 snap-start text-left sm:w-auto"
              >
                <span className={`mount block p-1.5 transition-colors ${on ? 'border-accent' : 'group-hover:border-ink'}`}>
                  <span className="relative block aspect-[4/3] overflow-hidden bg-white">
                    <Image src={it.model.poster.src} alt="" fill sizes="(max-width: 640px) 46vw, 280px" className="object-contain" />
                  </span>
                </span>
                <span className={`mt-2.5 block text-[15px] font-[620] leading-snug ${on ? 'text-accent' : ''}`}>{it.title}</span>
                <span className="mt-0.5 block font-mono text-[12.5px] text-faint">
                  {it.area}
                  {it.model.standardSizes ? ' · standard sizes' : ''}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div id="model-gallery-view" role={items.length > 1 ? 'tabpanel' : undefined} className={items.length > 1 ? 'mt-8' : undefined}>
        {/* key: a fresh viewer for each job, so the last one is shut down first */}
        <Model3D key={cur.model.src} src={cur.model.src} poster={cur.model.poster} label={cur.model.poster.alt} shape="gallery" skp={cur.model.skp} />
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-line pt-5">
          <p className="text-[17px]">
            <span className="font-[620]">{cur.title}</span>
            <span className="text-muted">, {cur.area}</span>
          </p>
          <Link href={`/portfolio/${cur.slug}`} className="link-more">
            See the job <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

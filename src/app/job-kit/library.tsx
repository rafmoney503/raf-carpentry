'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { LibraryDesign } from '@/lib/designs';
import { matches } from '@/lib/search';
import { kindsIn, kindWords, type KindCount } from '@/lib/design-kinds';
import { whatsappTo } from './designs';
import { Icon } from './icons';

/* The Design library: every 3D design so far, to send to someone who wants something similar.
   - Customer designs (content/designs, asked for behind the PIN because the codes keep the pages private) go
     as /d/<code>/like: the same 3D, labelled as a design made for a home in that area, with "I'd like
     something like this" instead of the approve button.
   - Finished jobs (every job page with a 3D model, built into the page) go as the job page at #in-3d, where the
     model sits with the photos of the real thing.
   Opened from a current job, Send goes straight to that customer's WhatsApp with their name in the message.
   A whole kind (or everything) can go as one link to the public Designs in 3D page, rafcarpentry.com/designs/<kind>,
   shown above the list for the word typed or tapped. */

export type LibraryJob = { slug: string; title: string; area: string; finished: string; poster: { src: string; w: number; h: number }; standard: boolean; words: string };
type Entry = { key: string; kind: 'design' | 'job'; title: string; area: string; when: string; sort: string; poster: { src: string; w: number; h: number }; link: string; note: string; words: string };

const SITE = 'https://www.rafcarpentry.com';
const QUICK = ['Wardrobe', 'Alcove', 'Bookcase', 'Desk', 'Seat', 'Doors', 'Panelling', 'Kitchen'];
const day = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const month = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function messageFor(e: Entry, first?: string) {
  const hi = first ? `Hi ${first}, here` : 'Here';
  return e.kind === 'design'
    ? `${hi}'s a design I drew in 3D for a home in ${e.area}: ${e.title}. You can turn it round and open the doors on your phone. Yours would be made to your own sizes.\n${e.link}`
    : `${hi}'s one I built in ${e.area}: ${e.title}. There's a 3D model you can turn round and open, and photos of the finished job on the same page.\n${e.link}`;
}

export function Library({
  designs,
  models,
  to,
  hasPin,
  kinds = [],
}: {
  designs: LibraryDesign[];
  models: LibraryJob[];
  to?: { name: string; first: string; mobile: string };
  hasPin: boolean;
  kinds?: KindCount[];
}) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'design' | 'job'>('all');
  const [copied, setCopied] = useState('');

  const all = useMemo<Entry[]>(() => {
    // One card per piece: a design that's been built shows as its finished job (with photos) instead.
    const builtFrom = new Map(designs.filter((d) => d.job).map((d) => [d.job!.slug, d]));
    const ds: Entry[] = designs.filter((d) => !(d.job && models.some((m) => m.slug === d.job!.slug))).map((d) => ({
      key: `d-${d.code}`,
      kind: 'design',
      title: d.title,
      area: d.area,
      when: day(d.made),
      sort: d.made,
      poster: d.poster,
      link: `${SITE}/d/${d.code}/like`,
      note: [d.options.length > 1 ? `${d.options.length} options` : '', d.public ? 'on the website' : ''].filter(Boolean).join(' · '),
      words: d.words,
    }));
    const js: Entry[] = models.map((m) => ({
      key: `j-${m.slug}`,
      kind: 'job',
      title: m.title,
      area: m.area,
      when: month(m.finished),
      sort: `${m.finished}-01`,
      poster: m.poster,
      link: `${SITE}/portfolio/${m.slug}#in-3d`,
      note: builtFrom.has(m.slug) ? 'designed in 3D first' : m.standard ? 'standard sizes' : '',
      words: builtFrom.has(m.slug) ? `${m.words} ${builtFrom.get(m.slug)!.words}` : m.words,
    }));
    return [...ds, ...js].sort((a, b) => b.sort.localeCompare(a.sort));
  }, [designs, models]);

  const list = all.filter((e) => (show === 'all' || e.kind === show) && matches(`${e.title} ${e.area} ${e.words}`, query));
  // The public page for what's being looked for: that kind, or everything when nothing is typed.
  const group = (() => {
    if (show === 'design') return null;
    const q = query.trim();
    const kind = q ? kinds.find((k) => kindsIn(q).some((x) => x.slug === k.slug)) : undefined;
    if (q && !kind) return null;
    const count = kind ? kind.count : models.length;
    const what = kind ? kindWords(kind) : 'designs';
    const link = `${SITE}/designs${kind ? `/${kind.slug}` : ''}`;
    const hi = to?.first ? `Hi ${to.first}, here` : 'Here';
    const text = `${hi} are ${count} ${what} I've built, all in 3D. You can turn them round and open them up on your phone. Tell me which is closest to what you'd like.\n${link}`;
    return { key: `g-${kind?.slug ?? 'all'}`, title: kind ? `All ${count} ${what} as one link` : `All ${count} job designs as one link`, link, text };
  })();
  const count = (k: 'design' | 'job') => all.filter((e) => e.kind === k).length;

  const copy = (e: Entry) => {
    const done = () => {
      setCopied(e.key);
      setTimeout(() => setCopied((c) => (c === e.key ? '' : c)), 1500);
    };
    if (navigator.clipboard) void navigator.clipboard.writeText(e.link).then(done, () => {});
  };

  return (
    <div className="pt-7">
      <h1 className="flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="library" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Design library
      </h1>
      <p className="mt-2 text-[15.5px] leading-relaxed text-muted">
        Every 3D design so far: {count('design')} made for customers and {count('job')} from finished jobs. Send one to someone who wants something similar.
      </p>
      {to ? (
        <p className="mt-4 rounded-sm border border-accent bg-accent-soft px-3.5 py-3 text-[15px] leading-relaxed">
          Sending to <span className="font-semibold">{to.name}</span>
          {to.mobile ? ': WhatsApp opens their chat with the message typed in.' : '. No mobile in ServiceM8, so pick the chat in WhatsApp.'}
        </p>
      ) : null}
      {!hasPin && !designs.length ? <p className="mt-3 font-mono text-[13px] text-faint">Add your PIN in Settings to see the designs made for customers.</p> : null}

      <label className="mt-5 block">
        <span className="sr-only">Search the designs</span>
        <input
          type="search"
          value={query}
          onChange={(x) => setQuery(x.target.value)}
          placeholder="Search: wardrobe, alcove, Finchley…"
          className="h-12 w-full rounded-sm border border-line-strong bg-mount px-3.5 text-[16px] outline-none focus:border-accent"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {QUICK.map((w) => {
          const on = query.trim().toLowerCase() === w.toLowerCase();
          return (
            <button
              key={w}
              type="button"
              aria-pressed={on}
              onClick={() => setQuery(on ? '' : w)}
              className={`h-10 shrink-0 rounded-sm border px-3 text-[14.5px] ${on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount'}`}
            >
              {w}
            </button>
          );
        })}
      </div>
      <div role="tablist" aria-label="Which designs" className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ['all', `All ${all.length}`],
            ['design', `Customers ${count('design')}`],
            ['job', `Jobs ${count('job')}`],
          ] as const
        ).map(([k, text]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={show === k}
            onClick={() => setShow(k)}
            className={`h-10 rounded-sm border text-[14px] ${show === k ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount text-muted'}`}
          >
            {text}
          </button>
        ))}
      </div>

      {group ? (
        <div className="mt-5 rounded-sm border border-accent bg-accent-soft p-3">
          <p className="text-[16px] font-semibold leading-snug">{group.title}</p>
          <p className="mt-0.5 break-all font-mono text-[12.5px] text-muted">{group.link.replace('https://www.', '')}</p>
          <div className="mt-2.5 grid grid-cols-[1.3fr_1fr_0.8fr] gap-2">
            <a href={whatsappTo(to?.mobile ?? '', group.text)} target="_blank" rel="noopener" className="btn btn-whatsapp btn-sm px-2">
              WhatsApp
            </a>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard)
                  void navigator.clipboard.writeText(group.link).then(() => {
                    setCopied(group.key);
                    setTimeout(() => setCopied((c) => (c === group.key ? '' : c)), 1500);
                  }, () => {});
              }}
              className="btn btn-ghost btn-sm bg-mount px-2"
            >
              {copied === group.key ? 'Copied' : 'Copy link'}
            </button>
            <a href={group.link} target="_blank" rel="noopener" className="btn btn-ghost btn-sm bg-mount px-2">
              Open
            </a>
          </div>
        </div>
      ) : null}

      {list.length ? (
        <ul className="mt-5 grid gap-3">
          {list.map((e) => (
            <li key={e.key} className="rounded-sm border border-line-strong bg-mount p-2.5">
              <div className="flex gap-3">
                <a href={e.link} target="_blank" rel="noopener" className="block h-[78px] w-[104px] shrink-0 overflow-hidden rounded-sm border border-line bg-raised" aria-label={`Open ${e.title}`}>
                  <Image src={e.poster.src} width={e.poster.w} height={e.poster.h} sizes="104px" alt="" className="h-full w-full object-cover" />
                </a>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="text-[16px] font-semibold leading-snug">{e.title}</p>
                  <p className="text-[14px] text-muted">
                    {e.area} · {e.when}
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-faint">
                    {e.kind === 'design' ? 'Customer design' : 'Finished job'}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-[1.3fr_1fr_0.8fr] gap-2">
                <a href={whatsappTo(to?.mobile ?? '', messageFor(e, to?.first))} target="_blank" rel="noopener" className="btn btn-whatsapp btn-sm px-2">
                  WhatsApp
                </a>
                <button type="button" onClick={() => copy(e)} className="btn btn-ghost btn-sm px-2">
                  {copied === e.key ? 'Copied' : 'Copy link'}
                </button>
                <a href={e.link} target="_blank" rel="noopener" className="btn btn-ghost btn-sm px-2">
                  Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 font-mono text-[13.5px] text-faint">{query.trim() ? `Nothing matches “${query.trim()}”.` : 'No designs here yet.'}</p>
      )}
      <p className="mt-6 text-[13.5px] leading-relaxed text-faint">
        A customer design goes as an example: the page says it was made for a home in that area (never a name or street) and asks “Something like this for you?” instead of the approve button. A finished job opens its page at the 3D model, with the photos of the real thing. A design that’s been built shows once, as its finished job.
      </p>
    </div>
  );
}

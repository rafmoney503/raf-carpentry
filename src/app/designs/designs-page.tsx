import Link from 'next/link';
import { Container, PageHeader } from '@/components/ui';
import WhatsAppButton from '@/components/WhatsAppButton';
import { kindWords } from '@/lib/design-kinds';
import { getLibraryItems, libraryKinds } from '@/lib/design-library';
import { formatMonth } from '@/lib/projects';
import { QUOTE_HREF } from '@/lib/site';
import DesignBrowser, { type BrowserItem } from './design-browser';

/* Designs in 3D: rafcarpentry.com/designs (everything) and /designs/<kind> (one kind, e.g. wardrobes).
   "What are you planning?" buttons at the top, one 3D viewer, the stills of that kind under it, and the way on:
   "I'd like something like this" into Plan your project. Every number and list comes from the job JSONs
   (src/lib/design-library.ts), so a new job with a model appears here by itself. */

export default function DesignsPage({ kind }: { kind?: string }) {
  const items = getLibraryItems();
  const kinds = libraryKinds(items);
  const k = kinds.find((x) => x.slug === kind);
  const shown = k ? items.filter((i) => i.kinds.includes(k.slug)) : items;
  const list: BrowserItem[] = shown.map((i) => ({ id: i.id, title: i.title, area: i.area, when: formatMonth(i.month), model: i.model, job: i.job, code: i.code }));
  const chip = (on: boolean) =>
    `inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-sm border px-4 text-[15px] transition-colors ${on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount hover:border-ink'}`;

  return (
    <>
      <PageHeader
        kicker="Designs in 3D"
        title={k ? `${k.label},` : 'Find something like yours,'}
        accent="in 3D."
        lede={
          k
            ? `${k.count} ${kindWords(k)} I’ve built, drawn in SketchUp. Turn one round and open it up, then tell me about your room and I’ll draw yours to your own sizes.`
            : 'Real jobs I’ve built, drawn in SketchUp. Pick what you’re planning, turn a design round and open the doors. When one is close, tell me about your room and I’ll draw yours to your own sizes.'
        }
      >
        <nav aria-label="What are you planning?" className="mt-8">
          <p className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">What are you planning?</p>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Link href="/designs" className={chip(!k)} aria-current={!k ? 'page' : undefined}>
              Everything <span className="font-mono text-[12.5px] opacity-75">{items.length}</span>
            </Link>
            {kinds.map((x) => (
              <Link key={x.slug} href={`/designs/${x.slug}`} className={chip(x.slug === k?.slug)} aria-current={x.slug === k?.slug ? 'page' : undefined}>
                {x.label} <span className="font-mono text-[12.5px] opacity-75">{x.count}</span>
              </Link>
            ))}
          </div>
        </nav>
      </PageHeader>

      <Container className="pb-16 md:pb-24">
        <DesignBrowser items={list} heading={k ? `All ${k.count} ${kindWords(k)} in 3D` : `All ${items.length} designs in 3D`} />

        <div className="mount mt-16 p-6 md:p-8">
          <p className="font-display text-[24px] font-[650] leading-snug tracking-[-0.02em] md:text-[28px]">Nothing quite like yours?</p>
          <p className="mt-2 max-w-[58ch] text-[16px] leading-relaxed text-muted">
            Every design starts from your room. Tell me what you’re planning and I’ll draw it in 3D before anything is cut, so you can turn it round and open the doors first.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={QUOTE_HREF} className="btn btn-primary">
              Get a quote
            </Link>
            <WhatsAppButton />
            {!k || k.slug === 'wardrobes' ? (
              <Link href="/wardrobe-planner" className="btn btn-ghost">
                Plan a wardrobe in 3D
              </Link>
            ) : null}
          </div>
        </div>
      </Container>
    </>
  );
}

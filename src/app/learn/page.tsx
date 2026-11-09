import Link from 'next/link';
import './learn.css';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import GuideDrawing from '@/components/learn/scenes';
import Magnetic from '@/components/Magnetic';
import WhatsAppButton from '@/components/WhatsAppButton';
import { graphPaper } from '@/app/how-it-works/sketches';
import { GUIDES, learnHref } from '@/lib/learn';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import { QUOTE_HREF, whatsappUrl } from '@/lib/site';

/* Learn: free step-by-step guides for people fixing their own homes (src/lib/learn.ts). Each guide's card plays
   one of its own drawings. */

export const metadata = pageMeta({
  title: 'Learn to fix it yourself: step-by-step guides | Raf Carpentry',
  description: 'Free guides with moving drawings for jobs round your own home: hanging heavy things on any wall, the right fixing for brick, studs and plasterboard, French cleats. From a London carpenter.',
  path: '/learn',
  ownImage: true,
});

export default function LearnPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Learn: step-by-step guides',
    url: `${SITE_URL}/learn`,
    itemListElement: GUIDES.map((g, k) => ({ '@type': 'ListItem', position: k + 1, url: `${SITE_URL}${learnHref(g)}`, name: g.title })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <PageHeader
        kicker="Learn · free guides"
        title="Fix it yourself,"
        accent="step by step."
        lede="Moving drawings act out each step, so you can see what to do before you pick up a drill."
      />

      <section className="border-t border-line">
        <Container className="py-12 md:py-16">
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2" data-guides>
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={learnHref(g)} className="group block h-full rounded-sm border border-line bg-mount p-3 transition-colors hover:border-accent md:p-4">
                  <span data-motion className="relative block aspect-[36/22] overflow-hidden rounded-sm border border-line bg-paper text-ink" style={graphPaper}>
                    <GuideDrawing slug={g.slug} step={g.hero} />
                  </span>
                  <span className="mt-4 block px-1 pb-1">
                    <span className="block font-mono text-[12px] uppercase tracking-[0.06em] text-accent">
                      {g.steps.length} steps · {g.time}
                    </span>
                    <span className="mt-2 block font-display text-[24px] font-[650] leading-[1.12] tracking-[-0.015em] text-ink transition-colors group-hover:text-accent md:text-[26px]">{g.title}</span>
                    <span className="mt-2 block text-[16px] leading-relaxed text-muted">{g.card}</span>
                    <span className="link-more mt-4 inline-block text-[15px]">
                      Start the guide <span aria-hidden="true">→</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-[60ch] text-[16px] leading-relaxed text-muted">
            Got a job round the house you’d like a guide for?{' '}
            <a href={whatsappUrl('Hi Raf, could you do a guide on ')} target="_blank" rel="noopener" className="text-accent hover:underline">
              Tell me on WhatsApp
            </a>
            . For carpenters and the trade, my{' '}
            <Link href="/tips" className="text-accent hover:underline">
              workshop tips
            </Link>{' '}
            go further.
          </p>
        </Container>
      </section>

      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <div className="max-w-[60ch]">
            <SectionHeading>Rather I do it?</SectionHeading>
            <p className="mt-4 text-muted">I build and fit wardrobes, alcove units, panelling and cabinets across London. Tell me about the room and I’ll come and measure up for a free quote.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic>
                <Link href={QUOTE_HREF} className="btn btn-primary">
                  Get a quote
                </Link>
              </Magnetic>
              <WhatsAppButton />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

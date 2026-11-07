import Link from 'next/link';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import { BOARDS, RULES } from '@/lib/decking-calc';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import DeckingCalculator from './decking-calculator';

/* The decking calculator (7 Nov 2026, Raf: "Go" to it as the first new calculator, after the search numbers:
   "decking calculator" 2,400 a month in the UK, "decking board calculator" 1,000, "composite decking calculator"
   720; then mockup A, "Drawing first"). Linked from the Tools page, the Tools menu, the footer, site search, the
   sitemap and the Camden Town decking post. Only WhatsApp floats here (LayoutShell): the page has its own
   Get a quote. */

export const metadata = pageMeta({
  title: 'Decking calculator: boards, joists, screws | Raf Carpentry',
  description: 'Free decking calculator: how many boards, joists, clips and screws your deck takes, from its size. Composite or softwood, with a plan drawn to scale.',
  path: '/tools/decking-calculator',
  ownImage: true,
});

const RULE_LINES = [
  `Boards: composite ${BOARDS.composite.w} × ${BOARDS.composite.t} in 3.6 m lengths with ${BOARDS.composite.gap} mm gaps, or softwood ${BOARDS.softwood.w} × ${BOARDS.softwood.t} in 2.4, 3.6 or 4.8 m with ${BOARDS.softwood.gap} mm gaps. It picks the length that wastes least.`,
  `Spares: ${Math.round(RULES.spare * 100)}% more boards, at least one. When boards join end to end, ${Math.round(RULES.joinWaste * 100)}% more for the offcuts.`,
  'The edge board: the last row is cut to fit. If that would leave less than half a board, the first and last are both cut instead, so you never end on a sliver.',
  `The frame: treated 47 × 100 joists at the spacing you pick, a rim joist across each end, and a row of noggins about every ${RULES.nogginEvery} m. Boards longer than one length join in one line, over a doubled joist.`,
  `Underneath: adjustable pads under each joist about every ${RULES.padEvery} m. Raised decks get 47 × 150 joists on doubled bearers and 100 × 100 posts about every ${RULES.postEvery} m.`,
  'Fixings: one hidden clip where each composite board crosses a joist, or two screws for softwood. Frame screws: four at each joist end and noggin.',
  `Finishing: fascia round the three open sides, weed membrane with ${Math.round(RULES.membraneExtra * 100)}% for overlaps, and joist tape on top of every joist.`,
  `The fall: ${RULES.fallPerMetre} mm a metre away from the house, so rain runs off.`,
];

const FAQ = [
  {
    q: 'How many decking boards do I need?',
    a: `Divide the width across the boards by one board and its gap (${BOARDS.composite.w} + ${BOARDS.composite.gap} mm for most composite boards) and round up: that's the rows. Each row takes one board when the deck is no longer than a board, more when it is. Add a spare or two. The calculator does it for you and says how wide the edge board is cut.`,
  },
  {
    q: 'What joist spacing do I need for decking?',
    a: '400 mm centres suits most boards: it’s what I used on my own deck job in Camden Town. Some hollow composite boards ask for 300, and boards laid on the diagonal need them closer, so check the board maker’s fitting sheet.',
  },
  {
    q: 'Do I need planning permission for decking?',
    a: 'For a house in England, usually not, if the deck is no more than 30 cm off the ground, covers no more than half the garden with any extensions and sheds, and isn’t in front of the house. Flats, maisonettes and listed buildings are different. Over 30 cm high, it needs planning permission. The Planning Portal has the details.',
  },
  {
    q: 'Why does a deck fall away from the house?',
    a: `So rain runs off and away from the wall instead of sitting against it. I allow about ${RULES.fallPerMetre} mm a metre, so a 3 metre deck is 15 mm lower at the front.`,
  },
  {
    q: 'Can you build it for me?',
    a: 'Yes, I build decks across London. Press Get a quote and your size is already filled in, or send me the list on WhatsApp.',
  },
];

export default function DeckingCalculatorPage() {
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Decking calculator',
      url: `${SITE_URL}/tools/decking-calculator`,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      description: 'How many decking boards, joists, clips and screws a deck takes, from its size, with a plan drawn to scale.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: `${SITE_URL}/tools/decking-calculator`,
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <PageHeader
        kicker="Free tool · decking"
        title="Decking"
        accent="calculator"
        lede="Boards, joists, clips and screws for your deck, worked out to the mm. Free, no sign-up."
        top={
          <nav aria-label="Breadcrumb" className="font-mono text-[13px] text-faint">
            <Link href="/tools" className="transition-colors hover:text-accent">
              Tools
            </Link>
            <span className="px-2 text-line-strong">/</span>
            <span>Decking calculator</span>
          </nav>
        }
      />

      <section>
        <Container className="-mt-4 pb-14 md:-mt-6 md:pb-20">
          <DeckingCalculator />
        </Container>
      </section>

      <section className="border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <div className="md:col-span-4">
            <SectionHeading>How it&apos;s worked out</SectionHeading>
            <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-muted">A carpenter&apos;s usual rules, not a board maker&apos;s. Check its fitting sheet before you buy.</p>
          </div>
          <ul className="space-y-3 border-t border-line pt-5 md:col-span-8" data-deck-rules>
            {RULE_LINES.map((t) => (
              <li key={t} className="flex gap-3 text-[16px] leading-relaxed text-muted">
                <span className="mt-[10px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <SectionHeading className="md:col-span-4">Questions</SectionHeading>
          <div className="border-t border-line md:col-span-8">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-[620] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex-none font-mono text-[20px] font-normal text-accent transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="-mt-1 max-w-[62ch] pb-6 text-[16px] leading-relaxed text-muted">
                  {f.q.startsWith('Do I need planning') ? (
                    <>
                      {f.a.replace(' The Planning Portal has the details.', '')}{' '}
                      <a href="https://www.planningportal.co.uk/permission/common-projects/decking/planning-permission" target="_blank" rel="noopener" className="text-accent hover:underline">
                        The Planning Portal has the details
                      </a>
                      .
                    </>
                  ) : f.q.startsWith('What joist') ? (
                    <>
                      400 mm centres suits most boards: it&apos;s what I used on my own{' '}
                      <Link href="/portfolio/decking-camden-town" className="text-accent hover:underline">
                        deck job in Camden Town
                      </Link>
                      . Some hollow composite boards ask for 300, and boards laid on the diagonal need them closer, so check the board maker&apos;s fitting sheet.
                    </>
                  ) : (
                    f.a
                  )}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-raised">
        <Container className="flex flex-col gap-4 py-12 md:flex-row md:items-center md:justify-between md:py-16">
          <p className="max-w-[40ch] font-display text-[24px] font-[650] leading-tight tracking-[-0.015em]">A deck I built: a walled courtyard in Camden Town, on a new frame.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/portfolio/decking-camden-town" className="link-more text-[16px]">
              See the job <span aria-hidden="true">→</span>
            </Link>
            <Link href="/designs/outdoor" className="link-more text-[16px]">
              Decks and fences in 3D <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

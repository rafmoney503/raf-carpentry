import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, SectionHeading } from '@/components/ui';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import { COMPANY, QUOTE_HREF, whatsappUrl } from '@/lib/site';
import guide from '../../../content/pages/pax-guide.json';

/* "IKEA PAX, built in", Raf's £9.99 PDF guide (Raf, 14 Nov 2026: "What digital products can we create and push for
   sale on Instagram and Threads", then "Go" to the PAX guide). The PDF is made outside this repo (it's sold, and this
   repo is public) and sold through Payhip, which takes the card and emails the download. content/pages/pax-guide.json
   holds the Payhip link: empty, the button asks on WhatsApp instead. */

const PRICE = guide.price;
const BUY = guide.buyUrl.trim();
const PAGES = guide.pages;

export const metadata: Metadata = pageMeta({
  title: 'IKEA PAX, built in: the fitting guide | Raf Carpentry',
  description: `How to make IKEA PAX wardrobes look made to measure: measure, pick the frames, make the fillers, top boxes and end panels, and fit it all. ${PAGES} pages with the sums done. ${PRICE} PDF.`,
  path: '/pax-guide',
  ownImage: true,
});

const PREVIEW = [
  { src: '/images/pax-guide/page-01-60ed4875.webp', alt: 'The guide cover: a wall of built-in PAX wardrobes' },
  { src: '/images/pax-guide/page-04-589aa262.webp', alt: 'Page 4: a drawing of the example wall with every part marked' },
  { src: '/images/pax-guide/page-08-5a2c73de.webp', alt: 'Page 8: the two PAX heights and what goes above each' },
  { src: '/images/pax-guide/page-17-a8290f0e.webp', alt: 'Page 17: scribing fillers with a school compass, and the end panels' },
];

const INSIDE = [
  'What gives flat-pack away, and the five fixes',
  'Will PAX work in your room? Five checks before you buy',
  'Where to measure, and a sheet to write it down',
  'Which frames fill your wall: the sums done for 14 walls',
  'Which height for your ceiling, and what goes above it',
  'The 75 cm frame and its doors',
  'Every part you make, with the sum for each size',
  'A full cut list for a real 2400 mm wall',
  'A blank cut list to fill in for yours',
  'Seven steps to fit it, with photos from my jobs',
  'Scribing to a wall with a school compass',
  'Ten mistakes to avoid, and a final checklist',
];

const FAQ = [
  {
    q: 'What do I get?',
    a: `A ${PAGES}-page A4 PDF. Read it on your phone in the room, or print it. Every size is in millimetres, and every drawing is to scale.`,
  },
  {
    q: 'How do I get it?',
    a: 'Pay by card, Apple Pay or Google Pay, and the download link comes by email straight away.',
  },
  {
    q: 'Do I need a workshop?',
    a: 'No. Every part you make is a straight cut in 18 mm MDF, and most board suppliers will cut your list for you. The guide shows how to scribe the last edges on site with a school compass.',
  },
  {
    q: 'Does it cover sliding doors?',
    a: "It's written for hinged doors. With IKEA's sliding doors the frames, fillers and the top still go the same way, but the door steps don't apply.",
  },
  {
    q: 'Is it made by IKEA?',
    a: "No. It's my own guide, from fitting PAX built in across London. IKEA's sizes in it are from IKEA's own pages, checked in November 2026.",
  },
  {
    q: 'Can I return it?',
    a: "It's a download, so once you've downloaded it you can't return it. If something in it is wrong or unclear, email me and I'll put it right.",
  },
  {
    q: 'Can you fit it for me?',
    a: 'In London, yes. Plan your project and send me your sizes, or your IKEA design code, and I come and measure up for free.',
  },
];

function BuyButton({ wide = false }: { wide?: boolean }) {
  if (BUY)
    return (
      <a href={BUY} className={`btn btn-primary ${wide ? 'w-full justify-center sm:w-auto' : ''}`} data-buy="pax-guide">
        Buy the guide, {PRICE}
      </a>
    );
  return (
    <a
      href={whatsappUrl(`Hi Raf, I'd like your IKEA PAX guide (${PRICE}).`)}
      className={`btn btn-primary ${wide ? 'w-full justify-center sm:w-auto' : ''}`}
      data-buy="pax-guide"
    >
      Get the guide, {PRICE}
    </a>
  );
}

export default function PaxGuidePage() {
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'IKEA PAX, built in: the fitting guide',
    description: `A ${PAGES}-page PDF guide to making IKEA PAX wardrobes look built in.`,
    image: `${SITE_URL}/images/pax-guide/page-01-60ed4875.webp`,
    brand: { '@type': 'Brand', name: 'Raf Carpentry' },
    ...(BUY ? { offers: { '@type': 'Offer', price: PRICE.replace(/[^0-9.]/g, ''), priceCurrency: 'GBP', availability: 'https://schema.org/InStock', url: `${SITE_URL}/pax-guide` } } : {}),
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${SITE_URL}/pax-guide`,
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />

      <Container className="grid grid-cols-1 items-center gap-12 pb-14 pt-10 md:pb-20 md:pt-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <p className="kicker mb-5">A fitter&apos;s guide · PDF</p>
          <h1 className="max-w-[12em] font-display text-[42px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[60px]">
            IKEA PAX, <span className="text-accent">built in.</span>
          </h1>
          <p className="mt-5 max-w-[50ch] text-pretty text-[17px] leading-relaxed text-muted md:text-[19px]">
            How to make flat-pack PAX wardrobes look made to measure: measure, pick the frames, make the parts round them and fit it all, floor to ceiling and wall to wall. The way I do it on my own jobs.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <BuyButton wide />
            <a href="#inside" className="btn btn-ghost">
              See what&apos;s inside
            </a>
          </div>
          {BUY ? null : <p className="mt-3 text-[14px] text-faint">Message me and I&apos;ll send it to you today.</p>}
          <ul className="mt-8 grid max-w-[34rem] grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-6 font-mono text-[13.5px] text-muted">
            <li>
              <span className="text-ink">{PAGES} pages</span>, A4 PDF
            </li>
            <li>
              Every size in <span className="text-ink">mm</span>
            </li>
            <li>
              A <span className="text-ink">cut list</span> for a real wall
            </li>
            <li>
              Photos from <span className="text-ink">my jobs</span>
            </li>
          </ul>
          <p className="mt-6 max-w-[48ch] text-[15px] leading-relaxed text-faint">By Raf Janczy, a London carpenter who fits IKEA PAX built in for a living.</p>
        </div>
        <div className="relative mx-auto w-full max-w-[520px] lg:col-span-6" aria-hidden="true">
          <div className="absolute right-0 top-[8%] w-[62%] rotate-[4deg] border border-line-strong bg-white shadow-[0_14px_30px_-14px_rgba(22,25,28,0.45)]">
            <Image src={PREVIEW[1].src} alt="" width={900} height={1273} sizes="320px" className="block h-auto w-full" />
          </div>
          <div className="relative w-[72%] border border-line-strong bg-white shadow-[0_18px_40px_-16px_rgba(22,25,28,0.5)]">
            <Image src={PREVIEW[0].src} alt="" width={900} height={1273} priority sizes="(max-width: 1024px) 72vw, 380px" className="block h-auto w-full" />
          </div>
        </div>
      </Container>

      <section id="inside" className="scroll-mt-4 border-t border-line">
        <Container className="grid grid-cols-1 gap-10 py-14 md:py-20 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <p className="kicker mb-4">What&apos;s inside</p>
            <SectionHeading>The whole job, in order.</SectionHeading>
            <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
              {INSIDE.map((t) => (
                <li key={t} className="flex gap-3 text-[16px] leading-snug text-muted">
                  <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:col-span-7">
            {PREVIEW.map((p) => (
              <a key={p.src} href={p.src} className="block border border-line-strong bg-white shadow-[0_10px_24px_-14px_rgba(22,25,28,0.4)] transition-transform hover:-translate-y-0.5">
                <Image src={p.src} alt={p.alt} width={900} height={1273} sizes="(max-width: 1024px) 45vw, 300px" className="block h-auto w-full" />
              </a>
            ))}
            <p className="col-span-2 font-mono text-[12.5px] text-faint">Four of the {PAGES} pages. Tap one to see it bigger.</p>
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-raised">
        <Container className="grid grid-cols-1 gap-10 py-14 md:grid-cols-2 md:gap-8 md:py-20">
          <div>
            <h2 className="font-display text-[24px] font-[650] tracking-[-0.015em]">It&apos;s for you if</h2>
            <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
              {[
                "You're buying PAX and want it to look fitted, not flat-pack",
                "You're happy with a drill, a saw and a level",
                'You want the sums done before you order a thing',
              ].map((t) => (
                <li key={t} className="flex gap-3 text-[16px] leading-snug text-muted">
                  <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-[24px] font-[650] tracking-[-0.015em]">Free first</h2>
            <p className="mt-4 border-t border-line pt-4 text-[16px] leading-relaxed text-muted">
              Not sure PAX suits your room? Read{' '}
              <Link href="/blog/ikea-pax-or-made-to-measure-wardrobe" className="text-accent hover:underline">
                PAX or made to measure
              </Link>
              ,{' '}
              <Link href="/blog/ikea-pax-height-for-your-ceiling" className="text-accent hover:underline">
                which height fits your ceiling
              </Link>{' '}
              and{' '}
              <Link href="/blog/fitting-ikea-pax-wall-to-wall" className="text-accent hover:underline">
                fitting PAX wall to wall
              </Link>
              . The free{' '}
              <a href="https://www.cabinetos.co.uk/pax-planner" className="text-accent hover:underline">
                PAX planner
              </a>{' '}
              does the sums for your wall.
            </p>
          </div>
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
                  {f.q === 'Can you fit it for me?' ? (
                    <>
                      In London, yes.{' '}
                      <Link href={QUOTE_HREF} className="text-accent hover:underline">
                        Plan your project
                      </Link>{' '}
                      and send me your sizes, or your IKEA design code, and I come and measure up for free.
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
        <Container className="flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between md:py-14">
          <div>
            <p className="font-display text-[24px] font-[650] tracking-[-0.015em]">Make your PAX look built in.</p>
            <p className="mt-1 text-[15px] text-muted">
              {PAGES} pages, the sums done, {PRICE}.
            </p>
          </div>
          <BuyButton />
        </Container>
        <Container className="pb-10">
          <p className="font-mono text-[12px] leading-relaxed text-faint">
            IKEA and PAX are trademarks of Inter IKEA Systems B.V. This guide is not made by or connected with IKEA. {COMPANY.name} · Company no. {COMPANY.number}
          </p>
        </Container>
      </section>
    </>
  );
}

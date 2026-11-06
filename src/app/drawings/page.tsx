import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, SectionHeading } from '@/components/ui';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import { COMPANY, QUOTE_HREF } from '@/lib/site';
import { FREE_ROUNDS, INCLUDED_UNITS, PACK, PACKS, WORKING_DAYS, gbp, packPrices } from '@/lib/drawings-service';
import DrawingsOrder from './drawings-order';
import Examples from './examples';

/* Drawings and cut lists, done for you (Raf, 6 Nov 2026: "making drawings, design, cutlist, 3d drawings and assembly
   as an online remote service which should be paid in advance ... a proper page in rafcarpentry", prices and promises
   agreed the same evening). For people building their own furniture, and trades who want a job drawn. The order goes
   to ServiceM8 and the payment through Stripe (src/lib/drawings-order.ts). */

export const metadata: Metadata = pageMeta({
  title: 'Furniture drawings and cut lists, done for you | Raf Carpentry',
  description: `Send your sizes, a sketch and photos. Within ${WORKING_DAYS} working days you get the drawings, 3D views, cut list, board layout and assembly guide, ready to cut. From ${gbp(packPrices('cutlist').total)}.`,
  path: '/drawings',
  ownImage: true,
});

const STEPS = [
  { t: 'Send it', d: 'Your sizes, a sketch and a few photos of the space. Pick a pack.' },
  { t: 'Pay by card', d: 'The full price, upfront. Card, Apple Pay or Google Pay.' },
  { t: 'I draw it', d: `If anything's unclear, I email you first. The files come by email within ${WORKING_DAYS} working days.` },
  { t: 'Check, then cut', d: `Up to ${FREE_ROUNDS} rounds of changes are free. Check every size against your room before you cut.` },
];

const DRAW = [
  'Fitted wardrobes, including loft ones under a slope',
  'Alcove units and bookcases',
  'Chests of drawers and bedside tables',
  'TV units and wall cupboards',
  'Hinged doors, shaker or flat, and drawers on runners',
];
const DONT = ['Kitchens', 'Staircases, windows and doors in frames', "Site visits: I draw it to the sizes you send me"];

const FAQ = [
  {
    q: 'What do I need to send?',
    a: 'The sizes of the space and of each unit in millimetres, a sketch (a photo of a drawing on paper is fine) and photos of the walls, skirting, ceiling and sockets. A PDF, a SketchUp file or a DWG works too.',
  },
  {
    q: 'How long does it take?',
    a: `Within ${WORKING_DAYS} working days of your order, once I have everything I need. If something is unclear, I email you the same day you order or the next working day.`,
  },
  {
    q: 'What counts as a round of changes?',
    a: `One list of changes to the same design: a size, a shelf moved, drawers instead of a rail. You get up to ${FREE_ROUNDS} rounds free. A different piece of furniture is a new order.`,
  },
  {
    q: 'What files do I get?',
    a: 'PDFs you can print or open on your phone, and the cut list as a spreadsheet your cutting company can take as it is. The Design pack adds a link to a 3D view you can turn and open.',
  },
  {
    q: 'Who is responsible if a size is wrong?',
    a: 'I draw every part to the sizes you send and check them against each other. You check them against your room before cutting, because the cut is your call. If I get a size wrong against what you sent me, I fix it free.',
  },
  {
    q: 'Can I cancel?',
    a: "Email me before I start and I'll refund you in full. Once I've sent you the files, there's no refund: you agreed to that when you ordered, so I can start straight away.",
  },
  {
    q: 'Do you work outside London?',
    a: 'Yes. It all happens by email, so it works anywhere. Sizes are in millimetres, and the board layout uses 2440 × 1220 sheets unless you tell me yours.',
  },
  {
    q: 'Do the prices include VAT?',
    a: `Yes, the big figure includes UK VAT at 20%. The price before VAT is next to it, and your receipt shows both.`,
  },
  {
    q: 'Can you build it as well?',
    a: 'In London, yes. Plan your project and send me the brief, and I come and measure up for free.',
  },
];

/* A pencil sketch like the ones people send: drawn here, not a photo. */
function Sketch() {
  const pencil = { fill: 'none', stroke: '#3f4347', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 240 280" className="block h-auto w-full" aria-hidden="true">
      <rect width="240" height="280" fill="#fffef8" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1="0" x2="240" y1={22 + i * 20} y2={22 + i * 20} stroke="#cfdcef" strokeWidth="1" />
      ))}
      <line x1="30" x2="30" y1="0" y2="280" stroke="#f1b8b8" strokeWidth="1" />
      <path {...pencil} d="M62 52 L178 50 L180 236 L60 238 Z" />
      <path {...pencil} d="M120 51 L121 237" />
      <path {...pencil} d="M61 190 L179 188" />
      <path {...pencil} d="M61 213 L179 212" />
      <path {...pencil} d="M70 70 L112 70" strokeWidth="1.6" />
      <path {...pencil} d="M113 134 L113 150 M128 134 L128 150" />
      <path {...pencil} d="M60 254 L180 252 M60 248 L60 260 M180 246 L180 258" strokeWidth="1.4" />
      <text x="104" y="273" fontFamily="var(--font-mono), monospace" fontSize="14" fill="#3f4347">1100</text>
      <path {...pencil} d="M196 50 L198 238 M190 50 L202 50 M192 238 L204 238" strokeWidth="1.4" />
      <text x="206" y="128" fontFamily="var(--font-mono), monospace" fontSize="14" fill="#3f4347" transform="rotate(90 206 128)">2400</text>
      <text x="72" y="86" fontFamily="var(--font-mono), monospace" fontSize="11" fill="#3f4347">rail</text>
      <text x="126" y="205" fontFamily="var(--font-mono), monospace" fontSize="11" fill="#3f4347">3 drw</text>
    </svg>
  );
}

export default function DrawingsPage() {
  const from = gbp(packPrices('cutlist').total);
  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Furniture drawings and cut lists',
    serviceType: 'Furniture design drawings and cut lists',
    url: `${SITE_URL}/drawings`,
    provider: { '@id': `${SITE_URL}/#business` },
    areaServed: 'Worldwide',
    offers: PACKS.map((p) => ({
      '@type': 'Offer',
      name: PACK[p].name,
      price: (packPrices(p).total / 100).toFixed(2),
      priceCurrency: 'GBP',
      description: `Up to ${INCLUDED_UNITS} units, VAT included`,
    })),
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${SITE_URL}/drawings`,
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(serviceLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />

      {/* Hero: what you send, what you get */}
      <Container className="grid grid-cols-1 items-center gap-12 pb-14 pt-10 md:pb-20 md:pt-16 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <p className="kicker mb-5">Drawings and cut lists, done for you</p>
          <h1 className="max-w-[14em] font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[58px]">
            Send me your sizes. <span className="text-accent">Get everything to build it.</span>
          </h1>
          <p className="mt-5 max-w-[52ch] text-pretty text-[17px] leading-relaxed text-muted md:text-[19px]">
            I draw your furniture and send back the drawings, 3D views, cut list, board layout and assembly guide, ready for your cutting company.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#order" className="btn btn-primary">
              Order drawings
            </a>
            <a href="#what" className="btn btn-ghost">
              See what you get
            </a>
          </div>
          <ul className="mt-8 grid max-w-[34rem] grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-6 font-mono text-[13.5px] text-muted">
            <li>
              From <span className="text-ink">{from}</span> with VAT
            </li>
            <li>
              Files in <span className="text-ink">{WORKING_DAYS} working days</span>
            </li>
            <li>
              <span className="text-ink">{FREE_ROUNDS} rounds</span> of changes free
            </li>
            <li>
              Paid <span className="text-ink">upfront</span> by card
            </li>
          </ul>
          <p className="mt-6 max-w-[48ch] text-[15px] leading-relaxed text-faint">Drawn by me, Raf, a London carpenter who builds fitted furniture for a living.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:col-span-6" aria-hidden="true">
          <div className="mount ml-[16%]">
            <div className="relative aspect-[1600/1667] bg-white">
              <Image src="/images/drawings/whole-job-326649ff.webp" alt="" fill priority sizes="(max-width: 1024px) 80vw, 460px" className="object-contain" />
            </div>
          </div>
          <div className="absolute left-0 top-[14%] w-[34%] -rotate-[5deg] overflow-hidden rounded-sm border border-line-strong shadow-[0_14px_30px_-14px_rgba(22,25,28,0.45)]">
            <Sketch />
          </div>
        </div>
      </Container>

      {/* What you get */}
      <section id="what" className="scroll-mt-4 border-t border-line">
        <Container className="py-14 md:py-20">
          <p className="kicker mb-4">What you get</p>
          <SectionHeading className="max-w-[18em]">Real files from an example job.</SectionHeading>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-muted md:text-[17px]">
            A bedroom: two wardrobes, a chest of drawers and a bedside table, 3100 mm wide. Yours come the same way, for your sizes. Tap any of them to see it full size.
          </p>
          <div className="mt-10">
            <Examples />
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <SectionHeading>How it works</SectionHeading>
          <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-sm border border-line bg-mount p-6">
                <span className="font-mono text-[13px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-display text-[21px] font-[650] tracking-[-0.015em]">{s.t}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <DrawingsOrder />

      {/* What I draw */}
      <section className="border-t border-line">
        <Container className="grid grid-cols-1 gap-10 py-14 md:grid-cols-2 md:gap-8 md:py-20">
          <div>
            <h2 className="font-display text-[24px] font-[650] tracking-[-0.015em]">What I draw</h2>
            <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
              {DRAW.map((t) => (
                <li key={t} className="flex gap-3 text-[16px] leading-snug text-muted">
                  <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-[24px] font-[650] tracking-[-0.015em]">What I don&apos;t</h2>
            <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
              {DONT.map((t) => (
                <li key={t} className="flex gap-3 text-[16px] leading-snug text-muted">
                  <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-line-strong" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Questions */}
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
                  {f.q === 'Can you build it as well?' ? (
                    <>
                      In London, yes. <Link href={QUOTE_HREF} className="text-accent hover:underline">Plan your project</Link> and send me the brief, and I come and measure up for free.
                    </>
                  ) : f.q === 'What do I need to send?' ? (
                    <>
                      {f.a} <Link href="/tips#measure-skirting-to-skirting" className="text-accent hover:underline">How I measure an alcove</Link>.
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
            <p className="font-display text-[24px] font-[650] tracking-[-0.015em]">Ready when you are.</p>
            <p className="mt-1 text-[15px] text-muted">
              From {from} with VAT, files within {WORKING_DAYS} working days.
            </p>
          </div>
          <a href="#order" className="btn btn-primary">
            Order drawings
          </a>
        </Container>
        <Container className="pb-10">
          <p className="font-mono text-[12px] leading-relaxed text-faint">
            {COMPANY.name} · Company no. {COMPANY.number} · VAT no. {COMPANY.vat} · {COMPANY.office}
          </p>
        </Container>
      </section>
    </>
  );
}

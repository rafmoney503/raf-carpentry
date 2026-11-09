import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../learn.css';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import GuidePlayer from '@/components/learn/GuidePlayer';
import GuideDrawing from '@/components/learn/scenes';
import Magnetic from '@/components/Magnetic';
import WhatsAppButton from '@/components/WhatsAppButton';
import { graphPaper } from '@/app/how-it-works/sketches';
import { affiliateLinks, isAmazonLink } from '@/lib/affiliates';
import { GUIDES, guideBySlug, learnHref, type LearnItem } from '@/lib/learn';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import { QUOTE_HREF, whatsappText } from '@/lib/site';

/* One Learn guide (src/lib/learn.ts): the answer first, the steps acted out one at a time (GuidePlayer), the
   fixing for each wall where the guide has one, what you need with Raf's Amazon links once he has confirmed them in
   his sheet, what to be careful of, questions, and "Rather I do it?". HowTo, FAQPage and BreadcrumbList for search. */

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return {};
  return pageMeta({ title: g.metaTitle, description: g.metaDescription, path: learnHref(g), type: 'article', ownImage: true });
}

/* the link for a thing to buy: a page of this site, or Raf's Amazon link once it's confirmed */
function linkOf(it: LearnItem) {
  if (it.href) return { href: it.href, label: 'How to fix to your wall', shop: false, external: false };
  const a = it.key ? affiliateLinks[it.key] : undefined;
  if (!a || !a.url || a.url === '#') return null;
  return { href: a.url, label: a.name, shop: isAmazonLink(a.url), external: /^https?:/.test(a.url) };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = guideBySlug(slug);
  if (!g) notFound();
  const href = learnHref(g);
  const links = g.need.map(linkOf);
  const hasShop = links.some((l) => l?.shop);
  const others = GUIDES.filter((o) => o.slug !== g.slug);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: g.title,
      description: g.answer,
      totalTime: g.totalTime,
      url: `${SITE_URL}${href}`,
      tool: g.need.map((it) => ({ '@type': 'HowToTool', name: it.name })),
      step: g.steps.map((s, k) => ({
        '@type': 'HowToStep',
        position: k + 1,
        name: s.title,
        text: [s.body, s.tip].filter(Boolean).join(' '),
        url: `${SITE_URL}${href}#step-${k + 1}`,
      })),
      author: { '@type': 'Person', name: 'Rafal Janczy', url: `${SITE_URL}/about` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      url: `${SITE_URL}${href}`,
      mainEntity: g.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SITE_URL}/learn` },
        { '@type': 'ListItem', position: 3, name: g.title, item: `${SITE_URL}${href}` },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <PageHeader kicker={g.kicker} title={g.title} lede={g.answer}>
        <div className="mt-7 flex flex-wrap items-center gap-2 font-mono text-[13px] text-muted" data-guide-facts>
          <span className="inline-flex h-9 items-center rounded-sm border border-line-strong px-3">{g.steps.length} steps</span>
          <span className="inline-flex h-9 items-center rounded-sm border border-line-strong px-3">{g.time}</span>
          <span className="inline-flex h-9 items-center rounded-sm border border-line-strong px-3">Moving drawings</span>
          <a href="#steps" className="link-more ml-1 font-sans text-[15px]">
            Start <span aria-hidden="true">↓</span>
          </a>
        </div>
      </PageHeader>

      <section id="steps" className="scroll-mt-20 border-t border-line">
        <Container className="py-10 md:py-14">
          <GuidePlayer slug={g.slug} steps={g.steps} />
        </Container>
      </section>

      {g.table ? (
        <section id="fixings" className="border-t border-line">
          <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
            <div className="md:col-span-4">
              <SectionHeading>{g.table.title}</SectionHeading>
              <p className="mt-4 max-w-[34ch] text-[16px] leading-relaxed text-muted">{g.table.intro}</p>
            </div>
            <div className="md:col-span-8">
              <div className="hidden grid-cols-[1.1fr_1.2fr_1.3fr] gap-4 border-b border-line-strong pb-3 font-mono text-[12px] uppercase tracking-[0.06em] text-faint md:grid">
                {g.table.head.map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              <ul data-fixings>
                {g.table.rows.map(([wall, fixing, good]) => (
                  <li key={wall} className="grid grid-cols-1 gap-1 border-b border-line py-4 md:grid-cols-[1.1fr_1.2fr_1.3fr] md:gap-4">
                    <span className="font-semibold text-ink">{wall}</span>
                    <span className="text-[15.5px] text-ink">
                      <span className="mr-1.5 font-mono text-[12px] uppercase tracking-[0.06em] text-faint md:hidden">{g.table!.head[1]}:</span>
                      {fixing}
                    </span>
                    <span className="text-[15.5px] text-muted">{good}</span>
                  </li>
                ))}
              </ul>
              {others.some((o) => o.slug === 'french-cleat') ? (
                <p className="mt-5 max-w-[60ch] text-[15.5px] leading-relaxed text-muted">
                  Something heavy where the studs aren’t where you need them? Fix a timber batten across two studs first, or hang it on a{' '}
                  <Link href="/learn/french-cleat" className="text-accent hover:underline">
                    French cleat
                  </Link>{' '}
                  screwed into every stud it crosses.
                </p>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      <section id="need" className="border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <SectionHeading className="md:col-span-4">What you need</SectionHeading>
          <div className="md:col-span-8">
            <ul className="border-t border-line" data-need>
              {g.need.map((it, k) => {
                const l = links[k];
                return (
                  <li key={it.name} className="flex flex-col gap-1 border-b border-line py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{it.name}</span>
                      {it.note ? <span className="block text-[15px] leading-relaxed text-muted">{it.note}</span> : null}
                    </span>
                    {l ? (
                      l.external ? (
                        <a href={l.href} target="_blank" rel={l.shop ? 'sponsored nofollow noopener' : 'noopener'} className="flex-none text-[15px] font-semibold text-accent hover:underline" data-shop={l.shop ? '' : undefined}>
                          {l.shop ? `The one I use: ${l.label}` : l.label}
                          <span className="ml-2 whitespace-nowrap font-mono text-[12.5px] font-normal text-faint">
                            {l.shop ? 'on Amazon ' : ''}
                            <span aria-hidden="true">↗</span>
                          </span>
                        </a>
                      ) : (
                        <Link href={l.href} className="link-more flex-none text-[15px]">
                          {l.label} <span aria-hidden="true">→</span>
                        </Link>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {hasShop ? (
              <p className="mt-5 max-w-[64ch] border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">
                Links marked Amazon are affiliate links: I earn a small commission if you buy through them, at no extra cost to you. As an Amazon Associate I earn from qualifying purchases.
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      <section id="careful" className="border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <SectionHeading className="md:col-span-4">Be careful</SectionHeading>
          <ul className="space-y-3 border-t border-line pt-5 md:col-span-8">
            {g.careful.map((t) => (
              <li key={t} className="flex gap-3 text-[16px] leading-relaxed text-ink">
                <span className="mt-[9px] h-2 w-2 flex-none rotate-45 bg-accent" aria-hidden="true" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="questions" className="border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <SectionHeading className="md:col-span-4">Questions</SectionHeading>
          <div className="border-t border-line md:col-span-8">
            {g.faq.map((f) => (
              <details key={f.q} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-[620] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="flex-none font-mono text-[20px] font-normal text-accent transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="-mt-1 max-w-[62ch] pb-6 text-[16px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <div className="max-w-[60ch]">
            <SectionHeading>Rather I do it?</SectionHeading>
            <p className="mt-4 text-muted">I fit cabinets, shelves, panelling and fitted furniture across London, fixed properly into whatever your walls are. Tell me about the room and I’ll come and measure up for a free quote.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Magnetic>
                <Link href={QUOTE_HREF} className="btn btn-primary">
                  Get a quote
                </Link>
              </Magnetic>
              <WhatsAppButton text={whatsappText(href, g.title)} />
            </div>
          </div>

          {others.length ? (
            <div className="mt-14 border-t border-line-strong pt-8">
              <p className="font-mono text-[13px] text-faint">More guides</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {others.map((o) => (
                  <li key={o.slug}>
                    <Link href={learnHref(o)} className="group flex items-center gap-4 rounded-sm border border-line bg-mount p-3 transition-colors hover:border-accent">
                      <span data-motion className="relative block aspect-[36/22] w-28 flex-none overflow-hidden rounded-sm border border-line bg-paper text-ink sm:w-36" style={graphPaper}>
                        <GuideDrawing slug={o.slug} step={o.hero} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-semibold leading-snug text-ink transition-colors group-hover:text-accent">{o.title}</span>
                        <span className="mt-1 block font-mono text-[12px] text-faint">
                          {o.steps.length} steps · {o.time.toLowerCase()}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/learn" className="link-more mt-5 inline-block text-[15px]">
                All guides <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : null}
        </Container>
      </section>
    </>
  );
}

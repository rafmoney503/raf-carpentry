import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import { COST_JOBS, costJob, fromPrice } from '@/lib/cost-calculator';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import CostCalculator from '../cost-calculator';

/* One page per job (Raf, 1 Nov 2026: a cost calculator for his own jobs, his own prices), each made for its own
   search ("fitted wardrobes cost", "loft boarding cost" ...). The sums and the words are in src/lib/cost-calculator.ts. */

export const dynamicParams = false;

export function generateStaticParams() {
  return COST_JOBS.map((j) => ({ slug: j.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = costJob(slug);
  if (!job) return {};
  return pageMeta({ title: job.metaTitle, description: job.metaDescription, path: `/cost/${job.slug}` });
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default async function CostJobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = costJob(slug);
  if (!job) notFound();
  const others = COST_JOBS.filter((j) => j.slug !== job.slug);
  const faq = [
    {
      question: 'Is this a quote?',
      answer: `No, it's a guide from my own prices for ${lower(job.name)} in London. Send it to me and I'll come and measure up for free, then send you a written quote.`,
    },
    {
      question: 'Why is it a range?',
      answer: `The low end is my price for a straightforward job. ${job.moves.map(lower).join(', ').replace(/^./, (m) => m.toUpperCase())}: that kind of thing takes it towards the top.`,
    },
    { question: 'Does the price include VAT?', answer: 'Yes, the big figure includes VAT at 20%. The price before VAT is just under it.' },
    { question: 'Where do you work?', answer: "Across London. Where I work shows every area I've done jobs in." },
  ];
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${SITE_URL}/cost/${job.slug}`,
    mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      <PageHeader
        kicker="Cost calculator"
        title={job.h1}
        accent="in London"
        lede={job.lede}
        top={
          <Link href="/cost" className="font-mono text-[13.5px] text-faint hover:text-accent">
            <span aria-hidden="true">← </span>All seven jobs
          </Link>
        }
      />

      <section>
        <Container className="pb-14 md:pb-20">
          <CostCalculator slug={job.slug} />
        </Container>
      </section>

      {/* What the price covers */}
      <section className="border-t border-line">
        <Container className="grid grid-cols-1 gap-10 py-14 md:grid-cols-3 md:gap-8 md:py-20">
          {[
            { title: "What's in the price", items: job.inPrice },
            { title: 'Not in the price', items: job.notInPrice },
            { title: 'What takes it to the top', items: job.moves },
          ].map((col) => (
            <div key={col.title}>
              <h2 className="font-display text-[22px] font-[650] tracking-[-0.015em]">{col.title}</h2>
              <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
                {col.items.map((t) => (
                  <li key={t} className="flex gap-3 text-[16px] leading-snug text-muted">
                    <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
      </section>

      {/* Questions */}
      <section className="border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <SectionHeading className="md:col-span-4">Questions</SectionHeading>
          <div className="border-t border-line md:col-span-8">
            {faq.map((q) => (
              <details key={q.question} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-[620] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  {q.question}
                  <span className="flex-none font-mono text-[20px] font-normal text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="-mt-1 max-w-[62ch] pb-6 text-[16px] leading-relaxed text-muted">
                  {q.question === 'Where do you work?' ? (
                    <>
                      Across London. <Link href="/areas" className="text-accent hover:underline">Where I work</Link> shows every area I&apos;ve done jobs in.
                    </>
                  ) : (
                    q.answer
                  )}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* The other jobs, and the service page */}
      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          {job.service ? (
            <Link href={`/services/${job.service}`} className="link-more text-[16px]">
              See my {lower(job.name)} jobs <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <nav aria-label="Other prices" className={job.service ? 'mt-10 border-t border-line-strong pt-6' : ''}>
            <p className="font-mono text-[13px] text-faint">Prices for other jobs</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/cost/${o.slug}`} className="inline-flex min-h-10 items-center gap-2 rounded-sm border border-line-strong bg-mount px-4 py-2 text-[14.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent">
                    {o.name}
                    <span className="font-mono text-[12.5px] font-normal text-faint">from {fromPrice(o)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>
    </>
  );
}

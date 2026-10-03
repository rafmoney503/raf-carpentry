import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import WhatsAppButton from '@/components/WhatsAppButton';
import Reviews, { GoogleRating } from '@/components/Reviews';
import { formatMonth } from '@/lib/projects';
import { QUOTE_HREF, whatsappText } from '@/lib/site';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import { areasFor, getService, getServices, getServicesData, joinAreas, jobsFor } from '@/lib/services';
import ProjectGallery from '@/components/project/ProjectGallery';
import '@/app/portfolio/project.css';

export function generateStaticParams() {
  return getServices().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return pageMeta({ title: s.metaTitle, description: s.metaDescription, path: `/services/${s.slug}`, ownImage: true });
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();
  const d = getServicesData();
  const jobs = jobsFor(s);
  const areas = areasFor(jobs);
  const others = getServices().filter((x) => x.slug !== s.slug);
  const waText = whatsappText(`/services/${s.slug}`, s.name);
  const photos = s.photos ?? [];

  const serviceLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.metaDescription,
    url: `${SITE_URL}/services/${s.slug}`,
    areaServed: { '@type': 'City', name: 'London' },
    provider: { '@id': `${SITE_URL}/#business` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(serviceLd)} />
      <PageHeader kicker="Services" title={`${s.name},`} accent={s.titleAccent} lede={s.intro}>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link>
          <WhatsAppButton text={waText} />
        </div>
        <GoogleRating variant="inline" className="mt-6" />
      </PageHeader>

      {/* What you get */}
      <section className="border-t border-line">
        <Container className="py-12 md:py-16">
          <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            {s.points.map((pt, i) => (
              <div key={i} className="border-t-2 border-line-strong py-5 first:border-accent">
                <dt className="text-[18px] font-[620] text-ink">{pt.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{pt.description}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* The jobs */}
      {jobs.length ? (
        <section id="jobs" className="scroll-mt-20 border-t border-line">
          <Container className="py-14 md:py-20">
            <div className="max-w-[62ch]">
              <SectionHeading>{jobs.length === 1 ? 'One job like this' : `${jobs.length} jobs like this`}</SectionHeading>
              {areas.length ? <p className="mt-4 text-[16px] leading-relaxed text-muted">In {joinAreas(areas)}. Open one to see how it went together, step by step.</p> : null}
            </div>
            <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {jobs.map((p, i) => (
                <li key={p.slug}>
                  <Link href={`/portfolio/${p.slug}`} className="group block">
                    <div className="mount transition-colors group-hover:border-accent">
                      <div className="relative aspect-[3/4] overflow-hidden bg-raised">
                        <Image
                          src={p.cover.src}
                          alt={p.cover.alt}
                          fill
                          priority={i < 2}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        />
                      </div>
                    </div>
                    <p className="mt-4 font-mono text-[13px] text-faint">{p.area}, {formatMonth(p.finished)}</p>
                    <h3 className="mt-1.5 text-[20px] font-[620] leading-tight transition-colors group-hover:text-accent">{p.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : photos.length ? null : (
        <section id="jobs" className="scroll-mt-20 border-t border-line">
          <Container className="grid grid-cols-1 items-center gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-16">
            {s.image ? (
              <div className="mount md:col-span-5">
                <div className="relative aspect-[4/3] overflow-hidden bg-raised">
                  <Image src={s.image} alt="" fill sizes="(max-width: 768px) 100vw, 500px" className="object-cover" />
                </div>
              </div>
            ) : null}
            <div className="md:col-span-6 md:col-start-7">
              <SectionHeading>Photos of these jobs</SectionHeading>
              <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted">
                There are no photos of this kind of job on the site yet. Ask me on WhatsApp and I will send you pictures of recent ones, or see the fitted furniture on My Work.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <WhatsAppButton text={waText} />
                <Link href="/portfolio" className="btn btn-ghost">See My Work</Link>
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* Loose photos from the "0 Services" folder (opens full screen) */}
      {photos.length ? (
        <section id="photos" className="scroll-mt-20 border-t border-line">
          <Container className="py-14 md:py-20">
            <div className="max-w-[62ch]">
              <SectionHeading>{jobs.length ? 'More photos' : 'Photos'}</SectionHeading>
              {!jobs.length ? <p className="mt-4 text-[16px] leading-relaxed text-muted">Ask me on WhatsApp for more pictures of recent jobs like these.</p> : null}
            </div>
            <div className="mt-10">
              <ProjectGallery photos={photos} title={s.name} />
            </div>
          </Container>
        </section>
      ) : null}

            {/* What customers say: the reviews about this kind of work first */}
      <section className="border-t border-line">
        <Container className="py-14 md:py-20">
          <Reviews max={3} job={{ slug: '', main: `${s.name} ${(s.matchTags ?? []).join(' ')}`, tags: (s.matchTypes ?? []).join(' ') }} />
        </Container>
      </section>

      {/* Questions */}
      {s.faq.length ? (
        <section className="border-t border-line">
          <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
            <SectionHeading className="md:col-span-4">{d.faqHeading}</SectionHeading>
            <div className="border-t border-line md:col-span-8">
              {s.faq.map((q, i) => (
                <details key={i} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-[620] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                    {q.question}
                    <span className="flex-none font-mono text-[20px] font-normal text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="-mt-1 max-w-[62ch] pb-6 text-[16px] leading-relaxed text-muted">{q.answer}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Quote band and the other services */}
      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-7">
              <SectionHeading>Want something like this?</SectionHeading>
              <p className="mt-4 max-w-[52ch] text-muted">Tell me about the room. I&apos;ll come and measure up for a free quote.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link>
                <WhatsAppButton text={waText} />
              </div>
            </div>
            <Link href="/how-it-works#materials" className="link-more text-[15px] md:col-span-5 md:justify-self-end">
              Materials, what I need and a two-minute brief <span aria-hidden="true">→</span>
            </Link>
          </div>
          <nav aria-label="Other services" className="mt-14 border-t border-line-strong pt-6">
            <p className="font-mono text-[13px] text-faint">Other things I build</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/services/${o.slug}`} className="inline-flex h-10 items-center rounded-sm border border-line-strong bg-mount px-4 text-[14.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent">
                    {o.name}
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

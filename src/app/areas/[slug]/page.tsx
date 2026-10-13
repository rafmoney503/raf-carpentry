import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import WhatsAppButton from '@/components/WhatsAppButton';
import SaveButton from '@/components/SaveButton';
import Reviews, { GoogleRating } from '@/components/Reviews';
import ModelGallery, { type GalleryItem } from '@/components/project/ModelGallery';
import { formatMonth, modelOf } from '@/lib/projects';
import { areaPages, getAreaPage, nearbyAreas } from '@/lib/areas';
import { getServices, jobMatches } from '@/lib/services';
import { DESIGN_KINDS } from '@/lib/design-kinds';
import { QUOTE_HREF } from '@/lib/site';
import { jsonLd, pageMeta, SITE_URL } from '@/lib/seo';
import '@/app/portfolio/project.css';

/* One page per area with 3 or more jobs (src/lib/areas.ts): the jobs there with their photos, the same jobs in 3D,
   what kinds of work they were, other jobs within 3 miles, reviews about that kind of work, and a quote band.
   Everything on it comes from the job pages and content/pages/areas.json, so a new job in the area shows up by
   itself and an area reaching 3 jobs gets its page at the next deploy. */

export const dynamicParams = false;

export function generateStaticParams() {
  return areaPages().map((a) => ({ slug: a.slug }));
}

const list = (words: string[]) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/* What was built there, by service, most jobs first: [{ name, slug, count }]. A job counts under every service
   whose page lists it (a loft with sliding doors is storage and a wardrobe), so the counts match the service pages. */
function kindsOf(jobs: ReturnType<typeof areaPages>[number]['jobs']) {
  return getServices()
    .map((s) => ({ name: s.name, slug: s.slug, count: jobs.filter((p) => jobMatches(s, p)).length }))
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* A short word for a service, for the Google description: "wardrobes", "cupboards", "window seats". */
const short = (k: { slug: string; name: string }) => (DESIGN_KINDS.find((d) => d.service === k.slug)?.short ?? k.name).toLowerCase();
const showMiles = (d: number) => (d < 0.3 ? 'next door' : `${d < 10 ? d.toFixed(1) : Math.round(d)} mi`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getAreaPage(slug);
  if (!a) return {};
  const kinds = [...new Set(kindsOf(a.jobs).map(short))].slice(0, 3);
  const where = a.postcode ? `${a.name}, ${a.postcode}` : a.name;
  return pageMeta({
    title: `Carpenter in ${where}: ${a.jobs.length} jobs with photos | Raf Carpentry`,
    description: `Fitted furniture I've built in ${a.name}: ${a.jobs.length} jobs with photos, build steps and 3D models, including ${list(kinds)}. Free quote and visit.`,
    path: `/areas/${a.slug}`,
    ownImage: true,
  });
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAreaPage(slug);
  if (!a) notFound();
  const jobs = a.jobs;
  const kinds = kindsOf(jobs);
  const near = nearbyAreas(a);
  const nearCount = near.reduce((n, o) => n + o.jobs.length, 0);
  const others = areaPages().filter((o) => o.slug !== a.slug);
  const models: GalleryItem[] = jobs.flatMap((p) => {
    const model = modelOf(p);
    return model ? [{ slug: p.slug, title: p.title, area: p.area, model }] : [];
  });
  const months = jobs.map((p) => p.finished).sort();
  const since = months.length ? formatMonth(months[0]) : '';
  const waText = `Hi Raf, I'm in ${a.name} and I'd like a quote for `;
  const lede = a.intro ?? `${jobs.length} jobs in ${a.name}, each with photos, how it went together and a 3D model.`;

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: `Fitted furniture in ${a.name}`,
      serviceType: 'Carpentry and fitted furniture',
      url: `${SITE_URL}/areas/${a.slug}`,
      areaServed: { '@type': 'Place', name: `${a.name}, London` },
      provider: { '@id': `${SITE_URL}/#business` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Where I work', item: `${SITE_URL}/areas` },
        { '@type': 'ListItem', position: 2, name: a.name, item: `${SITE_URL}/areas/${a.slug}` },
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <PageHeader
        top={
          <nav aria-label="Breadcrumb" className="font-mono text-[13px] text-faint">
            <Link href="/areas" className="transition-colors hover:text-accent">Where I work</Link>
            <span className="px-2 text-line-strong">/</span>
            <span>{a.name}</span>
          </nav>
        }
        kicker={a.postcode ? `${a.name} · ${a.postcode}` : a.name}
        title="Fitted furniture in"
        accent={`${a.name}.`}
        lede={lede}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link>
          <WhatsAppButton text={waText} />
        </div>
        <GoogleRating variant="inline" className="mt-6" />
      </PageHeader>

      {/* At a glance: how many, since when, what kinds (each a link to its service page) */}
      <section className="border-t border-line">
        <Container className="py-10 md:py-12">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-12">
            <div className="border-t-2 border-accent pt-4 md:col-span-2">
              <dt className="font-mono text-[12.5px] text-faint">Jobs here</dt>
              <dd className="mt-1 font-display text-[34px] font-[680] leading-none">{jobs.length}</dd>
            </div>
            <div className="border-t-2 border-line-strong pt-4 md:col-span-2">
              <dt className="font-mono text-[12.5px] text-faint">Since</dt>
              <dd className="mt-1.5 text-[18px] font-[620]">{since}</dd>
            </div>
            <div className="col-span-2 border-t-2 border-line-strong pt-4 md:col-span-8">
              <dt className="font-mono text-[12.5px] text-faint">What I&apos;ve built here</dt>
              <dd className="mt-2.5 flex flex-wrap gap-2">
                {kinds.map((k) => (
                  <Link key={k.slug} href={`/services/${k.slug}`} className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-mount px-3.5 text-[14.5px] text-ink transition-colors hover:border-accent hover:text-accent">
                    {k.name}
                    <span className="font-mono text-[12px] text-faint">{k.count}</span>
                  </Link>
                ))}
              </dd>
            </div>
          </dl>
        </Container>
      </section>

      {/* The jobs */}
      <section id="jobs" className="border-t border-line">
        <Container className="py-14 md:py-20">
          <div className="max-w-[62ch]">
            <SectionHeading>{`${jobs.length} jobs in ${a.name}`}</SectionHeading>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">Open one to see the photos and how it went together, step by step.</p>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {jobs.map((p, i) => (
              <li key={p.slug} className="relative">
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
                  <p className="mt-4 font-mono text-[13px] text-faint">{p.type}, {formatMonth(p.finished)}</p>
                  <h3 className="mt-1.5 text-[20px] font-[620] leading-tight transition-colors group-hover:text-accent">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.summary}</p>
                </Link>
                <SaveButton item={{ id: `job:${p.slug}`, title: p.title, area: p.area, href: `/portfolio/${p.slug}`, image: p.cover.src }} variant="icon" className="absolute right-4 top-4" />
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* The same jobs in 3D */}
      {models.length ? (
        <section id="in-3d" className="border-t border-line">
          <Container className="py-14 md:py-20">
            <div className="max-w-[62ch]">
              <SectionHeading>{models.length === 1 ? 'This job in 3D' : `These ${models.length} jobs in 3D`}</SectionHeading>
              <p className="mt-4 text-[16px] leading-relaxed text-muted">Drawn in SketchUp. Pick one, then drag to turn it round, open the doors or take it apart.</p>
            </div>
            <div className="mt-10">
              <ModelGallery items={models} />
            </div>
          </Container>
        </section>
      ) : null}

      {/* Other jobs within 3 miles */}
      {near.length ? (
        <section id="nearby" className="border-t border-line">
          <Container className="py-14 md:py-20">
            <div className="max-w-[62ch]">
              <SectionHeading>{`${nearCount} more ${nearCount === 1 ? 'job' : 'jobs'} within 3 miles`}</SectionHeading>
              <p className="mt-4 text-[16px] leading-relaxed text-muted">Miles are from the middle of {a.name} to the middle of each area.</p>
            </div>
            <ul className="mt-8 grid gap-x-8 gap-y-4 md:grid-cols-2">
              {near.map((o) => {
                const j = o.jobs[0];
                const more = o.jobs.length - 1;
                const page = others.find((x) => x.name === o.name);
                return (
                  <li key={o.name} className="flex items-center gap-3.5">
                    <Link href={`/portfolio/${j.slug}`} tabIndex={-1} aria-hidden="true" className="relative h-16 w-16 flex-none overflow-hidden border border-line bg-raised">
                      <Image src={j.cover.src} alt="" fill sizes="64px" className="object-cover" />
                    </Link>
                    <span className="min-w-0 flex-1">
                      <Link href={`/portfolio/${j.slug}`} className="line-clamp-2 block text-[15.5px] font-[620] leading-snug text-ink hover:text-accent">
                        {j.title}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[12.5px] text-faint">
                        {page ? (
                          <Link href={`/areas/${page.slug}`} className="text-accent hover:underline">{o.name}</Link>
                        ) : (
                          o.name
                        )}
                        {more ? ` · and ${more} more there` : ''}
                      </span>
                    </span>
                    <span className="flex-none whitespace-nowrap font-mono text-[13px] text-accent">{showMiles(o.d)}</span>
                  </li>
                );
              })}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* What customers say, about this kind of work first */}
      <section className="border-t border-line">
        <Container className="py-14 md:py-20">
          <Reviews max={3} job={{ slug: '', main: jobs.map((p) => `${p.type} ${p.title}`).join(' '), tags: jobs.flatMap((p) => p.tags ?? []).join(' ') }} />
        </Container>
      </section>

      {/* Quote band and the other areas */}
      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-7">
              <SectionHeading>{`In ${a.name}? Tell me about the room.`}</SectionHeading>
              <p className="mt-4 max-w-[52ch] text-muted">I reply within 24 hours, then come and measure up for a free quote. You get a 3D drawing to approve before anything is cut.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link>
                <WhatsAppButton text={waText} />
              </div>
            </div>
            <Link href="/how-it-works" className="link-more text-[15px] md:col-span-5 md:justify-self-end">
              Plan your project: what I need and a two-minute brief <span aria-hidden="true">→</span>
            </Link>
          </div>
          <nav aria-label="Other areas" className="mt-14 border-t border-line-strong pt-6">
            <p className="font-mono text-[13px] text-faint">Other areas</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/areas/${o.slug}`} className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-mount px-4 text-[14.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent">
                    {o.name}
                    <span className="font-mono text-[12px] font-normal text-faint">{o.jobs.length}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/areas" className="inline-flex h-10 items-center rounded-sm px-2 text-[14.5px] font-semibold text-accent hover:underline">
                  Everywhere I&apos;ve worked <span aria-hidden="true" className="ml-1.5">→</span>
                </Link>
              </li>
            </ul>
          </nav>
        </Container>
      </section>
    </>
  );
}

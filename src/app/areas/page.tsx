import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import WhatsAppButton from '@/components/WhatsAppButton';
import { GoogleRating } from '@/components/Reviews';
import JobsNear from '@/components/JobsNear';
import { areaPageLinks, areaPages, getNearJobs } from '@/lib/areas';
import { getAllProjects } from '@/lib/projects';
import { getServices, jobMatches } from '@/lib/services';
import { QUOTE_HREF } from '@/lib/site';
import { pageMeta } from '@/lib/seo';
import GrowList from '@/components/GrowList';
import Magnetic from '@/components/Magnetic';

/* Where I work (/areas): the areas with their own page (3 or more jobs), Jobs near you, and every place there's
   a job, each linking to its area page, its one job, or My Work's search. */

export function generateMetadata(): Metadata {
  const jobs = getAllProjects();
  const places = new Set(jobs.map((p) => p.area)).size;
  return pageMeta({
    title: 'Where I work: fitted furniture across London | Raf Carpentry',
    description: `${jobs.length} jobs in ${places} places, from Chiswick to East Finchley. Type your postcode to see the jobs nearest you, with photos and 3D models.`,
    path: '/areas',
  });
}

export default function AreasPage() {
  const pages = areaPages();
  const links = areaPageLinks();
  const jobs = getAllProjects();
  const services = getServices();
  // Every place with a job, most jobs first
  const byArea = new Map<string, typeof jobs>();
  for (const p of jobs) byArea.set(p.area, [...(byArea.get(p.area) ?? []), p]);
  const places = [...byArea.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <>
      <PageHeader
        kicker="Where I work"
        title="Fitted furniture across"
        accent="London."
        lede={`From Chiswick to East Finchley, and further out when the job suits. ${jobs.length} jobs in ${places.length} places so far, each with photos and a 3D model.`}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link>
          <WhatsAppButton />
        </div>
        <GoogleRating variant="inline" className="mt-6" />
      </PageHeader>

      {/* Areas with their own page */}
      <section className="border-t border-line">
        <Container className="py-14 md:py-20">
          <SectionHeading>Where I&apos;ve built the most</SectionHeading>
          <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {pages.map((a, i) => {
              // the services with most jobs here, as on the area page
              const kinds = services
                .map((s) => ({ name: s.name, n: a.jobs.filter((p) => jobMatches(s, p)).length }))
                .filter((k) => k.n)
                .sort((x, y) => y.n - x.n)
                .slice(0, 3)
                .map((k) => k.name);
              return (
                <li key={a.slug}>
                  <Link href={`/areas/${a.slug}`} className="group block">
                    <div className="mount transition-colors group-hover:border-accent">
                      <div className="relative aspect-[4/3] overflow-hidden bg-raised">
                        <Image src={a.jobs[0].cover.src} alt="" fill priority={i < 2} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                      </div>
                    </div>
                    <p className="mt-4 font-mono text-[13px] text-faint">
                      {a.jobs.length} jobs{a.postcode ? ` · ${a.postcode}` : ''}
                    </p>
                    <h3 className="mt-1 text-[22px] font-[650] leading-tight transition-colors group-hover:text-accent">{a.name}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{kinds.join(', ')}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Postcode finder */}
      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <JobsNear jobs={getNearJobs()} areaLinks={links} heading="h2" />
        </Container>
      </section>

      {/* Every place */}
      <section className="border-t border-line">
        <Container className="py-14 md:py-20">
          <SectionHeading>Every place so far</SectionHeading>
          <GrowList className="mt-8 grid grid-cols-1 border-t border-line md:grid-cols-2 md:gap-x-10">
            {places.map(([area, list], i) => {
              const href = links[area] ? `/areas/${links[area]}` : list.length === 1 ? `/portfolio/${list[0].slug}` : `/portfolio?q=${encodeURIComponent(area)}`;
              return (
                <li key={area} className="border-b border-line">
                  <Link href={href} className="group flex items-baseline gap-4 py-3.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-[620] text-ink group-hover:text-accent">{area}</span>
                      <span className="mt-0.5 block truncate text-[14.5px] text-muted">{list.length === 1 ? list[0].title : list.map((p) => p.title).slice(0, 2).join(' · ') + (list.length > 2 ? ' ...' : '')}</span>
                      {/* how many jobs, as a bar scaled to the busiest place; grows out as the row comes into view */}
                      <span className="jn-bar jn-bar-thin mt-2.5" aria-hidden="true">
                        <i style={{ '--f': list.length / (places[0]?.[1].length || 1), '--i': i % 2 } as React.CSSProperties} />
                      </span>
                    </span>
                    <span className="flex-none font-mono text-[13px] text-faint">
                      {list.length} {list.length === 1 ? 'job' : 'jobs'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </GrowList>
        </Container>
      </section>

      <section className="border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <SectionHeading>Not on the list?</SectionHeading>
          <p className="mt-4 max-w-[52ch] text-muted">Tell me where you are and what you have in mind. I reply within 24 hours.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Magnetic><Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link></Magnetic>
            <WhatsAppButton />
          </div>
        </Container>
      </section>
    </>
  );
}

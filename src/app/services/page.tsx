import Image from 'next/image';
import Link from 'next/link';
import { Container, PageHeader } from '@/components/ui';
import { GoogleRating } from '@/components/Reviews';
import { pageMeta } from '@/lib/seo';
import { getServicesData, jobsFor } from '@/lib/services';

export function generateMetadata() {
  const d = getServicesData();
  return pageMeta({ title: d.metaTitle, description: d.metaDescription, path: '/services' });
}

/* "What I build": one card per service, with the photo of its newest job and how many jobs it has. */
export default function ServicesPage() {
  const d = getServicesData();
  const cards = d.services.map((s) => {
    const jobs = jobsFor(s);
    return { s, count: jobs.length, image: s.image || jobs[0]?.cover.src, alt: jobs[0]?.cover.alt ?? s.name };
  });
  return (
    <>
      <PageHeader kicker={d.kicker} title={d.title} accent={d.titleAccent} lede={d.lede}>
        <GoogleRating variant="inline" className="mt-6" />
      </PageHeader>
      <Container className="pb-20 md:pb-28">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-12 border-t border-line pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ s, count, image, alt }, i) => (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}`} className="group block">
                <div className="mount transition-colors group-hover:border-accent">
                  <div className="relative aspect-[4/3] overflow-hidden bg-raised">
                    {image ? (
                      <Image src={image} alt={alt} fill priority={i < 3} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <h2 className="text-[22px] font-[620] leading-tight transition-colors group-hover:text-accent">{s.name}</h2>
                  {count ? <span className="flex-none font-mono text-[13px] text-faint">{count} {count === 1 ? 'job' : 'jobs'}</span> : null}
                </div>
                <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{s.summary}</p>
                <p className="mt-3 text-sm font-medium text-accent">See the jobs <span aria-hidden="true">→</span></p>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}

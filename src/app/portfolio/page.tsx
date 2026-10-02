import Image from 'next/image';
import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import { formatMonth, getAllProjects } from '@/lib/projects';
import './project.css';

type ArchiveItem = { title: string; description: string; category: string; image: string };
type PortfolioPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  projects: ArchiveItem[];
};

export const metadata = {
  title: 'My work | Raf Carpentry',
  description: 'Fitted wardrobes, alcove units and built-ins across north London, with the build photographed step by step.',
};

export default function PortfolioPage() {
  const d = readPageJson<PortfolioPageData>('portfolio.json');
  const projects = getAllProjects();

  return (
    <>
      <PageHeader title={d.title} accent={d.titleAccent} lede={d.subtitle} />

      <Container className="pb-20 md:pb-28">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((p, i) => (
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
                <p className="mt-5 font-mono text-[13px] text-faint">
                  {p.area}, {formatMonth(p.finished)}
                </p>
                <h2 className="mt-1.5 text-[21px] font-[620] leading-tight transition-colors group-hover:text-accent">{p.title}</h2>
                <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{p.summary}</p>
                <p className="mt-3 font-mono text-[13px] text-ink">
                  {p.steps.length} build steps, {p.gallery.length + 1} photos{p.video ? ', video' : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      {d.projects.length > 0 ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <SectionHeading>Earlier work</SectionHeading>
            <p className="mt-4 max-w-[56ch] text-muted">Jobs from before I started photographing every build.</p>
            <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {d.projects.map((x) => (
                <li key={x.title}>
                  <div className="mount p-1.5">
                    <div className="relative aspect-[4/5] overflow-hidden bg-raised">
                      <Image src={x.image} alt={x.title} fill sizes="(max-width: 768px) 50vw, 300px" className="object-cover" />
                    </div>
                  </div>
                  <p className="mt-4 font-mono text-[12.5px] text-faint">{x.category}</p>
                  <h3 className="mt-1 text-[17px] font-[620] leading-snug">{x.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{x.description}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}
    </>
  );
}

import { readPageJson } from '@/lib/pages';
import { PageHeader } from '@/components/ui';
import { formatMonth, getAllProjects, getKit } from '@/lib/projects';
import { matches } from '@/lib/search';
import PortfolioBrowser, { type ArchiveCard, type JobCard } from './portfolio-browser';
import './project.css';
import { pageMeta } from '@/lib/seo';

type PortfolioPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  projects: ArchiveCard[];
};

export const metadata = pageMeta({
  title: 'My work | Raf Carpentry',
  description: 'Fitted wardrobes, alcove units and built-ins across north London, with the build photographed step by step.',
  path: '/portfolio',
});

export default function PortfolioPage() {
  const d = readPageJson<PortfolioPageData>('portfolio.json');
  const projects = getAllProjects();

  const jobs: JobCard[] = projects.map((p) => {
    const month = formatMonth(p.finished);
    const kit = getKit(p.slug);
    const kitWords = kit ? [...kit.materials, ...kit.tools].map((k) => [k.name, k.brand, k.model].filter(Boolean).join(' ')) : [];
    return {
      slug: p.slug,
      title: p.title,
      area: p.area,
      month,
      summary: p.summary,
      cover: { src: p.cover.src, alt: p.cover.alt },
      tags: p.tags ?? [],
      meta: [p.steps.length ? `${p.steps.length} build steps` : '', `${p.gallery.length + 1} photos`, p.video ? 'video' : '', p.compare ? 'before and after' : ''].filter(Boolean).join(', '),
      // Everything a visitor might type: title, area, tags, facts, words from the write-up.
      searchText: [p.title, p.area, month, p.type, ...(p.tags ?? []), p.summary, p.intro, ...p.facts.map((f) => f.value), ...p.steps.map((s) => s.title), ...kitWords].join(' '),
    };
  });

  // Quick-filter buttons, in this order, shown only when at least one job matches them.
  const archiveText = d.projects.map((a) => `${a.title} ${a.description} ${a.category}`);
  const chips = ['Wardrobes', 'IKEA PAX', 'Window seats', 'Alcoves', 'Bookshelves', 'Desks', 'Storage', 'Wall panelling', 'Birch ply', 'MDF', 'Loft', 'Outdoor'].filter(
    (c) => jobs.some((j) => matches(j.searchText, c)) || archiveText.some((t) => matches(t, c)),
  );

  return (
    <>
      <PageHeader title={d.title} accent={d.titleAccent} lede={d.subtitle} />
      <PortfolioBrowser jobs={jobs} archive={d.projects} chips={chips} />
    </>
  );
}

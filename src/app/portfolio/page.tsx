import { readPageJson } from '@/lib/pages';
import { PageHeader } from '@/components/ui';
import { formatMonth, getAllProjects } from '@/lib/projects';
import PortfolioBrowser, { type ArchiveCard, type JobCard } from './portfolio-browser';
import './project.css';

type PortfolioPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  projects: ArchiveCard[];
};

export const metadata = {
  title: 'My work | Raf Carpentry',
  description: 'Fitted wardrobes, alcove units and built-ins across north London, with the build photographed step by step.',
};

export default function PortfolioPage() {
  const d = readPageJson<PortfolioPageData>('portfolio.json');
  const projects = getAllProjects();

  const jobs: JobCard[] = projects.map((p) => {
    const month = formatMonth(p.finished);
    return {
      slug: p.slug,
      title: p.title,
      area: p.area,
      month,
      summary: p.summary,
      cover: { src: p.cover.src, alt: p.cover.alt },
      tags: p.tags ?? [],
      meta: `${p.steps.length} build steps, ${p.gallery.length + 1} photos${p.video ? ', video' : ''}`,
      // Everything a visitor might type: title, area, tags, facts, words from the write-up.
      searchText: [p.title, p.area, month, p.type, ...(p.tags ?? []), p.summary, p.intro, ...p.facts.map((f) => f.value), ...p.steps.map((s) => s.title)].join(' '),
    };
  });

  // Quick-filter buttons, in this order, shown only when at least one job uses them.
  const used = new Set([...jobs.flatMap((j) => j.tags), ...d.projects.map((a) => a.category)].map((t) => t.toLowerCase()));
  const chips = ['Wardrobes', 'IKEA PAX', 'MDF', 'Alcoves', 'Shelving', 'Chimney breast', 'Loft', 'Outdoor'].filter(
    (c) => used.has(c.toLowerCase()) || (c === 'Alcoves' && used.has('alcove units')),
  );

  return (
    <>
      <PageHeader title={d.title} accent={d.titleAccent} lede={d.subtitle} />
      <PortfolioBrowser jobs={jobs} archive={d.projects} chips={chips} />
    </>
  );
}

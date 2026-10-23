import { readPageJson } from '@/lib/pages';
import { PageHeader } from '@/components/ui';
import { formatMonth, getAllProjects, modelOf } from '@/lib/projects';
import { jobSearchText, portfolioChips } from '@/lib/portfolio-chips';
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
    return {
      slug: p.slug,
      title: p.title,
      area: p.area,
      month,
      summary: p.summary,
      cover: { src: p.cover.src, alt: p.cover.alt },
      model: modelOf(p)?.poster.src,
      tags: p.tags ?? [],
      meta: [p.steps.length ? `${p.steps.length} build steps` : '', `${p.gallery.length + 1} photos`, p.video ? 'video' : '', p.compare ? 'before and after' : ''].filter(Boolean).join(', '),
      // Everything a visitor might type: title, area, tags, facts, words from the write-up.
      searchText: jobSearchText(p),
    };
  });

  // Quick-filter buttons (src/lib/portfolio-chips.ts, shared with the menu's My Work panel).
  const chips = portfolioChips(projects);

  return (
    <>
      <PageHeader title={d.title} accent={d.titleAccent} lede={d.subtitle} />
      <PortfolioBrowser jobs={jobs} archive={d.projects} chips={chips} />
    </>
  );
}

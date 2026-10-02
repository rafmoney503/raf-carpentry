import { readPageJson } from '@/lib/pages';
import { Container, PageHeader } from '@/components/ui';
import PortfolioGrid, { type Project } from './portfolio-grid';

type PortfolioPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  categories: string[];
  projects: Project[];
};

export default function PortfolioPage() {
  const d = readPageJson<PortfolioPageData>('portfolio.json');

  return (
    <>
      <PageHeader title={d.title} accent={d.titleAccent} lede={d.subtitle} />
      <Container className="pb-24 md:pb-32">
        <PortfolioGrid categories={d.categories} projects={d.projects} />
      </Container>
    </>
  );
}

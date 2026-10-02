import Link from 'next/link';
import type { Metadata } from 'next';
import { readPageJson } from '@/lib/pages';
import { Container, PageHeader, SectionHeading } from '@/components/ui';

type ToolEntry = {
  name: string;
  description: string;
  url: string;
  image: string;
  price: string;
};

type ToolsPageData = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  titleAccent: string;
  intro: string;
  disclosure: string;
  categories: {
    name: string;
    icon: string;
    tools: ToolEntry[];
  }[];
  footerCtaTitle: string;
  footerCtaTitleAccent: string;
  footerCtaSubtitle: string;
  footerCtaButtonLabel: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const d = readPageJson<ToolsPageData>('tools.json');
  return {
    title: d.metaTitle,
    description: d.metaDescription,
  };
}

export default function ToolsPage() {
  const d = readPageJson<ToolsPageData>('tools.json');

  return (
    <>
      <PageHeader title={d.title} accent={d.titleAccent} lede={d.intro}>
        <p className="mt-6 max-w-[64ch] border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">{d.disclosure}</p>
      </PageHeader>

      <Container className="pb-8">
        {d.categories.map((cat, ci) => (
          <section key={ci} className="grid grid-cols-1 gap-8 border-t border-line py-12 md:grid-cols-12 md:gap-6 md:py-16">
            <SectionHeading className="md:col-span-4">{cat.name}</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 md:col-span-8">
              {cat.tools.map((tool, ti) => {
                const href = tool.url;
                const isExternal = href?.startsWith('http');
                return (
                  <a
                    key={ti}
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener sponsored' : undefined}
                    className="group block border-t border-line py-6 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(-n+2)]:pt-0 [&:first-child]:border-t-0 [&:first-child]:pt-0"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">{tool.name}</h3>
                      <span className="flex-none font-mono text-sm text-muted" aria-label={`Price band ${tool.price.length} of 4`}>{tool.price}</span>
                    </div>
                    <p className="mt-2 text-[16px] leading-relaxed text-muted">{tool.description}</p>
                    {isExternal && <p className="mt-3 text-sm font-medium text-accent">View on Amazon →</p>}
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </Container>

      <section className="border-t border-line">
        <Container className="grid grid-cols-1 items-end gap-8 py-20 md:grid-cols-12 md:gap-6 md:py-24">
          <div className="md:col-span-8">
            <SectionHeading>
              {d.footerCtaTitle}
              <span className="text-accent">{d.footerCtaTitleAccent}</span>
            </SectionHeading>
            <p className="mt-4 max-w-[56ch] text-muted">{d.footerCtaSubtitle}</p>
          </div>
          <div className="md:col-span-4 md:justify-self-end">
            <Link href="/blog" className="btn btn-primary">{d.footerCtaButtonLabel}</Link>
          </div>
        </Container>
      </section>
    </>
  );
}

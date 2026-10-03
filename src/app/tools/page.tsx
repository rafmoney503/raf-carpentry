import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { readPageJson } from '@/lib/pages';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import { isAmazonLink } from '@/lib/affiliates';
import Sketch from '@/app/how-it-works/sketches';

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
        {/* Teasers for the free calculator and the workshop tips */}
        <div className="mb-12 grid grid-cols-1 gap-4 md:mb-16 lg:grid-cols-2">
          <Link
            href="/calculator"
            className="group grid grid-cols-1 items-center gap-4 rounded-sm border border-line-strong bg-mount p-5 transition-colors hover:border-accent sm:grid-cols-[minmax(0,1fr)_auto] md:p-6"
          >
            <div>
              <p className="font-mono text-[13px] text-accent">Free tool</p>
              <h2 className="mt-1 text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Workshop calculator in mm</h2>
              <p className="mt-1 text-[15px] text-muted">The quick calc from CabinetOS: answers in mm, cm and inches, and how many fit on a full board.</p>
            </div>
            <div className="flex items-center gap-5">
              <p className="whitespace-nowrap rounded-sm border border-line bg-paper px-4 py-2.5 font-mono text-[15px] text-muted" aria-hidden="true">
                600 − 18 × 2 = <span className="font-semibold text-ink">564</span>
              </p>
              <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </div>
          </Link>
          <Link
            href="/tips"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-sm border border-line-strong bg-mount p-5 transition-colors hover:border-accent md:p-6"
          >
            <div>
              <p className="font-mono text-[13px] text-accent">Free tips</p>
              <h2 className="mt-1 text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Workshop tips</h2>
              <p className="mt-1 text-[15px] text-muted">Measuring alcoves, scribing to uneven walls, wardrobe door hinges and the screws I use.</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-[64px] sm:w-[76px]">
                <Sketch name="compass" fallback="" />
              </div>
              <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </div>
          </Link>
        </div>
        {d.categories.map((cat, ci) => (
          <section key={ci} className="grid grid-cols-1 gap-8 border-t border-line py-12 md:grid-cols-12 md:gap-6 md:py-16">
            <SectionHeading className="md:col-span-4">{cat.name}</SectionHeading>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 md:col-span-8">
              {cat.tools.map((tool, ti) => {
                const href = tool.url && tool.url !== '#' ? tool.url : '';
                const isExternal = href.startsWith('http');
                const isShop = isAmazonLink(href);
                const cls =
                  'group block border-t border-line py-6 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(-n+2)]:pt-0 [&:first-child]:border-t-0 [&:first-child]:pt-0';
                const inner = (
                  <div className="flex items-start gap-4 sm:gap-5">
                    {/* Small photo of Raf's own tool, so visitors see what it is before clicking */}
                    <div className={`mount w-[76px] shrink-0 p-1 sm:w-[88px] ${href ? 'group-hover:border-accent' : ''}`}>
                      <div className="relative aspect-square overflow-hidden bg-raised">
                        {tool.image ? (
                          <Image src={tool.image} alt={`Raf's ${tool.name} on a job`} fill sizes="88px" className="object-cover" />
                        ) : (
                          <span className="absolute inset-0 flex items-center justify-center px-1 text-center font-mono text-[10px] uppercase tracking-wider text-faint" aria-hidden="true">
                            {tool.name.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className={`text-[19px] font-[620] leading-snug transition-colors sm:text-[21px] ${href ? 'group-hover:text-accent' : ''}`}>{tool.name}</h3>
                        {tool.price ? (
                          <span className="flex-none font-mono text-sm text-muted" aria-label={`Price band ${tool.price.length} of 4`}>{tool.price}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[16px] leading-relaxed text-muted">{tool.description}</p>
                      {href ? (
                        <p className="mt-3 text-sm font-medium text-accent">{isShop ? 'View on Amazon' : isExternal ? 'Visit the website' : 'Find out more'} →</p>
                      ) : null}
                    </div>
                  </div>
                );
                // Tools without a confirmed link are listed but not clickable.
                if (!href) return <div key={ti} className={cls}>{inner}</div>;
                return (
                  <a
                    key={ti}
                    href={href}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? (isShop ? 'sponsored nofollow noopener' : 'noopener') : undefined}
                    className={cls}
                  >
                    {inner}
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

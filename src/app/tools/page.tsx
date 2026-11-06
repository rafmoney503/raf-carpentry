import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { readPageJson } from '@/lib/pages';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import { toolsSectionId } from '@/lib/menu-panels';
import { isAmazonLink } from '@/lib/affiliates';
import Sketch from '@/app/how-it-works/sketches';
import PlannerTeaser from '@/components/PlannerTeaser';
import { TradeNudge } from '@/components/AlsoByMe';
import AppNudge from '@/components/AppNudge';
import ExtensionTeaser from '@/components/ExtensionTeaser';
import { BUILD_IT_IN_3D_URL } from '@/lib/site';
import { WORKING_DAYS, gbp, packPrices } from '@/lib/drawings-service';

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
        {/* Teasers for the wardrobe planner, the Workshop Tools app, my SketchUp extension, the free calculator, the workshop tips, Workshop Games and Build It in 3D */}
        <div className="mb-12 grid grid-cols-1 gap-4 md:mb-16 lg:grid-cols-2">
          <PlannerTeaser variant="feature" className="lg:col-span-2" />
          {/* the Workshop Tools app for phones (25 Oct 2026) */}
          <AppNudge variant="card" className="lg:col-span-2" />
          {/* CabinetOS Units, my extension for SketchUp (28 Oct 2026) */}
          <ExtensionTeaser variant="feature" className="lg:col-span-2" />
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
          <Link
            href="/tools/spirit-level"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-sm border border-line-strong bg-mount p-5 transition-colors hover:border-accent md:p-6"
          >
            <div>
              <p className="font-mono text-[13px] text-accent">Free phone tool</p>
              <h2 className="mt-1 text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Spirit level</h2>
              <p className="mt-1 text-[15px] text-muted">Set zero on any surface, so the phone&apos;s buttons don&apos;t matter. Then read the angle and the mm to pack.</p>
            </div>
            <div className="flex items-center gap-5">
              {/* A small spirit level, as drawn on the home page */}
              <svg viewBox="0 0 76 46" className="w-[64px] sm:w-[76px]" aria-hidden="true">
                <rect x="2" y="10" width="72" height="20" rx="2" className="fill-mount stroke-ink" strokeWidth="1.6" />
                <circle cx="10" cy="20" r="2.2" className="fill-none stroke-ink/40" strokeWidth="1.2" />
                <circle cx="66" cy="20" r="2.2" className="fill-none stroke-ink/40" strokeWidth="1.2" />
                <rect x="20" y="14" width="36" height="12" rx="6" className="fill-accent/15 stroke-ink" strokeWidth="1.2" />
                <rect x="29" y="16.5" width="18" height="7" rx="3.5" className="fill-mount stroke-accent" strokeWidth="1.2" />
                <text x="38" y="43" textAnchor="middle" className="fill-accent font-mono" fontSize="9">0.0°</text>
              </svg>
              <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </div>
          </Link>
          <Link
            href="/tools/games"
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-sm border border-line-strong bg-mount p-5 transition-colors hover:border-accent md:p-6"
          >
            <div>
              <p className="font-mono text-[13px] text-accent">Free games</p>
              <h2 className="mt-1 text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Workshop Games</h2>
              <p className="mt-1 text-[15px] text-muted">Measure Up, Sheet Saver, Timber Stack, Nail Pop, Level Best and Find the Difference. New tapes, a new board and a new job every day, with real sizes.</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="w-[64px] sm:w-[76px]">
                <Sketch name="stack" fallback="" />
              </div>
              <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </div>
          </Link>
          {/* Drawings and cut lists, done for you: the paid service (6 Nov 2026) */}
          <Link
            href="/drawings"
            data-drawings-card
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-sm border border-line-strong bg-mount p-5 transition-colors hover:border-accent md:p-6 lg:col-span-2"
          >
            <div>
              <p className="font-mono text-[13px] text-accent">Done for you</p>
              <h2 className="mt-1 text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Drawings and cut lists</h2>
              <p className="mt-1 max-w-[62ch] text-[15px] text-muted">
                Send me your sizes and a sketch. Within {WORKING_DAYS} working days you get the drawings, 3D views, cut list, board layout and assembly guide, ready for your cutting company.
              </p>
              <p className="mt-2 font-mono text-[13px] text-faint">From {gbp(packPrices('cutlist').total)} with VAT · paid upfront</p>
            </div>
            <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
          </Link>
          {/* Build It in 3D, my free 3D drawing lessons on their own site (5 Nov 2026) */}
          <a
            href={BUILD_IT_IN_3D_URL}
            target="_blank"
            rel="noopener"
            data-build-it-in-3d
            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-sm border border-line-strong bg-mount p-5 transition-colors hover:border-accent md:p-6 lg:col-span-2"
          >
            <div>
              <p className="font-mono text-[13px] text-accent">Free 3D lessons</p>
              <h2 className="mt-1 text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Build It in 3D</h2>
              <p className="mt-1 max-w-[62ch] text-[15px] text-muted">
                Learn to draw in 3D in your browser, one real build at a time: a bird box, a planter, alcove shelves, a log store, a raised bed and a wardrobe. Then print the cut list and make it. Free, no sign-up.
              </p>
              <p className="mt-2 font-mono text-[13px] text-faint">builditin3d.com · opens in a new tab</p>
            </div>
            <div className="flex items-center gap-5">
              {/* A board being pulled up in 3D, the first thing every lesson teaches */}
              <svg viewBox="0 0 64 58" className="w-[64px] sm:w-[76px]" aria-hidden="true">
                <path d="M25 6 L56.2 24 L38.9 34 L7.7 16 Z" className="fill-none stroke-accent" strokeWidth="1.2" strokeDasharray="3 2.5" />
                <path d="M25 20 L25 6 M56.2 38 L56.2 24 M38.9 48 L38.9 34 M7.7 30 L7.7 16" className="stroke-accent/50" strokeWidth="1" strokeDasharray="2 2.5" />
                <path d="M7.7 37 L38.9 55 L38.9 48 L7.7 30 Z" className="fill-raised stroke-ink" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M56.2 45 L38.9 55 L38.9 48 L56.2 38 Z" className="fill-paper stroke-ink" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M25 20 L56.2 38 L38.9 48 L7.7 30 Z" className="fill-mount stroke-ink" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M31.9 33 L31.9 21.5 M28.6 25 L31.9 21 L35.2 25" className="fill-none stroke-accent" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
            </div>
          </a>
        </div>
        {d.categories.map((cat, ci) => (
          <section key={ci} id={toolsSectionId(cat.name)} className="grid grid-cols-1 gap-8 border-t border-line py-12 md:grid-cols-12 md:gap-6 md:py-16">
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

      <TradeNudge />
    </>
  );
}

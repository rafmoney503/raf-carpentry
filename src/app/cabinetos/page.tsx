import Image from 'next/image';
import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { Container, MountedImage, SectionHeading } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import AppScreens, { type AppScreen } from '@/components/AppScreens';
import Compare from './compare';

function imageSrc(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v;
  return '';
}

type BeforeAfterItem = {
  beforeImage?: string;
  afterImage?: string;
  beforeAlt?: string;
  afterAlt?: string;
};

type CabinetosPageData = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  heroImage?: string;
  heroImageAlt?: string;
  screensKicker?: string;
  screensTitle?: string;
  screensTitleAccent?: string;
  screensIntro?: string;
  screens?: AppScreen[];
  mockupEmoji: string;
  mockupPlaceholder: string;
  featuresSectionTitle: string;
  featuresSectionTitleAccent: string;
  featuresSectionSubtitle: string;
  features: { title: string; description: string; icon: string }[];
  beforeAfterItems?: BeforeAfterItem[];
  compareKicker?: string;
  compareTitle?: string;
  compareTitleAccent?: string;
  compareNote?: string;
  withoutTitle: string;
  withoutBullets: string[];
  withTitle: string;
  withBullets: string[];
  faqSectionTitle: string;
  faqSectionTitleAccent: string;
  faq: { question: string; answer: string }[];
  bottomCtaTitle: string;
  bottomCtaTitleAccent: string;
  bottomCtaSubtitle: string;
  bottomCtaButtonLabel: string;
};

export const metadata = pageMeta({
  title: 'CabinetOS, the cabinet making app | Raf Carpentry',
  description: 'CabinetOS automates your parts list, cut list, board optimisation and printing, so you can focus on building, not calculating.',
  path: '/cabinetos',
});

export default function Cabinetos() {
  const d = readPageJson<CabinetosPageData>('cabinetos.json');
  const heroSrc = imageSrc(d.heroImage);
  const screens = (d.screens ?? []).filter((s) => s?.label && (imageSrc(s.computer) || imageSrc(s.tablet) || imageSrc(s.phone)));
  const pairs = (d.beforeAfterItems ?? []).filter((p) => imageSrc(p.beforeImage) || imageSrc(p.afterImage));

  return (
    <>
      <Container className="pb-14 pt-12 md:pb-20 md:pt-20">
        <p className="kicker mb-5">{d.eyebrow}</p>
        <h1 className="max-w-[15em] font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[58px]">
          {d.title} <span className="text-accent">{d.titleAccent}</span>
        </h1>
        <p className="mt-5 max-w-[56ch] text-pretty text-[17px] leading-relaxed text-muted md:text-[19px]">{d.subtitle}</p>
        <div className="mt-9 flex flex-wrap gap-3.5">
          <a href="#features" className="btn btn-primary">{d.primaryCtaLabel}</a>
          <a href="#faq" className="btn btn-ghost">{d.secondaryCtaLabel}</a>
        </div>
      </Container>

      {screens.length ? (
        <section id="screens" aria-labelledby="screens-title" className="pb-20 md:pb-28">
          <Container>
            {d.screensKicker ? <p className="kicker mb-4">{d.screensKicker}</p> : null}
            <SectionHeading>
              <span id="screens-title">
                {d.screensTitle}
                <span className="text-accent">{d.screensTitleAccent}</span>
              </span>
            </SectionHeading>
            {d.screensIntro ? <p className="mt-4 max-w-[60ch] text-pretty text-muted">{d.screensIntro}</p> : null}
            <AppScreens screens={screens} />
          </Container>
        </section>
      ) : heroSrc ? (
        <Container className="pb-20 md:pb-28">
          <div className="overflow-hidden rounded-sm border border-line-strong bg-[#f6f7f8]">
            <Image src={heroSrc} alt={d.heroImageAlt || 'CabinetOS app'} width={2648} height={1916} priority sizes="(max-width: 1280px) 100vw, 1200px" className="h-auto w-full" />
          </div>
        </Container>
      ) : null}

      <section id="features" className="border-y border-line bg-raised py-20 md:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-5">
              <SectionHeading>
                {d.featuresSectionTitle}
                <span className="text-accent">{d.featuresSectionTitleAccent}</span>
              </SectionHeading>
              <p className="mt-4 max-w-[40ch] text-muted">{d.featuresSectionSubtitle}</p>
            </div>
            <ol className="md:col-span-7">
              {d.features.map((f, i) => (
                <li key={i} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-t border-line py-7 first:border-t-0 first:pt-0">
                  <span className="pt-1.5 font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-[25px] font-[620] leading-tight">{f.title}</h3>
                    <p className="mt-2 text-muted">{f.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section aria-labelledby={d.compareTitle || d.compareTitleAccent ? 'compare-title' : undefined} className="py-20 md:py-28">
        <Container>
          {d.compareKicker ? <p className="kicker mb-4">{d.compareKicker}</p> : null}
          {d.compareTitle || d.compareTitleAccent ? (
            <SectionHeading>
              <span id="compare-title">
                {d.compareTitle}
                <span className="text-accent">{d.compareTitleAccent}</span>
              </span>
            </SectionHeading>
          ) : null}
          <Compare withoutTitle={d.withoutTitle} withTitle={d.withTitle} without={d.withoutBullets ?? []} withList={d.withBullets ?? []} note={d.compareNote} />
          {pairs.map((pair, idx) => {
            const b = imageSrc(pair.beforeImage);
            const a = imageSrc(pair.afterImage);
            return (
              <div key={idx} className={`mt-6 grid gap-6 ${b && a ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {b ? <MountedImage src={b} alt={pair.beforeAlt || d.withoutTitle} aspect="aspect-video" /> : null}
                {a ? <MountedImage src={a} alt={pair.afterAlt || d.withTitle} aspect="aspect-video" /> : null}
              </div>
            );
          })}
        </Container>
      </section>

      <section id="faq" className="border-t border-line py-20 md:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
            <SectionHeading className="md:col-span-5">
              {d.faqSectionTitle}
              <span className="text-accent">{d.faqSectionTitleAccent}</span>
            </SectionHeading>
            <div className="md:col-span-7">
              {d.faq.map((f, i) => (
                <details key={i} className="group border-t border-line py-6 first:border-t-0 first:pt-0" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[21px] font-[620] leading-snug [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <span aria-hidden="true" className="mt-1 font-mono text-lg text-accent transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-[60ch] text-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-line">
        <Container className="grid grid-cols-1 items-end gap-8 py-20 md:grid-cols-12 md:gap-6 md:py-24">
          <div className="md:col-span-8">
            <SectionHeading>
              {d.bottomCtaTitle}
              <span className="text-accent">{d.bottomCtaTitleAccent}</span>
            </SectionHeading>
            <p className="mt-4 max-w-[56ch] text-muted">{d.bottomCtaSubtitle}</p>
          </div>
          <div className="md:col-span-4 md:justify-self-end">
            <Link href="/contact" className="btn btn-primary">{d.bottomCtaButtonLabel}</Link>
          </div>
        </Container>
      </section>
    </>
  );
}

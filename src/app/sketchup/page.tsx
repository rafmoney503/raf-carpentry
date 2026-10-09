import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { Container, MountedImage, SectionHeading } from '@/components/ui';
import PlanCard from '@/components/project/PlanCard';
import ScreenGrid from '@/components/project/ScreenGrid';
import { formatMonth, getAllProjects, isPlanReady } from '@/lib/projects';
import { pageMeta } from '@/lib/seo';
import Joint from '@/components/Joint';

type SketchupPageData = {
  heroTitle: string;
  heroTitleAccent: string;
  heroParagraphs: string[];
  heroImage: string;
  heroImageAlt: string;
  heroImageCaption: string;
  benefitsSectionTitle: string;
  benefitsSectionTitleAccent: string;
  benefits: { title: string; description: string; icon: string }[];
  comparisonTitle: string;
  comparisonTitleAccent: string;
  comparisonSubtitle: string;
  comparisonModelImage: string;
  comparisonModelAlt: string;
  comparisonModelLabel: string;
  comparisonBuildImage: string;
  comparisonBuildAlt: string;
  comparisonBuildLabel: string;
  plansTitle: string;
  plansIntro: string;
  plansBundle?: { label: string; price: string; url: string; note: string };
  learnKicker: string;
  learnTitle: string;
  learnBody: string;
  learnPoints: string[];
  learnImages: { src: string; alt: string; caption: string; w: number; h: number }[];
  learnButtonLabel: string;
  learnButtonUrl: string;
  learnNote: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonLabel: string;
};

export const metadata = pageMeta({
  title: 'Why I draw every job in SketchUp | Raf Carpentry',
  description: 'Every job is drawn in SketchUp first, so you see exactly what you are getting before a single board is ordered. Plans from real jobs, and how to learn SketchUp with me.',
  path: '/sketchup',
});

export default function SketchUpPage() {
  const d = readPageJson<SketchupPageData>('sketchup.json');
  // Plans appear here by themselves once a job has preview drawings and a Payhip link (or a free download).
  const plans = getAllProjects().filter(isPlanReady);
  const bundle = d.plansBundle?.url ? d.plansBundle : null;

  return (
    <>
      <Container className="pb-20 pt-12 md:pb-28 md:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-6">
            <h1 className="font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[58px]">
              {d.heroTitle}
              <span className="text-accent">{d.heroTitleAccent}</span>
            </h1>
            <div className="mt-8 max-w-[58ch] space-y-4 text-[17px] leading-relaxed text-muted">
              {d.heroParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <figure className="md:col-span-5 md:col-start-8">
            <MountedImage src={d.heroImage} alt={d.heroImageAlt} aspect="aspect-square" contain priority sizes="(max-width: 768px) 100vw, 480px" />
            <figcaption className="mt-4 font-mono text-[13px] text-faint">{d.heroImageCaption}</figcaption>
          </figure>
        </div>
      </Container>

      <section className="relative bg-raised py-20 md:py-28">
        <Joint />
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
            <SectionHeading className="md:col-span-5">
              {d.benefitsSectionTitle}
              <span className="text-accent">{d.benefitsSectionTitleAccent}</span>
            </SectionHeading>
            <div className="md:col-span-7">
              {d.benefits.map((b, i) => (
                <div key={i} className="border-t border-line py-7 first:border-t-0 first:pt-0">
                  <h3 className="text-[25px] font-[620] leading-tight">{b.title}</h3>
                  <p className="mt-2 max-w-[56ch] text-muted">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
        <Joint edge="bottom" />
      </section>

      <Container className="py-20 md:py-28">
        <SectionHeading>
          {d.comparisonTitle}
          <span className="text-accent">{d.comparisonTitleAccent}</span>
        </SectionHeading>
        <p className="mt-4 max-w-[56ch] text-muted">{d.comparisonSubtitle}</p>
        <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 md:grid-cols-2">
          <figure>
            <MountedImage src={d.comparisonModelImage} alt={d.comparisonModelAlt} aspect="aspect-[4/3]" contain />
            <figcaption className="mt-4 text-[17px] font-semibold">{d.comparisonModelLabel}</figcaption>
          </figure>
          <figure>
            <MountedImage src={d.comparisonBuildImage} alt={d.comparisonBuildAlt} aspect="aspect-[4/3]" />
            <figcaption className="mt-4 text-[17px] font-semibold">{d.comparisonBuildLabel}</figcaption>
          </figure>
        </div>
      </Container>

      {plans.length > 0 ? (
        <section id="plans" className="scroll-mt-24 border-t border-line">
          <Container className="py-20 md:py-28">
            <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-12 md:gap-6">
              <div className="md:col-span-7">
                <p className="kicker">Plans</p>
                <SectionHeading className="mt-3">{d.plansTitle}</SectionHeading>
                <p className="mt-4 max-w-[56ch] text-muted">{d.plansIntro}</p>
              </div>
              {bundle ? (
                <div className="mount md:col-span-5 md:justify-self-end">
                  <div className="flex flex-wrap items-center justify-between gap-4 p-3">
                    <div>
                      <p className="text-[18px] font-[640] leading-tight">{bundle.label}</p>
                      {bundle.note ? <p className="mt-1 text-[14px] text-muted">{bundle.note}</p> : null}
                    </div>
                    <a href={bundle.url} target="_blank" rel="noopener" className="btn btn-primary btn-sm">
                      Buy all, {bundle.price}
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <PlanCard key={p.slug} plan={p.planSale} title={p.title} meta={`${p.area}, ${formatMonth(p.finished)}`} href={`/portfolio/${p.slug}`} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <section id="learn" className="relative scroll-mt-24 bg-raised">
        <Joint />
        <Container className="grid grid-cols-1 gap-12 py-20 md:grid-cols-12 md:gap-6 md:py-28">
          <div className="md:col-span-5">
            <p className="kicker">{d.learnKicker}</p>
            <SectionHeading className="mt-3">{d.learnTitle}</SectionHeading>
            <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-muted">{d.learnBody}</p>
            <ol className="mt-8 border-t border-line-strong">
              {d.learnPoints.map((pt, i) => (
                <li key={pt} className="grid grid-cols-[2.5rem_1fr] gap-2 border-b border-line py-3.5">
                  <span className="font-mono text-[13px] leading-[1.6] text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[16px] leading-snug text-ink">{pt}</span>
                </li>
              ))}
            </ol>
            <a href={d.learnButtonUrl} className="btn btn-primary mt-9">{d.learnButtonLabel}</a>
            <p className="mt-4 max-w-[44ch] text-[14.5px] text-muted">{d.learnNote}</p>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <ScreenGrid shots={d.learnImages} />
          </div>
        </Container>
      </section>

      <section className="border-t border-line">
        <Container className="grid grid-cols-1 items-end gap-8 py-20 md:grid-cols-12 md:gap-6 md:py-24">
          <div className="md:col-span-8">
            <SectionHeading>{d.ctaTitle}</SectionHeading>
            <p className="mt-4 max-w-[56ch] text-muted">{d.ctaSubtitle}</p>
          </div>
          <div className="md:col-span-4 md:justify-self-end">
            <Link href="/contact" className="btn btn-primary">{d.ctaButtonLabel}</Link>
          </div>
        </Container>
      </section>
    </>
  );
}

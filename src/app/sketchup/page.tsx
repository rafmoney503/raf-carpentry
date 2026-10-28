import Image from 'next/image';
import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { Container, MountedImage, SectionHeading } from '@/components/ui';
import PlanCard from '@/components/project/PlanCard';
import ScreenGrid from '@/components/project/ScreenGrid';
import ModelGallery, { type GalleryItem } from '@/components/project/ModelGallery';
import { formatMonth, getAllProjects, isPlanReady } from '@/lib/projects';
import { pageMeta } from '@/lib/seo';

type SketchupPageData = {
  heroTitle: string;
  heroTitleAccent: string;
  heroParagraphs: string[];
  heroImage: string;
  heroImageAlt: string;
  heroImageCaption: string;
  models3dTitle?: string;
  models3dIntro?: string;
  benefitsSectionTitle: string;
  benefitsSectionTitleAccent: string;
  benefits: { title: string; description: string; icon: string }[];
  extensionKicker?: string;
  extensionTitle?: string;
  extensionTitleAccent?: string;
  extensionBody?: string;
  extensionSteps?: string[];
  extensionImage?: string;
  extensionImageAlt?: string;
  extensionPanelImage?: string;
  extensionPanelAlt?: string;
  extensionCaption?: string;
  extensionUnitsTitle?: string;
  extensionUnits?: { name: string; image: string }[];
  extensionButtonLabel?: string;
  extensionButtonUrl?: string;
  extensionNote?: string;
  extensionTrademark?: string;
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
  description: 'Every job is drawn in SketchUp first, so you see exactly what you are getting before a single board is ordered. My extension for drawing units fast, plans from real jobs, and how to learn SketchUp with me.',
  path: '/sketchup',
});

export default function SketchUpPage() {
  const d = readPageJson<SketchupPageData>('sketchup.json');
  // Plans appear here by themselves once a job has preview drawings and a Payhip link (or a free download).
  const plans = getAllProjects().filter(isPlanReady);
  const bundle = d.plansBundle?.url ? d.plansBundle : null;
  // Every job with a 3D SketchUp model (plan.model3d or model3d) shows up in "Real jobs, in 3D" by itself.
  const models: GalleryItem[] = getAllProjects().flatMap((p) => {
    const model = p.plan?.model3d ?? p.model3d;
    return model ? [{ slug: p.slug, title: p.title, area: p.area, model }] : [];
  });

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

      {models.length > 0 ? (
        <section id="in-3d" className="border-t border-line">
          <Container className="py-20 md:py-28">
            <p className="kicker">In 3D</p>
            <SectionHeading className="mt-3">{d.models3dTitle ?? 'Real jobs, in 3D'}</SectionHeading>
            {d.models3dIntro ? <p className="mt-4 max-w-[60ch] text-muted">{d.models3dIntro}</p> : null}
            <div className="mt-10">
              <ModelGallery items={models} />
            </div>
            <p className="mt-8">
              <Link href="/designs" className="link-more">
                Find one by type: wardrobes, alcoves, desks and more <span aria-hidden="true">→</span>
              </Link>
            </p>
          </Container>
        </section>
      ) : null}

      <section id="benefits" className="border-y border-line bg-raised py-20 md:py-28">
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
      </section>

      {d.extensionTitle ? <ExtensionSection d={d} /> : null}

      <div id="compare" />
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
        <section id="plans" className="border-t border-line">
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

      <section id="learn" className="border-t border-line bg-raised">
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
            <ScreenGrid shots={d.learnImages} tilt />
          </div>
        </Container>
      </section>

      <section id="get-a-design" className="border-t border-line">
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

/* The CabinetOS Units extension for SketchUp (its own page is on cabinetos.co.uk/sketchup-extension). The drawings are
   the extension's own parts, copied from cabinetos-site public/sketchup (made by its scripts/sketchup-page/render.cjs)
   with the edges in ink; the unit drawings share one height on paper, so shown at one height they are at one scale. */
function ExtensionSection({ d }: { d: SketchupPageData }) {
  const units = d.extensionUnits ?? [];
  return (
    <section id="extension" className="border-b border-line">
      <Container className="py-20 md:py-28">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-5">
            {d.extensionKicker ? <p className="kicker">{d.extensionKicker}</p> : null}
            <SectionHeading className="mt-3">
              {d.extensionTitle}
              {d.extensionTitleAccent ? <span className="text-accent">{d.extensionTitleAccent}</span> : null}
            </SectionHeading>
            {d.extensionBody ? <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-muted">{d.extensionBody}</p> : null}
            {d.extensionSteps?.length ? (
              <ol className="mt-8 border-t border-line-strong">
                {d.extensionSteps.map((pt, i) => (
                  <li key={pt} className="grid grid-cols-[2.5rem_1fr] gap-2 border-b border-line py-3.5">
                    <span className="font-mono text-[13px] leading-[1.6] text-accent">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[16px] leading-snug text-ink">{pt}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              {d.extensionButtonUrl ? (
                <a href={d.extensionButtonUrl} target="_blank" rel="noopener" className="btn btn-primary">
                  {d.extensionButtonLabel || 'See the extension'} <span aria-hidden="true">↗</span>
                </a>
              ) : null}
              <Link href="/cabinetos" className="link-more">
                What CabinetOS does <span aria-hidden="true">→</span>
              </Link>
            </div>
            {d.extensionNote ? <p className="mt-4 max-w-[44ch] text-[14.5px] text-muted">{d.extensionNote}</p> : null}
          </div>

          {d.extensionImage ? (
            <figure className="md:col-span-6 md:col-start-7 md:self-center">
              <div className={`grid gap-3 ${d.extensionPanelImage ? 'grid-cols-[93fr_54fr]' : 'grid-cols-1'}`}>
                <div className="mount">
                  <div className="relative aspect-[2510/2707] bg-white">
                    <Image src={d.extensionImage} alt={d.extensionImageAlt ?? ''} fill unoptimized sizes="(max-width: 768px) 60vw, 380px" className="object-contain p-3" />
                  </div>
                </div>
                {d.extensionPanelImage ? (
                  <div className="mount">
                    <div className="relative h-full min-h-[120px] bg-white">
                      <Image src={d.extensionPanelImage} alt={d.extensionPanelAlt ?? ''} fill sizes="(max-width: 768px) 36vw, 220px" className="object-contain" />
                    </div>
                  </div>
                ) : null}
              </div>
              {d.extensionCaption ? <figcaption className="mt-4 font-mono text-[13px] text-faint">{d.extensionCaption}</figcaption> : null}
            </figure>
          ) : null}
        </div>

        {units.length ? (
          <div className="mt-16 md:mt-20">
            {d.extensionUnitsTitle ? <h3 className="text-[20px] font-[620] leading-tight">{d.extensionUnitsTitle}</h3> : null}
            <div className="mount mt-5">
              <div className="overflow-x-auto bg-white" data-no-pull>
                <ul className="flex w-max min-w-full items-end justify-between gap-6 px-5 pb-4 pt-6">
                  {units.map((u) => (
                    <li key={u.image} className="flex shrink-0 flex-col items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- line drawings at one height, so their widths keep one scale */}
                      <img src={u.image} alt={u.name} loading="lazy" className="h-[150px] w-auto lg:h-[170px] xl:h-[230px]" />
                      <span className="mt-3 w-0 min-w-full border-t border-line-strong pt-2 text-center font-mono text-[12px] leading-snug text-muted">{u.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {d.extensionTrademark ? <p className="mt-10 max-w-[90ch] text-[12.5px] leading-relaxed text-faint">{d.extensionTrademark}</p> : null}
      </Container>
    </section>
  );
}

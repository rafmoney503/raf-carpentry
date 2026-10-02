import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { Container, MountedImage, SectionHeading } from '@/components/ui';

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
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonLabel: string;
};

export default function SketchUpPage() {
  const d = readPageJson<SketchupPageData>('sketchup.json');

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

      <section className="border-y border-line bg-raised py-20 md:py-28">
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

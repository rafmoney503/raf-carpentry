import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Container, SectionHeading } from '@/components/ui';
import CompareSlider from '@/components/project/CompareSlider';
import ProjectVideo from '@/components/project/ProjectVideo';
import ProjectGallery from '@/components/project/ProjectGallery';
import BuildPhotos from '@/components/project/BuildPhotos';
import ToolsUsed from '@/components/ToolsUsed';
import { countModels, formatMonth, getAllProjects, getKit, getProject, isPlanReady } from '@/lib/projects';
import AllIn3DLink from '@/components/project/AllIn3DLink';
import PlanCard from '@/components/project/PlanCard';
import ProjectKit from '@/components/project/ProjectKit';
import PlanDrawings from '@/components/project/PlanDrawings';
import Model3D from '@/components/project/Model3D';
import { BOOKING_URL, QUOTE_HREF, whatsappText } from '@/lib/site';
import WhatsAppButton from '@/components/WhatsAppButton';
import '../project.css';
import { pageMeta } from '@/lib/seo';
import Reviews, { GoogleRating } from '@/components/Reviews';
import { getReviews } from '@/lib/reviews';
import { serviceForJob } from '@/lib/services';

export function generateStaticParams() {
  return getAllProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) return {};
  return pageMeta({ title: `${p.title}, ${p.area} | Raf Carpentry`, description: p.summary, path: `/portfolio/${p.slug}`, ownImage: true });
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();

  const all = getAllProjects();
  const next = all[(all.findIndex((x) => x.slug === p.slug) + 1) % all.length];
  const waText = whatsappText(`/portfolio/${p.slug}`, p.title);
  const hasReviews = getReviews().reviews.length > 0;
  const service = serviceForJob(p);
  const stepCount = p.steps.length;
  // Up to five steps sit in one row on a computer; more wrap into rows of three or four.
  const stepCols = stepCount <= 5 ? stepCount : stepCount % 3 === 0 ? 3 : 4;
  const clips = p.clips ?? [];
  const build = p.buildPhotos ?? [];
  const kit = getKit(p.slug);

  return (
    <>
      {/* Header: main photo and the job's title block */}
      <Container className="pb-16 pt-8 md:pb-24 md:pt-12">
        <nav aria-label="Breadcrumb" className="mb-8 font-mono text-[13px] text-faint">
          <Link href="/portfolio" className="transition-colors hover:text-accent">My work</Link>
          <span className="px-2 text-line-strong">/</span>
          <span>{p.area}</span>
        </nav>

        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-12 md:gap-6">
          <figure className="md:col-span-7">
            <div className="mount">
              <div className="relative overflow-hidden bg-raised" style={{ aspectRatio: `${p.cover.w} / ${p.cover.h}` }}>
                <Image src={p.cover.src} alt={p.cover.alt} fill priority sizes="(max-width: 768px) 100vw, 700px" className="object-cover" />
              </div>
            </div>
          </figure>

          <div className="md:sticky md:top-28 md:col-span-5">
            {service ? (
              <Link href={`/services/${service.slug}`} className="kicker hover:underline">{p.type}</Link>
            ) : (
              <p className="kicker">{p.type}</p>
            )}
            <h1 className="mt-3 font-display text-[36px] font-[680] leading-[1.05] tracking-[-0.03em] md:text-[48px]">{p.title}</h1>
            <p className="mt-5 max-w-[52ch] text-pretty text-[17px] leading-relaxed text-muted">{p.intro}</p>

            <dl className="title-block mt-8">
              {p.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href={`${QUOTE_HREF}?job=${p.slug}`} className="btn btn-primary">Get a quote</Link>
              <WhatsAppButton text={waText} />
              <a href="#photos" className="link-more">
                All {p.gallery.length + 1} photos <span aria-hidden="true">↓</span>
              </a>
            </div>
            <GoogleRating variant="inline" className="mt-6" />
          </div>
        </div>
      </Container>

      {/* The one interactive piece each job has: before/after, the plan, or a clip */}
      {p.compare ? (
        <section className="border-t border-line">
          <Container className="grid grid-cols-1 items-start gap-10 py-16 md:grid-cols-12 md:gap-6 md:py-24">
            <div className="md:sticky md:top-28 md:col-span-4">
              <SectionHeading>Before and after</SectionHeading>
              <p className="mt-4 max-w-[40ch] text-muted">{p.compare.caption}</p>
            </div>
            <div className="md:col-span-6 md:col-start-6">
              <CompareSlider before={p.compare.before} after={p.compare.after} beforeLabel={p.compare.beforeLabel} afterLabel={p.compare.afterLabel} />
            </div>
          </Container>
        </section>
      ) : null}

      {p.plan ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <SectionHeading>{p.plan.title}</SectionHeading>
            <p className="mt-4 max-w-[56ch] text-muted">{p.plan.text}</p>
            <PlanDrawings plan={p.plan} title={p.title} modelCount={countModels()} />
          </Container>
        </section>
      ) : null}

      {p.model3d ? (
        <section id="in-3d" className="scroll-mt-24 border-t border-line">
          <Container className="py-16 md:py-24">
            <SectionHeading>{p.model3d.title ?? 'In 3D'}</SectionHeading>
            {p.model3d.text ? <p className="mt-4 max-w-[56ch] text-muted">{p.model3d.text}</p> : null}
            <div className="mt-10">
              <Model3D src={p.model3d.src} poster={p.model3d.poster} label={p.model3d.poster.alt} shape={p.model3d.shape} skp={p.model3d.skp} />
            </div>
            <AllIn3DLink count={countModels()} />
          </Container>
        </section>
      ) : null}

      {p.video ? (
        <section className="border-t border-line">
          <Container className="grid grid-cols-1 items-center gap-10 py-16 md:grid-cols-12 md:gap-6 md:py-24">
            <div className="mx-auto w-full max-w-[340px] md:col-span-4 md:mx-0">
              <ProjectVideo src={p.video.src} poster={p.video.poster.src} label={p.video.title} />
            </div>
            <div className="md:col-span-6 md:col-start-6">
              <SectionHeading>{p.video.title}</SectionHeading>
              <p className="mt-4 max-w-[46ch] text-muted">{p.video.text}</p>
            </div>
          </Container>
        </section>
      ) : null}

      {/* How it went together */}
      {stepCount > 0 ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <SectionHeading>How it went together</SectionHeading>
            <ol className="steps-row mt-10" style={{ ['--steps' as string]: stepCols }}>
              {p.steps.map((s, i) => (
                <li key={s.title}>
                  <div className="mount">
                    <div className="relative aspect-[3/4] overflow-hidden bg-raised">
                      <Image src={s.image.src} alt={s.image.alt} fill sizes="(max-width: 768px) 72vw, 300px" className="object-cover" />
                    </div>
                  </div>
                  <p className="step-no mt-5">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="mt-1 text-[19px] font-[620] leading-snug">{s.title}</h3>
                  <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      ) : null}

      {/* Clips from the job folder */}
      {clips.length ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <SectionHeading>{p.video ? 'More on video' : 'On video'}</SectionHeading>
            <ul className={`mt-10 grid grid-cols-1 gap-x-6 gap-y-10 ${clips.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-12'}`}>
              {clips.map((c) => (
                <li key={c.src} className={clips.length > 1 ? 'mx-auto w-full max-w-[340px] sm:mx-0' : 'grid grid-cols-1 items-center gap-8 md:col-span-12 md:grid-cols-12 md:gap-6'}>
                  <div className={clips.length > 1 ? '' : 'mx-auto w-full max-w-[340px] md:col-span-4 md:mx-0'}>
                    <ProjectVideo src={c.src} poster={c.poster.src} label={c.caption} />
                  </div>
                  <p className={clips.length > 1 ? 'mt-4 text-[15.5px] leading-relaxed text-muted' : 'max-w-[46ch] text-[17px] leading-relaxed text-muted md:col-span-6 md:col-start-6'}>{c.caption}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* All photos */}
      <section id="photos" className="scroll-mt-24 border-t border-line">
        <Container className="py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading>Photos</SectionHeading>
            <p className="font-mono text-[13px] text-faint">Tap a photo to see it full size</p>
          </div>
          <div className="mt-10">
            <ProjectGallery photos={[p.cover, ...p.gallery]} title={p.title} />
          </div>
        </Container>
      </section>

      {/* The rest of the build photos */}
      {build.length ? (
        <section id="build" className="scroll-mt-24 border-t border-line">
          <Container className="py-16 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading>More from the build</SectionHeading>
              <p className="font-mono text-[13px] text-faint">{build.length} photos from the job</p>
            </div>
            <div className="mt-10">
              <BuildPhotos photos={build} title={`${p.title}: the build`} />
            </div>
          </Container>
        </section>
      ) : null}

      {/* Materials and tools, once Raf has confirmed them in his sheet */}
      {kit ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <ProjectKit kit={kit} />
          </Container>
        </section>
      ) : null}

      {/* Plans for this job: free preview of the drawings, then buy or download */}
      {isPlanReady(p) ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-24">
            <p className="kicker">Build it yourself</p>
            <SectionHeading className="mt-3">The plans for this job</SectionHeading>
            <div className="mt-10">
              <PlanCard plan={p.planSale} title={p.title} meta={`${p.area}, ${formatMonth(p.finished)}`} wide />
            </div>
          </Container>
        </section>
      ) : null}

      {/* The write-up and tools: only shown once they exist */}
      {p.blogSlug || (p.tools && p.tools.length > 0) ? (
        <section className="border-t border-line">
          <Container className="py-16 md:py-20">
            <div className="max-w-[760px]">
              {p.blogSlug ? (
                <Link href={`/blog/${p.blogSlug}`} className="link-more text-[18px]">
                  Read the full story on the blog <span aria-hidden="true">→</span>
                </Link>
              ) : null}
              {p.tools && p.tools.length > 0 ? <ToolsUsed tools={p.tools} /> : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* What customers say (reviews about this job first) */}
      <section className="border-t border-line">
        <Container className={hasReviews ? 'py-14 md:py-20' : 'py-8 md:py-10'}>
          <Reviews max={3} job={{ slug: p.slug, main: `${p.type} ${p.title}`, tags: (p.tags ?? []).join(' ') }} />
        </Container>
      </section>

      {/* Quote and next job */}
      <section className="border-t border-line bg-raised">
        <Container className="grid grid-cols-1 items-end gap-10 py-16 md:grid-cols-12 md:gap-6 md:py-20">
          <div className="md:col-span-7">
            <SectionHeading>Want something like this?</SectionHeading>
            <p className="mt-4 max-w-[52ch] text-muted">Tell me about the room. I&apos;ll come and measure up, then draw it before anything is cut.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`${QUOTE_HREF}?job=${p.slug}`} className="btn btn-primary">Get a quote</Link>
              <WhatsAppButton text={waText} />
            </div>
            <a href={BOOKING_URL} target="_blank" rel="noopener" className="link-more mt-6 text-[15px]">
              Rather pick a date yourself? Book a visit online <span aria-hidden="true">↗</span>
            </a>
          </div>
          {next && next.slug !== p.slug ? (
            <Link href={`/portfolio/${next.slug}`} className="group md:col-span-4 md:col-start-9">
              <p className="font-mono text-[13px] text-faint">Next job</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="mount w-24 shrink-0 p-1.5 transition-colors group-hover:border-accent">
                  <div className="relative aspect-[3/4] overflow-hidden bg-raised">
                    <Image src={next.cover.src} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                </div>
                <div>
                  <p className="text-[18px] font-[620] leading-snug transition-colors group-hover:text-accent">{next.title}</p>
                  <p className="mt-1 font-mono text-[13px] text-faint">{next.area}, {formatMonth(next.finished)}</p>
                </div>
              </div>
            </Link>
          ) : null}
        </Container>
      </section>
    </>
  );
}

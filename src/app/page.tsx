import Image from 'next/image';
import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { getAllPosts } from '@/lib/blog';
import QuoteCta from '@/components/QuoteCta';
import Reviews, { GoogleRating } from '@/components/Reviews';
import { getReviews } from '@/lib/reviews';
import { countModels, formatMonth, getAllProjects, modelOf } from '@/lib/projects';
import { libraryKinds } from '@/lib/design-library';
import { QUOTE_HREF, whatsappText, whatsappUrl } from '@/lib/site';
import SocialIcon from '@/components/SocialIcon';
import JobsNear from '@/components/JobsNear';
import PlannerTeaser from '@/components/PlannerTeaser';
import BuildStory from '@/components/BuildStory';
import { HeroLevel } from '@/components/ScrollLevel';
import HeroDoors from '@/components/HeroDoors';
import CountUp from '@/components/CountUp';
import ServiceStack from '@/components/ServiceStack';
import WipeCover from '@/components/WipeCover';
import TiltShot from '@/components/TiltShot';
import DeviceTrio from '@/components/DeviceTrio';
import { areaPageLinks, getNearJobs } from '@/lib/areas';
import { businessJsonLd, jsonLd, pageMeta } from '@/lib/seo';
import './home.css';
import './home-motion.css';

/* Rebuilt at most once an hour, so the photo of the day changes soon after midnight (London)
   and new jobs show in "Latest jobs" without a redeploy. */
export const revalidate = 3600;

export const metadata = pageMeta({
  title: 'Raf Carpentry | Fitted wardrobes and built-in furniture in London',
  description: 'Fitted wardrobes, alcove units, bookcases and built-ins across London. You see the 3D drawing before a board is cut, and I reply within 24 hours.',
  path: '/',
  ownImage: true,
});

export type HomePageData = {
  heroKicker: string;
  heroTitle: string;
  heroTitleAccent: string;
  heroSubtitle: string;
  heroImage: string;
  heroImageAlt: string;
  /* Main photo of the day: one of these jobs, in turn, a new one each day. */
  heroJobs?: { job: string; image?: string; imageAlt?: string; position?: string }[];
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  facts: { value: string; unit?: string; label: string }[];
  buildHeading: string;
  buildIntro: string;
  services: { title: string; description: string; image: string; imageAlt: string; link?: string }[];
  processHeading: string;
  processImage: string;
  processImageAlt: string;
  processCaption: string;
  steps: { title: string; description: string }[];
  processLinkLabel: string;
  appKicker: string;
  appHeading: string;
  appBody: string;
  appImage: string;
  appImageAlt: string;
  appTabletImage?: string;
  appTabletImageAlt?: string;
  appPhoneImage?: string;
  appPhoneImageAlt?: string;
  appLinkLabel: string;
  blogHeading: string;
  quoteHeading: string;
  quoteBody: string;
  phone: string;
  email: string;
  quotePanelHeading: string;
  quotePanelBody: string;
  quoteNextSteps: string[];
  quoteNote: string;
};

function formatDate(value: unknown): string {
  const d = new Date(value instanceof Date ? value : String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
}

/* Days since 1970 by the London calendar, so the photo changes at midnight UK time. */
function londonDay(now = new Date()) {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000);
}

/* The headline, a word at a time, so each word can settle in after the one before (home-motion.css .hw). */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i, all) => (
      <span key={i}>
        <span className="hw" style={{ '--i': from + i } as React.CSSProperties}>{w}</span>
        {i < all.length - 1 ? ' ' : null}
      </span>
    ));
}

export default function HomePage() {
  const d = readPageJson<HomePageData>('home.json');
  const posts = getAllPosts().slice(0, 3);
  const hasReviews = getReviews().reviews.length > 0;
  const phoneHref = `tel:${d.phone.replace(/\s/g, '')}`;
  const projects = getAllProjects();
  const latest = projects.slice(0, 4);

  // Main photo of the day: the jobs listed in home.json take turns, one per day; each links to its job.
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const heroOptions = (d.heroJobs ?? []).flatMap((h) => {
    const p = bySlug.get(h.job);
    if (!p) return [];
    return [{ href: `/portfolio/${p.slug}`, src: h.image || p.cover.src, alt: (h.image && h.imageAlt) || p.cover.alt, position: h.position, caption: `${p.title}, ${p.area}` }];
  });
  const hero = heroOptions.length ? heroOptions[londonDay() % heroOptions.length] : null;

  return (
    <div className="home">
      {/* Business details for Google: same name, address and phone as the Google Business Profile. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(businessJsonLd)} />
      <section className="wrap grid12 hero">
        <div className="hero-copy">
          <p className="kicker anim">{d.heroKicker}</p>
          <h1 className="h1">
            <Words text={d.heroTitle} /> <em><Words text={d.heroTitleAccent} from={d.heroTitle.split(/\s+/).filter(Boolean).length} /></em>
          </h1>
          {/* A spirit level that tips while the page scrolls and settles with a tick (src/lib/scroll-level.ts). */}
          <HeroLevel className="anim d2" />
          <p className="hero-sub anim d2">{d.heroSubtitle}</p>
          <div className="hero-ctas anim d3">
            <Link className="btn btn-primary" href={QUOTE_HREF}>{d.primaryCtaLabel}</Link>
            <Link className="btn btn-ghost" href="/portfolio">{d.secondaryCtaLabel}</Link>
          </div>
          <GoogleRating variant="inline" className="hero-rating anim d3" />
          {/* The nudge: what are you planning? Each opens that kind on the Designs in 3D page. */}
          <nav aria-label="See designs in 3D" className="hero-plan anim d3">
            <p className="hero-plan-q">Planning something? See it in 3D first</p>
            <div className="hero-plan-row">
              {libraryKinds()
                .slice(0, 5)
                .map((k) => (
                  <Link key={k.slug} href={`/designs/${k.slug}`} className="hero-plan-chip">
                    {k.short}
                  </Link>
                ))}
              <Link href="/designs" className="hero-plan-chip hero-plan-all">
                All {countModels()} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <PlannerTeaser className="hero-plan-tool" />
          </nav>
        </div>
        <figure className="hero-visual anim d2">
          {hero ? (
            <Link href={hero.href} className="hero-link">
              <div className="mount">
                <div className="photo hero-photo">
                  <Image src={hero.src} alt={hero.alt} fill priority sizes="(max-width: 860px) 100vw, 500px" style={hero.position ? { objectPosition: hero.position } : undefined} />
                  <HeroDoors />
                </div>
              </div>
              <figcaption className="hero-cap">
                <span>{hero.caption}</span>
                <span className="hero-cap-go">See the job <span aria-hidden="true">→</span></span>
              </figcaption>
            </Link>
          ) : (
            <div className="mount">
              <div className="photo hero-photo">
                <Image src={d.heroImage} alt={d.heroImageAlt} fill priority sizes="(max-width: 860px) 100vw, 500px" />
                <HeroDoors />
              </div>
            </div>
          )}
        </figure>
      </section>

      <section className="wrap" aria-label="At a glance">
        <div className="grid12 facts">
          {d.facts.map((f) => (
            <div className="fact reveal" key={f.label}>
              <p className="fact-v">
                <CountUp value={f.value} />
                {f.unit ? <small>{f.unit}</small> : null}
              </p>
              <p className="fact-l">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec" id="work">
        <div className="wrap">
          <div className="sec-head reveal">
            <h2 className="h2">{d.buildHeading}</h2>
            <p className="lede">{d.buildIntro}</p>
          </div>
          {/* On a computer the three cards stack under the menu bar as the page scrolls (ServiceStack). */}
          <ServiceStack items={d.services.slice(0, 3)} />
          <div className="build-foot">
            <Link className="link-more" href="/services">
              Everything I build <span aria-hidden="true">→</span>
            </Link>
            <Link className="link-more" href="/portfolio">
              {d.secondaryCtaLabel} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* The newest jobs, straight from the job pages: changes by itself when a job goes up */}
      {latest.length ? (
        <section className="sec latest" id="latest">
          <div className="wrap">
            <div className="latest-head reveal">
              <h2 className="h2">Latest jobs</h2>
              <Link className="link-more" href="/portfolio">
                All {projects.length} jobs <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul className="latest-row">
              {latest.map((p) => (
                <li key={p.slug} className="reveal">
                  <Link href={`/portfolio/${p.slug}`} className="latest-card">
                    <div className="mount">
                      <WipeCover photo={p.cover} model={modelOf(p)?.poster.src} sizes="(max-width: 860px) 68vw, 290px" row />
                    </div>
                    <p className="latest-meta">{formatMonth(p.finished)} · {p.area}</p>
                    <h3>{p.title}</h3>
                  </Link>
                </li>
              ))}
            </ul>
            {/* Jobs near you: a postcode shows the nearest jobs with rough miles */}
            <div className="mt-16 border-t border-line pt-12 md:mt-20 md:pt-14">
              <JobsNear jobs={getNearJobs()} areaLinks={areaPageLinks()} bars />
              <p className="mt-8">
                <Link href="/areas" className="link-more text-[15px]">
                  Everywhere I&apos;ve worked <span aria-hidden="true">→</span>
                </Link>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* How I work: one wardrobe goes through the four steps in 3D while the page scrolls */}
      <BuildStory
        heading={d.processHeading}
        steps={d.steps}
        fallback={{ src: d.processImage, alt: d.processImageAlt, caption: d.processCaption }}
        plannerHref="/wardrobe-planner"
        quoteHref={QUOTE_HREF}
      >
        <Link className="link-more" href="/how-it-works">
          Plan your project <span aria-hidden="true">→</span>
        </Link>
        <Link className="link-more" href="/sketchup">
          {d.processLinkLabel} <span aria-hidden="true">→</span>
        </Link>
        <Link className="link-more" href="/designs">
          See all {countModels()} designs in 3D <span aria-hidden="true">→</span>
        </Link>
      </BuildStory>

      <section className={`sec reviews${hasReviews ? '' : ' sec-tight'}`} id="reviews">
        <div className="wrap">
          <Reviews max={6} homeHeading ticker />
        </div>
      </section>

      <section className="sec app">
        <div className="wrap grid12">
          <div className="app-copy reveal">
            <p className="kicker">{d.appKicker}</p>
            <h2 className="h2">{d.appHeading}</h2>
            <p className="lede">{d.appBody}</p>
            <Link className="link-more" href="/cabinetos">
              {d.appLinkLabel} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <figure className="app-shot reveal">
            <TiltShot className="app-tilt">
              <DeviceTrio
                computer={{ src: d.appImage, alt: d.appImageAlt }}
                tablet={d.appTabletImage ? { src: d.appTabletImage, alt: d.appTabletImageAlt || '' } : undefined}
                phone={d.appPhoneImage ? { src: d.appPhoneImage, alt: d.appPhoneImageAlt || '' } : undefined}
              />
            </TiltShot>
          </figure>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="sec blog">
          <div className="wrap">
            <div className="sec-head reveal">
              <h2 className="h2">{d.blogHeading}</h2>
            </div>
            <ul>
              {posts.map((p) => (
                <li className="reveal" key={p.slug}>
                  <Link className="post" href={`/blog/${p.slug}`}>
                    <span className="post-date">{formatDate(p.date)}</span>
                    <span className="post-title">{p.title}</span>
                    <span className="post-cat">{p.category}</span>
                    <span className="post-arrow" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="sec quote" id="quote">
        <div className="wrap grid12">
          <div className="quote-copy reveal">
            <h2 className="h2">{d.quoteHeading}</h2>
            <p className="lede">{d.quoteBody}</p>
            <div className="direct">
              <div>
                <p className="direct-l">Call or text</p>
                <a className="direct-v" href={phoneHref}>{d.phone}</a>
              </div>
              <div>
                <p className="direct-l">WhatsApp</p>
                <a className="direct-v direct-wa" href={whatsappUrl(whatsappText('/'))} target="_blank" rel="noopener">
                  <SocialIcon network="whatsapp" size={24} className="text-whatsapp" />
                  Message me
                </a>
              </div>
              <div>
                <p className="direct-l">Email</p>
                <a className="direct-v" href={`mailto:${d.email}`}>{d.email}</a>
              </div>
            </div>
          </div>
          <div className="quote-form reveal">
            <QuoteCta
              heading={d.quotePanelHeading}
              body={d.quotePanelBody}
              steps={d.quoteNextSteps}
              buttonLabel={d.primaryCtaLabel}
              note={d.quoteNote}
              quoteOnly
            />
          </div>
        </div>
      </section>
    </div>
  );
}

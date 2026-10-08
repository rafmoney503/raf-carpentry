import { ViewTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { readPageJson } from '@/lib/pages';
import { getAllPosts } from '@/lib/blog';
import QuoteCta from '@/components/QuoteCta';
import Reviews, { GoogleRating } from '@/components/Reviews';
import { getReviews } from '@/lib/reviews';
import { formatMonth, getAllProjects } from '@/lib/projects';
import { QUOTE_HREF, whatsappText, whatsappUrl } from '@/lib/site';
import SocialIcon from '@/components/SocialIcon';
import { businessJsonLd, jsonLd, pageMeta } from '@/lib/seo';
import './home.css';
import Joint from '@/components/Joint';
import JobLink from '@/components/JobLink';

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

const tileClass = ['tile-a', 'tile-b', 'tile-c'];
const tileSizes = ['(max-width: 860px) 100vw, 700px', '(max-width: 860px) 100vw, 490px', '(max-width: 860px) 100vw, 490px'];

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
          <h1 className="h1 anim d1">
            {d.heroTitle} <em>{d.heroTitleAccent}</em>
          </h1>
          <p className="hero-sub anim d2">{d.heroSubtitle}</p>
          <div className="hero-ctas anim d3">
            <Link className="btn btn-primary" href={QUOTE_HREF}>{d.primaryCtaLabel}</Link>
            <Link className="btn btn-ghost" href="/portfolio">{d.secondaryCtaLabel}</Link>
          </div>
          <GoogleRating variant="inline" className="hero-rating anim d3" />
        </div>
        <figure className="hero-visual anim d2">
          {hero ? (
            <Link href={hero.href} className="hero-link">
              <div className="mount">
                <div className="photo hero-photo">
                  <Image src={hero.src} alt={hero.alt} fill priority sizes="(max-width: 860px) 100vw, 500px" style={hero.position ? { objectPosition: hero.position } : undefined} />
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
                {f.value}
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
          <div className="grid12 build">
            {d.services.slice(0, 3).map((s, i) => (
              <article className={`tile ${tileClass[i]} reveal`} key={s.title}>
                <div className="mount">
                  <div className="photo">
                    <Image src={s.image} alt={s.imageAlt} fill sizes={tileSizes[i]} />
                  </div>
                </div>
                <h3>{s.link ? <Link href={s.link} className="tile-link">{s.title}</Link> : s.title}</h3>
                <p>{s.description}</p>
              </article>
            ))}
          </div>
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
                  <JobLink href={`/portfolio/${p.slug}`} cover={p.cover.src} className="latest-card">
                    <div className="mount">
                      <ViewTransition name={`job-${p.slug}`} share="job-photo">
                        <div className="photo latest-photo">
                          <Image src={p.cover.src} alt={p.cover.alt} fill sizes="(max-width: 860px) 68vw, 290px" />
                        </div>
                      </ViewTransition>
                    </div>
                    <p className="latest-meta">{formatMonth(p.finished)} · {p.area}</p>
                    <h3>{p.title}</h3>
                  </JobLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="sec process" id="process">
        <Joint />
        <div className="wrap grid12">
          <figure className="drawing reveal">
            <Image src={d.processImage} alt={d.processImageAlt} width={1056} height={1047} sizes="(max-width: 860px) 100vw, 560px" />
            <figcaption>{d.processCaption}</figcaption>
          </figure>
          <div className="process-copy">
            <h2 className="h2 reveal">{d.processHeading}</h2>
            <ol className="steps">
              {d.steps.map((s) => (
                <li className="step reveal" key={s.title}>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                </li>
              ))}
            </ol>
            <div className="process-foot reveal">
              <Link className="link-more" href="/how-it-works">
                Plan your project <span aria-hidden="true">→</span>
              </Link>
              <Link className="link-more" href="/sketchup">
                {d.processLinkLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
        <Joint edge="bottom" />
      </section>

      <section className={`sec reviews${hasReviews ? '' : ' sec-tight'}`} id="reviews">
        <div className="wrap">
          <Reviews max={6} homeHeading />
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
            <div className="app-frame">
              <Image src={d.appImage} alt={d.appImageAlt} width={1600} height={1053} sizes="(max-width: 860px) 100vw, 760px" />
            </div>
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
            />
          </div>
        </div>
      </section>
    </div>
  );
}

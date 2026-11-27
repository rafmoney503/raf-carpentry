import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import SocialIcon, { networkOf } from '@/components/SocialIcon';
import { readPageJson } from '@/lib/pages';
import { GoogleRating } from '@/components/Reviews';
import { getReviews } from '@/lib/reviews';
import { RsMark } from '@/components/AlsoByMe';
import { getAllProjects, type Project } from '@/lib/projects';
import { getAllPosts } from '@/lib/blog';
import { PAX_GUIDE } from '@/lib/pax-guide';
import PlannerClip from '@/components/PlannerClip';
import { EXTENSION_CLIP_WIDE, EXTENSION_STILL_WIDE } from '@/lib/extension-clip';
import { APP_STEPS, BANNER_JOBS, COLLAGE_JOBS, GROUPS, PANELS_ANSWER, TOOL_PHOTOS, lookOf, type Group, type Look } from './look';
import './ms.css';

/* The Instagram link-in-bio page. Since 20 Nov 2026 (Raf: "add some mini miniatures for each button/section to make
   it more interesting", mockup C on the "Instagram page with mini pictures" canvas) the buttons sit in four groups,
   each with a picture: job photos, the apps on their screens, the PAX guide's cover. Words, links and order are in
   content/pages/ms.json (TinaCMS); the look of each button is in ./look.ts. */

type MsLink = {
  label: string;
  subtitle: string;
  url: string;
  icon: string;
  highlight: boolean;
};

type MsPageData = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  subtitle: string;
  links: MsLink[];
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
};

type Item = { link: MsLink; look: Look };
type Block = { type: 'pair' | 'grid'; items: Item[] } | { type: 'one'; item: Item };

export async function generateMetadata(): Promise<Metadata> {
  const d = readPageJson<MsPageData>('ms.json');
  return {
    title: d.metaTitle,
    description: d.metaDescription,
  };
}

const outside = (url: string) => (url.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {});

const shortMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/* Next to each other in ms.json, the two halves (Book a Service and WhatsApp) share a row, and the square tiles go two
   to a row; everything else takes the whole width. */
function blocks(items: Item[]): Block[] {
  const out: Block[] = [];
  for (const item of items) {
    const kind = item.look.kind;
    const type = kind === 'half' || kind === 'whatsapp' ? 'pair' : kind === 'tile' ? 'grid' : null;
    const last = out[out.length - 1];
    if (type && last && last.type === type) last.items.push(item);
    else out.push(type ? { type, items: [item] } : { type: 'one', item });
  }
  return out;
}

function Tag({ children, tone = 'ink', className = '' }: { children: ReactNode; tone?: 'ink' | 'accent'; className?: string }) {
  const colour = tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-ink text-white';
  return (
    <span className={`absolute left-2 top-2 rounded-[2px] px-1.5 py-[5px] font-mono text-[10px] uppercase leading-none tracking-[0.05em] ${colour} ${className}`}>
      {children}
    </span>
  );
}

const Arrow = () => (
  <span aria-hidden="true" className="flex-none text-accent transition-transform group-hover:translate-x-1">
    →
  </span>
);

const cardBox = 'group overflow-hidden rounded-[2px] border border-line-strong bg-mount transition-colors hover:border-accent';

function Words({ link, extra }: { link: MsLink; extra?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[15px] font-semibold leading-snug transition-colors group-hover:text-accent">
        {link.label}
        {extra}
      </div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{link.subtitle}</div>
    </div>
  );
}

function Stars({ size }: { size: number }) {
  return (
    <span className="flex text-accent" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

function Mini({ look, rating }: { look: Look; rating?: string }) {
  const box = 'relative flex h-[50px] w-[50px] flex-none items-center justify-center overflow-hidden rounded-[2px] border border-line bg-white';
  if (look.mark === 'rs') {
    return (
      <span className={box}>
        <RsMark size={40} edge="mount" />
      </span>
    );
  }
  if (look.mark === 'r') {
    return (
      <span className={box}>
        <Image src="/images/r-logo-final.png" alt="" width={80} height={80} className="h-10 w-10 rounded-full object-cover" />
      </span>
    );
  }
  if (look.mark === 'google') {
    return (
      <span className={`${box} flex-col gap-0.5`}>
        <span className="font-display text-[17px] font-bold leading-none">{rating || '5'}</span>
        <Stars size={8} />
      </span>
    );
  }
  if (!look.image) {
    return (
      <span className={box}>
        <Image src="/images/r-logo-final.png" alt="" width={80} height={80} className="h-10 w-10 rounded-full object-cover" />
      </span>
    );
  }
  return (
    <span className={box}>
      <Image src={look.image} alt="" fill sizes="100px" className="object-cover" style={{ objectPosition: look.position }} />
    </span>
  );
}

function Row({ item, rating, extra }: { item: Item; rating?: string; extra?: ReactNode }) {
  const { link, look } = item;
  if (link.highlight && !look.image && !look.mark) {
    // A highlighted button added in TinaCMS that has no picture yet: the blue button as before.
    return (
      <a href={link.url} {...outside(link.url)} className="group flex min-h-[68px] items-center gap-4 rounded-[2px] border border-accent bg-accent px-5 py-4 text-on-accent transition-colors hover:bg-accent-hover">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{link.label}</div>
          <div className="mt-0.5 text-[12.5px] leading-snug text-on-accent/80">{link.subtitle}</div>
        </div>
        <span aria-hidden="true">→</span>
      </a>
    );
  }
  return (
    <a href={link.url} {...outside(link.url)} className={`${cardBox} flex items-center gap-3.5 py-2.5 pl-2.5 pr-4`}>
      <Mini look={look} rating={rating} />
      <Words link={link} extra={extra} />
      <Arrow />
    </a>
  );
}

function Count({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 font-mono text-[11px] font-normal text-accent">{children}</span>;
}

function Half({ item }: { item: Item }) {
  const { link, look } = item;
  if (look.kind === 'whatsapp') {
    return (
      <a href={link.url} {...outside(link.url)} className="group flex flex-col justify-between rounded-[2px] border border-whatsapp bg-whatsapp px-3 pb-3 pt-3.5 text-white transition-colors hover:bg-whatsapp-hover">
        <SocialIcon network="whatsapp" size={38} />
        <div className="mt-4">
          <div className="text-[16px] font-semibold leading-tight">{link.label}</div>
          <div className="mt-1 text-[12px] leading-snug text-white/90">{link.subtitle}</div>
          {look.tag ? <div className="mt-2.5 inline-block rounded-[2px] bg-white/20 px-1.5 py-1 font-mono text-[10.5px] uppercase leading-none tracking-[0.04em]">{look.tag}</div> : null}
        </div>
      </a>
    );
  }
  return (
    <a href={link.url} {...outside(link.url)} className={`${cardBox} flex flex-col`}>
      <div className="relative h-[150px]">
        {look.image ? <Image src={look.image} alt="" fill sizes="(max-width: 512px) 50vw, 250px" className="object-cover" style={{ objectPosition: look.position }} /> : null}
        {look.tag ? <Tag>{look.tag}</Tag> : null}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="text-[14.5px] font-semibold leading-snug transition-colors group-hover:text-accent">{link.label}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted">{link.subtitle}</div>
      </div>
    </a>
  );
}

/* A part of a picture that waits before it moves (motion.css adds it to the part's own delay). */
const after = (s: number) => ({ '--mv-o': `${s}s` }) as CSSProperties;

/* What's drawn over a square tile's photo (look.art). The pictures are square crops made for these tiles, so the
   drawings are placed on a 170 by 170 grid over them. */
function TileArt({ look }: { look: Look }) {
  switch (look.art) {
    case 'panels':
      return (
        <>
          <svg viewBox="0 0 170 170" className="absolute inset-0 h-full w-full text-accent" aria-hidden="true">
            <rect className="mv-ms-glow" x="71" y="62" width="24" height="36" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.4" />
            <path d="M71 49H95M71 46V52M95 46V52" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <rect x="64" y="35" width="38" height="11" rx="1.5" className="fill-mount" />
            <text x="83" y="43.5" textAnchor="middle" fontSize="8" fontWeight="500" fill="currentColor" className="font-mono">
              603.7
            </text>
            <text transform="translate(86 80) rotate(-90)" textAnchor="middle" fontSize="8" fontWeight="500" fill="currentColor" className="font-mono">
              862
            </text>
          </svg>
          <div aria-hidden="true" className="mv-ms-strip absolute inset-x-0 bottom-0 bg-ink/90 px-2.5 py-[7px] font-mono text-[9.5px] leading-[1.35] text-white">
            <span className="uppercase tracking-[0.04em] text-white/65">Worked out in the app</span>
            <br />
            {PANELS_ANSWER}
          </div>
        </>
      );
    case 'sum':
      return (
        <div aria-hidden="true" className="absolute inset-x-[9px] bottom-[9px] rounded-[6px] border border-line bg-mount px-2.5 pb-[7px] pt-1.5 text-right shadow-[0_4px_12px_rgb(22_25_28/0.18)]">
          <div className="font-mono text-[10px] text-muted">600 − 36 =</div>
          <div className="mv-drop mt-px font-display text-[30px] font-bold leading-none" style={after(0.2)}>
            564
          </div>
          <div className="mt-[5px] h-[1.5px] bg-accent" />
        </div>
      );
    case 'skirting':
      return (
        <svg viewBox="0 0 170 170" className="absolute inset-0 h-full w-full text-accent" aria-hidden="true">
          <g className="mv-grow-x">
            <path d="M53 125H117M53 120V130M117 120V130" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </g>
          <g className="mv-show" style={after(0.4)}>
            <rect x="38" y="136" width="94" height="14" rx="2" fill="currentColor" />
            <text x="85" y="145.6" textAnchor="middle" fontSize="7.2" letterSpacing="0.3" className="fill-white font-mono">
              SKIRTING TO SKIRTING
            </text>
          </g>
        </svg>
      );
    case 'wipe':
      return (
        <>
          {/* Loaded straight away: hidden until the wipe, a lazy picture would never start loading. */}
          {look.drawing ? <Image src={look.drawing} alt="" fill loading="eager" sizes="(max-width: 512px) 50vw, 250px" className="mv-ms-wipe object-cover" /> : null}
          <span aria-hidden="true" className="mv-ms-line absolute inset-y-0 -ml-px w-0.5 bg-accent" />
          <Tag className="mv-ms-built">Built</Tag>
          <Tag tone="accent" className="mv-ms-drawn">3D drawing</Tag>
        </>
      );
    default:
      return null;
  }
}

function Tile({ item, tag }: { item: Item; tag?: string }) {
  const { link, look } = item;
  const label = tag ?? look.tag;
  return (
    <a href={link.url} {...outside(link.url)} className={`${cardBox} flex flex-col`}>
      <div className="relative aspect-square overflow-hidden bg-raised" data-motion={look.art ? '' : undefined}>
        {look.image ? <Image src={look.image} alt="" fill sizes="(max-width: 512px) 50vw, 250px" className="object-cover" style={{ objectPosition: look.position }} /> : null}
        <TileArt look={look} />
        {label ? <Tag>{label}</Tag> : null}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="text-[14px] font-semibold leading-snug transition-colors group-hover:text-accent">{link.label}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted">{link.subtitle}</div>
      </div>
    </a>
  );
}

function Wide({ href, children, words }: { href: string; children: ReactNode; words: ReactNode }) {
  return (
    <a href={href} {...outside(href)} className={`${cardBox} block`}>
      {children}
      <div className="flex items-center gap-3 px-3.5 pb-3 pt-2.5">
        {words}
        <Arrow />
      </div>
    </a>
  );
}

function Kicker({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-2.5 font-mono text-[11px] font-normal uppercase tracking-[0.09em] text-muted">
      <span className="text-accent">{String(n).padStart(2, '0')}</span>
      <span>{title}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </h2>
  );
}

export default function MiniSite() {
  const d = readPageJson<MsPageData>('ms.json');
  const reviews = getReviews();
  const projects = getAllProjects();
  const latest = projects[0];
  const jobs = (slugs: string[]) => slugs.map((s) => projects.find((p) => p.slug === s)).filter((p): p is Project => Boolean(p));
  const banner = jobs(BANNER_JOBS);
  const collage = jobs(COLLAGE_JOBS);
  const postCount = getAllPosts().length;
  /* The Tips tile names the tip its picture shows (measuring an alcove skirting to skirting) and how many there are. */
  const tips = readPageJson<{ tips?: { sketch?: string }[] }>('tips.json').tips ?? [];
  const tipAt = tips.findIndex((t) => t.sketch === 'skirting');
  const tipTag = tips.length ? (tipAt >= 0 ? `Tip ${String(tipAt + 1).padStart(2, '0')} of ${tips.length}` : `${tips.length} tips`) : undefined;
  const socials = [
    { href: d.instagramUrl, label: 'Instagram' },
    { href: d.tiktokUrl, label: 'TikTok' },
    { href: d.facebookUrl, label: 'Facebook' },
  ].filter((s) => s.href);

  const items: Item[] = d.links.map((link) => ({ link, look: lookOf(link.url) }));
  const inGroup = (g: Group) => items.filter((i) => i.look.group === g);

  const one = (item: Item) => {
    const { link, look } = item;
    switch (look.kind) {
      case 'collage':
        return (
          <Wide
            href={link.url}
            words={<Words link={link} extra={<Count>{projects.length} jobs</Count>} />}
          >
            <div className="grid h-[170px] grid-cols-3 grid-rows-2 gap-0.5">
              {collage.map((p, i) => (
                <div key={p.slug} className={`relative ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                  <Image src={p.cover.src} alt="" fill sizes={i === 0 ? '(max-width: 512px) 66vw, 340px' : '(max-width: 512px) 33vw, 170px'} className="object-cover" />
                </div>
              ))}
            </div>
          </Wide>
        );
      case 'model':
        return (
          <Wide href={link.url} words={<Words link={link} />}>
            <div
              className="relative h-[160px]"
              style={{
                backgroundImage: 'linear-gradient(rgb(37 71 208 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(37 71 208 / 0.08) 1px, transparent 1px)',
                backgroundSize: '12px 12px',
              }}
            >
              {look.image ? <Image src={look.image} alt="" fill sizes="(max-width: 512px) 100vw, 512px" className="object-contain p-3 mix-blend-multiply" /> : null}
              {look.tag ? <Tag>{look.tag}</Tag> : null}
              <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-[2px] bg-mount/90 px-1.5 py-1 font-mono text-[10.5px] uppercase leading-none text-accent">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8a5 5 0 0 1 9-3M13 8a5 5 0 0 1-9 3M12 2v3H9M4 14v-3h3" />
                </svg>
                Turn it round
              </span>
            </div>
          </Wide>
        );
      case 'guide':
        return (
          <a href={link.url} {...outside(link.url)} className="group flex items-center gap-3.5 rounded-[2px] border border-accent bg-accent py-3 pl-3 pr-3.5 text-on-accent transition-colors hover:bg-accent-hover">
            <span className="relative h-24 w-24 flex-none -rotate-3 overflow-hidden rounded-[2px] border-2 border-white/90 shadow-[0_4px_10px_rgb(0_0_0/0.25)] transition-transform group-hover:rotate-0">
              <Image src={PAX_GUIDE.square} alt="" fill sizes="200px" className="object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-on-accent/80">PDF guide · {PAX_GUIDE.pages} pages</div>
              <div className="mt-1 text-[16px] font-semibold leading-tight">{link.label}</div>
              <div className="mt-1 text-[12.5px] leading-snug text-on-accent/85">{link.subtitle}</div>
              <div className="mt-2 inline-block rounded-[2px] bg-white px-2 py-1 font-mono text-[11px] text-accent">
                {PAX_GUIDE.price} PDF <span aria-hidden="true">→</span>
              </div>
            </div>
          </a>
        );
      case 'app':
        // The app on a phone flipping through the demo job, with the step it shows lit beside it (ms.css).
        return (
          <a
            href={link.url}
            {...outside(link.url)}
            data-motion=""
            className="ms-app group flex min-h-[200px] items-stretch overflow-hidden rounded-[2px] border border-ink text-white"
          >
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5 py-3.5 pl-3.5 pr-2">
              <div>
                <Image src="/images/cabinetos/icon.svg" alt="" width={34} height={34} unoptimized className="rounded-[6px]" />
                <div className="mt-2.5 text-[16px] font-semibold leading-tight">
                  {link.label} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </div>
                <div className="mt-1 text-[12.5px] leading-snug text-white/80">{link.subtitle}</div>
              </div>
              <ol aria-hidden="true" className="grid gap-1 font-mono text-[11px] leading-tight">
                {APP_STEPS.map((st, i) => (
                  <li key={st.name} className={`mv-ms-lit${i + 1} flex gap-2 whitespace-nowrap`}>
                    <span className="ms-hi">{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      {st.name} <span className="text-white/60">· {st.fact}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {look.tag ? <div className="self-start rounded-[2px] bg-white/15 px-1.5 py-1 font-mono text-[10.5px] uppercase leading-none tracking-[0.04em]">{look.tag}</div> : null}
            </div>
            <div className="relative w-[124px] flex-none max-[359px]:w-[100px]">
              <div className="absolute -bottom-3 left-2 top-4 w-[112px] overflow-hidden max-[359px]:w-[88px] rounded-t-[12px] border-[3px] border-b-0 border-white/25 bg-white">
                {APP_STEPS.map((st, i) => (
                  <Image key={st.screen} src={st.screen} alt="" fill sizes="120px" className={`object-cover object-top ${i ? `mv-ms-scr mv-ms-scr${i + 1}` : ''}`} />
                ))}
              </div>
            </div>
          </a>
        );
      case 'extension':
        return (
          <Wide href={link.url} words={<Words link={link} />}>
            <div className="relative h-[220px] bg-white">
              <Image src={EXTENSION_STILL_WIDE} alt="" fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover object-[50%_70%]" />
              <PlannerClip {...EXTENSION_CLIP_WIDE} className="object-[50%_70%]" />
              {look.tag ? <Tag tone="accent">{look.tag}</Tag> : null}
            </div>
          </Wide>
        );
      case 'tools':
        return (
          <a href={link.url} {...outside(link.url)} className={`${cardBox} flex items-center gap-3.5 py-2.5 pl-2.5 pr-4`}>
            <span className="flex w-[86px] flex-none">
              {TOOL_PHOTOS.map((src, i) => (
                <span key={src} className={`relative h-[46px] w-[46px] overflow-hidden rounded-full border-2 border-mount shadow-[0_1px_3px_rgb(22_25_28/0.18)] ${i ? '-ml-[26px]' : ''}`}>
                  <Image src={src} alt="" fill sizes="92px" className="object-cover" />
                </span>
              ))}
            </span>
            <Words link={link} />
            <Arrow />
          </a>
        );
      default:
        return <Row item={item} rating={reviews.googleRating} extra={look.image && link.url.split(/[?#]/)[0] === '/blog' ? <Count>{postCount} posts</Count> : undefined} />;
    }
  };

  const latestCard = latest ? (
    <Wide
      href={`/portfolio/${latest.slug}`}
      words={
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted">Latest job · {latest.area}</div>
          <div className="mt-1 text-[15px] font-semibold leading-snug transition-colors group-hover:text-accent">{latest.title}</div>
        </div>
      }
    >
      <div className="relative h-[200px]">
        <Image src={latest.cover.src} alt="" fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover" />
        <Tag tone="accent">{shortMonth(latest.finished)}</Tag>
      </div>
    </Wide>
  ) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <div className="relative grid h-[150px] grid-cols-3 gap-0.5">
        {banner.map((p) => (
          <div key={p.slug} className="relative">
            <Image src={p.cover.src} alt="" fill priority sizes="(max-width: 512px) 34vw, 175px" className="object-cover" />
          </div>
        ))}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[60px]" style={{ background: 'linear-gradient(to bottom, rgb(241 242 239 / 0), var(--color-paper))' }} />
      </div>

      <div className="flex flex-1 flex-col px-[18px] pb-7">
        <div className="relative -mt-11 flex flex-col items-center text-center">
          <div className="h-[84px] w-[84px] overflow-hidden rounded-full border-[3px] border-paper bg-[#f4f1ea] ring-1 ring-line-strong">
            <Image src="/images/r-logo-final.png" alt="Raf Carpentry logo" width={84} height={84} className="h-full w-full object-cover" priority />
          </div>
          <h1 className="mt-3 font-display text-[27px] font-[680] tracking-[-0.02em]">{d.title}</h1>
          <p className="mt-0.5 text-[14.5px] text-muted">{d.subtitle}</p>
          <div className="mt-[18px] flex gap-5">
            {socials.map((s) => {
              const net = networkOf(s.href) ?? networkOf(s.label);
              return (
                <a key={s.label} href={s.href} target="_blank" rel="noopener" aria-label={`${s.label}: @rafcarpentry`} className="group flex flex-col items-center gap-1.5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-mount text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
                    {net ? <SocialIcon network={net} size={18} /> : null}
                  </span>
                  <span className="font-mono text-[10.5px] text-faint transition-colors group-hover:text-accent">{s.label}</span>
                </a>
              );
            })}
          </div>
          <GoogleRating variant="inline" className="mt-4 justify-center" />
        </div>

        {GROUPS.map((g, gi) => {
          const list = inGroup(g.id);
          const extra = g.id === 'work' ? latestCard : null;
          if (!list.length && !extra) return null;
          return (
            <section key={g.id} aria-label={g.title}>
              <Kicker n={gi + 1} title={g.title} />
              <div className="flex flex-col gap-2.5">
                {extra}
                {blocks(list).map((b, bi) =>
                  b.type === 'one' ? (
                    <div key={bi}>{one(b.item)}</div>
                  ) : (
                    <div key={bi} className="grid grid-cols-2 gap-2.5">
                      {b.items.map((it, ii) => (b.type === 'pair' ? <Half key={ii} item={it} /> : <Tile key={ii} item={it} tag={it.look.art === 'skirting' ? tipTag : undefined} />))}
                    </div>
                  ),
                )}
              </div>
            </section>
          );
        })}

        <p className="mt-auto pt-10 text-center text-xs text-faint">© {new Date().getFullYear()} Raf Carpentry</p>
      </div>
    </div>
  );
}

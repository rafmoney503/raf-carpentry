import Link from 'next/link';
import type { Metadata } from 'next';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import WhatsAppButton from '@/components/WhatsAppButton';
import Sketch from '@/app/how-it-works/sketches';
import { isAmazonLink } from '@/lib/affiliates';
import { pageMeta } from '@/lib/seo';
import { QUOTE_HREF, whatsappText } from '@/lib/site';
import { getTipsData, tipSections } from '@/lib/tips';
import { CopyTipLink, TipPhotos } from './tip-extras';
import Joint from '@/components/Joint';

export function generateMetadata(): Metadata {
  const d = getTipsData();
  return pageMeta({ title: d.metaTitle, description: d.metaDescription, path: '/tips', ownImage: true });
}

const more = [
  { href: '/calculator', label: 'Workshop calculator' },
  { href: '/tools', label: 'My tools' },
  { href: '/sketchup', label: 'SketchUp' },
  { href: '/cabinetos', label: 'CabinetOS' },
];

export default function TipsPage() {
  const d = getTipsData();
  const sections = tipSections(d.tips);
  const hasShopLinks = d.tips.some((t) => isAmazonLink(t.linkHref));

  return (
    <>
      <PageHeader kicker={d.kicker} title={d.title} accent={d.titleAccent} lede={d.intro}>
        {sections.length > 1 ? (
          <nav aria-label="On this page" className="mt-7 flex flex-wrap gap-2">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="inline-flex h-10 items-center rounded-sm border border-line-strong px-4 text-[14.5px] font-medium text-ink transition-colors hover:border-ink">
                {s.name}
              </a>
            ))}
          </nav>
        ) : null}
      </PageHeader>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-20 border-t border-line">
          <Container className="grid grid-cols-1 gap-6 py-12 md:grid-cols-12 md:gap-6 md:py-16">
            <SectionHeading className="md:col-span-4">{s.name}</SectionHeading>
            <ol className="md:col-span-8">
              {s.tips.map((t) => {
                const href = t.linkHref?.trim();
                const shop = isAmazonLink(href);
                const external = Boolean(href && /^https?:/.test(href));
                return (
                  <li
                    key={t.id}
                    id={t.id}
                    className="grid scroll-mt-24 grid-cols-[76px_minmax(0,1fr)] items-start gap-4 rounded-sm border-b border-line py-6 transition-colors first:pt-0 last:border-b-0 target:bg-raised target:shadow-[0_0_0_12px_var(--color-raised)] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-6 md:first:pt-1"
                  >
                    <Sketch name={t.sketch} fallback={t.num} />
                    <div className="min-w-0">
                      <h3 className="text-[19px] font-[620] leading-snug text-ink sm:text-[21px]">
                        <span className="mr-2 font-mono text-[13px] font-normal text-accent">{t.num}</span>
                        {t.title}
                      </h3>
                      <p className="mt-2 max-w-[60ch] text-[16px] leading-relaxed text-muted">{t.body}</p>
                      <TipPhotos photos={t.photos ?? []} title={t.title} />
                      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                        {href && t.linkLabel ? (
                          external ? (
                            <a href={href} target="_blank" rel={shop ? 'sponsored nofollow noopener' : 'noopener'} className="text-[15px] font-semibold text-accent hover:underline">
                              {t.linkLabel}
                              <span className="ml-2 whitespace-nowrap font-mono text-[12.5px] font-normal text-faint">
                                {shop ? 'on Amazon ' : ''}
                                <span aria-hidden="true">↗</span>
                              </span>
                            </a>
                          ) : (
                            <Link href={href} className="link-more text-[15px]">
                              {t.linkLabel} <span aria-hidden="true">→</span>
                            </Link>
                          )
                        ) : null}
                        <CopyTipLink id={t.id} title={t.title} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Container>
        </section>
      ))}

      {hasShopLinks ? (
        <Container className="pb-10">
          <p className="max-w-[64ch] border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">
            Links marked Amazon are affiliate links: I earn a small commission if you buy through them, at no extra cost to you. As an Amazon Associate I earn from qualifying purchases.
          </p>
        </Container>
      ) : null}

      {/* For the people reading who would rather not do it themselves */}
      <section className="relative bg-raised">
        <Joint />
        <Container className="py-14 md:py-20">
          <div className="max-w-[60ch]">
            <SectionHeading>{d.ctaHeading || 'Rather have it built for you?'}</SectionHeading>
            {d.ctaText ? <p className="mt-4 text-muted">{d.ctaText}</p> : null}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={QUOTE_HREF} className="btn btn-primary">Get a quote</Link>
              <WhatsAppButton text={whatsappText('/tips')} />
            </div>
          </div>
          <nav aria-label="More free tools" className="mt-14 border-t border-line-strong pt-6">
            <p className="font-mono text-[13px] text-faint">More free tools</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {more.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="inline-flex h-10 items-center rounded-sm border border-line-strong bg-mount px-4 text-[14.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent">
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </section>
    </>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import { KITS, kitOf, kitTool } from '@/lib/kits';
import { isAmazonLink } from '@/lib/affiliates';

/* rafcarpentry.com/kit/<slug>: the tools for one of Raf's paid plans (src/lib/kits.ts). The PDFs link here, because
   Amazon doesn't allow its links inside a PDF. */

export const dynamicParams = false;
export function generateStaticParams() {
  return KITS.map((k) => ({ slug: k.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const kit = kitOf(slug);
  if (!kit) return {};
  return pageMeta({ title: `${kit.title} | Raf Carpentry`, description: kit.lede, path: `/kit/${kit.slug}` });
}

// Built at deploy, so checking public/ here is fine (it isn't traced into any function).
const photoOf = (key: string) => {
  const p = `/images/tools/${key}.jpg`;
  return existsSync(path.join(process.cwd(), 'public', p)) ? p : null;
};

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kit = kitOf(slug);
  if (!kit) notFound();
  const external = kit.planHref.startsWith('http');
  const anyAmazon = kit.groups.some((g) => g.items.some((i) => isAmazonLink(kitTool(i.key).url ?? undefined)));

  return (
    <main className="pb-20">
      <PageHeader kicker={`For the plan: ${kit.plan}`} title={kit.title} lede={kit.lede}>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={kit.planHref} className="btn btn-ghost" {...(external ? { target: '_blank', rel: 'noopener' } : {})}>
            {kit.planLabel}
          </Link>
        </div>
      </PageHeader>
      <Container>
        {kit.groups.map((g) => (
          <section key={g.title} className="mt-12" data-kit-group>
            <SectionHeading className="!text-[26px] md:!text-[32px]">{g.title}</SectionHeading>
            <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {g.items.map((it) => {
                const t = kitTool(it.key);
                const photo = photoOf(it.key);
                const amazon = isAmazonLink(t.url ?? undefined);
                return (
                  <li key={it.key} className="flex gap-4 rounded-[2px] border border-line bg-mount p-4" data-kit-item={it.key}>
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[2px] border border-line bg-raised">
                      {photo ? <Image src={photo} alt={`My ${t.name}`} width={160} height={160} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[18px] font-[650] text-ink">{t.name}</p>
                      <p className="mt-1 text-[15px] text-muted">{it.why}</p>
                      {t.url ? (
                        <a
                          href={t.url}
                          target="_blank"
                          rel={amazon ? 'sponsored nofollow noopener' : 'noopener'}
                          className="link-more mt-2 inline-block"
                          data-kit-link
                        >
                          {amazon ? 'See it on Amazon' : 'See it'} →
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <section className="mt-12">
          <SectionHeading className="!text-[26px] md:!text-[32px]">Materials and fittings</SectionHeading>
          <ul className="mt-5 list-disc space-y-1.5 pl-5 text-[16px] text-muted">
            {kit.materials.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
        <section className="mt-12 rounded-[2px] border border-line bg-raised p-6">
          <p className="font-display text-[20px] font-[650] text-ink">Draw it in CabinetOS, free for a month</p>
          <p className="mt-2 text-[15px] text-muted">
            The code in your plan gives you CabinetOS Pro free for 30 days: your own sizes, the cut list and the board layouts for the saw.
          </p>
          <a href="https://www.cabinetos.co.uk" target="_blank" rel="noopener" className="btn btn-primary mt-4">
            Open CabinetOS
          </a>
        </section>
        {anyAmazon ? <p className="mt-8 font-mono text-[12.5px] text-faint">As an Amazon Associate I earn from qualifying purchases.</p> : null}
      </Container>
    </main>
  );
}

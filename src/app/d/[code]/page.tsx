import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui';
import { getAllDesigns, getDesign } from '@/lib/designs';
import { SITE_URL } from '@/lib/seo';
import DesignView from './design-view';

/* A customer's private 3D design: rafcarpentry.com/d/<code> (see src/lib/designs.ts). Not indexed. */

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDesigns().map((d) => ({ code: d.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const d = getDesign(code);
  if (!d) return {};
  const title = `Your design: ${d.title}, ${d.area} | Raf Carpentry`;
  const description = 'Turn it round, open the doors and look inside, on your phone.';
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, url: `${SITE_URL}/d/${code}` } };
}

const when = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function DesignPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = getDesign(code);
  if (!d) notFound();
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto max-w-[980px]">
        <p className="kicker">{d.example ? 'Example design' : 'Your design'} · {when(d.made)}</p>
        <h1 className="mt-2 font-display text-[34px] font-[680] leading-[1.04] tracking-[-0.025em] md:text-[46px]">
          {d.title}
          <span className="text-muted">, {d.area}</span>
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed text-muted">
          {d.intro ?? 'Drag to turn it round, use the buttons under it to open the doors or take it apart, and pinch to zoom.'}
        </p>
        <div className="mt-7">
          <DesignView title={d.title} area={d.area} link={`${SITE_URL}/d/${d.code}`} options={d.options} />
        </div>
        {d.notes?.length ? (
          <ul className="mt-8 grid gap-1.5 border-t border-line pt-5 text-[14.5px] leading-relaxed text-muted">
            {d.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Container>
  );
}

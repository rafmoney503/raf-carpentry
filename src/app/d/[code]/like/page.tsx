import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui';
import { getAllDesigns, getDesign } from '@/lib/designs';
import { SITE_URL } from '@/lib/seo';
import { jobForDesign } from '@/lib/design-library';
import Link from 'next/link';
import DesignView from '../design-view';

/* A customer's design shown to someone else who wants something similar: rafcarpentry.com/d/<code>/like, the
   link the Job Kit's Design library sends. The same 3D and sizes as /d/<code>, labelled as a design made for a
   home in that area (area only, as everywhere), without the first customer's notes, and with "I'd like
   something like this" instead of approving it. Not indexed, not linked (robots disallow /d/). */

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDesigns()
    .filter((d) => !d.example)
    .map((d) => ({ code: d.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const d = getDesign(code);
  if (!d) return {};
  const title = `${d.title} in 3D | Raf Carpentry`;
  const description = 'A design I made for a home in ' + d.area + '. Turn it round and open the doors on your phone.';
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, url: `${SITE_URL}/d/${code}/like` } };
}

const month = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function LikeDesignPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = getDesign(code);
  if (!d || d.example) notFound();
  const built = jobForDesign(d.code);
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto max-w-[980px]">
        <p className="kicker">A design I made · {month(d.made)}</p>
        <h1 className="mt-2 font-display text-[34px] font-[680] leading-[1.04] tracking-[-0.025em] md:text-[46px]">
          {d.title}
          <span className="text-muted">, {d.area}</span>
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed text-muted">
          I drew this in 3D for a home in {d.area}. Yours would be made to your own room and sizes. Drag to turn it round, use the buttons under it to open the doors or take it apart, and pinch to zoom.
        </p>
        {built ? (
          <p className="mt-4">
            <Link href={`/portfolio/${built.slug}`} className="link-more">
              I built this one. See the finished job, with photos <span aria-hidden="true">→</span>
            </Link>
          </p>
        ) : null}
        <div className="mt-7">
          <DesignView title={d.title} area={d.area} link={`${SITE_URL}/d/${d.code}/like`} options={d.options} like />
        </div>
      </div>
    </Container>
  );
}

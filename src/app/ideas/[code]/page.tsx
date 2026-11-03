import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@/components/ui';
import { conceptsRpc, conceptsSetUp } from '@/lib/concept-maker';
import { quotesRpc } from '@/lib/quote-maker';
import { pricesWith } from '@/lib/quote-sums';
import { CODE_RE, DEFAULT_COLOUR, priceOption, rangeText, sizedPlan, type ConceptEdits, type Plan } from '@/lib/concept-plan';
import { SITE_URL } from '@/lib/seo';
import IdeasView from './ideas-view';

/* A customer's concept drawings from the Job Kit's Design with Claude: rafcarpentry.com/ideas/<code> (see
   src/lib/concept-plan.ts). Shown only once Raf has put it online; the code is the only key. Not indexed. */

export const dynamic = 'force-dynamic';

type Public = { plan: Plan; first: string | null; edits: ConceptEdits | null; updated: number } | null;

async function load(code: string): Promise<Public> {
  if (!CODE_RE.test(code) || !conceptsSetUp()) return null;
  return ((await conceptsRpc('public', { id: code }).catch(() => null)) as Public) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const c = await load(code);
  if (!c?.plan) return { robots: { index: false, follow: false } };
  const title = `Your ${c.plan.title.toLowerCase()} ideas | Raf Carpentry`;
  const description = 'Drawn to your sizes: the options with the doors on and off, and a rough price for each.';
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, url: `${SITE_URL}/ideas/${code}` } };
}

const when = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });

export default async function IdeasPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = await load(code);
  if (!c?.plan?.options?.length) notFound();
  const edits = c.edits ?? {};
  const plan = sizedPlan(c.plan, edits);
  const priceRow = (await quotesRpc('get', { id: '_prices' }).catch(() => null)) as { data?: Record<string, unknown> } | null;
  const prices = pricesWith(priceRow?.data);
  const options = plan.options
    .map((o, i) => ({ o, i }))
    .filter(({ i }) => !(edits.hide ?? []).includes(i))
    .map(({ o, i }) => ({ option: o, price: edits.prices === false ? null : rangeText(priceOption(o, prices, plan.stripOut, edits.own?.[String(i)])) }));
  if (!options.length) notFound();
  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto max-w-[980px]">
        <p className="kicker">
          {c.first ? `For ${c.first}` : 'Your ideas'} · {when(c.updated)}
        </p>
        <h1 className="mt-2 font-display text-[34px] font-[680] leading-[1.04] tracking-[-0.025em] md:text-[46px]">
          Your {plan.title.toLowerCase()}
          {options.length > 1 ? <span className="text-muted">, {options.length === 2 ? 'two' : 'three'} ways</span> : null}
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16.5px] leading-relaxed text-muted">Drawn to your sizes from what you sent me. I’ll measure properly on a free visit, then draw the final one for you to sign off.</p>
        <div className="mt-7">
          <IdeasView title={plan.title} link={`${SITE_URL}/ideas/${code}`} width={plan.width} height={plan.height} options={options} inside={edits.inside !== false} colour={edits.colour ?? DEFAULT_COLOUR} />
        </div>
      </div>
    </Container>
  );
}

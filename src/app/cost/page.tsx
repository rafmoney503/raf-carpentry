import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container, PageHeader } from '@/components/ui';
import { COST_JOBS, fromPrice } from '@/lib/cost-calculator';
import { pageMeta } from '@/lib/seo';

/* Cost calculator (Raf, 1 Nov 2026): the seven jobs he prices, each with its own calculator page (/cost/<job>).
   Prices and sums in src/lib/cost-calculator.ts. While only one job is on (COST_LIVE), /cost goes straight to it. */

const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const n = COUNT[COST_JOBS.length] ?? String(COST_JOBS.length);
const names = COST_JOBS.map((j) => j.name.toLowerCase());
const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];

export const metadata = pageMeta({
  title: 'Cost calculator | London carpentry prices | Raf Carpentry',
  description: `What will it cost? My own London prices for ${list}. Set the size, see the price.`.slice(0, 160),
  path: '/cost',
});

export default function CostPage() {
  if (COST_JOBS.length === 1) redirect(`/cost/${COST_JOBS[0].slug}`);
  return (
    <>
      <PageHeader
        kicker="Cost calculator"
        title="What will it"
        accent="cost?"
        lede={`My own London prices for ${n} jobs. Pick one, set the size and see the price straight away. Then send it to me for a written quote.`}
      />
      <section>
        <Container className="pb-16 md:pb-24">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COST_JOBS.map((j) => (
              <li key={j.slug}>
                <Link
                  href={`/cost/${j.slug}`}
                  className="group flex h-full flex-col justify-between gap-6 rounded-sm border border-line bg-mount p-5 transition-colors hover:border-accent md:p-6"
                >
                  <span>
                    <span className="block font-display text-[24px] font-[650] leading-tight tracking-[-0.02em] text-ink group-hover:text-accent">{j.name}</span>
                    <span className="mt-2 block text-[15px] leading-snug text-muted">{j.card}</span>
                  </span>
                  <span className="flex items-end justify-between gap-4">
                    <span>
                      <span className="block font-mono text-[12.5px] text-faint">from, with VAT</span>
                      <span className="block font-mono text-[18px] text-ink">{fromPrice(j)}</span>
                    </span>
                    <span className="text-[20px] text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-[60ch] text-[15px] leading-relaxed text-muted">
            Something else, or more than one job? <Link href="/how-it-works" className="text-accent hover:underline">Plan your project</Link> and send it to me in one message.
          </p>
        </Container>
      </section>
    </>
  );
}

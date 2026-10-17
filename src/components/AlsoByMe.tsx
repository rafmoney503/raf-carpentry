import Image from 'next/image';
import Link from 'next/link';
import { Container, SectionHeading } from './ui';
import { CABINETOS_URL, COMPANY, PHONE_DISPLAY, PHONE_HREF, QUOTE_HREF, RAFAL_SOLUTIONS_URL } from '@/lib/site';

/* My other two names, linked both ways with rafalsolutions.co.uk (its About page has the same three cards).
   Rafal Solutions Ltd is the company behind Raf Carpentry and, at rafalsolutions.co.uk, builds systems for other
   trade businesses; CabinetOS is the cut-list app. Each piece shows where the people who need it already are:
   - CompanyCards: About #company, the three names side by side
   - OtherWays: the contact page, 'Not a home job?', sending trades and cabinet makers to the right door
   - TradeNudge: one line for tradespeople reading Tools, Workshop tips, the calculator and CabinetOS
   - the footer has 'Also by me' and the company name in the legal line (Footer.tsx). */

const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

/* The rs mark as Rafal Solutions draws it: ink square, 'rs', a yellow corner. `edge` is the colour of whatever it
   sits on, so the corner looks cut out of the square. */
export function RsMark({ size = 28, edge = 'border-paper' }: { size?: number; edge?: string }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-grid flex-none place-items-center rounded-[2px] bg-ink font-display font-bold leading-none tracking-[-0.02em] text-paper"
      style={{ width: size, height: size, fontSize: Math.round(size / 2) }}
    >
      rs
      <span className={`absolute bg-rs ${edge}`} style={{ left: '80%', top: '80%', width: '33%', height: '33%', borderWidth: Math.max(1, Math.round(size * 0.067)), borderStyle: 'solid' }} />
    </span>
  );
}

/* CabinetOS's own app icon (public/images/cabinetos/icon.svg, copied from cabinetos-site). */
export function CosMark({ size = 28 }: { size?: number }) {
  return <Image src="/images/cabinetos/icon.svg" alt="" width={size} height={size} unoptimized className="flex-none rounded-[5px]" />;
}

function RLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex-none overflow-hidden rounded-full bg-mount ring-1 ring-line-strong" style={{ width: size, height: size }}>
      <Image src="/images/r-logo-final.png" alt="" width={size} height={size} className="h-full w-full object-cover" />
    </span>
  );
}

const Out = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
    <path d="M5.5 3.5h7v7M12.5 3.5l-9 9" />
  </svg>
);

/* About page: one company, three names. */
export function CompanyCards() {
  const card = 'flex flex-col rounded-sm border bg-mount p-6';
  const pill = 'inline-flex h-7 items-center self-start rounded-sm bg-raised px-2.5 font-mono text-[12.5px] text-muted';
  return (
    <section id="company" className="border-t border-line">
      <Container className="py-20 md:py-28">
        <p className="kicker">The company</p>
        <SectionHeading className="mt-4">One company, three names you might see.</SectionHeading>
        <p className="mt-4 max-w-[60ch] text-muted">
          Whichever you found first, it&apos;s me on the other end, on the same number:{' '}
          <a href={PHONE_HREF} className="whitespace-nowrap font-medium text-ink hover:text-accent">{PHONE_DISPLAY}</a>.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          <div className={`${card} border-accent`}>
            <div className="flex items-center justify-between gap-3">
              <span className={pill}>The carpentry</span>
              <span className="font-mono text-[12.5px] text-accent">You&apos;re here</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <RLogo />
              <h3 className="text-[23px] font-[620] leading-tight">Raf Carpentry</h3>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">Fitted wardrobes, alcove units, panelling, kitchens, doors and floors across London.</p>
            <Link href={QUOTE_HREF} className="link-more mt-auto pt-5 text-[15px]">
              Get a quote <span aria-hidden="true">→</span>
            </Link>
          </div>

          <a href={RAFAL_SOLUTIONS_URL} target="_blank" rel="noopener" className={`${card} group border-line-strong transition-colors hover:border-accent`}>
            <span className={pill}>The company</span>
            <div className="mt-5 flex items-center gap-3">
              <RsMark edge="border-mount" />
              <h3 className="text-[23px] font-[620] leading-tight">{COMPANY.name}</h3>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Company No. {COMPANY.number}
              <br />
              VAT No. {COMPANY.vat}
              <br />
              {COMPANY.office}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">It also builds systems for other trade businesses: enquiries straight into ServiceM8, job apps for the phone, planners for their customers.</p>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[15px] font-semibold text-accent">
              {host(RAFAL_SOLUTIONS_URL)} <Out />
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          </a>

          <a href={CABINETOS_URL} target="_blank" rel="noopener" className={`${card} group border-line-strong transition-colors hover:border-accent`}>
            <span className={pill}>The software</span>
            <div className="mt-5 flex items-center gap-3">
              <CosMark />
              <h3 className="text-[23px] font-[620] leading-tight">CabinetOS</h3>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">Cut lists, board layouts and drawings for wardrobe and cabinet makers. Free plan available.</p>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[15px] font-semibold text-accent">
              {host(CABINETOS_URL)} <Out />
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          </a>
        </div>
      </Container>
    </section>
  );
}

/* Contact page: a home job stays here; a trade business or a cabinet maker goes to the right door. */
export function OtherWays({ className = '' }: { className?: string }) {
  const row = 'group flex items-center gap-3.5 border-t border-line py-3.5 first:border-t-0 first:pt-1 last:pb-0';
  return (
    <div className={`rounded-sm border border-line p-5 ${className}`}>
      <p className="font-mono text-[13px] text-accent">Not a home job?</p>
      <div className="mt-3">
        <a href={`${RAFAL_SOLUTIONS_URL}/contact`} target="_blank" rel="noopener" className={row}>
          <RsMark size={32} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink group-hover:text-accent">Systems for your trade business</span>
            <span className="mt-0.5 block text-[14.5px] leading-snug text-muted">Rafal Solutions: enquiries into ServiceM8, job apps, planners. Same me.</span>
          </span>
          <span className="text-faint group-hover:text-accent">
            <Out />
          </span>
          <span className="sr-only"> (opens rafalsolutions.co.uk in a new tab)</span>
        </a>
        <a href={CABINETOS_URL} target="_blank" rel="noopener" className={row}>
          <CosMark size={32} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink group-hover:text-accent">Cut lists for cabinet making</span>
            <span className="mt-0.5 block text-[14.5px] leading-snug text-muted">CabinetOS, the app I cut from. There&apos;s a free plan.</span>
          </span>
          <span className="text-faint group-hover:text-accent">
            <Out />
          </span>
          <span className="sr-only"> (opens cabinetos.co.uk in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

/* For the tradespeople among the readers. `to` is the Rafal Solutions page that fits what they were reading. */
export function TradeNudge({
  kicker = 'Run a trade business?',
  text = 'The systems behind this site run my own business: enquiries straight into ServiceM8, a job app on my phone, a 3D planner for customers. I build them for other trades too.',
  to = '/trades#carpenters',
  bare = false,
}: {
  kicker?: string;
  text?: string;
  to?: string;
  bare?: boolean; // inside a section that already has its own Container
}) {
  const body = (
    <aside className="flex items-start gap-4 sm:items-center">
      <RsMark size={40} edge={bare ? 'border-raised' : 'border-paper'} />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-[62ch]">
          <p className="font-mono text-[13px] text-accent">{kicker}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
        </div>
        <a href={`${RAFAL_SOLUTIONS_URL}${to}`} target="_blank" rel="noopener" className="link-more mt-3 flex-none text-[15px] sm:mt-0">
          Rafal Solutions <Out />
          <span className="sr-only"> (opens rafalsolutions.co.uk in a new tab)</span>
        </a>
      </div>
    </aside>
  );
  if (bare) return <div className="mt-10 border-t border-line-strong pt-6">{body}</div>;
  return (
    <div className="border-t border-line">
      <Container className="py-10 md:py-12">{body}</Container>
    </div>
  );
}

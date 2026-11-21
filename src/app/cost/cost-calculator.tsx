'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import WhatsAppButton from '@/components/WhatsAppButton';
import { cleanQty, costBriefHref, costJob, estimate, lowerFirst, money, qtyWords, VAT_RATE, type CostJob } from '@/lib/cost-calculator';

/* The calculator on /cost/<job>: one dark card with the price, the size (box, − / + and a slider) and Get a quote,
   which opens the brief on Plan your project already filled in. Sums in src/lib/cost-calculator.ts.

   On a phone the card goes price, size, Get a quote, so all three are on the first screen with the title (Raf's
   ad lands here, and the daily review of 20 Nov 2026 found the price under the fold: 85 landings, 9 s, no taps).
   From lg the size sits on the left and the price and button on the right. */

export type CostPhoto = { slug: string; title: string; area: string; src: string; alt: string };

const ctl =
  'h-12 w-12 flex-none rounded-sm border border-on-accent/30 bg-on-accent/10 text-[22px] text-on-accent transition-colors hover:border-on-accent disabled:opacity-35';
const chip =
  'min-h-10 rounded-sm border border-on-accent/30 bg-on-accent/10 px-3.5 py-2 text-left text-[14.5px] font-medium leading-snug text-on-accent transition-colors hover:border-on-accent aria-pressed:border-on-accent aria-pressed:bg-on-accent aria-pressed:text-ink';

const per = (job: CostJob) => (job.unit === 'metre' ? 'a metre' : job.unit === 'm2' ? 'a m²' : job.unit === 'door' ? 'a door' : '');
const withVat = (v: number) => v * (1 + VAT_RATE);
const shown = (job: CostJob, v: number) => (job.qty && job.qty.step < 1 ? v.toFixed(1) : String(v));

export default function CostCalculator({ slug, photos = [] }: { slug: string; photos?: CostPhoto[] }) {
  const job = costJob(slug)!;
  const [qty, setQty] = useState(job.qty?.def ?? 1);
  const [qtyText, setQtyText] = useState(job.qty ? shown(job, job.qty.def) : '');
  const [opt, setOpt] = useState(job.def);
  const e = useMemo(() => estimate(job, qty, opt), [job, qty, opt]);
  const picked = job.options.find((o) => o.id === opt) ?? job.options[0];

  const setSize = (v: number) => {
    const q = cleanQty(job, v);
    setQty(q);
    setQtyText(shown(job, q));
  };
  const step = (dir: 1 | -1) => job.qty && setSize(qty + dir * job.qty.step);
  const side = 'lg:col-start-2 lg:border-l lg:border-on-accent/15';

  return (
    <div>
      <div className="grid grid-cols-1 rounded-sm bg-ink text-on-accent lg:grid-cols-2" data-cost-card>
        {/* The price */}
        <div className={`px-5 pt-5 md:px-7 md:pt-7 lg:row-start-1 ${side}`} aria-live="polite" data-cost-result>
          <p className="font-mono text-[13px] text-on-accent/70">My price{job.qty ? `, ${qtyWords(job, e.qty)}` : ''}</p>
          <p className="mt-1.5 font-display text-[34px] font-[680] leading-[1.04] tracking-[-0.03em] sm:text-[40px] md:text-[46px]" data-cost-gross>
            {money(e.gross[0])} <span className="text-[0.62em] font-[560] text-on-accent/70">to</span> {money(e.gross[1])}
          </p>
          <p className="mt-1.5 text-[14.5px] text-on-accent/80">
            with VAT · <span className="font-mono text-[13.5px]" data-cost-net>{money(e.net[0])} to {money(e.net[1])}</span> before VAT
          </p>
        </div>

        {/* What you're having */}
        <div className="px-5 pt-5 md:px-7 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:py-7">
          {job.qty ? (
            <div>
              <label htmlFor="cost-qty" className="block font-mono text-[13px] text-on-accent/70">{job.qty.label}</label>
              <div className="mt-2 flex items-stretch gap-2">
                <button type="button" className={ctl} onClick={() => step(-1)} disabled={qty <= job.qty.min} aria-label={`Less, ${job.qty.step} ${job.qty.word}`}>
                  −
                </button>
                <div className="relative min-w-0 flex-1">
                  <input
                    id="cost-qty"
                    className="h-12 w-full rounded-sm border border-on-accent bg-mount px-3 pr-12 text-center font-mono text-[20px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/60"
                    inputMode={job.qty.step < 1 ? 'decimal' : 'numeric'}
                    value={qtyText}
                    onChange={(ev) => {
                      const t = ev.target.value.replace(/[^\d.]/g, '').slice(0, 6);
                      setQtyText(t);
                      const v = Number(t);
                      if (t && Number.isFinite(v) && v >= job.qty!.min && v <= job.qty!.max) setQty(cleanQty(job, v));
                    }}
                    onBlur={() => setSize(Number(qtyText))}
                    aria-describedby="cost-qty-range"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[14px] text-faint">{job.qty.word}</span>
                </div>
                <button type="button" className={ctl} onClick={() => step(1)} disabled={qty >= job.qty.max} aria-label={`More, ${job.qty.step} ${job.qty.word}`}>
                  +
                </button>
              </div>
              <input
                type="range"
                className="mt-3 w-full accent-accent"
                min={job.qty.min}
                max={job.qty.max}
                step={job.qty.step}
                value={qty}
                onChange={(ev) => setSize(Number(ev.target.value))}
                aria-label={job.qty.label}
              />
              <p id="cost-qty-range" className="mt-0.5 hidden justify-between font-mono text-[12.5px] text-on-accent/55 sm:flex">
                <span>{shown(job, job.qty.min)} {job.qty.word}</span>
                <span>{shown(job, job.qty.max)} {job.qty.word}</span>
              </p>
            </div>
          ) : null}

          {job.options.length > 1 ? (
            <div className={job.qty ? 'mt-5' : ''}>
              <p className="font-mono text-[13px] text-on-accent/70" id="cost-opt">{job.optionLabel}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-labelledby="cost-opt">
                {job.options.map((o) => (
                  <button key={o.id} type="button" aria-pressed={o.id === opt} onClick={() => setOpt(o.id)} className={`${chip} group flex flex-col items-start gap-0.5 py-3`} data-cost-opt={o.id}>
                    <span className="text-[16px] font-semibold">{o.label}</span>
                    <span className="text-[13.5px] font-normal text-on-accent/75 group-aria-pressed:text-ink/75">{o.sub}</span>
                    <span className="mt-1 font-mono text-[13px] font-normal text-on-accent/60 group-aria-pressed:text-ink/60">
                      {money(withVat(o.rate))}
                      {per(job) ? ` ${per(job)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* One option: the title and the line under it already say it on a phone */
            <p className={`hidden text-[14.5px] leading-snug text-on-accent/80 sm:block ${job.qty ? 'mt-5' : ''}`} data-cost-option>
              {picked.label}, {lowerFirst(picked.sub)}: <span className="font-mono text-on-accent">{money(withVat(picked.rate))} {per(job)}</span> with VAT
            </p>
          )}
        </div>

        {/* Get a quote */}
        <div className={`px-5 pb-5 pt-5 md:px-7 md:pb-7 lg:row-start-2 ${side}`}>
          <Link href={costBriefHref(job, e.qty)} className="btn w-full border-on-accent bg-on-accent text-ink hover:bg-paper" data-cost-quote>
            Get a quote
          </Link>
          <p className="mt-3 text-[13.5px] leading-snug text-on-accent/70">
            Then a free visit to measure up, and a written quote.
            {e.minimum ? ` ${money(e.gross[0])} with VAT is my smallest job price.` : ''} The low end is a straightforward room; the top allows for the extra work a room can need.
          </p>
        </div>
      </div>

      {photos.length ? (
        <div className="mt-8 md:mt-10" data-cost-photos>
          <p className="font-mono text-[13.5px] text-faint">{job.photosTitle ?? 'From my jobs'}</p>
          <ul className="mt-3 grid max-w-[760px] grid-cols-3 gap-2 md:gap-4">
            {photos.map((p) => (
              <li key={p.slug}>
                <Link href={`/portfolio/${p.slug}`} className="group block">
                  <div className="rounded-[2px] border border-line-strong bg-mount p-1 md:p-2">
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <Image src={p.src} alt={p.alt} fill sizes="(max-width: 768px) 33vw, 250px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] font-medium leading-snug text-ink group-hover:text-accent md:text-[15px]">
                    <span className="hidden md:inline">{p.title}, </span>
                    {p.area}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 md:mt-10">
        <QuoteBand job={job} qty={e.qty} gross={e.gross} />
      </div>
    </div>
  );
}

/* No form of its own (Raf, 1 Nov 2026: one form, the brief): Get a quote opens Plan your project with the
   wardrobe, made to measure and this width filled in, and the brief shows the same price (costBriefHref). */
function QuoteBand({ job, qty, gross }: { job: CostJob; qty: number; gross: [number, number] }) {
  const wa = `Hi Raf, I've seen your ${job.name.toLowerCase()} price: ${qtyWords(job, qty)}, ${money(gross[0])} to ${money(gross[1])} with VAT. Can you quote for mine? I'm in `;
  return (
    <section id="quote" className="scroll-mt-4 rounded-sm border border-line bg-mount p-5 md:p-8" aria-labelledby="cq-title" data-cost-band>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center md:gap-8">
        <div className="md:col-span-7">
          <p className="kicker">Your price: {money(gross[0])} to {money(gross[1])}</p>
          <h2 id="cq-title" className="mt-3 font-display text-[28px] font-[650] leading-tight tracking-[-0.02em] md:text-[34px]">Get a written quote</h2>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
            Three quick steps, with your wardrobe and this width already filled in. Add the height, a photo of the space and your details, and I&apos;ll reply within 24 hours and come and measure up for free.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row md:col-span-5 md:flex-col lg:flex-row md:items-stretch">
          <Link href={costBriefHref(job, qty)} className="btn btn-primary" data-cost-brief>
            Get a quote
          </Link>
          <WhatsAppButton text={wa} />
        </div>
      </div>
    </section>
  );
}

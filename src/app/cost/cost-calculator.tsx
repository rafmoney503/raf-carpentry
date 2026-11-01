'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import WhatsAppButton from '@/components/WhatsAppButton';
import { cleanQty, costBriefHref, costJob, estimate, lowerFirst, money, qtyWords, VAT_RATE, type CostJob } from '@/lib/cost-calculator';

/* The calculator on /cost/<job>: the size (box, − / + and a slider) and the option, the price range straight away,
   then Get a quote, which opens the brief on Plan your project already filled in. Sums in src/lib/cost-calculator.ts. */

const input =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
const chip =
  'min-h-10 rounded-sm border border-line-strong bg-mount px-3.5 py-2 text-left text-[14.5px] font-medium leading-snug text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent';

const per = (job: CostJob) => (job.unit === 'metre' ? 'a metre' : job.unit === 'm2' ? 'a m²' : job.unit === 'door' ? 'a door' : '');
const withVat = (v: number) => v * (1 + VAT_RATE);
const shown = (job: CostJob, v: number) => (job.qty && job.qty.step < 1 ? v.toFixed(1) : String(v));

export default function CostCalculator({ slug }: { slug: string }) {
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      {/* What you're having */}
      <div className="rounded-sm border border-line bg-mount p-5 md:p-7 lg:col-span-7">
        {job.qty ? (
          <div>
            <label htmlFor="cost-qty" className="block text-[15px] font-semibold text-ink">{job.qty.label}</label>
            <div className="mt-3 flex items-stretch gap-2">
              <button type="button" className="h-12 w-12 flex-none rounded-sm border border-line-strong bg-paper text-[22px] text-ink hover:border-ink disabled:opacity-40" onClick={() => step(-1)} disabled={qty <= job.qty.min} aria-label={`Less, ${job.qty.step} ${job.qty.word}`}>
                −
              </button>
              <div className="relative min-w-0 flex-1">
                <input
                  id="cost-qty"
                  className={`${input} pr-16 text-center font-mono text-[20px]`}
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
              <button type="button" className="h-12 w-12 flex-none rounded-sm border border-line-strong bg-paper text-[22px] text-ink hover:border-ink disabled:opacity-40" onClick={() => step(1)} disabled={qty >= job.qty.max} aria-label={`More, ${job.qty.step} ${job.qty.word}`}>
                +
              </button>
            </div>
            <input
              type="range"
              className="mt-4 w-full accent-accent"
              min={job.qty.min}
              max={job.qty.max}
              step={job.qty.step}
              value={qty}
              onChange={(ev) => setSize(Number(ev.target.value))}
              aria-label={job.qty.label}
            />
            <p id="cost-qty-range" className="mt-1 flex justify-between font-mono text-[12.5px] text-faint">
              <span>{shown(job, job.qty.min)} {job.qty.word}</span>
              <span>{shown(job, job.qty.max)} {job.qty.word}</span>
            </p>
          </div>
        ) : null}

        <div className={job.qty ? 'mt-7 border-t border-line pt-6' : ''}>
          <p className="text-[15px] font-semibold text-ink" id="cost-opt">{job.optionLabel}</p>
          {job.options.length > 1 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-labelledby="cost-opt">
              {job.options.map((o) => (
                <button key={o.id} type="button" aria-pressed={o.id === opt} onClick={() => setOpt(o.id)} className={`${chip} group flex flex-col items-start gap-0.5 py-3`} data-cost-opt={o.id}>
                  <span className="text-[16px] font-semibold">{o.label}</span>
                  <span className="text-[13.5px] font-normal text-muted group-aria-pressed:text-on-accent/85">{o.sub}</span>
                  <span className="mt-1 font-mono text-[13px] font-normal text-faint group-aria-pressed:text-on-accent/85">
                    {money(withVat(o.rate))}
                    {per(job) ? ` ${per(job)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[15px] text-muted">
              {picked.label}, {lowerFirst(picked.sub)}: <span className="font-mono text-ink">{money(withVat(picked.rate))} {per(job)}</span> with VAT
            </p>
          )}
        </div>
      </div>

      {/* The price */}
      <div className="lg:col-span-5">
        <div className="rounded-sm bg-ink p-6 text-on-accent md:p-7 lg:sticky lg:top-24" aria-live="polite" data-cost-result>
          <p className="font-mono text-[13px] text-on-accent/70">My price{job.qty ? `, ${qtyWords(job, e.qty)}` : ''}</p>
          <p className="mt-3 font-display text-[40px] font-[680] leading-[1.02] tracking-[-0.03em] md:text-[46px]" data-cost-gross>
            {money(e.gross[0])} <span className="text-[0.62em] font-[560] text-on-accent/70">to</span> {money(e.gross[1])}
          </p>
          <p className="mt-2 text-[15px] text-on-accent/80">
            with VAT · <span className="font-mono text-[14px]" data-cost-net>{money(e.net[0])} to {money(e.net[1])}</span> before VAT
          </p>
          <ul className="mt-5 space-y-1.5 border-t border-on-accent/20 pt-4 text-[14.5px] text-on-accent/85">
            <li>
              {job.qty ? `${qtyWords(job, e.qty)}` : picked.label}
              {job.qty && (job.options.length > 1 || job.sayOption) ? `, ${lowerFirst(picked.label)}` : ''}
              {job.unit !== 'job' ? ` at ${money(withVat(e.rate))} ${per(job)}` : ''}
            </li>
            {e.minimum ? <li>That&apos;s my smallest job price ({money(e.gross[0])} with VAT).</li> : null}
            <li>The low end is a straightforward job; the top allows for the extra work a room can need.</li>
          </ul>
          <Link href={costBriefHref(job, e.qty)} className="btn mt-6 w-full border-on-accent bg-on-accent text-ink hover:bg-paper" data-cost-quote>
            Get a quote
          </Link>
          <p className="mt-3 text-center text-[13px] text-on-accent/65">A guide from my own prices, not a quote.</p>
        </div>
      </div>

      <div className="lg:col-span-12">
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

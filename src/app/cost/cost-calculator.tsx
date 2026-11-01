'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { COST_WHEN, cleanQty, costJob, costMessage, estimate, money, qtyWords, VAT_RATE, type CostJob } from '@/lib/cost-calculator';
import { PHONE_DISPLAY, whatsappUrl } from '@/lib/site';

/* The calculator on /cost/<job>: the size (box, − / + and a slider) and the option, the price range straight away,
   then "Get a written quote", which sends the brief to Raf like the wardrobe planner does (POST /api/brief:
   a Quote job in ServiceM8 and an email; production only, so previews can't send). Sums in src/lib/cost-calculator.ts. */

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
              {picked.label}, {picked.sub.toLowerCase()}: <span className="font-mono text-ink">{money(withVat(picked.rate))} {per(job)}</span> with VAT
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
              {job.qty && job.options.length > 1 ? `, ${picked.label.toLowerCase()}` : ''}
              {job.unit !== 'job' ? ` at ${money(withVat(e.rate))} ${per(job)}` : ''}
            </li>
            {e.minimum ? <li>That&apos;s my smallest job price ({money(e.gross[0])} with VAT).</li> : null}
            <li>The low end is a straightforward job; the top allows for the extra work a room can need.</li>
          </ul>
          <a href="#quote" className="btn mt-6 w-full border-on-accent bg-on-accent text-ink hover:bg-paper" data-cost-quote>
            Get a quote
          </a>
          <p className="mt-3 text-center text-[13px] text-on-accent/65">A guide from my own prices, not a quote.</p>
        </div>
      </div>

      <div className="lg:col-span-12">
        <QuoteForm job={job} qty={e.qty} opt={picked.id} gross={e.gross} />
      </div>
    </div>
  );
}

function QuoteForm({ job, qty, opt, gross }: { job: CostJob; qty: number; opt: string; gross: [number, number] }) {
  const [c, setC] = useState({ name: '', phone: '', email: '', postcode: '', when: '', notes: '' });
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<null | { name: string; phone: string; email: string }>(null);
  const trapRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement>(null);
  const set = (k: keyof typeof c) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setC((v) => ({ ...v, [k]: ev.target.value }));

  const okMobile = c.phone.replace(/\D/g, '').length >= 10;
  const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim());

  const focus = (id: string) => {
    const el = root.current?.querySelector<HTMLElement>(`#${id}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const send = async () => {
    if (sending) return;
    if (c.name.trim().length < 2) return setErr('Add your name.'), focus('cq-name');
    if (!okMobile && !okEmail) return setErr('Add your mobile or email so I can reply.'), focus('cq-phone');
    if (c.email.trim() && !okEmail) return setErr('That email address looks incomplete.'), focus('cq-email');
    setErr('');
    setSending(true);
    try {
      const r = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: c.name.trim(),
          mobile: okMobile ? c.phone.trim() : '',
          email: okEmail ? c.email.trim() : '',
          address: c.postcode.trim(),
          message: costMessage({ name: c.name, job, qty, optionId: opt, when: c.when, postcode: c.postcode, notes: c.notes }),
          photos: 0,
          company: trapRef.current?.value ?? '',
          ms: Math.round(performance.now()),
          choices: { what: [job.choicesWhat], room: [], uses: [], material: [] },
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setErr(
          j.error === 'name'
            ? 'Add your name.'
            : j.error === 'contact'
              ? 'Add your mobile or email so I can reply.'
              : j.error === 'busy'
                ? 'That has been sent a few times already. Wait a few minutes or call me.'
                : `It did not send. Try again, or call ${PHONE_DISPLAY}.`,
        );
        setSending(false);
        return;
      }
      setSent({ name: c.name.trim(), phone: okMobile ? c.phone.trim() : '', email: okEmail ? c.email.trim() : '' });
      setSending(false);
    } catch {
      setErr(`It did not send. Check your signal and try again, or call ${PHONE_DISPLAY}.`);
      setSending(false);
    }
  };

  // the thank-you card is much shorter than the form, so bring it into view once it's drawn
  useEffect(() => {
    if (sent) root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [sent]);

  const first = (sent?.name ?? '').split(' ')[0];
  const wa = whatsappUrl(`Hi Raf, this is ${sent?.name ?? ''}. I've just sent you my ${job.name.toLowerCase()} price from your website. Here are some photos of the space.`);

  return (
    <section id="quote" ref={root} className="scroll-mt-4 rounded-sm border border-line bg-mount p-5 md:p-8" aria-labelledby="cq-title">
      {sent ? (
        <div data-cost-sent>
          <p className="kicker">Sent</p>
          <h2 id="cq-title" className="mt-3 font-display text-[28px] font-[650] leading-tight tracking-[-0.02em] md:text-[34px]">Thanks{first ? `, ${first}` : ''}. It&apos;s with me.</h2>
          <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-muted">
            I&apos;ll reply within 24 hours{sent.phone ? ` by phone or WhatsApp on ${sent.phone}` : sent.email ? ` by email to ${sent.email}` : ''}, and come and measure up for free.
          </p>
          <p className="mt-6 text-[15px] font-semibold text-ink">Photos help me price it</p>
          <p className="mt-1 text-[15px] text-muted">A couple of the space, taken from the doorway, are plenty.</p>
          <a href={wa} target="_blank" rel="noopener" className="btn mt-4 border-whatsapp bg-whatsapp text-white hover:bg-whatsapp-hover">Send photos on WhatsApp</a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-5">
              <p className="kicker">Your price: {money(gross[0])} to {money(gross[1])}</p>
              <h2 id="cq-title" className="mt-3 font-display text-[28px] font-[650] leading-tight tracking-[-0.02em] md:text-[34px]">Get a written quote</h2>
              <p className="mt-3 max-w-[44ch] text-[16px] leading-relaxed text-muted">Send me this price with your details. I&apos;ll reply within 24 hours and come and measure up for free.</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-7 md:mt-0">
              <div className="sm:col-span-2">
                <label htmlFor="cq-name" className="block text-[14.5px] font-medium text-ink">Your name</label>
                <input id="cq-name" className={`${input} mt-1.5`} autoComplete="name" value={c.name} onChange={set('name')} maxLength={80} />
              </div>
              <div>
                <label htmlFor="cq-phone" className="block text-[14.5px] font-medium text-ink">Mobile</label>
                <input id="cq-phone" className={`${input} mt-1.5`} type="tel" autoComplete="tel" inputMode="tel" value={c.phone} onChange={set('phone')} maxLength={30} />
              </div>
              <div>
                <label htmlFor="cq-email" className="block text-[14.5px] font-medium text-ink">
                  Email <span className="font-normal text-faint">(or mobile)</span>
                </label>
                <input id="cq-email" className={`${input} mt-1.5`} type="email" autoComplete="email" value={c.email} onChange={set('email')} maxLength={160} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cq-postcode" className="block text-[14.5px] font-medium text-ink">
                  Postcode <span className="font-normal text-faint">(optional)</span>
                </label>
                <input id="cq-postcode" className={`${input} mt-1.5 sm:max-w-[220px]`} autoComplete="postal-code" value={c.postcode} onChange={set('postcode')} maxLength={10} />
              </div>
              <div className="sm:col-span-2">
                <p className="text-[14.5px] font-medium text-ink" id="cq-when">When</p>
                <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="cq-when">
                  {COST_WHEN.map((w) => (
                    <button key={w} type="button" aria-pressed={c.when === w} className={chip} onClick={() => setC((v) => ({ ...v, when: v.when === w ? '' : w }))}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="cq-notes" className="block text-[14.5px] font-medium text-ink">
                  Anything I should know? <span className="font-normal text-faint">(optional)</span>
                </label>
                <textarea id="cq-notes" className={`${input} mt-1.5 h-24 py-2.5`} value={c.notes} onChange={set('notes')} maxLength={800} />
              </div>
              <div className="absolute left-[-9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="cq-company">Company</label>
                <input id="cq-company" ref={trapRef} tabIndex={-1} autoComplete="off" />
              </div>
              <div className="sm:col-span-2">
                {err ? (
                  <p className="mb-3 text-[15px] font-medium text-accent" role="alert">
                    {err}
                  </p>
                ) : null}
                <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={send} disabled={sending} data-cost-send>
                  {sending ? 'Sending...' : 'Send to Raf'}
                </button>
                <p className="mt-3 text-[13.5px] text-faint">
                  Only sent to me. Nothing is kept on this website. Rather plan it in more detail? <Link href="/how-it-works#brief" className="text-accent hover:underline">Plan your project</Link>.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

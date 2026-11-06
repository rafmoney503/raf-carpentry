'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EMAIL, PHONE_DISPLAY, PHONE_HREF, whatsappUrl } from '@/lib/site';
import { FREE_ROUNDS, dayWords, gbp } from '@/lib/drawings-service';

type Done = { pack: string; units: number; total: number; due: string; email: string; name: string };

export default function Thanks() {
  const [done, setDone] = useState<Done | null>(null);
  const [state, setState] = useState<'checking' | 'done' | 'waiting' | 'problem'>('checking');

  useEffect(() => {
    const session = new URLSearchParams(location.search).get('session_id') ?? '';
    let tries = 0;
    let stop = false;
    const ask = async () => {
      tries += 1;
      try {
        const res = await fetch('/api/drawings/paid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session }) });
        const data = (await res.json().catch(() => ({}))) as Partial<Done> & { error?: string };
        if (stop) return;
        if (res.ok && data.pack) {
          setDone(data as Done);
          setState('done');
          try {
            sessionStorage.removeItem('raf_drawings_order');
          } catch {}
          return;
        }
        // A payment still going through (or a moment's hiccup): ask again a few times.
        if ((data.error === 'not-paid' || res.status >= 500) && tries < 6) {
          setState(data.error === 'not-paid' ? 'waiting' : 'checking');
          setTimeout(ask, 2500);
          return;
        }
        setState('problem');
      } catch {
        if (!stop && tries < 6) setTimeout(ask, 2500);
        else if (!stop) setState('problem');
      }
    };
    ask();
    return () => {
      stop = true;
    };
  }, []);

  if (state === 'done' && done) {
    return (
      <div className="max-w-[44rem]" data-dw-thanks>
        <p className="kicker mb-5">Order received</p>
        <h1 className="font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[54px]">
          Thanks{done.name ? `, ${done.name}` : ''}. <span className="text-accent">Your order is in.</span>
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted md:text-[19px]">Your payment is through and your files are with me.</p>
        <dl className="mt-8 divide-y divide-line rounded-sm border border-line bg-mount px-5 text-[16px]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Pack</dt>
            <dd className="text-right">
              {done.pack}, {done.units} unit{done.units === 1 ? '' : 's'}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Paid</dt>
            <dd className="font-mono">{gbp(done.total)} with VAT</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-muted">Your files by</dt>
            <dd className="text-right font-[620]" data-dw-due>
              {dayWords(done.due)}
            </dd>
          </div>
        </dl>
        <h2 className="mt-10 font-display text-[24px] font-[650] tracking-[-0.015em]">What happens next</h2>
        <ol className="mt-4 space-y-3 text-[16px] leading-relaxed text-muted">
          <li>1. I go through your sizes, sketch and photos. If anything is unclear, I email you first.</li>
          <li>
            2. The files come to {done.email || 'your email'} by {dayWords(done.due)}.
          </li>
          <li>3. Up to {FREE_ROUNDS} rounds of changes to the same design are free: reply with what to change.</li>
        </ol>
        <p className="mt-6 text-[15px] text-faint">A confirmation is on its way to your email. Check every size against your room before you cut.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={whatsappUrl("Hi Raf, I've just ordered drawings on your website. Here are more photos of the space:")} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            Send more photos on WhatsApp
          </a>
          <Link href="/" className="btn btn-ghost">
            Back to the website
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'problem') {
    return (
      <div className="max-w-[44rem]">
        <p className="kicker mb-5">Order</p>
        <h1 className="font-display text-[36px] font-[680] leading-[1.06] tracking-[-0.03em] md:text-[48px]">I couldn&apos;t check your payment from here.</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted">
          If you paid, it&apos;s safe: you&apos;ll get a receipt by email, and I&apos;ll have your order. If nothing arrives within the hour, email{' '}
          <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">
            {EMAIL}
          </a>{' '}
          or call{' '}
          <a href={PHONE_HREF} className="text-accent hover:underline">
            {PHONE_DISPLAY}
          </a>
          .
        </p>
        <Link href="/drawings" className="btn btn-ghost mt-8">
          Back to drawings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[44rem]" aria-live="polite">
      <p className="kicker mb-5">Order</p>
      <h1 className="font-display text-[36px] font-[680] leading-[1.06] tracking-[-0.03em] md:text-[48px]">{state === 'waiting' ? 'Your payment is going through…' : 'Checking your payment…'}</h1>
      <p className="mt-5 text-[17px] text-muted">This takes a few seconds.</p>
    </div>
  );
}

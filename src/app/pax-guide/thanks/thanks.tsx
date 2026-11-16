'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EMAIL, QUOTE_HREF, whatsappUrl } from '@/lib/site';
import guide from '../../../../content/pages/pax-guide.json';

type Order = { found: boolean; email?: string; downloads?: number; max?: number };
type State = 'checking' | 'ready' | 'late' | 'nolink';

const kicker = 'kicker mb-5';
const h1 = 'font-display text-[38px] font-[680] leading-[1.05] tracking-[-0.03em] md:text-[52px]';

export default function Thanks() {
  const [state, setState] = useState<State>('checking');
  const [order, setOrder] = useState<Order | null>(null);
  const [session, setSession] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const s = q.get('session_id') ?? '';
    setErr(q.get('err') ?? '');
    setSession(s);
    if (!/^cs_(live|test)_[A-Za-z0-9]{20,200}$/.test(s)) {
      setState('nolink');
      return;
    }
    let stop = false;
    const started = Date.now();
    const ask = async () => {
      try {
        const res = await fetch(`/api/pax-guide/order?session=${encodeURIComponent(s)}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as Order;
        if (stop) return;
        if (res.ok && data.found) {
          setOrder(data);
          setState('ready');
          return;
        }
      } catch {}
      if (stop) return;
      // Stripe tells the website within seconds; after 45 s the link is on its way by email instead.
      if (Date.now() - started < 45_000) setTimeout(ask, 2000);
      else setState('late');
    };
    ask();
    return () => {
      stop = true;
    };
  }, []);

  const help = whatsappUrl("Hi Raf, I've bought your IKEA PAX guide but can't get the download. I paid with this email: ");

  if (state === 'nolink') {
    return (
      <div className="max-w-[44rem]" data-guide-thanks="nolink">
        <p className={kicker}>IKEA PAX, built in</p>
        <h1 className={h1}>Bought the guide?</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted md:text-[19px]">Use the link in the email I sent you. It takes you back here with your download.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={help} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            Can&apos;t find it? WhatsApp me
          </a>
          <Link href="/pax-guide" className="btn btn-ghost">
            About the guide
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'ready' && order) {
    const left = Math.max(0, (order.max ?? 30) - (order.downloads ?? 0));
    const limit = err === 'limit' || left === 0;
    return (
      <div className="max-w-[44rem]" data-guide-thanks="ready">
        <p className={kicker}>Payment received</p>
        <h1 className={h1}>
          Thanks. <span className="text-accent">Your guide is ready.</span>
        </h1>
        {limit ? (
          <p className="mt-5 text-[17px] leading-relaxed text-muted md:text-[19px]" data-guide-limit>
            This link has been used {order.max ?? 30} times. WhatsApp me and I&apos;ll send you the guide again.
          </p>
        ) : (
          <>
            <p className="mt-5 text-[17px] leading-relaxed text-muted md:text-[19px]">{guide.pages} pages, A4. On a phone, open it and save it to Files or Books so it&apos;s with you in the room.</p>
            <a href={`/api/pax-guide/download?s=${encodeURIComponent(session)}`} className="btn btn-primary mt-8 w-full justify-center sm:w-auto" data-guide-download>
              Download the guide (PDF)
            </a>
            {err === 'busy' ? <p className="mt-3 text-[15px] text-faint">That didn&apos;t load. Try again in a moment.</p> : null}
          </>
        )}
        {order.email ? (
          <p className="mt-6 text-[15px] text-faint" data-guide-email>
            The link is also in your email ({order.email}): keep it, it works for {order.max ?? 30} downloads.
          </p>
        ) : null}
        <div className="mt-10 border-t border-line pt-8">
          <h2 className="font-display text-[24px] font-[650] tracking-[-0.015em]">Rather I fit it?</h2>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">In London I fit PAX built in. Send me your sizes or your IKEA design code and I&apos;ll come and measure up for free.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={QUOTE_HREF} className="btn btn-primary">
              Get a quote
            </Link>
            <a href={limit ? help : whatsappUrl("Hi Raf, I've just bought your IKEA PAX guide. A question about my wardrobe: ")} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
              WhatsApp me
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'late') {
    return (
      <div className="max-w-[44rem]" data-guide-thanks="late">
        <p className={kicker}>Payment received</p>
        <h1 className={h1}>Your guide is on its way.</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted md:text-[19px]">
          Your payment went through, and the download link is coming to your email. Nothing in 10 minutes? Check your spam, then WhatsApp me or email{' '}
          <a href={`mailto:${EMAIL}`} className="text-accent hover:underline">
            {EMAIL}
          </a>{' '}
          with the email you paid with.
        </p>
        <a href={help} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp mt-8">
          WhatsApp me
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-[44rem]" aria-live="polite" data-guide-thanks="checking">
      <p className={kicker}>Payment received</p>
      <h1 className={h1}>Getting your guide ready…</h1>
      <p className="mt-5 text-[17px] text-muted">This takes a few seconds.</p>
    </div>
  );
}

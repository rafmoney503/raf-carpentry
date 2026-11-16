import Image from 'next/image';
import Link from 'next/link';
import { PAX_GUIDE } from '@/lib/pax-guide';
import { whatsappUrl } from '@/lib/site';

/* The £9.99 PAX guide on the Tools page, straight under the wardrobe planner (Raf, 16 Nov 2026: "add this product
   just below wardrobe planner in 3d in tools with nice button buy make it stand out"). A blue edge, the cover and
   page 4 on graph paper, the price big and a Buy button that goes straight to Stripe. The picture and "See what's
   inside" open the guide's own page. */

const PAPER = {
  backgroundImage: 'linear-gradient(rgba(22,25,28,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(22,25,28,.06) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
};

export default function PaxGuideCard({ className = '' }: { className?: string }) {
  const { price, buyUrl, pages, href, cover, page4 } = PAX_GUIDE;
  const buy = buyUrl || whatsappUrl(`Hi Raf, I'd like your IKEA PAX guide (${price}).`);
  return (
    <div
      data-pax-guide-card
      className={`group/guide relative grid overflow-hidden rounded-sm border-2 border-accent bg-mount shadow-[0_18px_40px_-24px_rgba(37,71,208,0.55)] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] ${className}`}
    >
      <Link
        href={href}
        aria-label="See what's inside the IKEA PAX guide"
        className="relative flex items-center justify-center border-b border-line bg-paper p-5 md:border-b-0 md:border-r md:p-8"
        style={PAPER}
      >
        <span className="relative block aspect-[3/2] w-full max-w-[520px]">
          <span className="absolute right-[6%] top-[11%] block w-[40%] rotate-[4deg] border border-line-strong bg-white shadow-[0_12px_26px_-14px_rgba(22,25,28,0.45)] transition-transform duration-500 group-hover/guide:rotate-[6deg]">
            <Image src={page4} alt="" width={900} height={1273} sizes="(min-width: 768px) 210px, 40vw" className="block h-auto w-full" />
          </span>
          <span className="absolute left-[10%] top-[2%] block w-[45%] -rotate-[2deg] border border-line-strong bg-white shadow-[0_18px_36px_-16px_rgba(22,25,28,0.5)] transition-transform duration-500 group-hover/guide:-rotate-[3deg] group-hover/guide:-translate-y-1">
            <Image src={cover} alt="" width={900} height={1273} sizes="(min-width: 768px) 240px, 45vw" className="block h-auto w-full" />
          </span>
        </span>
        <span className="absolute left-3 top-3 rounded-sm bg-accent px-2 py-1 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-on-accent">New</span>
      </Link>
      <div className="flex flex-col justify-center p-5 md:p-8">
        <p className="font-mono text-[13px] text-accent">My guide · PDF · {pages} pages</p>
        <h3 className="mt-1.5 font-display text-[26px] font-[650] leading-[1.1] tracking-[-0.02em] md:text-[30px]">
          IKEA PAX, <span className="text-accent">built in</span>
        </h3>
        <p className="mt-2.5 text-[15.5px] leading-relaxed text-muted">
          Make flat-pack PAX look made to measure, floor to ceiling and wall to wall. The way I do it on my own jobs.
        </p>
        <ul className="mt-4 grid gap-1.5 text-[15px] text-ink">
          {['The frames for your wall, the sums done', 'Every part you make, with its size', 'A cut list and seven fitting steps'].map((t) => (
            <li key={t} className="flex items-baseline gap-2.5">
              <span aria-hidden="true" className="font-mono text-accent">
                +
              </span>
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={buy}
            data-buy="pax-guide-tools"
            className="btn btn-primary min-h-[52px] w-full justify-center gap-2 px-6 text-[17px] sm:w-auto shadow-[0_10px_22px_-12px_rgba(37,71,208,0.8)]"
          >
            Buy the guide, {price} <span aria-hidden="true">→</span>
          </a>
          <Link href={href} className="link-more text-[15px]">
            See what&apos;s inside
          </Link>
        </div>
        <p className="mt-3 font-mono text-[12.5px] text-faint">
          {buyUrl ? 'Card, Apple Pay or Google Pay · download straight after paying' : 'Message me and I’ll send it to you today'}
        </p>
      </div>
    </div>
  );
}

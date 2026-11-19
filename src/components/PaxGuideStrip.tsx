import Image from 'next/image';
import Link from 'next/link';
import { PAX_GUIDE } from '@/lib/pax-guide';

/* The PAX guide near the top of every PAX post, straight after the post's short answer (19 Nov 2026: of the 8
   people who read a PAX post since the guide went live, 1 scrolled to the end, where its only link was, and nobody
   tapped it). One slim card, the whole of it a link to the guide's page, which does the selling (the first buyer
   spent her time on its page previews and questions). */

export default function PaxGuideStrip() {
  const { price, pages, href, cover } = PAX_GUIDE;
  return (
    <Link
      href={href}
      data-pax-guide-strip
      className="group/strip my-9 flex items-center gap-4 rounded-sm border border-line-strong bg-mount p-3.5 shadow-[0_14px_30px_-22px_rgba(22,25,28,0.45)] transition-colors hover:border-accent sm:gap-5 sm:p-4"
    >
      <span className="block w-[68px] shrink-0 -rotate-[2deg] border border-line-strong bg-white shadow-[0_8px_16px_-10px_rgba(22,25,28,0.5)] transition-transform duration-300 group-hover/strip:-rotate-[3deg] sm:w-[84px]">
        <Image src={cover} alt="" width={900} height={1273} sizes="84px" className="block h-auto w-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[12.5px] text-accent">Doing it yourself? · My guide · {pages} pages</span>
        <span className="mt-0.5 block font-display text-[21px] font-[650] leading-[1.15] tracking-[-0.015em] text-ink sm:text-[23px]">
          IKEA PAX, <span className="text-accent">built in</span>
        </span>
        <span className="mt-1 block text-[15px] leading-snug text-muted">
          The frames for your wall, the fillers and top boxes, the cut list and how I fit it.
        </span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold text-ink group-hover/strip:text-accent">
            See inside <span aria-hidden="true">→</span>
          </span>
          <span className="font-mono text-[12.5px] text-faint">{price} PDF</span>
        </span>
      </span>
    </Link>
  );
}

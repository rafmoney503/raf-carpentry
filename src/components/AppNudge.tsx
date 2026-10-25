import Image from 'next/image';
import Link from 'next/link';
import { APP_ICON, APP_PAGE, APP_SCREENS } from '@/lib/workshop-tools/site';

/* The way into the Workshop Tools app (/tools/workshop) from other pages (25 Oct 2026).
   - 'line': the app's icon, a line and Get the app, like TradeNudge; on /tips, /calculator and the blog's trade posts
   - 'card': the card on the Tools page, with the app's home screen on a phone */

export default function AppNudge({
  variant = 'line',
  kicker = 'Free app for your phone',
  text = 'Workshop Tools: hinges, drawer runners, unit sizes, panelling, flooring and stud walls, in mm. Works with no signal on site.',
  bare = false,
  className = '',
}: {
  variant?: 'line' | 'card';
  kicker?: string;
  text?: string;
  bare?: boolean; // inside a section that already has its own spacing
  className?: string;
}) {
  if (variant === 'card') {
    return (
      <Link
        href={APP_PAGE}
        className={`group grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-sm border border-line-strong bg-mount p-4 transition-colors hover:border-accent sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-5 sm:p-5 md:p-6 ${className}`}
      >
        <span className="relative block aspect-[390/520] overflow-hidden rounded-[10px] border-[4px] border-ink bg-[#f1f2ef] sm:rounded-[14px] sm:border-[5px]">
          <Image src={APP_SCREENS.home.src} alt="" fill sizes="120px" className="object-cover object-top" />
        </span>
        <span className="min-w-0">
          <span className="block font-mono text-[13px] text-accent">Free app · iPhone and Android</span>
          <span className="mt-1 block text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">Workshop Tools</span>
          <span className="mt-1 block text-[15px] leading-relaxed text-muted">Ten setting-out tools in mm: hinges, drawer runners, unit sizes, panelling, flooring, stud walls and more. Saved on your phone, works with no signal.</span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent sm:hidden">Get the app <span aria-hidden="true">→</span></span>
        </span>
        <span className="hidden items-center gap-2 text-[15px] font-medium text-accent sm:flex">
          Get the app <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </span>
      </Link>
    );
  }
  const body = (
    <aside className={`flex items-start gap-4 sm:items-center ${className}`}>
      <Image src={APP_ICON} alt="" width={40} height={40} className="h-10 w-10 flex-none rounded-[9px]" />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-[62ch]">
          <p className="font-mono text-[13px] text-accent">{kicker}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
        </div>
        <Link href={APP_PAGE} className="link-more mt-3 flex-none text-[15px] sm:mt-0">
          Get the app <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
  if (bare) return <div className="mt-10 border-t border-line-strong pt-6">{body}</div>;
  return body;
}

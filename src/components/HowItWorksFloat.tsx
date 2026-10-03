import Link from 'next/link';

/* "How it works" button that stays in the bottom-left corner on every page, opposite the
   green WhatsApp button, so customers can always find what to send and what to expect. */
export default function HowItWorksFloat() {
  return (
    <Link
      href="/how-it-works"
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-40 flex h-14 items-center gap-2.5 rounded-full border border-line-strong bg-mount/95 pl-4 pr-5 text-[15px] font-semibold text-ink shadow-[0_8px_28px_rgb(22_25_28/0.18)] backdrop-blur-sm transition-colors hover:border-accent hover:text-accent md:bottom-6 md:left-6 md:h-12"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none text-accent">
        <circle cx="4" cy="5" r="1.6" fill="currentColor" />
        <circle cx="4" cy="10" r="1.6" fill="currentColor" />
        <circle cx="4" cy="15" r="1.6" fill="currentColor" />
        <path d="M8.5 5h8M8.5 10h8M8.5 15h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      How it works
    </Link>
  );
}

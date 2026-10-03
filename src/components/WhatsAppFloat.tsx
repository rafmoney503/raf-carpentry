'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SocialIcon from './SocialIcon';
import { whatsappText, whatsappUrl } from '@/lib/site';

/* WhatsApp button that stays in the bottom corner on every page. On a job or blog post it
   reads the page title, so the ready-typed message says which job the visitor was looking at. */
export default function WhatsAppFloat() {
  const pathname = usePathname() || '/';
  const [href, setHref] = useState(() => whatsappUrl(whatsappText(pathname)));

  useEffect(() => {
    const title = document.querySelector('main h1')?.textContent?.trim() ?? '';
    setHref(whatsappUrl(whatsappText(pathname, title)));
  }, [pathname]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="Message Raf on WhatsApp"
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2.5 rounded-full bg-whatsapp px-4 text-white shadow-[0_8px_28px_rgb(22_25_28/0.22)] transition-colors hover:bg-whatsapp-hover md:bottom-6 md:right-6 md:h-12 md:px-5"
    >
      <SocialIcon network="whatsapp" size={24} className="md:h-5 md:w-5" />
      <span className="hidden text-[15px] font-semibold md:inline">WhatsApp me</span>
    </a>
  );
}

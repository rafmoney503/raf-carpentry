'use client';
import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppFloat from './WhatsAppFloat';
import HowItWorksFloat from './HowItWorksFloat';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMiniSite = pathname === '/ms';
  const pageRef = useRef<HTMLDivElement>(null);
  const firstPage = useRef(true);
  // after a click to another page, the new page rises into place (woodwork.css .page-enter);
  // never on the first load, so nothing slows down the first thing a visitor sees
  useLayoutEffect(() => {
    if (firstPage.current) { firstPage.current = false; return; }
    pageRef.current?.classList.add('page-enter');
  }, [pathname]);

  if (isMiniSite) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen">
        {/* wide screens: a marking-out line with ruler ticks down the left margin (woodwork.css) */}
        <div className="page-rule" aria-hidden="true" />
        <div key={pathname} ref={pageRef}>{children}</div>
      </main>
      <Footer />
      {/* Floating buttons: Plan your project (/how-it-works) bottom-left, WhatsApp bottom-right. None on the calculator
          (they sat on the keypad on phones). Plan your project has its own WhatsApp button that sends
          the customer's brief, so neither floats there either. */}
      {pathname?.startsWith('/editor') || pathname === '/calculator' || pathname === '/how-it-works' || pathname?.startsWith('/review') ? null : (
        <>
          <HowItWorksFloat />
          <WhatsAppFloat />
        </>
      )}
    </>
  );
}

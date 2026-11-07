'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppFloat from './WhatsAppFloat';
import HowItWorksFloat from './HowItWorksFloat';
import RecentDesign from './RecentDesign';
import PhoneBar from './PhoneBar';
import BackBar, { useBackTrail } from './BackBar';
import type { MenuPanel } from '@/lib/menu-panels';

export default function LayoutShell({ children, menu }: { children: React.ReactNode; menu?: Record<string, MenuPanel> }) {
  const pathname = usePathname();
  // every page shown goes on the tab's trail, for the back link at the top of the next one
  useBackTrail();
  // The Instagram mini-site, Raf's Job Kit app, the Workshop Tools and Workshop Games apps and the simple calculator
  // stand alone: no menu, footer or floating buttons.
  const isMiniSite = pathname === '/ms' || pathname?.startsWith('/job-kit') || pathname?.startsWith('/tools/workshop/app') || pathname?.startsWith('/tools/games/app') || pathname === '/tools/calculator';

  if (isMiniSite) {
    return <main>{children}</main>;
  }

  // What floats at the bottom of this page. None on the calculator and the tools with their own screens (they sat on
  // the keypad on phones), on Plan your project (its own WhatsApp button sends the customer's brief), on Your
  // readings (its own send bar) and on the private pages. A cost calculator page has its own quote form, the drawings
  // service its own order form (Get my free quote is for a fitting job) and the decking calculator its own Get a
  // quote, so only WhatsApp there.
  const p = pathname || '/';
  const floats: 'none' | 'wa' | 'all' =
    p.startsWith('/editor') || p === '/calculator' || p === '/tools/spirit-level' || p === '/tools/workshop' || p.startsWith('/tools/games') || p === '/tools/readings' || p === '/wardrobe-planner' || p === '/how-it-works' || p.startsWith('/review') || p.startsWith('/d/') || p.startsWith('/ideas/')
      ? 'none'
      : p.startsWith('/cost/') || p.startsWith('/drawings') || p === '/tools/decking-calculator'
        ? 'wa'
        : 'all';

  return (
    <>
      <Navbar menu={menu} barQuote={floats === 'all'} />
      <main className="min-h-screen">
        <BackBar />
        {children}
      </main>
      <Footer />
      {floats === 'none' ? null : (
        <>
          {/* phones: one bar along the bottom with Back, Top, Get my free quote and WhatsApp (src/components/PhoneBar.tsx),
              and room under the footer so it never covers the end of the page; computers: the floating buttons */}
          <PhoneBar quote={floats === 'all'} />
          <div aria-hidden="true" className="h-[calc(66px+env(safe-area-inset-bottom))] md:hidden" />
          <div className="hidden md:contents">
            {floats === 'all' ? <HowItWorksFloat /> : null}
            <WhatsAppFloat />
          </div>
          {/* once a visit: a job someone really looked at or saved lately, above Get my free quote */}
          {floats === 'all' ? <RecentDesign /> : null}
        </>
      )}
    </>
  );
}

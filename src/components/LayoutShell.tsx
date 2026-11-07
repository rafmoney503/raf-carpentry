'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppFloat from './WhatsAppFloat';
import HowItWorksFloat from './HowItWorksFloat';
import RecentDesign from './RecentDesign';
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

  return (
    <>
      <Navbar menu={menu} />
      <main className="min-h-screen">
        <BackBar />
        {children}
      </main>
      <Footer />
      {/* Floating buttons: Get my free quote (the brief on /how-it-works) bottom-left, WhatsApp bottom-right. None on the calculator
          (they sat on the keypad on phones). Plan your project has its own WhatsApp button that sends
          the customer's brief, so neither floats there either. Your readings has its own send bar at the bottom. */}
      {pathname?.startsWith('/editor') || pathname === '/calculator' || pathname === '/tools/spirit-level' || pathname === '/tools/workshop' || pathname?.startsWith('/tools/games') || pathname === '/tools/readings' || pathname === '/wardrobe-planner' || pathname === '/how-it-works' || pathname?.startsWith('/review') || pathname?.startsWith('/d/') || pathname?.startsWith('/ideas/') ? null : (
        pathname?.startsWith('/cost/') || pathname?.startsWith('/drawings') || pathname === '/tools/decking-calculator' ? (
          /* a cost calculator page has its own quote form, and the drawings service its own order form (Get my free
             quote is for a fitting job), so only WhatsApp floats there; the decking calculator has its own Get a quote */
          <WhatsAppFloat />
        ) : (
          <>
            <HowItWorksFloat />
            <WhatsAppFloat />
            {/* once a visit: a job someone really looked at or saved lately, above Get my free quote */}
            <RecentDesign />
          </>
        )
      )}
    </>
  );
}

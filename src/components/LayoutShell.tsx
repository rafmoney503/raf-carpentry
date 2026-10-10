'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppFloat from './WhatsAppFloat';
import HowItWorksFloat from './HowItWorksFloat';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The Instagram mini-site and Raf's Job Kit app stand alone: no menu, footer or floating buttons.
  const isMiniSite = pathname === '/ms' || pathname?.startsWith('/job-kit');

  if (isMiniSite) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      {/* Floating buttons: Plan your project (/how-it-works) bottom-left, WhatsApp bottom-right. None on the calculator
          (they sat on the keypad on phones). Plan your project has its own WhatsApp button that sends
          the customer's brief, so neither floats there either. */}
      {pathname?.startsWith('/editor') || pathname === '/calculator' || pathname === '/tools/timber-stack' || pathname === '/how-it-works' || pathname?.startsWith('/review') || pathname?.startsWith('/d/') ? null : (
        <>
          <HowItWorksFloat />
          <WhatsAppFloat />
        </>
      )}
    </>
  );
}

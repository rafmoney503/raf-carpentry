'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import WhatsAppFloat from './WhatsAppFloat';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMiniSite = pathname === '/ms';

  if (isMiniSite) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      {/* No floating WhatsApp on the calculator (it sat on the = key on phones) or on How it works,
          which has its own WhatsApp button that sends the customer's brief. */}
      {pathname?.startsWith('/editor') || pathname === '/calculator' || pathname === '/how-it-works' ? null : <WhatsAppFloat />}
    </>
  );
}

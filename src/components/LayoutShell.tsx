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
      {/* No floating WhatsApp on the calculator: it would sit on top of the = key on phones. */}
      {pathname?.startsWith('/editor') || pathname === '/calculator' ? null : <WhatsAppFloat />}
    </>
  );
}

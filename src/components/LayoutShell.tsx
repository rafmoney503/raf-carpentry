'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMiniSite = pathname === '/ms';

  if (isMiniSite) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">{children}</main>
      <Footer />
    </>
  );
}

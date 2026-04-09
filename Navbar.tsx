'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/portfolio', label: 'My Work' },
  { href: '/cabinetos', label: 'Cabinetos' },
  { href: '/sketchup', label: 'SketchUp' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0f1114]/80 border-b border-[--border]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-white flex items-center justify-center">
            <Image src="/images/r-logo-final.png" alt="R" width={36} height={36} className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg tracking-tight">Raf Carpentry</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === l.href
                  ? 'text-[--gold] bg-[rgba(212,168,83,0.1)]'
                  : 'text-[--text-muted] hover:text-[--text] hover:bg-[--bg-card]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5"
          aria-label="Menu"
        >
          <span className={`w-5 h-0.5 bg-white transition-all ${open ? 'rotate-45 translate-y-1' : ''}`} />
          <span className={`w-5 h-0.5 bg-white transition-all ${open ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-0.5 bg-white transition-all ${open ? '-rotate-45 -translate-y-1' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[--bg-card] border-b border-[--border] px-6 py-4 flex flex-col gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname === l.href
                  ? 'text-[--gold] bg-[rgba(212,168,83,0.1)]'
                  : 'text-[--text-muted] hover:text-[--text]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

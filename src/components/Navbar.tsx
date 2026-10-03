'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PHONE_DISPLAY, PHONE_HREF, QUOTE_URL } from '@/lib/site';

const links = [
  { href: '/portfolio', label: 'My Work' },
  { href: '/sketchup', label: 'SketchUp' },
  { href: '/cabinetos', label: 'CabinetOS' },
  { href: '/blog', label: 'Blog' },
  { href: '/tools', label: 'Tools' },
  { href: '/about', label: 'About' },
];


export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-5 md:h-[72px] md:gap-8 md:px-10">
        <Link href="/" className="flex items-center gap-3 whitespace-nowrap text-[17px] font-semibold tracking-tight">
          <span className="h-9 w-9 flex-none overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-line-strong">
            <Image src="/images/r-logo-final.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
          </span>
          Raf Carpentry
        </Link>

        <nav aria-label="Main" className="ml-auto hidden gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href || pathname.startsWith(l.href + '/') ? 'page' : undefined}
              className="whitespace-nowrap rounded-sm px-3 py-2 text-[15px] text-muted transition-colors hover:text-ink aria-[current=page]:text-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5 lg:ml-0 lg:gap-5">
          <a href={PHONE_HREF} className="hidden whitespace-nowrap font-mono text-sm text-ink xl:inline">
            {PHONE_DISPLAY}
          </a>
          <a href={QUOTE_URL} target="_blank" rel="noopener" className="btn btn-primary btn-sm">
            Get a quote
          </a>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-line-strong text-ink lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 7h14M3 13h14" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-line bg-paper px-5 pb-6 pt-2 lg:hidden">
          {[...links, { href: '/how-it-works', label: 'How it works' }, { href: '/contact', label: 'Contact' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-line py-3.5 text-[17px] text-ink"
            >
              {l.label}
            </Link>
          ))}
          <a href={PHONE_HREF} className="mt-5 block font-mono text-[15px] text-ink">
            {PHONE_DISPLAY}
          </a>
        </nav>
      )}
    </header>
  );
}

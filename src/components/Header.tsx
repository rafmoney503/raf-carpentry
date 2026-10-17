'use client';

import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#systems', label: 'Systems', note: '3 running' },
  { href: '#servicem8', label: 'ServiceM8', note: 'how it connects' },
  { href: '#how', label: 'How I work', note: '4 steps' },
  { href: '#paint', label: 'Paint schedule', note: 'try it' },
  { href: '#faq', label: 'Questions', note: '' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <header className="site-head">
      <div className="wrap">
        <div className="head-row">
          <a href="#top" className="logo" aria-label="Rafal Solutions, back to the top">
            <span className="logo-mark" aria-hidden="true">
              rs
            </span>
            <span className="logo-name">Rafal Solutions</span>
          </a>
          <nav className="nav" aria-label="Main">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="head-actions">
            <a href="#contact" className="btn btn-sm head-cta">
              Tell me the problem
            </a>
            <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((v) => !v)}>
              {open ? 'Close' : 'Menu'}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-menu" className="mobile-menu" aria-label="Main">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="link" onClick={() => setOpen(false)}>
                {l.label}
                {l.note ? <span>{l.note}</span> : null}
              </a>
            ))}
            <a href="#contact" className="btn" onClick={() => setOpen(false)}>
              Tell me the problem
            </a>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

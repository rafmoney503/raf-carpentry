import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rafal Janczy — Links',
  description: 'All my links in one place. Carpentry services, CabinetOS app, tools, and more.',
};

const links = [
  {
    icon: '⚡',
    title: 'CabinetOS App Waitlist',
    subtitle: 'Cutlists. Boards. Done. A carpenter built this — join free.',
    href: '/cabinetos',
    highlight: true,
  },
  {
    icon: '🪚',
    title: 'Book a Service in London',
    subtitle: "Let's make your dream project a reality!",
    href: '/contact',
  },
  {
    icon: '🛠️',
    title: 'My Carpentry Tools',
    subtitle: 'Affiliate links for all the tools I use daily.',
    href: '#',
  },
  {
    icon: '✏️',
    title: 'SketchUp for Carpenters',
    subtitle: 'How I design every project in 3D before building.',
    href: '/sketchup',
  },
  {
    icon: '📝',
    title: 'The Workshop Journal',
    subtitle: 'Blog — tips, tutorials, and behind-the-scenes.',
    href: '/blog',
  },
  {
    icon: '👤',
    title: 'Get to Know Me',
    subtitle: 'My story — from carpentry to code.',
    href: '/about',
  },
  {
    icon: '🌐',
    title: 'Full Website',
    subtitle: 'Explore everything at rafcarpentry.com',
    href: '/',
  },
];

export default function MiniSite() {
  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-10 max-w-lg mx-auto">
      {/* Profile */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden border-[3px] border-[--gold] mb-4 bg-[--bg-card] flex items-center justify-center p-4">
          <Image
            src="/images/r-logo-gold.png"
            alt="Raf Carpentry Logo"
            width={64}
            height={64}
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-xl font-bold">Rafal Janczy</h1>
        <p className="text-sm text-[--text-muted] mt-1">Where Ideas Take Shape</p>
        
        {/* Social icons */}
        <div className="flex gap-4 mt-4">
          <a
            href="https://www.instagram.com/rafcarpentry/"
            target="_blank"
            rel="noopener"
            className="w-10 h-10 rounded-full border border-[--border] flex items-center justify-center text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors text-sm"
            aria-label="Instagram"
          >
            📸
          </a>
          <a
            href="https://www.tiktok.com/@rafcarpentry"
            target="_blank"
            rel="noopener"
            className="w-10 h-10 rounded-full border border-[--border] flex items-center justify-center text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors text-sm"
            aria-label="TikTok"
          >
            🎵
          </a>
          <a
            href="https://www.facebook.com/rafcarpentry/"
            target="_blank"
            rel="noopener"
            className="w-10 h-10 rounded-full border border-[--border] flex items-center justify-center text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors text-sm"
            aria-label="Facebook"
          >
            📘
          </a>
        </div>
      </div>

      {/* Links */}
      <div className="w-full space-y-3">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.href}
            className={`block w-full rounded-2xl border p-4 transition-all duration-200 group ${
              link.highlight
                ? 'border-[--gold] bg-gradient-to-r from-[rgba(212,168,83,0.1)] to-[rgba(212,168,83,0.03)] hover:from-[rgba(212,168,83,0.15)] hover:to-[rgba(212,168,83,0.06)]'
                : 'border-[--border] bg-[--bg-card] hover:border-[rgba(212,168,83,0.3)] hover:bg-[--bg-card-hover]'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                link.highlight ? 'bg-[rgba(212,168,83,0.2)]' : 'bg-[rgba(212,168,83,0.08)]'
              }`}>
                {link.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm group-hover:text-[--gold] transition-colors ${
                  link.highlight ? 'text-[--gold]' : ''
                }`}>
                  {link.highlight && <span className="text-[--gold-light]">NEW ⚡ </span>}
                  {link.title}
                </div>
                <div className="text-xs text-[--text-muted] mt-0.5 leading-snug">{link.subtitle}</div>
              </div>
              <div className="text-[--text-muted] text-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                →
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-10 text-center">
        <p className="text-xs text-[--text-muted]">© {new Date().getFullYear()} Raf Carpentry</p>
      </div>
    </div>
  );
}

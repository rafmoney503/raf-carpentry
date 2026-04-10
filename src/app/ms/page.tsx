import Image from 'next/image';
import type { Metadata } from 'next';
import { readPageJson } from '@/lib/pages';

type MsLink = {
  label: string;
  subtitle: string;
  url: string;
  icon: string;
  highlight: boolean;
};

type MsPageData = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  subtitle: string;
  links: MsLink[];
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const d = readPageJson<MsPageData>('ms.json');
  return {
    title: d.metaTitle,
    description: d.metaDescription,
  };
}

export default function MiniSite() {
  const d = readPageJson<MsPageData>('ms.json');

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-10 max-w-lg mx-auto">
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 rounded-full overflow-hidden border-[3px] border-[--gold] mb-4 bg-white flex items-center justify-center">
          <Image
            src="/images/r-logo-final.png"
            alt="Raf Carpentry Logo"
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-xl font-bold">{d.title}</h1>
        <p className="text-sm text-[--text-muted] mt-1">{d.subtitle}</p>

        <div className="flex gap-4 mt-4">
          <a
            href={d.instagramUrl}
            target="_blank"
            rel="noopener"
            className="w-10 h-10 rounded-full border border-[--border] flex items-center justify-center text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors text-sm"
            aria-label="Instagram"
          >
            {'\u{1F4F7}'}
          </a>
          <a
            href={d.tiktokUrl}
            target="_blank"
            rel="noopener"
            className="w-10 h-10 rounded-full border border-[--border] flex items-center justify-center text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors text-sm"
            aria-label="TikTok"
          >
            {'\u{1F3B5}'}
          </a>
          <a
            href={d.facebookUrl}
            target="_blank"
            rel="noopener"
            className="w-10 h-10 rounded-full border border-[--border] flex items-center justify-center text-[--text-muted] hover:border-[--gold] hover:text-[--gold] transition-colors text-sm"
            aria-label="Facebook"
          >
            {'\u{1F4D8}'}
          </a>
        </div>
      </div>

      <div className="w-full space-y-3">
        {d.links.map((link, i) => (
          <a
            key={i}
            href={link.url}
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
                  {link.highlight && <span className="text-[--gold-light]">NEW {'\u26A1'} </span>}
                  {link.label}
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

      <div className="mt-10 text-center">
        <p className="text-xs text-[--text-muted]">© {new Date().getFullYear()} Raf Carpentry</p>
      </div>
    </div>
  );
}

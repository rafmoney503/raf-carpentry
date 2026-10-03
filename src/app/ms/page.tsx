import Image from 'next/image';
import SocialIcon, { networkOf } from '@/components/SocialIcon';
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
  const socials = [
    { href: d.instagramUrl, label: 'Instagram' },
    { href: d.tiktokUrl, label: 'TikTok' },
    { href: d.facebookUrl, label: 'Facebook' },
  ].filter((s) => s.href);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-5 py-12">
      <div className="flex flex-col items-center text-center">
        <div className="h-20 w-20 overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-line-strong">
          <Image src="/images/r-logo-final.png" alt="Raf Carpentry logo" width={80} height={80} className="h-full w-full object-cover" priority />
        </div>
        <h1 className="mt-5 font-display text-[28px] font-[680] tracking-[-0.025em]">{d.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{d.subtitle}</p>
        <div className="mt-6 flex gap-5">
          {socials.map((s) => {
            const net = networkOf(s.href) ?? networkOf(s.label);
            return (
              <a key={s.label} href={s.href} target="_blank" rel="noopener" aria-label={`${s.label}: @rafcarpentry`} className="group flex flex-col items-center gap-1.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-mount text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
                  {net ? <SocialIcon network={net} size={20} /> : null}
                </span>
                <span className="font-mono text-[11px] text-faint transition-colors group-hover:text-accent">{s.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="mt-10 w-full space-y-3">
        {d.links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            className={`group flex min-h-[68px] items-center gap-4 rounded-sm border px-5 py-4 transition-colors ${
              link.highlight ? 'border-accent bg-accent text-on-accent hover:bg-accent-hover' : 'border-line-strong bg-mount hover:border-accent'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className={`text-[16px] font-semibold ${link.highlight ? '' : 'transition-colors group-hover:text-accent'}`}>{link.label}</div>
              <div className={`mt-0.5 text-[13px] leading-snug ${link.highlight ? 'text-on-accent/80' : 'text-muted'}`}>{link.subtitle}</div>
            </div>
            <span aria-hidden="true" className={`flex-none transition-transform group-hover:translate-x-1 ${link.highlight ? '' : 'text-accent'}`}>→</span>
          </a>
        ))}
      </div>

      <p className="mt-auto pt-12 text-center text-xs text-faint">© {new Date().getFullYear()} Raf Carpentry</p>
    </div>
  );
}

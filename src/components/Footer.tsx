import Link from 'next/link';
import Image from 'next/image';
import SocialIcon, { networkOf } from './SocialIcon';
import { whatsappText, whatsappUrl } from '@/lib/site';

const explore = [
  { href: '/portfolio', label: 'My Work' },
  { href: '/sketchup', label: 'SketchUp' },
  { href: '/cabinetos', label: 'CabinetOS' },
  { href: '/tools', label: 'Tools' },
  { href: '/calculator', label: 'Calculator' },
];
const read = [
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];
const social = [
  { href: 'https://www.instagram.com/rafcarpentry/', label: 'Instagram' },
  { href: 'https://www.tiktok.com/@rafcarpentry', label: 'TikTok' },
  { href: 'https://www.facebook.com/rafcarpentry/', label: 'Facebook' },
];

const linkClass = 'block py-2.5 text-[15px] text-muted transition-colors hover:text-ink md:py-1.5';

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1280px] px-5 pb-24 pt-14 md:px-10 md:pb-10 md:pt-[72px]">
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-12 md:gap-x-6">
          <div className="col-span-2 md:col-span-4">
            <Link href="/" className="flex items-center gap-3 text-[17px] font-semibold tracking-tight">
              <span className="h-9 w-9 flex-none overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-line-strong">
                <Image src="/images/r-logo-final.png" alt="" width={36} height={36} className="h-full w-full object-cover" />
              </span>
              Raf Carpentry
            </Link>
            <p className="mt-4 max-w-[32ch] text-pretty text-[15px] text-muted">Fitted furniture in London, drawn before it&apos;s built.</p>
          </div>
          <div className="md:col-span-2 md:col-start-6">
            <h4 className="mb-3 font-sans text-sm font-semibold tracking-normal text-ink">Explore</h4>
            {explore.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </div>
          <div className="md:col-span-2">
            <h4 className="mb-3 font-sans text-sm font-semibold tracking-normal text-ink">Read</h4>
            {read.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
            ))}
          </div>
          <div className="col-span-2 md:col-span-3">
            <h4 className="mb-3 font-sans text-sm font-semibold tracking-normal text-ink">Contact</h4>
            <a href="tel:07792860221" className={linkClass}>07792 860221</a>
            <a href={whatsappUrl(whatsappText())} target="_blank" rel="noopener" className={linkClass.replace('block', 'flex items-center gap-2.5')}>
              <SocialIcon network="whatsapp" size={17} className="text-whatsapp" />
              WhatsApp me
            </a>
            <a href="mailto:info@rafcarpentry.com" className={linkClass}>info@rafcarpentry.com</a>
            <div className="mt-2">
              {social.map((l) => {
                const net = networkOf(l.href);
                return (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener" className={linkClass.replace('block', 'flex items-center gap-2.5')}>
                    {net ? <SocialIcon network={net} size={17} /> : null}
                    {l.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-1.5 border-t border-line pt-6 text-[13px] leading-relaxed text-faint md:mt-16">
          <p>© {new Date().getFullYear()} Raf Carpentry. Raf Carpentry is a trading name of Rafal Solutions Ltd, registered in England and Wales, company no. 13645392.</p>
          <p>Registered office: 14 Kings Road, Wood Green, London N22 5SN. VAT no. 521 4613 26.</p>
        </div>
      </div>
    </footer>
  );
}

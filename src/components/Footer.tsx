import Link from 'next/link';
import Image from 'next/image';
import SocialIcon, { networkOf } from './SocialIcon';
import { CosMark, RsMark } from './AlsoByMe';
import { CABINETOS_URL, COMPANY, GOOGLE_REVIEWS_URL, RAFAL_SOLUTIONS_URL, whatsappText, whatsappUrl } from '@/lib/site';

const explore = [
  { href: '/services', label: 'Services' },
  { href: '/portfolio', label: 'My Work' },
  { href: '/designs', label: 'Designs in 3D' },
  { href: '/areas', label: 'Where I work' },
  { href: '/sketchup', label: 'SketchUp' },
  { href: '/cabinetos', label: 'CabinetOS' },
  { href: '/tools', label: 'Tools' },
  { href: '/tools/workshop', label: 'Workshop Tools app' },
  { href: '/tools/games', label: 'Workshop Games' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/tips', label: 'Workshop tips' },
];
const read = [
  { href: '/how-it-works', label: 'Plan your project' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/review', label: 'Leave a review' },
];
const social = [
  { href: 'https://www.instagram.com/rafcarpentry/', label: 'Instagram' },
  { href: 'https://www.tiktok.com/@rafcarpentry', label: 'TikTok' },
  { href: 'https://www.facebook.com/rafcarpentry/', label: 'Facebook' },
  { href: GOOGLE_REVIEWS_URL, label: 'Google reviews' },
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
            {/* My other two names; rafalsolutions.co.uk's footer links back the same way (src/components/AlsoByMe.tsx). */}
            <div className="mt-7 max-w-[34ch]">
              <h4 className="font-sans text-sm font-semibold tracking-normal text-ink">Also by me</h4>
              {[
                { href: RAFAL_SOLUTIONS_URL, mark: <RsMark size={26} />, name: 'Rafal Solutions', line: 'Systems for trade businesses' },
                { href: CABINETOS_URL, mark: <CosMark size={26} />, name: 'CabinetOS', line: 'Cut lists for cabinet makers' },
              ].map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener" className="group mt-3 flex items-center gap-3 text-[15px] leading-snug">
                  {l.mark}
                  <span>
                    <span className="block font-medium text-ink group-hover:text-accent">{l.name}</span>
                    <span className="block text-[13.5px] text-muted">{l.line}</span>
                  </span>
                </a>
              ))}
            </div>
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
                    {net ? (
                      <SocialIcon network={net} size={17} />
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="flex-none text-accent">
                        <path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z" />
                      </svg>
                    )}
                    {l.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-1.5 border-t border-line pt-6 text-[13px] leading-relaxed text-faint md:mt-16">
          <p>
            © {new Date().getFullYear()} Raf Carpentry. Raf Carpentry is a trading name of{' '}
            <a href={RAFAL_SOLUTIONS_URL} target="_blank" rel="noopener" className="underline decoration-line-strong underline-offset-2 hover:text-ink">{COMPANY.name}</a>, registered in England and Wales, company no. {COMPANY.number}.
          </p>
          <p>
            Registered office: {COMPANY.office}. VAT no. {COMPANY.vat}.{' '}
            <Link href="/privacy" className="underline decoration-line-strong underline-offset-2 hover:text-ink">
              Privacy
            </Link>
          </p>
          {/* Raf's own tool: sends a client the review link by WhatsApp or text (src/app/review/send). */}
          <p className="mt-2">
            <Link href="/review/send" className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-accent hover:underline">
              For Raf: ask a client for a review <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

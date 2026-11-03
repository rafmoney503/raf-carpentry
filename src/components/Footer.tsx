import Link from 'next/link';
import { ADDRESS, COMPANY, COMPANY_NO, EMAIL, PHONE_DISPLAY, PHONE_HREF, RAFCARPENTRY_URL, VAT_NO, whatsappUrl } from '@/lib/site';
import { STEPS5 } from '@/lib/steps';

/* The bottom of every page: the five steps in their colours, the systems pages, the company and how to reach Rafal. */

const BUILT = [
  { href: '/systems', label: 'Systems running today' },
  { href: '/servicem8', label: 'ServiceM8' },
  { href: '/trades', label: 'Trades' },
  { href: '/paint-schedule', label: 'Paint schedule' },
  { href: '/how-it-works', label: 'How it works' },
];

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-planks" aria-hidden="true">
        {STEPS5.map((s) => (
          <span key={s.id} className={`fp fp-${s.id}`} />
        ))}
      </div>
      <div className="wrap foot-grid">
        <div className="foot-col foot-about" style={{ gap: 8 }}>
          <span className="foot-brand">rafal solutions</span>
          <span>Software for people who build things. Made in a working London workshop.</span>
          <Link href="/start" className="btn btn-sm" style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            <span className="dot" aria-hidden="true" />
            Start a project
          </Link>
        </div>
        <nav className="foot-col" aria-label="The five steps">
          <span className="foot-head">The five steps</span>
          {STEPS5.map((s) =>
            s.external ? (
              <a key={s.id} href={s.href} target="_blank" rel="noopener" className={`foot-step fs-${s.id}`}>
                {s.name}
              </a>
            ) : (
              <Link key={s.id} href={s.href} className={`foot-step fs-${s.id}`}>
                {s.name}
              </Link>
            ),
          )}
        </nav>
        <nav className="foot-col" aria-label="Built for you">
          <span className="foot-head">Built for you</span>
          {BUILT.map((m) => (
            <Link key={m.href} href={m.href}>
              {m.label}
            </Link>
          ))}
        </nav>
        <nav className="foot-col" aria-label="Company">
          <span className="foot-head">Company</span>
          <Link href="/about">About Rafal</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/contact">Contact</Link>
          <a href={RAFCARPENTRY_URL} target="_blank" rel="noopener">
            Raf Carpentry
          </a>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <div className="foot-col">
          <span className="foot-head">Talk to Rafal</span>
          <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
          <a href={whatsappUrl('Hi Rafal, I found you on rafalsolutions.co.uk. ')} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </div>
      </div>
      <div className="wrap foot-legal">
        © {new Date().getFullYear()} {COMPANY}, registered in England and Wales, company no. {COMPANY_NO}. Registered office: {ADDRESS}. VAT no. {VAT_NO}.
      </div>
    </footer>
  );
}

import Link from 'next/link';
import { CONTACT_ITEM, MENU } from '@/lib/menu';
import { ADDRESS, CABINETOS_URL, COMPANY, COMPANY_NO, EMAIL, PHONE_DISPLAY, PHONE_HREF, RAFCARPENTRY_URL, VAT_NO, whatsappUrl } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-grid">
        <div className="foot-col" style={{ gap: 8 }}>
          <span className="foot-brand">
            Rafal Solutions <span>· Just Build.</span>
          </span>
          <span>Systems for trade businesses, built by a carpenter.</span>
        </div>
        <nav className="foot-col" aria-label="Pages">
          <span className="foot-head">Pages</span>
          {[...MENU, CONTACT_ITEM].map((m) => (
            <Link key={m.href} href={m.href}>
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="foot-col">
          <span className="foot-head">Contact</span>
          <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
          <a href={whatsappUrl('Hi Rafal, I found you on rafalsolutions.co.uk. ')} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </div>
        <div className="foot-col">
          <span className="foot-head">Also by me</span>
          <a href={CABINETOS_URL} target="_blank" rel="noopener">
            CabinetOS
          </a>
          <a href={RAFCARPENTRY_URL} target="_blank" rel="noopener">
            Raf Carpentry
          </a>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
      <div className="wrap foot-legal">
        {COMPANY} · Company No. {COMPANY_NO} · VAT No. {VAT_NO} · Registered office: {ADDRESS}
      </div>
    </footer>
  );
}

import Link from 'next/link';
import SocialIcon from '@/components/SocialIcon';
import { whatsappUrl } from '@/lib/site';

/* Shown in the brief once the customer presses Send to Raf, Send on WhatsApp, Email it or Copy text: the three
   steps that follow, in the site's own promises only (a reply within 24 hours, a free visit and quote, a 3D drawing
   to sign off before anything is cut), and what to do while they wait (photos of the space). After Send to Raf
   it says the brief has arrived, with how many photos, and offers WhatsApp for any photos that didn't make it. */

type How = 'whatsapp' | 'email' | 'copy' | 'direct';
export type Direct = { photosSent: number; photosTotal: number; mobile: string; email: string; name: string };

const LEAD: Record<Exclude<How, 'direct'>, string> = {
  whatsapp: 'Press send in WhatsApp if you haven’t yet. Then:',
  email: 'Press send in your email if you haven’t yet. Then:',
  copy: 'Paste it into WhatsApp, a text or an email to me. Then:',
};

const REPLY: Record<Exclude<How, 'direct'>, string> = {
  whatsapp: 'On WhatsApp, in the same chat.',
  email: 'By email.',
  copy: 'Wherever you sent it.',
};

const PHOTOS: Record<Exclude<How, 'direct'>, string> = {
  whatsapp: 'Send photos of the space in the same WhatsApp chat:',
  email: 'Attach photos of the space to the email before you send it:',
  copy: 'Send photos of the space with it:',
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export default function WhatHappensNext({ how, photoTips, designTotal, direct }: { how: How; photoTips: string[]; designTotal: number; direct?: Direct | null }) {
  const d = how === 'direct' ? direct : null;
  const missing = d ? d.photosTotal - d.photosSent : 0;
  const lead = d
    ? `Your brief is with me${d.photosSent ? `, with ${plural(d.photosSent, 'photo')}` : ''}. Then:`
    : LEAD[how as Exclude<How, 'direct'>];
  const reply = d ? (d.mobile ? `By phone or WhatsApp on ${d.mobile}.` : `By email to ${d.email}.`) : REPLY[how as Exclude<How, 'direct'>];
  const steps = [
    { title: 'I reply within 24 hours', text: reply },
    { title: 'A free visit to measure up', text: 'Then your quote, free as well.' },
    { title: 'Your 3D drawing to approve', text: 'We change it until it is right, and nothing is cut until you sign it off.' },
  ];
  const waPhotos = d ? whatsappUrl(`Hi Raf, this is ${d.name}. Here are photos for the brief I sent from your website.`) : '';
  return (
    <section aria-label="What happens next" className="rounded-sm border border-line-strong bg-mount p-4 shadow-[0_10px_28px_rgb(22_25_28/0.08)] sm:p-5" role="status">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-on-accent">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" />
          </svg>
        </span>
        <p className="font-display text-[24px] font-[680] leading-tight tracking-[-0.02em] text-ink">{d ? 'Brief sent' : 'What happens next'}</p>
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{lead}</p>
      <ol className="mt-3">
        {steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2.5 border-t border-line py-3">
            <span className="pt-0.5 font-mono text-[13px] text-accent">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="block text-[16px] font-[620] text-ink">{s.title}</span>
              <span className="mt-0.5 block break-words text-[14.5px] leading-snug text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {d ? (
        <div className="mt-1.5 rounded-sm bg-accent-soft p-3">
          <p className="text-[15px] font-[620] text-ink">{missing > 0 ? `${plural(missing, 'photo')} didn’t go through` : d.photosSent ? 'More photos help' : 'While you wait'}</p>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">
            {missing > 0
              ? `Send ${missing === 1 ? 'it' : 'them'} on WhatsApp and I’ll put ${missing === 1 ? 'it' : 'them'} with your brief.`
              : d.photosSent
                ? 'If you have more of the space, send them on WhatsApp any time.'
                : 'Send photos of the space on WhatsApp:'}
          </p>
          {!d.photosSent && !missing && photoTips.length ? (
            <ul className="mt-1.5 grid gap-1 text-[14px] leading-snug text-muted">
              {photoTips.slice(0, 2).map((t) => (
                <li key={t} className="flex gap-2">
                  <span aria-hidden="true" className="text-accent">·</span>
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
          <a href={waPhotos} target="_blank" rel="noopener" className="mt-2.5 inline-flex h-10 items-center gap-2 text-[15px] font-semibold text-ink hover:text-accent">
            <span className="text-whatsapp"><SocialIcon network="whatsapp" size={18} /></span>
            Send photos on WhatsApp
          </a>
        </div>
      ) : photoTips.length ? (
        <div className="mt-1.5 rounded-sm bg-accent-soft p-3">
          <p className="text-[15px] font-[620] text-ink">While you wait</p>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">{PHOTOS[how as Exclude<How, 'direct'>]}</p>
          <ul className="mt-1.5 grid gap-1 text-[14px] leading-snug text-muted">
            {photoTips.slice(0, 2).map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true" className="text-accent">·</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {designTotal ? (
        <p className="mt-4">
          <Link href="/designs" className="link-more text-[15px]">
            Look at {designTotal} designs in 3D meanwhile <span aria-hidden="true">→</span>
          </Link>
        </p>
      ) : null}
    </section>
  );
}

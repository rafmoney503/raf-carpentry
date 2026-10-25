import type { Picks } from './design-match';
import { PHONE_DISPLAY, WHATSAPP_NUMBER } from './site';

/* The thank-you email a customer gets straight after Send to Raf (when they gave an email address): it's arrived,
   the reply comes within 24 hours, the designs closest to their brief with links that open each one in 3D, the next
   steps in the site's own promises, where to send more photos, and a P.S. for the free Workshop Tools app. Plain text,
   as from Raf. No prices, sizes, timescales or guarantees. */

const SITE = 'https://www.rafcarpentry.com';

export function customerEmail(c: { name: string; mobile: string; picks: Picks }) {
  const first = c.name.split(/\s+/)[0] || 'there';
  const lines = [
    `Hi ${first},`,
    '',
    `Thanks for your brief. It's with me now and I'll reply within 24 hours${c.mobile ? `, by phone or WhatsApp on ${c.mobile}` : ', by email'}.`,
  ];
  if (c.picks.picks.length) {
    lines.push(
      '',
      c.picks.recent
        ? 'While you wait, here are some of my recent jobs, each drawn in 3D so you can turn it round on your phone:'
        : `While you wait, here ${c.picks.picks.length === 1 ? 'is the job' : 'are the jobs'} I've built that ${c.picks.picks.length === 1 ? 'is' : 'are'} closest to what you described, each drawn in 3D so you can turn it round on your phone:`,
    );
    for (const p of c.picks.picks) lines.push('', `${p.title}, ${p.area}`, `${SITE}${p.href}`);
    if (c.picks.more) lines.push('', `${c.picks.more.label}: ${SITE}${c.picks.more.href}`);
  }
  lines.push(
    '',
    'What happens next:',
    '1. I reply within 24 hours.',
    '2. I come round to measure up, free, then send your quote, free as well.',
    '3. You get a 3D drawing to approve. We change it until it is right, and nothing is cut until you sign it off.',
    '',
    `If you have more photos of the space, reply to this email with them or send them on WhatsApp: https://wa.me/${WHATSAPP_NUMBER}`,
    '',
    'Raf',
    'Raf Carpentry',
    PHONE_DISPLAY,
    'www.rafcarpentry.com',
    '',
    // the free app (25 Oct 2026); utm_source shows these visits in the Job Kit's Website stats
    'P.S. Measuring up yourself? My free Workshop Tools app works out flooring packs, wall panelling and unit sizes in mm, on any iPhone or Android phone: https://www.rafcarpentry.com/app?utm_source=email-brief',
  );
  return { subject: `Thanks for your brief, ${first}`, text: lines.join('\n') };
}

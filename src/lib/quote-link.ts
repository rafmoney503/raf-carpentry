/* rafcarpentry.com/quote (26 Nov 2026, Raf: "make a shortcut or link for quote so I can send it to new customers so
   they know what to do ... so I don't have to search for it and also send easily"): the short address for Plan your
   project's brief. next.config.ts sends it to /how-it-works?utm_source=quote-link#brief, so the Job Kit's Website
   stats show the visits it brings ("Your quote link"). The Job Kit sends it from Today, a job and a WhatsApp chat.
   No imports: the Job Kit and the site both use it. */

export const QUOTE_LINK = 'https://www.rafcarpentry.com/quote';
export const QUOTE_LINK_SHORT = 'rafcarpentry.com/quote';

/* The message that goes with it: only what the site already promises (a free quote, a reply within 24 hours) and
   what the brief asks for (a photo and a rough size). */
export function quoteLinkMessage(first?: string) {
  const name = (first ?? '').trim().split(/\s+/)[0] ?? '';
  return [
    name ? `Hi ${name}, thanks for getting in touch.` : 'Hi, thanks for getting in touch.',
    'For your free quote, tell me about the job here. It takes about 2 minutes:',
    QUOTE_LINK,
    '',
    'Add a photo or two of the space and a rough size, and I’ll reply within 24 hours.',
    'Raf',
  ].join('\n');
}

'use client';

/* Sends an enquiry from the browser to /api/enquiry. Every failure comes back as a plain reason the form can show,
   and the form always offers WhatsApp with the same words typed in. */

export type EnquiryPayload = {
  name: string;
  email: string;
  mobile: string;
  company?: string;
  trade: string;
  message: string;
  sketch?: { trade: string; pains: string[]; hours: number; modules: string[] };
  source: 'contact' | 'sketch';
  website?: string;
  ms: number;
};

export type EnquiryResult = { ok: true; job: string; emailed: boolean } | { ok: false; reason: string };

export async function sendEnquiry(p: EnquiryPayload): Promise<EnquiryResult> {
  try {
    const res = await fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    const data = (await res.json().catch(() => null)) as EnquiryResult | null;
    if (data && 'ok' in data) return data;
    return { ok: false, reason: res.status === 429 ? 'busy' : 'error' };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}

export function reasonText(reason: string) {
  switch (reason) {
    case 'name':
      return 'Add your name so I know who to reply to.';
    case 'contact':
      return 'Add an email or a mobile number so I can reply.';
    case 'email':
      return 'That email address looks incomplete. Check it, or use your mobile instead.';
    case 'message':
      return 'Write one line about what slows you down.';
    case 'busy':
      return 'A lot of messages from your connection just now. Wait a few minutes, or send it on WhatsApp.';
    case 'offline':
      return "It didn't go: your phone looks offline. Try again, or send it on WhatsApp.";
    case 'not-set-up':
      return "The form isn't connected yet. Send it on WhatsApp instead: it's typed in for you.";
    default:
      return "It didn't go through this time. Send it on WhatsApp instead: it's typed in for you.";
  }
}

/* The same enquiry as a WhatsApp message. */
export function whatsappText(p: Omit<EnquiryPayload, 'ms' | 'source'>) {
  return [
    `Hi Rafal, this is ${p.name || '[your name]'}${p.trade && p.trade !== 'Not said' ? `, ${p.trade.toLowerCase()}` : ''}.`,
    p.sketch?.pains.length ? `What eats my time: ${p.sketch.pains.join(', ')}.` : '',
    p.sketch?.hours ? `About ${p.sketch.hours} hours a week.` : '',
    p.message ? p.message : '',
    'From rafalsolutions.co.uk',
  ]
    .filter(Boolean)
    .join('\n');
}

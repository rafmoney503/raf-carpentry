// One place for the business details used across the site.
// Every "Get a quote" button opens the top of the "Plan your project" page (/how-it-works, QUOTE_HREF):
// what I need, what you get, materials, then a brief that becomes a ready-written WhatsApp message or
// email. BOOKING_URL is the ServiceM8 online booking page, still linked as "Book a visit online" for
// people who would rather pick a date.
export const QUOTE_HREF = '/how-it-works';
export const BOOKING_URL =
  'https://book.servicem8.com/request_service_booking?strVendorUUID=0ddb658e-f9b6-46a4-bf41-1bb0e304e6db';

export const PHONE_DISPLAY = '07792 860221';
export const PHONE_HREF = 'tel:07792860221';
export const EMAIL = 'info@rafcarpentry.com';

// WhatsApp: the same mobile number in international format (44, no leading 0, no spaces).
// Every WhatsApp button opens a chat with Raf with the first message already typed in,
// so the customer only has to press send.
export const WHATSAPP_NUMBER = '447792860221';

export function whatsappUrl(text?: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/* The ready-typed first message, worded for the page the visitor is on. `title` is the job or post title. */
export function whatsappText(path = '/', title = '') {
  const ask = '\n\nArea or postcode: \nWhat I need: ';
  if (path.startsWith('/portfolio/') && title) return `Hi Raf, I've just seen the "${title}" job on your website and I'd like something similar.${ask}`;
  if (path.startsWith('/blog/') && title) return `Hi Raf, I've just read "${title}" on your website and I've got a question.`;
  if (path.startsWith('/tools')) return "Hi Raf, I've got a question about the tools on your website.";
  if (path.startsWith('/sketchup')) return "Hi Raf, I've got a question about your SketchUp drawings and plans.";
  if (path.startsWith('/cabinetos')) return "Hi Raf, I've got a question about CabinetOS.";
  return `Hi Raf, I found you on rafcarpentry.com and I'd like to ask about a job.${ask}`;
}

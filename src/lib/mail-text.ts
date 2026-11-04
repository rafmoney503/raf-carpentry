/* Emails as the Job Kit shows them in a job's conversation: plain text, without the earlier messages a reply
   quotes underneath ("On Tue, 13 Oct 2026, Raf wrote: ..."), the phone's "Sent from my iPhone", or Raf's own
   sign-off on his emails (the Job Kit adds it when sending). The whole email stays one tap away.
   No imports: used on the server (src/lib/servicem8-mail.ts) and tested on its own with node. */

export const SIGN_OFF = ['Raf', 'Raf Carpentry', '07792 860221', 'www.rafcarpentry.com']; // the phone as PHONE_DISPLAY in site.ts
export const signOff = () => SIGN_OFF.join('\n');

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", pound: '£', hellip: '...', ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };

export function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<blockquote\b/i, '\n[[quote]]\n$&') // replies quote the earlier email in a blockquote: mark where
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    // a photo in the email itself (src="cid:..."): kept as a mark, so photoMarks can show it (logos on the web aren't)
    .replace(/<img\b[^>]*>/gi, (tag) => {
      if (!/\bsrc=["']?cid:/i.test(tag)) return '';
      const name = /\balt=["']([^"'<>]{1,120})["']/i.exec(tag)?.[1]?.trim() || /\bsrc=["']?cid:([^"'@\s>]{1,120})/i.exec(tag)?.[1];
      return name ? `[image: ${name}]` : '';
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m),
    );
}

export const looksHtml = (s: string) => /<\/?(p|div|br|html|body|table|span|blockquote)\b[^>]*>/i.test(s);

const tidyLines = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/* Where a reply's quoted history starts, in the ways common mail apps write it (English and Polish). */
const QUOTE_STARTS = [
  /\n[ \t>]*On [^\n]{0,240}(?:\n[^\n]{0,240})?\bwrote:[ \t]*\n/i, // Gmail, Apple Mail (sometimes wrapped over two lines)
  /\n[ \t]*-{2,}[ \t]*(?:Original Message|Forwarded message)[ \t]*-{2,}/i,
  /\n[ \t]*_{5,}[ \t]*\n[ \t]*From:/i, // Outlook
  /\n[ \t]*From:[^\n]+\n[ \t]*(?:Sent|Date):[^\n]+\n/i, // Outlook without the line
  /\n[ \t]*W dniu [^\n]{0,240}(?:\n[^\n]{0,240})?napisa(?:ł|l)(?:\(a\))?:[ \t]*\n/i,
  /\n[ \t]*Dnia [^\n]{0,240}(?:\n[^\n]{0,240})?napisa(?:ł|l)(?:\(a\))?:[ \t]*\n/i,
  /\n\[\[quote\]\]\n/,
];

/* The new part of an email: `text` is what to show, `cut` says whether anything was left out (the quoted
   earlier emails, a block of > lines at the end), `all` is the whole email. */
export function freshPart(raw: string): { text: string; cut: boolean; all: string } {
  const all = tidyLines(raw.replace(/\n?\[\[quote\]\]\n?/g, '\n'));
  let s = `\n${tidyLines(raw)}\n`;
  let cut = false;
  for (const re of QUOTE_STARTS) {
    const m = re.exec(s);
    if (m && m.index > 0) {
      s = s.slice(0, m.index) + '\n';
      cut = true;
    }
  }
  // a block of quoted lines at the end
  const lines = s.split('\n');
  while (lines.length && (/^\s*>/.test(lines[lines.length - 1]) || !lines[lines.length - 1].trim())) {
    if (/^\s*>/.test(lines[lines.length - 1])) cut = true;
    lines.pop();
  }
  s = lines.join('\n');
  s = s.replace(/\n[ \t]*Sent from my (?:iPhone|iPad|Android|Samsung|Galaxy|mobile)[^\n]*\s*$/i, '').replace(/\n[ \t]*Get Outlook for (?:iOS|Android)[^\n]*\s*$/i, '');
  const text = tidyLines(s);
  if (!text) return { text: all, cut: false, all }; // all of it was "quoted": show it as it is
  return { text, cut: cut && text !== all, all };
}

/* Raf's sign-off taken off the end of his own emails (it is on every one; the conversation doesn't need it). */
export function withoutSignOff(text: string) {
  const t = tidyLines(text);
  const sig = signOff();
  return t.endsWith(sig) ? tidyLines(t.slice(0, -sig.length)) : t;
}

/* ---------- texts (SMS) ---------- */

/* Texts are signed off short: every 153 characters is another ServiceM8 text credit. */
export const SMS_SIGN_OFF = 'Raf, Raf Carpentry';

/* A text as the conversation shows it: without Raf's sign-off, or the "Reply here" link ServiceM8's two-way texts
   end with. */
export function textOnly(text: string) {
  let t = tidyLines(text)
    .replace(/\n?[ \t]*(?:Reply (?:here|to this message)|Tap to reply)\b[^\n]*$/i, '')
    .replace(/\n?[ \t]*https?:\/\/\S*servicem8\S*\s*$/i, '');
  t = tidyLines(t);
  return t.endsWith(SMS_SIGN_OFF) ? tidyLines(t.slice(0, -SMS_SIGN_OFF.length)) : t;
}

/* How many ServiceM8 text credits a text uses: one per 153 characters (ServiceM8's rule), sign-off included. */
export const textCredits = (message: string) => Math.max(1, Math.ceil(`${message.trim()}\n${SMS_SIGN_OFF}`.length / 153));

/* A UK mobile as ServiceM8 wants it for texts (E.164: +447700900123), or '' if it isn't one. */
export function e164(raw: string) {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `44${d.slice(1)}`;
  else if (/^7\d{9}$/.test(d)) d = `44${d}`;
  d = d.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : '';
}

/* Photos in an email's words: Gmail's "[image: IMG_4821.jpeg]", Outlook's "[cid:image001.jpg@01DB...]", Apple
   Mail's "<IMG_4821.jpeg>" and an HTML email's own photos (htmlToText). Each becomes "[photo: IMG_4821.jpeg]", and
   the names come back so the Job Kit's diary can show the photos themselves (an emailed photo is an attachment
   in ServiceM8, on the job or on the email: src/lib/servicem8-diary.ts messageFiles). Raf, 3 Nov 2026: customers'
   photos showed as "just img something". */
export function photoMarks(text: string): { text: string; photos: string[] } {
  const photos: string[] = [];
  const mark = (name: string) => {
    const n = name.trim().replace(/@.*$/, '');
    if (!n) return '';
    if (!photos.includes(n)) photos.push(n);
    return `[photo: ${n}]`;
  };
  const out = text
    .replace(/\[image:\s*([^\]\n]{1,160})\]/gi, (_, n: string) => mark(n))
    .replace(/\[cid:([^\]\s]{1,200})\]/gi, (_, n: string) => mark(n))
    .replace(/<([^<>\n]{1,120}\.(?:jpe?g|png|heic|heif|gif|webp|tiff?))>/gi, (_, n: string) => mark(n));
  return { text: out, photos };
}

/* The same photo by name, whatever its ending: an iPhone sends IMG_4821.HEIC as IMG_4821.jpeg. */
export const photoKey = (name: string) => name.trim().toLowerCase().replace(/\.[a-z0-9]{2,5}$/, '');

/* A brief from the website (Plan your project, src/app/how-it-works/brief-builder.tsx), pasted into a new
   enquiry in the Job Kit: the WhatsApp message or email the customer sent, turned back into the enquiry's
   name, mobile, email, address and description for ServiceM8. Any other message pasted (a plain WhatsApp text)
   becomes the description, with whatever name, number or email can be picked out of it. Nothing here is stored;
   it only fills the form on the phone. */

export type PastedBrief = {
  name: string;
  mobile: string;
  email: string;
  address: string;
  description: string;
  fromBrief: boolean; // it was the website's brief, not just any message
  found: string[]; // what was filled in, for the line under the box
};

/* The brief's labels, in the order the website writes them. */
const LABELS = ['Something like your job', 'What', 'Rooms', 'Room', 'For', 'Material', 'Finish', 'Rough size', 'When', 'Budget', 'Mobile', 'Email', 'Address', 'Parking', 'Parking and access'];
const SKIP = /^(i will send photos of the space next\.?|photos of the space attached\.?)$/i;
const URL_LINE = /^https?:\/\/\S+$/i;

/* Several WhatsApp messages copied together start each with "[12/10/2026, 21:20] Name: "; the name is the
   customer's number when they aren't saved in the phone. */
const WA_PREFIX = /^\[\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]\s+([^:]+):\s?/;
const PHONE = /(?:\+44\s?7|\b07)\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/;

/* Invisible marks that come along when copying from WhatsApp (the direction marks round a copied phone number,
   zero-width joiners): ServiceM8 turns text with them down ("Character Set Not Supported"), and they split a
   number so it isn't found. The server tidies everything again before ServiceM8 (src/lib/servicem8.ts tidy). */
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
export const stripInvisible = (s: string) => s.replace(INVISIBLE, '');

export function parseBrief(raw: string): PastedBrief {
  let sender = '';
  const text = raw
    .replace(/\r/g, '')
    .replace(INVISIBLE, '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .split('\n')
    .map((l) => {
      const m = l.match(WA_PREFIX);
      if (m) sender = sender || m[1].trim();
      return m ? l.slice(m[0].length) : l;
    })
    .join('\n')
    .trim();
  const lines = text.split('\n').map((l) => l.trim());
  const fields: Record<string, string> = {};
  const notes: string[] = [];
  let name = '';
  // "Things I liked:" (saved with the hearts on the website) is followed by a title line and a link for each,
  // up to the next empty line: the titles become one "Liked:" line.
  let liked: string[] | null = null;
  for (const line of lines) {
    if (!line) {
      if (liked) {
        if (liked.length) fields.Liked = liked.join(' + ');
        liked = null;
      }
      if (notes.length && notes[notes.length - 1] !== '') notes.push('');
      continue;
    }
    if (/^things i liked:?$/i.test(line)) {
      liked = [];
      continue;
    }
    if (liked) {
      if (!URL_LINE.test(line)) liked.push(line);
      continue;
    }
    const hello = line.match(/^hi raf[,.!]?\s*(?:this is\s+(.+?)\s*[.!]\s*)?here is my brief from your website\.?$/i);
    if (hello) {
      name = (hello[1] ?? '').trim();
      continue;
    }
    if (SKIP.test(line) || URL_LINE.test(line)) continue;
    const m = line.match(/^([A-Za-z][A-Za-z ]{1,30}):\s*(.+)$/);
    const label = m ? LABELS.find((l) => l.toLowerCase() === m[1].trim().toLowerCase()) : undefined;
    if (m && label) {
      fields[label === 'Room' ? 'Rooms' : label] = m[2].trim();
      continue;
    }
    notes.push(line);
  }
  if (liked?.length) fields.Liked = liked.join(' + ');
  while (notes.length && notes[notes.length - 1] === '') notes.pop();
  while (notes.length && notes[0] === '') notes.shift();
  const fromBrief = Boolean(name || fields.What || fields.Address || Object.keys(fields).length >= 2);

  // A plain message: "this is Sam", "I'm Sam", "my name is Sam" at the start.
  if (!name) name = text.match(/\b(?:[Tt]his is|[Mm]y name is|I am|I'm)\s+([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?)/)?.[1] ?? '';
  const senderPhone = sender.match(PHONE)?.[0] ?? '';
  if (!name && sender && !senderPhone) name = sender;
  const email = fields.Email || (text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? '');
  const mobile = fields.Mobile || senderPhone || (text.match(PHONE)?.[0] ?? '');
  const address = fields.Address ?? '';

  let description: string;
  if (fromBrief) {
    const first = fields.What || 'Enquiry';
    const rest = ['Rooms', 'For', 'Material', 'Finish', 'Rough size', 'When', 'Budget', 'Parking', 'Parking and access', 'Something like your job', 'Liked']
      .filter((k) => fields[k])
      .map((k) => `${k === 'Rooms' && !fields.Rooms.includes('+') ? 'Room' : k}: ${fields[k]}`);
    description = [first, ...rest, ...(notes.length ? ['', ...notes] : []), '', 'From the website brief.'].join('\n');
  } else {
    description = text;
  }

  const found = [name && 'name', mobile && 'mobile', email && 'email', address && 'address', description && 'what they want'].filter(Boolean) as string[];
  return { name, mobile, email, address, description, fromBrief, found };
}

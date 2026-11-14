/* Live WhatsApp (13 Nov 2026, Raf: 'how much would it cost to have the WhatsApp automatically checked in Jobkit and
   processed as job ... also WhatsApp would be best way to send new designs, finished products and newsletter', then
   'Go'). Raf's number stays on the WhatsApp Business app and is also on Meta's Cloud API through 360dialog
   ("coexistence"), so every chat on it reaches /api/whatsapp/webhook: messages from customers ('messages'), what Raf
   types in the app ('smb_message_echoes'), up to 6 months of past chats once ('history') and the names saved in his
   phone ('smb_app_state_sync'). This file reads those webhooks into plain rows. No imports, so the server, the Job Kit
   and the tests can all use it.

   Payload shapes: Meta's own ({object, entry: [{changes: [{field, value}]}]}), 360dialog's event form
   ({event, data}) and the flat one ({messages, contacts, statuses}); all are read the same way. Field names follow
   Meta's Cloud API webhook reference and its 'Onboard WhatsApp Business app users' page (checked 13 Nov 2026). */

export type LiveSrc = 'live' | 'echo' | 'history' | 'api';
export type LiveMedia = { id?: string; url?: string; mime?: string; name?: string; caption?: string };
export type LiveMsg = { id: string; wa: string; dir: 'in' | 'out'; src: LiveSrc; at: number; type: string; body?: string; media?: LiveMedia };
export type LiveContact = { wa: string; name?: string; profile?: string };
export type LiveStatus = { id: string; status: string; error?: string };
export type Parsed = {
  msgs: LiveMsg[];
  contacts: LiveContact[];
  statuses: LiveStatus[];
  fields: string[];
  business?: string; // Raf's number, digits
  historyOff?: boolean; // he chose not to share past chats
  history?: { phase?: number; chunk?: number; progress?: number }; // how far the one-off history sync is
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
export const digits = (v: unknown) => str(v).replace(/\D/g, '');

/* WhatsApp's own message types, as the Job Kit shows them */
const MEDIA = ['image', 'video', 'audio', 'document', 'sticker'] as const;

function bodyOf(m: Obj): { type: string; body?: string; media?: LiveMedia } {
  const type = str(m.type) || 'text';
  if (type === 'text') return { type, body: str(obj(m.text).body) };
  if ((MEDIA as readonly string[]).includes(type)) {
    const x = obj(m[type]);
    const media: LiveMedia = { id: str(x.id) || undefined, url: str(x.url) || undefined, mime: str(x.mime_type) || undefined, name: str(x.filename) || undefined, caption: str(x.caption) || undefined };
    return { type, body: media.caption, media };
  }
  if (type === 'location') {
    const l = obj(m.location);
    const where = [str(l.name), str(l.address)].filter(Boolean).join(', ');
    return { type, body: `Location: ${where ? `${where} ` : ''}(${str(l.latitude)}, ${str(l.longitude)})` };
  }
  if (type === 'contacts') {
    const c = obj(arr(m.contacts)[0]);
    const phone = str(obj(arr(c.phones)[0]).phone);
    return { type, body: `Contact: ${str(obj(c.name).formatted_name)}${phone ? ` ${phone}` : ''}`.trim() };
  }
  if (type === 'interactive') {
    const i = obj(m.interactive);
    return { type, body: str(obj(i.button_reply).title) || str(obj(i.list_reply).title) || str(obj(i.nfm_reply).body) || undefined };
  }
  if (type === 'button') return { type, body: str(obj(m.button).text) || undefined };
  if (type === 'reaction') return { type, body: str(obj(m.reaction).emoji) };
  if (type === 'media_placeholder') return { type: 'placeholder' };
  // anything else (orders, polls, unsupported, edits): its words where it has some
  const t = str(obj(m.text).body);
  return t ? { type: 'text', body: t } : { type: 'unsupported' };
}

function msgOf(m: Obj, wa: string, dir: 'in' | 'out', src: LiveSrc): LiveMsg | null {
  const id = str(m.id);
  const sec = Number(str(m.timestamp));
  if (!id || !/^\d{6,16}$/.test(wa) || !Number.isFinite(sec) || sec <= 0) return null;
  return { id, wa, dir, src, at: Math.round(sec * 1000), ...bodyOf(m) };
}

/* The changes in a webhook, whichever shape it came in. */
function changesOf(body: unknown): { field: string; value: Obj }[] {
  const b = obj(body);
  if (Array.isArray(b.entry)) return arr(b.entry).flatMap((e) => arr(obj(e).changes).map((c) => ({ field: str(obj(c).field), value: obj(obj(c).value) })));
  if (b.event && b.data) return [{ field: str(b.event), value: obj(b.data) }];
  if (b.field && b.value) return [{ field: str(b.field), value: obj(b.value) }];
  if (b.messages || b.statuses || b.contacts) return [{ field: 'messages', value: b }];
  return [];
}

export function parseWebhook(body: unknown): Parsed {
  const out: Parsed = { msgs: [], contacts: [], statuses: [], fields: [] };
  for (const { field, value } of changesOf(body)) {
    if (field && !out.fields.includes(field)) out.fields.push(field);
    const biz = digits(obj(value.metadata).display_phone_number);
    if (biz) out.business = biz;
    for (const c of arr(value.contacts)) {
      const wa = digits(obj(c).wa_id);
      if (wa) out.contacts.push({ wa, profile: str(obj(obj(c).profile).name) || undefined });
    }
    for (const s of arr(value.statuses)) {
      const x = obj(s);
      if (str(x.id) && str(x.status)) out.statuses.push({ id: str(x.id), status: str(x.status), error: str(obj(arr(x.errors)[0]).title) || undefined });
    }
    if (field === 'history') {
      for (const h of arr(value.history)) {
        const hx = obj(h);
        const err = arr(hx.errors).map(obj).find((e) => Number(e.code) === 2593109 || /history.*(off|sharing)/i.test(str(e.title) + str(e.message)));
        if (err) out.historyOff = true;
        const meta = obj(hx.metadata);
        if (Object.keys(meta).length) out.history = { phase: Number(meta.phase) || 0, chunk: Number(meta.chunk_order) || 0, progress: Number(meta.progress) || 0 };
        for (const t of arr(hx.threads)) {
          const wa = digits(obj(t).id);
          for (const m0 of arr(obj(t).messages)) {
            const m = obj(m0);
            const fromMe = obj(m.history_context).from_me === true || (Boolean(out.business) && digits(m.from) === out.business) || (digits(m.from) !== '' && digits(m.from) !== wa);
            const x = msgOf(m, wa, fromMe ? 'out' : 'in', 'history');
            if (x) out.msgs.push(x);
          }
        }
      }
      // the photos and files of past chats come afterwards as messages on the same field
      for (const m0 of arr(value.messages)) {
        const m = obj(m0);
        const from = digits(m.from);
        const mine = obj(m.history_context).from_me === true || (Boolean(out.business) && from === out.business);
        const wa = mine ? digits(m.to) : from;
        const x = msgOf(m, wa, mine ? 'out' : 'in', 'history');
        if (x) out.msgs.push(x);
      }
      continue;
    }
    if (field === 'smb_message_echoes') {
      for (const m0 of arr(value.message_echoes)) {
        const m = obj(m0);
        const x = msgOf(m, digits(m.to), 'out', 'echo');
        if (x) out.msgs.push(x);
      }
      continue;
    }
    if (field === 'smb_app_state_sync') {
      for (const s0 of arr(value.state_sync)) {
        const s = obj(s0);
        const c = obj(s.contact);
        const wa = digits(c.phone_number);
        if (!wa || (str(s.type) && str(s.type) !== 'contact')) continue;
        out.contacts.push({ wa, name: str(s.action) === 'remove' ? '' : str(c.full_name) || str(c.first_name) || undefined });
      }
      continue;
    }
    for (const m0 of arr(value.messages)) {
      const m = obj(m0);
      const x = msgOf(m, digits(m.from), 'in', 'live');
      if (x) out.msgs.push(x);
    }
  }
  return out;
}

/* What of a message is kept as a file: photos (and photos sent as documents) and PDFs. Videos, voice notes and
   stickers stay in WhatsApp. */
export function storable(m: { type: string; media?: LiveMedia }): 'photo' | 'pdf' | null {
  if (!m.media) return null;
  const mime = (m.media.mime ?? '').toLowerCase();
  if (m.type === 'image') return 'photo';
  if (m.type === 'document') {
    if (mime === 'application/pdf' || /\.pdf$/i.test(m.media.name ?? '')) return 'pdf';
    if (/^image\/(jpe?g|png|heic|heif|webp)$/.test(mime) || /\.(jpe?g|png|heic|heif)$/i.test(m.media.name ?? '')) return 'photo';
  }
  return null;
}

/* A time as the phone in London shows it: "2026-11-13T09:41". */
export function londonAt(ms: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/* "447700900123" -> "+44 7700 900123" */
export function showNumber(wa: string) {
  const d = digits(wa);
  if (/^44\d{10}$/.test(d)) return `+44 ${d.slice(2, 6)} ${d.slice(6)}`;
  return d ? `+${d}` : '';
}

/* A phone number as ServiceM8 or a brief has it ("07700 900123", "+44 7700 900123", "0044...") -> WhatsApp's
   "447700900123"; '' when it isn't one. */
export function waOf(raw: unknown) {
  let d = str(raw).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `44${d.slice(1)}`;
  else if (/^7\d{9}$/.test(d)) d = `44${d}`;
  d = d.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(d) ? d : '';
}

/* WhatsApp lets a business write freely only for 24 hours after the customer's last message (one that came after
   the link: past chats from the history don't count). After that only an approved template can start it again. */
export const WINDOW_MS = 24 * 3600 * 1000;
export const windowLeft = (liveInAt: number | null | undefined, now = Date.now()) => (liveInAt ? Math.max(0, liveInAt + WINDOW_MS - now) : 0);

/* The message templates the Job Kit makes in Raf's WhatsApp account (Settings, 'Make the message templates'), for
   writing to someone after the 24 hours. Meta checks each one (minutes to a day) and decides its category, which
   sets the price: utility £0.0159, marketing £0.0458 a message in the UK (Meta's GBP rate card, Nov 2026). */
export type Template = { name: string; category: 'UTILITY' | 'MARKETING'; label: string; body: string; example: [string, string]; second: string };
export const TEMPLATES: Template[] = [
  {
    name: 'raf_follow_up',
    category: 'UTILITY',
    label: 'Follow up their enquiry',
    body: 'Hi {{1}}, it’s Raf from Raf Carpentry, following up on your enquiry about {{2}}. Reply here when you have a moment and I’ll get back to you.',
    example: ['Sarah', 'the fitted wardrobe'],
    second: 'What it was about',
  },
  {
    name: 'raf_design_ready',
    category: 'UTILITY',
    label: 'Their design is ready',
    body: 'Hi {{1}}, your design is ready to look at: {{2}}\n\nHave a look and reply here with any changes.\n\nRaf, Raf Carpentry',
    example: ['Sarah', 'https://www.rafcarpentry.com/ideas/k7m2q9xd3a'],
    second: 'The link',
  },
  {
    name: 'raf_job_ideas',
    category: 'MARKETING',
    label: 'Jobs like theirs (ideas)',
    body: 'Hi {{1}}, here are some jobs I’ve built that might give you ideas: {{2}}\n\nRaf, Raf Carpentry',
    example: ['Sarah', 'https://www.rafcarpentry.com/designs/wardrobes'],
    second: 'The link',
  },
];
export const fillTemplate = (t: Template, a: string, b: string) => t.body.replace('{{1}}', a).replace('{{2}}', b);

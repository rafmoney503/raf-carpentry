/* The info@rafcarpentry.com mailbox (Microsoft 365, bought through GoDaddy) for the Job Kit's Inbox: the newest
   emails, one email with its conversation and attachments, marking read or unread, and a reply from info@ that
   Raf has read and approved (or left as a draft in Outlook). Nothing here deletes or moves an email, and nothing
   is sent unless Raf presses Send in the Job Kit.

   Microsoft Graph, app-only: the app 'Raf Job Kit' registered in Entra (15 Oct 2026) with the application
   permissions Mail.ReadWrite and Mail.Send and admin consent. Vercel settings: MS_TENANT_ID, MS_CLIENT_ID,
   MS_CLIENT_SECRET (sensitive; made under Certificates & secrets, lasts 24 months at most), optional MS_MAILBOX
   (default info@rafcarpentry.com). MS_LOGIN_API and MS_GRAPH_API override the addresses for local tests. */

import { freshPart } from './mail-text';

const MAILBOX = () => (process.env.MS_MAILBOX || 'info@rafcarpentry.com').trim().toLowerCase();
const LOGIN = () => (process.env.MS_LOGIN_API || 'https://login.microsoftonline.com').replace(/\/+$/, '');
const GRAPH = () => (process.env.MS_GRAPH_API || 'https://graph.microsoft.com/v1.0').replace(/\/+$/, '');
const SETTINGS = ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'] as const;
export const outlookMissing = () => SETTINGS.filter((k) => !process.env[k]?.trim());
export const outlookSetUp = () => outlookMissing().length === 0;
export const mailboxAddress = MAILBOX;

export type OutlookCode = 'outlook-not-set-up' | 'outlook-secret' | 'outlook-app' | 'outlook-consent' | 'outlook-mailbox' | 'outlook-gone' | 'outlook-busy' | 'outlook-too-big' | 'outlook-error';
export class OutlookError extends Error {
  constructor(
    public code: OutlookCode,
    public status: number,
    public detail = '',
  ) {
    super(code);
  }
}

export type Who = { name: string; email: string };
/* One email in the Inbox list. */
export type InboxMail = {
  id: string;
  from: Who;
  replyTo: Who | null; // when replies go somewhere else (ServiceM8's 'New brief' emails reply to the customer)
  subject: string;
  preview: string;
  at: string; // ISO time it arrived
  read: boolean;
  attachments: boolean;
  other: boolean; // Outlook's Focused Inbox put it under Other
  flagged: boolean;
};
export type Attachment = { id: string; name: string; type: string; size: number; inline: boolean };
/* One message of a conversation, as the email screen shows it. */
export type ThreadMail = { id: string; dir: 'in' | 'out'; from: Who; to: Who[]; subject: string; at: string; text: string };
export type FullMail = InboxMail & {
  to: Who[];
  cc: Who[];
  text: string; // the new part (Outlook's uniqueBody)
  full: string; // the whole email, as text
  link: string; // opens it in Outlook on the web
  files: Attachment[];
  thread: ThreadMail[]; // the rest of the conversation in this mailbox (Inbox, Sent...), oldest first
};

/* ---------- signing in (client credentials), kept for the life of the server instance ---------- */

let token: { value: string; until: number; roles: string[] } | null = null;

function rolesOf(jwt: string): string[] {
  try {
    const part = jwt.split('.')[1] ?? '';
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { roles?: string[] };
    return Array.isArray(json.roles) ? json.roles : [];
  } catch {
    return [];
  }
}

async function getToken(): Promise<{ value: string; roles: string[] }> {
  const missing = outlookMissing();
  if (missing.length) throw new OutlookError('outlook-not-set-up', 503, missing.join(', '));
  if (token && token.until > Date.now() + 60_000) return token;
  let res: Response;
  try {
    res = await fetch(`${LOGIN()}/${encodeURIComponent(process.env.MS_TENANT_ID!.trim())}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID!.trim(),
        client_secret: process.env.MS_CLIENT_SECRET!.trim(),
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new OutlookError('outlook-busy', 503, 'Microsoft sign-in didn’t answer');
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    const d = body.error_description ?? body.error ?? `${res.status}`;
    if (/AADSTS7000222/.test(d)) throw new OutlookError('outlook-secret', 502, 'expired');
    if (/AADSTS7000215|AADSTS7000216|invalid_client/.test(d)) throw new OutlookError('outlook-secret', 502, 'wrong');
    if (/AADSTS700016|AADSTS90002|AADSTS900023|AADSTS90013|AADSTS50034/.test(d)) throw new OutlookError('outlook-app', 502, d.split(/\r?\n/)[0].slice(0, 200));
    if (res.status >= 500 || res.status === 429) throw new OutlookError('outlook-busy', 503, `${res.status}`);
    throw new OutlookError('outlook-error', 502, d.split(/\r?\n/)[0].slice(0, 200));
  }
  token = { value: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000, roles: rolesOf(body.access_token) };
  return token;
}

/* The token says which permissions were granted: without admin consent it has none, and Graph would only say
   'Access is denied', so check first and say which step is missing. */
function need(roles: string[], what: 'read' | 'send') {
  if (!roles.length) return; // a token we can't read (or a test): let Graph decide
  const ok = what === 'read' ? roles.some((r) => r === 'Mail.ReadWrite' || r === 'Mail.Read') : roles.includes('Mail.Send');
  if (!ok) throw new OutlookError('outlook-consent', 403, `${what === 'read' ? 'Mail.ReadWrite' : 'Mail.Send'} isn’t granted (the app has: ${roles.join(', ') || 'nothing'})`);
}

/* ---------- Graph ---------- */

type GraphInit = { method?: string; body?: unknown; text?: boolean; html?: boolean; raw?: boolean };

async function graph<T>(path: string, init: GraphInit = {}, what: 'read' | 'send' = 'read', again = true): Promise<T> {
  const t = await getToken();
  need(t.roles, what);
  const headers: Record<string, string> = { Authorization: `Bearer ${t.value}` };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.text) headers.Prefer = 'outlook.body-content-type="text"';
  if (init.html) headers.Prefer = 'outlook.body-content-type="html"';
  let res: Response;
  try {
    res = await fetch(`${GRAPH()}/users/${encodeURIComponent(MAILBOX())}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new OutlookError('outlook-busy', 503, 'Microsoft didn’t answer');
  }
  if (res.status === 401 && again) {
    token = null; // signed in again once: the token may have just run out
    return graph<T>(path, init, what, false);
  }
  if (!res.ok) {
    const e = ((await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }).error ?? {};
    const code = e.code ?? '';
    const msg = (e.message ?? '').slice(0, 200);
    if (res.status === 404 && /ErrorItemNotFound|ErrorInvalidIdMalformed/.test(code)) throw new OutlookError('outlook-gone', 404, msg);
    if (/ErrorInvalidUser|MailboxNotEnabledForRESTAPI|ErrorNonExistentMailbox|MailboxNotFound/.test(code) || (res.status === 404 && /user|mailbox/i.test(msg)))
      throw new OutlookError('outlook-mailbox', 404, `${code}: ${msg}`);
    if (res.status === 401 || res.status === 403) throw new OutlookError('outlook-consent', 403, `${code}: ${msg}`);
    if (res.status === 429 || res.status >= 500) throw new OutlookError('outlook-busy', 503, `${res.status} ${code}`);
    throw new OutlookError('outlook-error', 502, `${res.status} ${code}: ${msg}`);
  }
  if (init.raw) return res as unknown as T;
  if (res.status === 202 || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ---------- shaping Graph's messages ---------- */

type GAddress = { emailAddress?: { name?: string; address?: string } };
type GMessage = {
  id: string;
  subject?: string | null;
  from?: GAddress | null;
  sender?: GAddress | null;
  replyTo?: GAddress[];
  toRecipients?: GAddress[];
  ccRecipients?: GAddress[];
  receivedDateTime?: string;
  sentDateTime?: string;
  isRead?: boolean;
  isDraft?: boolean;
  bodyPreview?: string;
  hasAttachments?: boolean;
  inferenceClassification?: string;
  flag?: { flagStatus?: string };
  body?: { contentType?: string; content?: string };
  uniqueBody?: { contentType?: string; content?: string };
  webLink?: string;
  conversationId?: string;
};

const who = (a?: GAddress | null): Who => ({ name: (a?.emailAddress?.name ?? '').trim(), email: (a?.emailAddress?.address ?? '').trim().toLowerCase() });
const plain = (b?: { contentType?: string; content?: string }) => {
  const c = b?.content ?? '';
  if ((b?.contentType ?? '').toLowerCase() !== 'html') return c;
  return c
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};
const tidy = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .replace(/[​-‍⁠﻿]/g, '')
    .replace(/[ \t ]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function listItem(m: GMessage): InboxMail {
  const reply = (m.replyTo ?? []).map(who).find((w) => w.email);
  const from = who(m.from ?? m.sender);
  return {
    id: m.id,
    from,
    replyTo: reply && reply.email !== from.email ? reply : null,
    subject: (m.subject ?? '').trim(),
    preview: (m.bodyPreview ?? '').replace(/\s+/g, ' ').trim().slice(0, 220),
    at: m.receivedDateTime ?? m.sentDateTime ?? '',
    read: m.isRead !== false,
    attachments: Boolean(m.hasAttachments),
    other: (m.inferenceClassification ?? '').toLowerCase() === 'other',
    flagged: m.flag?.flagStatus === 'flagged',
  };
}

const LIST_FIELDS = 'id,subject,from,sender,replyTo,receivedDateTime,isRead,bodyPreview,hasAttachments,inferenceClassification,flag';
export const PAGE = 30;

/* The newest emails in the Inbox (30 at a time), and how many are unread. */
export async function inbox(skip = 0): Promise<{ mails: InboxMail[]; more: boolean; unread: number | null; mailbox: string }> {
  const q = new URLSearchParams({ $select: LIST_FIELDS, $orderby: 'receivedDateTime desc', $top: String(PAGE) });
  if (skip > 0) q.set('$skip', String(skip));
  const [list, folder] = await Promise.all([
    graph<{ value: GMessage[]; '@odata.nextLink'?: string }>(`/mailFolders/inbox/messages?${q}`),
    skip ? Promise.resolve(null) : graph<{ unreadItemCount?: number }>(`/mailFolders/inbox?$select=unreadItemCount`).catch(() => null),
  ]);
  return { mails: (list.value ?? []).filter((m) => !m.isDraft).map(listItem), more: Boolean(list['@odata.nextLink']), unread: folder?.unreadItemCount ?? null, mailbox: MAILBOX() };
}

/* One email: the new part and the whole text, its attachments, and the rest of its conversation in this mailbox
   (what Raf sent from Outlook or the Job Kit included). Opening it marks it read, as Outlook does. */
export async function message(id: string, markRead = true): Promise<FullMail> {
  const fields = `${LIST_FIELDS},toRecipients,ccRecipients,sentDateTime,body,uniqueBody,webLink,conversationId`;
  const m = await graph<GMessage>(`/messages/${encodeURIComponent(id)}?$select=${fields}`, { text: true });
  const [files, convo] = await Promise.all([
    m.hasAttachments
      ? graph<{ value: { id: string; name?: string; contentType?: string; size?: number; isInline?: boolean; '@odata.type'?: string }[] }>(
          `/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline`,
        )
          .then((r) => r.value ?? [])
          .catch(() => [])
      : Promise.resolve([]),
    m.conversationId ? conversation(m.conversationId) : Promise.resolve([]),
  ]);
  if (markRead && m.isRead === false) await graph(`/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: { isRead: true } }).catch(() => undefined);
  const me = MAILBOX();
  const thread: ThreadMail[] = convo
    .filter((c) => c.id !== m.id && !c.isDraft)
    .map((c) => {
      const from = who(c.from ?? c.sender);
      return {
        id: c.id,
        dir: from.email === me ? ('out' as const) : ('in' as const),
        from,
        to: (c.toRecipients ?? []).map(who),
        subject: (c.subject ?? '').trim(),
        at: c.receivedDateTime ?? c.sentDateTime ?? '',
        text: (c.uniqueBody?.content ? tidy(plain(c.uniqueBody)) : freshPart(tidy(plain(c.body))).text).slice(0, 6000),
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  const full = tidy(plain(m.body));
  const fresh = tidy(plain(m.uniqueBody));
  return {
    ...listItem(m),
    read: true,
    to: (m.toRecipients ?? []).map(who),
    cc: (m.ccRecipients ?? []).map(who),
    text: (fresh || freshPart(full).text || full).slice(0, 20000),
    full: full.slice(0, 40000),
    link: m.webLink ?? '',
    files: files
      .filter((f) => !/itemAttachment|referenceAttachment/i.test(f['@odata.type'] ?? ''))
      .map((f) => ({ id: f.id, name: f.name ?? 'attachment', type: f.contentType ?? '', size: f.size ?? 0, inline: Boolean(f.isInline) })),
    thread,
  };
}

/* Every message of a conversation in this mailbox, with the new part of each (uniqueBody), or the whole body if
   Graph won't list uniqueBody; nothing (not an error) if neither works. */
async function conversation(cid: string): Promise<GMessage[]> {
  const ask = (fields: string) =>
    graph<{ value: GMessage[] }>(`/messages?${new URLSearchParams({ $filter: `conversationId eq '${cid.replace(/'/g, "''")}'`, $select: fields, $top: '25' })}`, { text: true }).then((r) => r.value ?? []);
  const base = 'id,subject,from,sender,toRecipients,receivedDateTime,sentDateTime,body,isDraft';
  return ask(`${base},uniqueBody`).catch(() => ask(base).catch(() => []));
}

export async function setRead(id: string, read: boolean) {
  await graph(`/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: { isRead: read } });
}

/* An attachment's bytes, for the phone to show. Photos over 2.5 MB are made smaller here (2000 px JPEG), since
   a Vercel answer can't be over 4.5 MB; anything else over 4 MB is opened in Outlook instead. */
export async function attachment(id: string, att: string): Promise<{ bytes: Uint8Array; type: string; name: string }> {
  const meta = await graph<{ name?: string; contentType?: string; size?: number; '@odata.type'?: string }>(
    `/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(att)}?$select=name,contentType,size`,
  );
  if (/itemAttachment|referenceAttachment/i.test(meta['@odata.type'] ?? '')) throw new OutlookError('outlook-too-big', 413, 'not a file');
  const type = (meta.contentType ?? 'application/octet-stream').toLowerCase();
  const image = /^image\/(jpeg|jpg|png|heic|heif|webp|gif)$/.test(type);
  if ((meta.size ?? 0) > 25_000_000 || (!image && (meta.size ?? 0) > 4_000_000)) throw new OutlookError('outlook-too-big', 413, `${meta.size}`);
  const res = await graph<Response>(`/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(att)}/$value`, { raw: true });
  let bytes = new Uint8Array(await res.arrayBuffer());
  let outType = type;
  if (image && (bytes.length > 2_500_000 || /heic|heif/.test(type))) {
    try {
      const sharp = (await import('sharp')).default;
      bytes = new Uint8Array(await sharp(bytes).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer());
      outType = 'image/jpeg';
    } catch {
      if (bytes.length > 4_000_000) throw new OutlookError('outlook-too-big', 413, `${bytes.length}`);
    }
  }
  return { bytes, type: outType, name: meta.name ?? 'attachment' };
}

/* ---------- replying ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function replyHtml(text: string, signOff: string) {
  const lines = `${text.trim()}\n\n${signOff}`.split('\n').map((l) => (l.trim() ? esc(l) : ''));
  return `<div style="font-family:Calibri,Arial,Helvetica,sans-serif;font-size:11pt;color:#000000">${lines.join('<br>')}</div><br>`;
}

/* Raf's reply to an email, from info@: Outlook makes the reply (to the right person, 'RE:' subject, the earlier
   email quoted underneath), Raf's words and sign-off go on top, then it is sent and lands in Sent Items.
   send: false leaves it in Drafts for Outlook. If sending fails the reply is still in Drafts. */
export async function reply(id: string, text: string, signOff: string, send: boolean): Promise<{ to: Who[]; subject: string; draft: boolean; at: string }> {
  const t = await getToken();
  need(t.roles, 'read');
  if (send) need(t.roles, 'send');
  const draft = await graph<GMessage>(`/messages/${encodeURIComponent(id)}/createReply`, { method: 'POST', body: {}, html: true });
  const old = draft.body?.content ?? '';
  const mine = replyHtml(text, signOff);
  const content = /<body[^>]*>/i.test(old) ? old.replace(/<body[^>]*>/i, (b) => `${b}${mine}`) : `${mine}${old}`;
  await graph(`/messages/${encodeURIComponent(draft.id)}`, { method: 'PATCH', body: { body: { contentType: 'HTML', content } } });
  const to = (draft.toRecipients ?? []).map(who);
  const subject = (draft.subject ?? '').trim();
  if (!send) return { to, subject, draft: true, at: new Date().toISOString() };
  try {
    await graph(`/messages/${encodeURIComponent(draft.id)}/send`, { method: 'POST' }, 'send');
  } catch (e) {
    if (e instanceof OutlookError) throw new OutlookError(e.code, e.status, `${e.detail}${e.detail ? ' · ' : ''}saved in Drafts`);
    throw e;
  }
  return { to, subject, draft: false, at: new Date().toISOString() };
}

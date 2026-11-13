/* 360dialog, the go-between that puts Raf's WhatsApp number on Meta's Cloud API (13 Nov 2026). One API key
   (D360_API_KEY, from the 360dialog hub: the number's API Keys), sent as D360-API-KEY to https://waba-v2.360dialog.io
   (D360_API for tests). 360dialog passes Meta's Cloud API through: /messages to send, /{media id} for a photo's
   address (the lookaside.fbsbx.com host swapped for 360dialog's, fetched within 5 minutes), /v1/configs/webhook
   where WhatsApp's messages go, /v1/configs/templates for message templates. 360dialog's docs, checked 13 Nov 2026. */

const API = () => (process.env.D360_API || 'https://waba-v2.360dialog.io').replace(/\/$/, '');
const KEY = () => process.env.D360_API_KEY || '';
export const d360SetUp = () => Boolean(KEY());

export type D360Code = 'wa-not-set-up' | 'wa-key' | 'wa-window' | 'wa-number' | 'wa-template' | 'wa-busy' | 'wa-error';
export class D360Error extends Error {
  constructor(
    public code: D360Code,
    public detail = '',
  ) {
    super(code);
  }
}

type Obj = Record<string, unknown>;

async function call(path: string, init: { method?: string; body?: unknown; raw?: boolean } = {}): Promise<Response> {
  if (!KEY()) throw new D360Error('wa-not-set-up');
  let res: Response;
  try {
    res = await fetch(path.startsWith('http') ? path : `${API()}${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { 'D360-API-KEY': KEY(), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new D360Error('wa-busy', 'no answer');
  }
  if (res.ok || init.raw) return res;
  const text = await res.text().catch(() => '');
  let err: Obj = {};
  try {
    const j = JSON.parse(text) as Obj;
    err = (j.error as Obj) ?? ((j.meta as Obj)?.developer_message ? { message: (j.meta as Obj).developer_message } : j);
  } catch {
    /* not JSON */
  }
  const code = Number(err.code);
  const msg = String(err.message ?? err.error_user_msg ?? text).replace(/\s+/g, ' ').slice(0, 200);
  if (res.status === 401 || res.status === 403 || code === 190) throw new D360Error('wa-key', msg);
  if (code === 131047) throw new D360Error('wa-window', msg); // more than 24 hours since their last message
  if (code === 131026 || code === 131030 || code === 131021) throw new D360Error('wa-number', msg); // not on WhatsApp / not allowed
  if (code === 132001 || code === 132000 || code === 132012 || code === 132015) throw new D360Error('wa-template', msg);
  if (res.status === 429 || res.status >= 500 || code === 130429 || code === 131056) throw new D360Error('wa-busy', msg);
  throw new D360Error('wa-error', `${res.status} ${msg}`);
}
const json = async (res: Response) => (await res.json().catch(() => ({}))) as Obj;

/* A photo or file someone sent: its bytes and type. `url` is the address the webhook gave, when it gave one. */
export async function mediaBytes(id: string | undefined, url?: string): Promise<{ bytes: Uint8Array; mime: string }> {
  let where = url;
  if (!where) {
    if (!id) throw new D360Error('wa-error', 'no media id');
    where = String((await json(await call(`/${encodeURIComponent(id)}`))).url ?? '');
  }
  if (!where) throw new D360Error('wa-error', 'no media address');
  where = where.replace(/\\/g, '').replace(/^https:\/\/lookaside\.fbsbx\.com/, API());
  const res = await call(where);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? '' };
}

const sentId = (j: Obj) => String(((j.messages as Obj[] | undefined)?.[0] as Obj | undefined)?.id ?? '');

/* Words, within the 24 hours after their last message. */
export async function sendText(to: string, body: string) {
  const j = await json(await call('/messages', { body: { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: true } } }));
  return sentId(j);
}

/* An approved template, any time: its two body values. */
export async function sendTemplate(to: string, name: string, values: string[], lang = 'en_GB') {
  const j = await json(
    await call('/messages', {
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: { name, language: { code: lang }, components: [{ type: 'body', parameters: values.map((text) => ({ type: 'text', text })) }] },
      },
    }),
  );
  return sentId(j);
}

export async function getWebhook(): Promise<string> {
  const j = await json(await call('/v1/configs/webhook'));
  return String(j.url ?? '');
}
export async function setWebhook(url: string) {
  await call('/v1/configs/webhook', { body: { url } });
}

export type TemplateRow = { name: string; status: string; category: string; language: string; reason?: string };
export async function listTemplates(): Promise<TemplateRow[]> {
  const j = await json(await call('/v1/configs/templates?limit=200'));
  return ((j.waba_templates as Obj[] | undefined) ?? []).map((t) => ({
    name: String(t.name ?? ''),
    status: String(t.status ?? ''),
    category: String(t.category ?? ''),
    language: String(t.language ?? ''),
    reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? String(t.rejected_reason) : undefined,
  }));
}
export async function createTemplate(t: { name: string; category: string; body: string; example: string[] }, lang = 'en_GB') {
  await call('/v1/configs/templates', {
    body: { name: t.name, category: t.category, language: lang, allow_category_change: true, components: [{ type: 'BODY', text: t.body, example: { body_text: [t.example] } }] },
  });
}

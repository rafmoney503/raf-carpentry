import { createEnquiry, emailRaf, sm8SetUp, Sm8Error } from '@/lib/servicem8';
import { parseBrief, stripInvisible } from '@/app/job-kit/brief-paste';
import { makeToken } from '@/lib/brief-token';
import { EMAIL } from '@/lib/site';

/* "Send to Raf" on Plan your project: the customer's brief goes straight into ServiceM8 as a Quote job (client,
   billing contact, job with the address and the same description the Job Kit's paste tool makes, job contact),
   and Raf gets an email about it through ServiceM8. The answer carries a token for adding the photos
   (/api/brief/photo), one request each, then /api/brief/done.
   Public, so: a hidden field people never see (bots fill it in), a minimum time on the page, a few sends per
   address per 10 minutes, and short limits on every field. A bot gets an ordinary-looking answer and nothing is
   made. createEnquiry is safe to repeat, so a customer pressing send twice gets one job. Nothing is kept here. */
export const maxDuration = 30;

const MAX_PHOTOS = 10;
const MIN_MS = 4000;
const recent = new Map<string, number[]>(); // per server instance: a speed bump, not a wall

const text = (v: unknown, max: number) => (typeof v === 'string' ? stripInvisible(v).trim().slice(0, max) : '');

function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 2000) recent.clear();
  return list.length > 4;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'bad' }, { status: 400 });
  }
  const photos = Math.max(0, Math.min(MAX_PHOTOS, Math.floor(Number(body.photos) || 0)));

  // Bots: the hidden box filled in, or sent faster than anyone could fill the form. Looks fine, does nothing.
  if (text(body.company, 200) || Number(body.ms) < MIN_MS) return Response.json({ ok: true, token: '', photos: 0 });

  if (!sm8SetUp()) return Response.json({ error: 'not-set-up' }, { status: 503 });
  const name = text(body.name, 80).replace(/\s+/g, ' ');
  const mobile = text(body.mobile, 30);
  const email = text(body.email, 160).replace(/\s+/g, '');
  const address = text(body.address, 300);
  const message = text(body.message, 5000);
  if (name.length < 2) return Response.json({ error: 'name' }, { status: 400 });
  const goodMobile = mobile.replace(/\D/g, '').length >= 10;
  const goodEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!goodMobile && !goodEmail) return Response.json({ error: 'contact' }, { status: 400 });
  if (!message) return Response.json({ error: 'message' }, { status: 400 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return Response.json({ error: 'busy' }, { status: 429 });

  const parsed = parseBrief(message);
  const description = [parsed.description, photos ? `Photos: ${photos} sent with the brief (in the job's diary).` : 'No photos sent yet.', 'Sent with Send to Raf.']
    .join('\n')
    .slice(0, 4000);

  try {
    const job = await createEnquiry({ name, mobile: goodMobile ? mobile : '', email: goodEmail ? email : '', address, description });
    const what = description.split('\n')[0];
    const lines = [
      `${name} sent a brief from rafcarpentry.com: ${what}`,
      '',
      goodMobile ? `Mobile: ${mobile}` : '',
      goodEmail ? `Email: ${email}` : '',
      address ? `Address: ${address}` : '',
      photos ? `Photos: ${photos} on the way, on the job in ServiceM8.` : 'No photos yet.',
      '',
      'It is a Quote job in ServiceM8 and on Today in the Job Kit.',
      '',
      description,
    ].filter((l, i, a) => l !== '' || (a[i - 1] ?? '') !== '');
    // Not awaited for long: the customer shouldn't wait on an email.
    await Promise.race([emailRaf(EMAIL, `New brief from the website: ${name}`, lines.join('\n'), job.uuid), new Promise((r) => setTimeout(r, 4000))]);
    return Response.json({ ok: true, token: makeToken(job.uuid, photos), photos }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const code = e instanceof Sm8Error ? e.code : 'error';
    const status = e instanceof Sm8Error && e.status === 429 ? 429 : 502;
    return Response.json({ error: code }, { status });
  }
}

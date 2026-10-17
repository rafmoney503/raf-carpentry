import { NextResponse } from 'next/server';
import { createEnquiry, sendEmail, sm8SetUp, Sm8Error, tidy } from '@/lib/servicem8';
import { PHONE_DISPLAY, SITE_URL } from '@/lib/site';

/* POST /api/enquiry: the contact form and the "Sketch my system" planner. Makes a Quote job in Rafal's ServiceM8,
   emails him (RAF_EMAIL, default info@rafcarpentry.com) and thanks the visitor if they gave an email. Without
   SERVICEM8_API_KEY it answers 503 not-set-up and the page offers WhatsApp with the message typed in. */

export const runtime = 'nodejs';

type Sketch = { trade?: string; pains?: string[]; hours?: number; modules?: string[] };
type Body = { name?: string; email?: string; mobile?: string; company?: string; trade?: string; message?: string; sketch?: Sketch; source?: string; website?: string; ms?: number };

const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 5;
}

const cut = (s: unknown, n: number) => (typeof s === 'string' ? tidy(s).trim().slice(0, n) : '');

export async function POST(req: Request) {
  let b: Body;
  try {
    b = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad' }, { status: 400 });
  }
  // Bots: a hidden box filled in, or sent faster than a person could type.
  if (b.website || (typeof b.ms === 'number' && b.ms < 3000)) return NextResponse.json({ ok: true, job: '', emailed: false });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (tooMany(ip)) return NextResponse.json({ ok: false, reason: 'busy' }, { status: 429 });

  const name = cut(b.name, 80);
  const email = cut(b.email, 120).replace(/\s+/g, '');
  const mobile = cut(b.mobile, 30);
  const company = cut(b.company, 80);
  const trade = cut(b.trade, 60);
  const message = cut(b.message, 2000);
  const sketch = b.sketch && typeof b.sketch === 'object' ? b.sketch : undefined;
  const pains = Array.isArray(sketch?.pains) ? sketch!.pains.slice(0, 12).map((p) => cut(p, 80)).filter(Boolean) : [];
  const modules = Array.isArray(sketch?.modules) ? sketch!.modules.slice(0, 12).map((p) => cut(p, 80)).filter(Boolean) : [];
  const hours = typeof sketch?.hours === 'number' && Number.isFinite(sketch.hours) ? Math.max(0, Math.min(60, Math.round(sketch.hours))) : 0;

  if (!name) return NextResponse.json({ ok: false, reason: 'name' }, { status: 400 });
  if (!email && mobile.replace(/\D/g, '').length < 10) return NextResponse.json({ ok: false, reason: 'contact' }, { status: 400 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, reason: 'email' }, { status: 400 });
  if (!message && !pains.length) return NextResponse.json({ ok: false, reason: 'message' }, { status: 400 });

  if (!sm8SetUp()) return NextResponse.json({ ok: false, reason: 'not-set-up' }, { status: 503 });

  const lines = [
    `Systems enquiry from rafalsolutions.co.uk${b.source === 'sketch' ? ' (Sketch my system)' : ''}`,
    trade ? `Trade: ${trade}` : '',
    company ? `Business: ${company}` : '',
    pains.length ? `What eats their time: ${pains.join(', ')}` : '',
    hours ? `Hours lost a week: ${hours} (about ${hours * 46} a year)` : '',
    modules.length ? `Sketch showed: ${modules.join(', ')}` : '',
    message ? `\nIn their words:\n${message}` : '',
  ].filter(Boolean);
  const description = lines.join('\n');

  let job: { uuid: string; number: string };
  try {
    job = await createEnquiry({ name, mobile, email, company, description });
  } catch (e) {
    const code = e instanceof Sm8Error ? e.code : 'sm8-error';
    console.error('enquiry failed', code, e instanceof Sm8Error ? e.detail : e);
    return NextResponse.json({ ok: false, reason: code }, { status: 502 });
  }

  const first = name.split(' ')[0];
  const toRaf = process.env.RAF_EMAIL || 'info@rafcarpentry.com';
  const rafText = [
    `New systems enquiry${job.number ? ` (ServiceM8 job ${job.number})` : ''}.`,
    '',
    `Name: ${name}`,
    company ? `Business: ${company}` : '',
    mobile ? `Mobile: ${mobile}` : '',
    email ? `Email: ${email}` : '',
    '',
    description,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
  const thanks = [
    `Hi ${first},`,
    '',
    "Thanks for telling me what slows your business down. It's with me now, filed as a job in ServiceM8, the same way the systems I build work.",
    '',
    "I'll read it properly and come back to you with one question or a first sketch.",
    '',
    'What you sent:',
    description,
    '',
    'Rafal',
    'Rafal Solutions Ltd',
    PHONE_DISPLAY,
    SITE_URL.replace('https://', ''),
  ].join('\n');

  const sent = await Promise.race([
    Promise.all([
      sendEmail({ to: toRaf, subject: `New systems enquiry: ${name}${trade ? ` (${trade})` : ''}`, text: rafText, jobUuid: job.uuid, replyTo: email || undefined }),
      email ? sendEmail({ to: email, subject: `Thanks ${first}, it's with me`, text: thanks, jobUuid: job.uuid }) : Promise.resolve(false),
    ]),
    new Promise<[boolean, boolean]>((r) => setTimeout(() => r([false, false]), 6000)),
  ]);

  return NextResponse.json({ ok: true, job: job.number, emailed: Boolean(sent[1]) });
}

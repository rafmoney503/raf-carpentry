import { countDownload, GUIDES, guidePdf, isGuide, sessionOk } from '@/lib/guide-sales';

/* The guide itself: GET ?s=<Checkout Session id> counts the download (30 at most) and sends the PDF from the private
   repo (src/lib/guide-sales.ts). Anything wrong goes back to the thank-you page, which says what. */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = url.searchParams.get('s') ?? '';
  const back = (err: string) =>
    Response.redirect(`${url.origin}/pax-guide/thanks?${sessionOk(s) ? `session_id=${encodeURIComponent(s)}&` : ''}err=${err}`, 303);
  if (!sessionOk(s)) return back('link');
  let product: string | undefined;
  try {
    const c = await countDownload(s);
    if (!c.ok) return back(c.reason === 'limit' ? 'limit' : 'link');
    product = c.product;
  } catch {
    return back('busy');
  }
  const id = isGuide(product) ? product : 'pax-guide';
  try {
    const pdf = await guidePdf(id);
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Content-Disposition': `inline; filename="${GUIDES[id].name}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (e) {
    console.error('[guide] pdf', e);
    return back('busy');
  }
}

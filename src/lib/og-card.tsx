import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';

/* The picture that shows when a page is shared on WhatsApp, Facebook or LinkedIn: 1200 x 630,
   drafting-paper background, the job photo on a white mount, the title in Bricolage and the
   R logo. Fonts are static copies of the site fonts in src/fonts/og (the editor needs TTF). */

export const ogSize = { width: 1200, height: 630 };
// JPEG, not PNG: WhatsApp often drops link-preview pictures over about 300 KB, and a photo as PNG is 450 KB+.
export const ogContentType = 'image/jpeg';

const C = {
  paper: '#f1f2ef',
  mount: '#fbfbf9',
  ink: '#16191c',
  muted: '#4f555b',
  faint: '#5e646a',
  accent: '#2547d0',
  line: 'rgba(22,25,28,0.26)',
  grid: 'rgba(37,71,208,0.06)',
};

const FALLBACK_PHOTO = '/images/projects/IMG_8405.jpg';

async function dataUrl(publicPath: string) {
  const file = join(process.cwd(), 'public', publicPath);
  const src = existsSync(file) ? file : join(process.cwd(), 'public', FALLBACK_PHOTO);
  const buf = await readFile(src);
  const type = src.endsWith('.png') ? 'image/png' : src.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return `data:${type};base64,${buf.toString('base64')}`;
}

async function font(name: string) {
  return readFile(join(process.cwd(), 'src/fonts/og', name));
}

export async function ogCard({ kicker, title, sub, photo }: { kicker: string; title: string; sub?: string; photo?: string }) {
  const [img, logo, display, body, mono] = await Promise.all([
    dataUrl(photo || FALLBACK_PHOTO),
    dataUrl('/images/r-logo-final.png'),
    font('Bricolage-650.ttf'),
    font('Geist-450.ttf'),
    font('GeistMono-400.ttf'),
  ]);
  const size = title.length <= 34 ? 66 : title.length <= 58 ? 56 : 46;

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 48,
          gap: 52,
          background: C.paper,
          backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      >
        <div style={{ display: 'flex', padding: 10, background: C.mount, border: `1px solid ${C.line}`, boxShadow: '0 18px 40px -18px rgba(22,25,28,0.35)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} width={392} height={514} style={{ objectFit: 'cover' }} alt="" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, paddingTop: 6, paddingBottom: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 22, color: C.accent, letterSpacing: 0.5 }}>{kicker}</div>
            <div style={{ display: 'flex', marginTop: 20, fontFamily: 'Display', fontSize: size, lineHeight: 1.04, letterSpacing: -1.6, color: C.ink }}>{title}</div>
            {sub ? <div style={{ display: 'flex', marginTop: 22, fontFamily: 'Body', fontSize: 27, lineHeight: 1.35, color: C.muted }}>{sub}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={60} height={60} style={{ borderRadius: 30, border: `1px solid ${C.line}` }} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: 'Display', fontSize: 30, color: C.ink, letterSpacing: -0.5 }}>Raf Carpentry</div>
              <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 19, color: C.faint, marginTop: 2 }}>rafcarpentry.com · London</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: 'Display', data: display, style: 'normal', weight: 600 },
        { name: 'Body', data: body, style: 'normal', weight: 400 },
        { name: 'Mono', data: mono, style: 'normal', weight: 400 },
      ],
    },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).flatten({ background: C.paper }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { 'Content-Type': ogContentType } });
}

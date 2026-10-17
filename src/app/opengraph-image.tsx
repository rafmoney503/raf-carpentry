import { ImageResponse } from 'next/og';

/* The picture shown when the site is shared on WhatsApp, LinkedIn or Facebook: drafting paper, the rs mark and the
   headline with its highlighter. Made once at build time. The fonts come from Google Fonts while building; if that
   fails, the picture still builds in the default font. */

export const alt = 'Rafal Solutions: systems for trade businesses, built by a carpenter.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return src ? await (await fetch(src)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OgImage() {
  const [display, body, mono] = await Promise.all([googleFont('Bricolage Grotesque', 700), googleFont('Geist', 400), googleFont('Geist Mono', 400)]);
  const fonts = [
    display && { name: 'Display', data: display, weight: 700 as const, style: 'normal' as const },
    body && { name: 'Body', data: body, weight: 400 as const, style: 'normal' as const },
    mono && { name: 'Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[];

  const grid = 'rgba(21,25,28,0.06)';
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
          backgroundColor: '#f5f6f3',
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          color: '#15171a',
          fontFamily: 'Body',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ position: 'relative', width: 52, height: 52, background: '#15171a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Display', fontSize: 28 }}>
            rs
            <div style={{ position: 'absolute', right: -8, bottom: -8, width: 20, height: 20, background: '#ffe45c', border: '3px solid #f5f6f3' }} />
          </div>
          <div style={{ fontFamily: 'Display', fontSize: 34 }}>Rafal Solutions</div>
        </div>
        <div style={{ marginTop: 56, fontFamily: 'Mono', fontSize: 22, letterSpacing: 2, color: '#545b62' }}>RAFAL SOLUTIONS LTD · LONDON</div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', fontFamily: 'Display', fontSize: 84, lineHeight: 1.04, letterSpacing: -3 }}>
          <div>Systems for trade</div>
          <div>businesses.</div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex', backgroundImage: 'linear-gradient(transparent 58%, #ffe45c 58%, #ffe45c 94%, transparent 94%)', padding: '0 6px', marginLeft: -6 }}>Built by a carpenter.</div>
          </div>
        </div>
        <div style={{ marginTop: 'auto', fontSize: 30, color: '#545b62' }}>Quotes, enquiries, diary and payments on your phone, connected to ServiceM8.</div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}

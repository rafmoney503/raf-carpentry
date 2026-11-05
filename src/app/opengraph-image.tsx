import { ImageResponse } from 'next/og';

/* The picture shown when the site is shared on WhatsApp, LinkedIn or Facebook: drafting paper, the steps logo and the
   headline with its highlighter. Made once at build time. The fonts come from Google Fonts while building; if that
   fails, the picture still builds in the default font. */

export const alt = 'Rafal Solutions: software for people who build things. Learn, design, make, fit, run.';
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
  const [display, body, mono] = await Promise.all([googleFont('Geist', 700), googleFont('Geist', 400), googleFont('Geist Mono', 400)]);
  const fonts = [
    display && { name: 'Display', data: display, weight: 700 as const, style: 'normal' as const },
    body && { name: 'Body', data: body, weight: 400 as const, style: 'normal' as const },
    mono && { name: 'Mono', data: mono, weight: 400 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }[];

  const grid = 'rgba(23,22,26,0.05)';
  const steps = [
    ['Learn', '#ff6b3d'],
    ['Design', '#8b5cf6'],
    ['Make', '#22c55e'],
    ['Fit', '#2f5bff'],
    ['Run', '#ffc21a'],
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '64px 72px',
          backgroundColor: '#ffffff',
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          color: '#17161a',
          fontFamily: 'Body',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <svg width="60" height="60" viewBox="0 0 100 100">
            <rect x="10" y="72" width="80" height="14" rx="2" fill="#17161a" />
            <rect x="34" y="54" width="56" height="14" rx="2" fill="#17161a" />
            <rect x="58" y="36" width="32" height="14" rx="2" fill="#17161a" />
            <circle cx="74" cy="25" r="9.5" fill="#ffd43b" stroke="#ffffff" strokeWidth="3" />
          </svg>
          <div style={{ fontFamily: 'Display', fontSize: 36, letterSpacing: -1 }}>Rafal Solutions</div>
        </div>
        <div style={{ marginTop: 48, fontFamily: 'Mono', fontSize: 22, letterSpacing: 2, color: '#6c6872' }}>RAFAL SOLUTIONS LTD · LONDON</div>
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', fontFamily: 'Display', fontSize: 88, lineHeight: 1.04, letterSpacing: -3 }}>
          <div>Software for people</div>
          <div style={{ display: 'flex' }}>
            <div style={{ display: 'flex' }}>who&nbsp;</div>
            <div style={{ display: 'flex' }}>build things.</div>
          </div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          {steps.map(([name, colour], i) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: 150, height: 16 + i * 10, borderRadius: 8, backgroundColor: colour }} />
              <div style={{ fontFamily: 'Mono', fontSize: 20, letterSpacing: 2, color: '#47444d' }}>{name.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}

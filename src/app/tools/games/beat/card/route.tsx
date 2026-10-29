import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { R_MARK } from '@/lib/r-logo';
import { readScore, scoreWords, squares, type Score } from '@/lib/workshop-games/site';

/* The picture WhatsApp (and the rest) shows for a shared score: /tools/games/beat/card?g=stack&n=34&h=1598 ...,
   1200 x 630, the games' dark blueprint, the score, a drawing of the game and the R. Drawn at request time from
   the link alone, so nothing is read from public/ (it isn't in the server function); the fonts are the static
   copies in src/fonts/og (next.config.ts traces them in). The same link always gives the same picture. */

export const runtime = 'nodejs';

const C = {
  bg: '#121518',
  grid: 'rgba(127,155,255,0.12)',
  gridFine: 'rgba(127,155,255,0.05)',
  ink: '#f4f1ea',
  muted: '#a3abb3',
  yellow: '#f2c94c',
  blue: '#8ea6ff',
  green: '#6fcf97',
  line: 'rgba(244,241,234,0.16)',
};

const TIMBER = [
  ['#e2c08c', '#b8935c'],
  ['#c88f56', '#9c6a3a'],
  ['#8a5a3b', '#5e3b24'],
  ['#e8c573', '#b9964a'],
  ['#b5653f', '#83442a'],
];

const svgUrl = (body: string, w: number, h: number) =>
  `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`).toString('base64')}`;

function stackArt(n: number) {
  const shown = Math.max(3, Math.min(11, n));
  const H = 30, base = 400;
  let s = `<path d="M40 ${base + 2} H400" stroke="${C.ink}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`;
  let w = 300, x = 80;
  for (let i = 0; i < shown; i++) {
    const [c, e] = i === shown - 1 ? [C.yellow, '#b8902a'] : TIMBER[Math.floor(i / 2) % TIMBER.length];
    const y = base - (i + 1) * H;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${H - 3}" rx="3" fill="${c}" stroke="${e}" stroke-width="2.5"/>`;
    const cut = 4 + ((i * 7) % 9);
    x += i % 2 ? cut : 0;
    w -= cut;
  }
  const top = base - shown * H;
  s += `<g stroke="${C.blue}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M36 ${base} V${top}"/><path d="M26 ${base} H46 M26 ${top} H46"/><path d="M36 ${top + 2} l-8 13 M36 ${top + 2} l8 13 M36 ${base - 2} l-8 -13 M36 ${base - 2} l8 -13"/></g>`;
  return svgUrl(s, 420, 420);
}

function nailArt() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    const y = 60 + i * 58;
    s += `<rect x="20" y="${y}" width="380" height="52" rx="3" fill="${TIMBER[i % 2 ? 1 : 0][0]}" stroke="${TIMBER[i % 2 ? 1 : 0][1]}" stroke-width="2.5"/>`;
  }
  const nail = (x: number, y: number, home: boolean) =>
    home
      ? `<circle cx="${x}" cy="${y}" r="9" fill="#8b9198" stroke="#4f555b" stroke-width="2"/>`
      : `<rect x="${x - 3}" y="${y - 34}" width="6" height="34" fill="#c5cad0"/><ellipse cx="${x}" cy="${y - 34}" rx="13" ry="5" fill="#dfe3e7" stroke="#6c737a" stroke-width="2"/>`;
  s += nail(90, 140, true) + nail(300, 198, true) + nail(150, 372, true) + nail(330, 314, false) + nail(210, 256, false);
  // the hit: a burst round the nail just driven home
  s += `<g stroke="${C.yellow}" stroke-width="5" stroke-linecap="round"><path d="M90 108 V96 M90 172 V184 M58 140 H46 M122 140 H134 M68 118 l-9 -9 M112 118 l9 -9 M68 162 l-9 9 M112 162 l9 9"/></g>`;
  // the hammer, coming down on the next one
  s += `<g transform="translate(250 150) rotate(-28)"><rect x="-10" y="0" width="20" height="150" rx="6" fill="#8a5a3b" stroke="#5e3b24" stroke-width="3"/><rect x="-46" y="-26" width="92" height="34" rx="5" fill="#5b6168" stroke="#2c3136" stroke-width="3"/></g>`;
  return svgUrl(s, 420, 420);
}

function measureArt(res: number[]) {
  // the tape up the side of something hidden, the real line in green and the guess in blue
  let s = `<rect x="60" y="40" width="190" height="360" rx="4" fill="#1b2025" stroke="${C.line}" stroke-width="2"/>`;
  s += `<rect x="60" y="40" width="190" height="150" fill="#0e1114"/><path d="M60 190 H250" stroke="${C.ink}" stroke-width="2" stroke-dasharray="7 6" opacity="0.5"/>`;
  s += `<rect x="290" y="60" width="54" height="340" fill="${C.yellow}" stroke="#b8902a" stroke-width="2.5"/>`;
  for (let i = 0; i <= 34; i++) {
    const y = 400 - i * 10;
    s += `<path d="M290 ${y} H${i % 10 === 0 ? 322 : i % 5 === 0 ? 312 : 302}" stroke="#16191c" stroke-width="${i % 10 === 0 ? 3 : 1.6}"/>`;
  }
  const off = Math.min(60, res.length ? res[res.length - 1] : 0);
  s += `<path d="M40 150 H360" stroke="${C.green}" stroke-width="4"/><path d="M40 ${150 + off * 0.8 + 6} H360" stroke="${C.blue}" stroke-width="4" stroke-dasharray="10 7"/>`;
  return svgUrl(s, 420, 420);
}

function sheetArt(n: number) {
  // a 2440 x 1220 board on end with the parts packed on it, the way the game draws it
  const X = 120, Y = 20, W = 190, H = 380;
  let s = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="#e7d3a8" stroke="${C.ink}" stroke-width="3" stroke-dasharray="9 6"/>`;
  const colours = ['#8ea6ff', '#6fcf97', '#f2c94c', '#ff8a5b', '#c9a7ff', '#7fd6d0', '#f4a6c1', '#b7c4cf'];
  const parts = Math.max(3, Math.min(8, n));
  // a guillotine layout: rows across, the last row split in two
  const rows = Math.ceil(parts / 2);
  let y = Y + 4, k = 0;
  for (let r = 0; r < rows; r++) {
    const h = (H - 8) / rows - 4;
    const two = k + 1 < parts;
    const w1 = two ? (W - 12) * (0.42 + ((r * 13) % 20) / 100) : W - 8;
    s += `<rect x="${X + 4}" y="${y}" width="${w1}" height="${h}" rx="2" fill="${colours[k % 8]}" stroke="#16191c" stroke-width="2"/>`;
    k++;
    if (two) {
      s += `<rect x="${X + 8 + w1}" y="${y}" width="${W - 12 - w1}" height="${h}" rx="2" fill="${colours[k % 8]}" stroke="#16191c" stroke-width="2"/>`;
      k++;
    }
    y += h + 4;
  }
  return svgUrl(s, 420, 420);
}

function levelArt(stars: number) {
  // a birch board seen from above: the bearing's route round the walls (pencil, dashed) into the brass hinge cup,
  // and under it the bubble sitting level
  const lime = '#b5e655';
  let s = `<rect x="30" y="20" width="360" height="300" rx="6" fill="#5a3d24"/><rect x="42" y="32" width="336" height="276" rx="2" fill="#e4cb9c"/>`;
  for (let i = 0; i < 14; i++) {
    const x = 50 + i * 24 + ((i * 7) % 9);
    s += `<path d="M${x} 32 C${x + 6} 120 ${x - 6} 220 ${x} 308" stroke="rgba(150,104,52,0.22)" stroke-width="2" fill="none"/>`;
  }
  s += `<rect x="42" y="118" width="230" height="16" fill="#a8784a"/><rect x="148" y="214" width="230" height="16" fill="#a8784a"/>`;
  s += `<circle cx="236" cy="250" r="14" fill="#0b0b0c"/><circle cx="160" cy="196" r="13" fill="#0b0b0c"/>`;
  s += `<path d="M340 282 H112 Q90 282 90 260 V192 Q90 170 112 170 H300 Q324 170 324 148 V112" stroke="${C.blue}" stroke-width="4" stroke-dasharray="10 9" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="326" cy="80" r="30" fill="none" stroke="${lime}" stroke-width="7"/><circle cx="326" cy="80" r="22" fill="#d4a64a" stroke="#1a140c" stroke-width="2"/><circle cx="326" cy="80" r="14" fill="#3b2a0c"/>`;
  s += `<circle cx="326" cy="80" r="11" fill="#c9d0d6"/><circle cx="322" cy="76" r="4" fill="#ffffff"/>`;
  [[190, 282], [220, 170], [324, 140]].forEach(([x, y], i) => {
    const got = i < stars;
    s += `<circle cx="${x}" cy="${y}" r="9" fill="${got ? 'none' : '#e0b44e'}" stroke="${got ? 'rgba(22,25,28,0.35)' : '#9a6d1e'}" stroke-width="2"${got ? ' stroke-dasharray="4 4"' : ''}/>`;
  });
  s += `<rect x="60" y="352" width="300" height="48" rx="24" fill="rgba(181,230,85,0.18)" stroke="${C.ink}" stroke-width="3"/>`;
  s += `<path d="M186 360 V392 M234 360 V392" stroke="${C.ink}" stroke-width="3" opacity="0.6"/><circle cx="210" cy="376" r="15" fill="${lime}"/><circle cx="205" cy="371" r="5" fill="#ffffff" opacity="0.8"/>`;
  return svgUrl(s, 420, 420);
}

function diffArt(f: number, n: number) {
  // the drawing the customer signed off over the job as fitted, a bedroom the way the game draws one: the snags
  // found ringed in lime, the ones missed in red, and under them a dot for each snag
  const lime = '#b5e655', red = '#ff6b4a';
  const room = (y: number, fitted: boolean) => {
    let s = `<rect x="30" y="${y}" width="360" height="168" rx="10" fill="#e8e3d9"/>`;
    s += `<path d="M30 ${y + 132} H390 V${y + 158} Q390 ${y + 168} 380 ${y + 168} H40 Q30 ${y + 168} 30 ${y + 158} Z" fill="#b98b5d"/>`;
    // the wardrobe: two doors on a plinth (the plinth left off as fitted)
    s += `<rect x="66" y="${y + 14}" width="156" height="${fitted ? 118 : 110}" fill="#7f9479"/><rect x="70" y="${y + 18}" width="72" height="104" fill="#8fa58a"/><rect x="146" y="${y + 18}" width="72" height="104" fill="#8fa58a"/>`;
    if (!fitted) s += `<rect x="70" y="${y + 124}" width="148" height="8" fill="#56685a"/>`;
    // the handles: brass on the drawing, one black as fitted
    s += `<rect x="134" y="${y + 58}" width="4" height="24" rx="2" fill="#c9a24a"/><rect x="150" y="${y + 58}" width="4" height="24" rx="2" fill="${fitted ? '#23272c' : '#c9a24a'}"/>`;
    // a picture on the wall, its hills gone as fitted
    s += `<rect x="252" y="${y + 26}" width="62" height="46" fill="#2a2d31"/><rect x="257" y="${y + 31}" width="52" height="36" fill="#bcd6e6"/>`;
    if (!fitted) s += `<path d="M257 ${y + 67} L274 ${y + 50} L288 ${y + 60} L296 ${y + 54} L309 ${y + 67} Z" fill="#6f9a6a"/>`;
    // the lamp, its shade another colour as fitted
    s += `<path d="M352 ${y + 132} V${y + 66}" stroke="#2b2f35" stroke-width="3"/><path d="M338 ${y + 66} H366 L360 ${y + 44} H344 Z" fill="${fitted ? '#e6b955' : '#2547d0'}"/>`;
    // a plant, and as fitted a tape measure left on the floor
    s += `<path d="M262 ${y + 132} L266 ${y + 110} H286 L290 ${y + 132} Z" fill="#c4733a"/><path d="M276 ${y + 110} C268 ${y + 96} 262 ${y + 92} 258 ${y + 86} M276 ${y + 110} C280 ${y + 94} 290 ${y + 90} 296 ${y + 84}" stroke="#5d7f6a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if (fitted) s += `<rect x="304" y="${y + 140}" width="22" height="18" rx="4" fill="#f2c94c" stroke="#16191c" stroke-width="2"/><rect x="326" y="${y + 152}" width="22" height="4" fill="#f2c94c"/>`;
    // the tag on each: blue on the drawing, dark with lime as fitted
    s += `<rect x="40" y="${y + 10}" width="${fitted ? 18 : 22}" height="8" rx="2" fill="${fitted ? '#16191c' : '#2547d0'}"/>`;
    if (fitted) s += `<rect x="43" y="${y + 13}" width="12" height="2" fill="${lime}"/>`;
    return s;
  };
  let s = room(14, false) + room(202, true);
  const spots: [number, number, number, number][] = [[144, 272, 18, 20], [146, 330, 84, 12], [283, 251, 38, 32], [352, 258, 22, 20], [326, 352, 30, 18]];
  const ok = Math.min(spots.length, f);
  spots.forEach(([x, y, rx, ry], i) => {
    if (i >= ok && f >= n) return;
    const got = i < ok;
    s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="rgba(22,25,28,0.6)" stroke-width="7"${got ? '' : ' stroke-dasharray="8 6"'}/>`;
    s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${got ? lime : red}" stroke-width="4"${got ? '' : ' stroke-dasharray="8 6"'}/>`;
  });
  const gap = 26, x0 = 210 - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) s += `<circle cx="${x0 + i * gap}" cy="402" r="8" fill="${i < f ? lime : red}"/>`;
  return svgUrl(s, 420, 420);
}

const artOf = (s: Score) =>
  s.g === 'stack' ? stackArt(s.n) : s.g === 'nail' ? nailArt() : s.g === 'measure' ? measureArt(s.res) : s.g === 'level' ? levelArt(s.s) : s.g === 'diff' ? diffArt(s.f, s.n) : sheetArt(s.n);

const R_LOGO = svgUrl(
  `<circle cx="500" cy="500" r="500" fill="${C.ink}"/><g transform="translate(${500 - (R_MARK.w * 0.62) / 2} ${500 - (R_MARK.h * 0.62) / 2}) scale(0.62)"><path d="${R_MARK.stem}" fill="#16191c"/><path d="${R_MARK.bowl}" fill="#16191c"/></g>`,
  1000,
  1000,
);

const font = (name: string) => readFile(join(process.cwd(), 'src/fonts/og', name));

export async function GET(req: Request) {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const s = readScore(q);
  const [display, body, mono] = await Promise.all([font('Bricolage-650.ttf'), font('Geist-450.ttf'), font('GeistMono-400.ttf')]);
  const w = s ? scoreWords(s) : null;
  const title = w ? w.title : 'Six games from the workshop';
  const size = title.length <= 20 ? 86 : title.length <= 30 ? 72 : 58;

  const png = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '52px 56px',
          gap: 40,
          background: C.bg,
          backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          color: C.ink,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 24, letterSpacing: 2, color: C.yellow }}>
              {`WORKSHOP GAMES${w ? ' · ' + w.game.toUpperCase() : ''}`}
            </div>
            <div style={{ display: 'flex', marginTop: 22, fontFamily: 'Display', fontSize: size, lineHeight: 1.0, letterSpacing: -2, color: C.ink }}>{title}</div>
            {s && s.g === 'measure' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 }}>
                {s.res.slice(0, 5).map((off, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {squares(off).split('').map((c, j) => (
                      <div key={j} style={{ display: 'flex', width: 30, height: 30, borderRadius: 4, background: c === '■' ? C.green : 'rgba(244,241,234,0.12)' }} />
                    ))}
                    <div style={{ display: 'flex', marginLeft: 12, fontFamily: 'Mono', fontSize: 22, color: C.muted }}>{off <= 5 ? 'spot on' : `${off} mm`}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', marginTop: 24, fontFamily: 'Body', fontSize: 28, lineHeight: 1.35, color: C.muted, maxWidth: 600 }}>
                {w ? w.sub : 'Measure Up, Sheet Saver, Timber Stack, Nail Pop, Level Best and Find the Difference. Free, on your phone.'}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={R_LOGO} width={64} height={64} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: 'Display', fontSize: 38, color: C.yellow, letterSpacing: -0.5 }}>Can you beat it?</div>
              <div style={{ display: 'flex', fontFamily: 'Mono', fontSize: 20, color: C.muted, marginTop: 2 }}>rafcarpentry.com/games · free, no adverts</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', width: 420, alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s ? artOf(s) : stackArt(7)} width={420} height={420} alt="" />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Display', data: display, style: 'normal', weight: 600 },
        { name: 'Body', data: body, style: 'normal', weight: 400 },
        { name: 'Mono', data: mono, style: 'normal', weight: 400 },
      ],
    },
  );
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).flatten({ background: C.bg }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}

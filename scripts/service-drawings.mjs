// Line drawings (drafting-paper style) for services that have no job photos yet.
// Run: node scripts/service-drawings.mjs  -> public/images/services/<name>.jpg (1200 x 900)
import sharp from 'sharp';

const INK = '#16191c', BLUE = '#2547d0', PAPER = '#f1f2ef', MOUNT = '#fbfbf9';
const W = 400, H = 300;

function paper(inner) {
  let grid = '';
  for (let x = 0; x <= W; x += 12) grid += `<path d="M${x} 0V${H}"/>`;
  for (let y = 0; y <= H; y += 12) grid += `<path d="M0 ${y}H${W}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 3}" height="${H * 3}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <g stroke="rgba(37,71,208,0.08)" stroke-width="0.6">${grid}</g>
  <g fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
</svg>`;
}

const door = paper(`
  <path d="M70 262H330"/>
  <path d="M126 262V38H274V262"/>
  <path d="M140 262V52H260V262" stroke-width="1.6"/>
  <rect x="146" y="58" width="108" height="202" fill="${MOUNT}"/>
  <g stroke-width="1.5">
    <rect x="158" y="72" width="36" height="76"/><rect x="206" y="72" width="36" height="76"/>
    <rect x="158" y="166" width="36" height="80"/><rect x="206" y="166" width="36" height="80"/>
  </g>
  <circle cx="246" cy="158" r="4.5" stroke-width="1.8"/>
  <g stroke="${BLUE}">
    <path d="M143 84v18M143 214v18" stroke-width="4"/>
    <path d="M146 24h45M209 24h45M146 18v12M254 18v12" stroke-width="1.8"/>
  </g>
  <text x="200" y="28.5" fill="${BLUE}" stroke="none" font-family="Menlo, monospace" font-size="13" font-weight="600" text-anchor="middle">W</text>
`);

// Floor in perspective: boards run to the back wall, joints staggered, one board in blue.
let boards = '', joints = '';
const N = 11, yB = 118, yF = 272, xB0 = 70, xB1 = 330, xF0 = 14, xF1 = 386;
const at = (i, y) => { const t = (y - yB) / (yF - yB); const xb = xB0 + (i * (xB1 - xB0)) / N, xf = xF0 + (i * (xF1 - xF0)) / N; return xb + t * (xf - xb); };
for (let i = 0; i <= N; i++) boards += `<path d="M${at(i, yB).toFixed(1)} ${yB}L${at(i, yF).toFixed(1)} ${yF}"/>`;
const k = 7, yb = 200;
for (let i = 0; i < N; i++) { if (i === k) continue; const y = yB + 18 + ((i * 47) % 120); joints += `<path d="M${at(i, y).toFixed(1)} ${y}L${at(i + 1, y).toFixed(1)} ${y}"/>`; }
const flooring = paper(`
  <path d="M${xB0} 40V${yB}M${xB1} 40V${yB}"/>
  <path d="M${xB0} ${yB - 14}H${xB1}" stroke-width="1.6"/>
  <path d="M${xB0} ${yB}H${xB1}"/>
  <path d="M${xB0} ${yB}L${xF0} ${yF}M${xB1} ${yB}L${xF1} ${yF}"/>
  <g stroke-width="1.2">${boards}${joints}</g>
  <path d="M${at(k, yb).toFixed(1)} ${yb}L${at(k, yF).toFixed(1)} ${yF}L${at(k + 1, yF).toFixed(1)} ${yF}L${at(k + 1, yb).toFixed(1)} ${yb}Z" stroke="${BLUE}" stroke-width="2.4" fill="rgba(37,71,208,0.08)"/>
`);

// Stud wall: head and sole plates, studs, staggered noggins in blue, one board fixed on.
let studs = '', nogs = '';
const xs = [84, 132, 180, 228, 276, 316];
xs.forEach((x) => (studs += `<rect x="${x}" y="54" width="10" height="196" fill="${MOUNT}"/>`));
for (let i = 0; i < xs.length - 1; i++) { const y = i % 2 ? 160 : 146; nogs += `<rect x="${xs[i] + 10}" y="${y}" width="${xs[i + 1] - xs[i] - 10}" height="9" fill="${MOUNT}"/>`; }
let screws = '';
for (const x of [233, 281, 321]) for (let y = 70; y < 246; y += 22) screws += `<circle cx="${x}" cy="${y}" r="1.4" fill="${INK}" stroke="none"/>`;
const studWall = paper(`
  <path d="M40 40H360M40 262H360" />
  <rect x="84" y="44" width="242" height="10" fill="${MOUNT}"/>
  <rect x="84" y="250" width="242" height="10" fill="${MOUNT}"/>
  <g stroke-width="1.8">${studs}</g>
  <g stroke="${BLUE}" stroke-width="1.8">${nogs}</g>
  <rect x="228" y="54" width="98" height="196" fill="${MOUNT}" stroke-width="1.8"/>
  ${screws}
`);

for (const [name, svg] of [['door-fitting', door], ['flooring', flooring], ['stud-walls', studWall]]) {
  await sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toFile(`public/images/services/${name}.jpg`);
  console.log('wrote', name);
}

#!/usr/bin/env node
/* The simple calculator's icon (7 Nov 2026, Raf picked option 2 of three, "Night signs", on the 'Basic calculator
   mockups' canvas): plus, minus and times as outlined keys from the night look, the equals filled blue, on the
   night look's dark tile. Run from the repo: `node scripts/calculator/icons.mjs` (uses sharp, already a
   dependency). It writes the icon for the site (rounded tile, a new file name when it changes), the browser tab
   icon and the home screen icons (full-bleed squares: the phone rounds the corners itself). */

import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';

const OUT = 'public/images/tools/calculator';
mkdirSync(OUT, { recursive: true });

// drawn on 64; `scale` shrinks the keys round the middle (the maskable icon keeps them in the safe circle)
function keys(scale) {
  return `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">` +
    '<g fill="none" stroke="#5b74e6" stroke-width="1.6">' +
    '<rect x="10.8" y="10.8" width="19.4" height="19.4" rx="5.5"/>' +
    '<rect x="33.8" y="10.8" width="19.4" height="19.4" rx="5.5"/>' +
    '<rect x="10.8" y="33.8" width="19.4" height="19.4" rx="5.5"/>' +
    '</g>' +
    '<rect x="33" y="33" width="21" height="21" rx="6" fill="#2547d0"/>' +
    '<g stroke-linecap="round" stroke-width="2.8">' +
    '<path d="M15.5 20.5H25.5M20.5 15.5V25.5" stroke="#a9b8ff"/>' +
    '<path d="M38.5 20.5H48.5" stroke="#a9b8ff"/>' +
    '<path d="M16.9 39.9L24.1 47.1M24.1 39.9L16.9 47.1" stroke="#a9b8ff"/>' +
    '<path d="M38.5 41.2H48.5M38.5 46.8H48.5" stroke="#ffffff"/>' +
    '</g></g>';
}
const svg = (scale, rx) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64"${rx ? ` rx="${rx}"` : ''} fill="#121518"/>${keys(scale)}</svg>\n`;

// the site's copy, named by its content so a changed icon is never served from an old cache
const tile = svg(1, 14);
const name = `icon-${createHash('sha256').update(tile).digest('hex').slice(0, 8)}.svg`;
for (const f of readdirSync(OUT)) if (/^icon-[0-9a-f]{8}\.svg$/.test(f) && f !== name) unlinkSync(`${OUT}/${f}`);
writeFileSync(`${OUT}/${name}`, tile);
// the browser tab on /tools/calculator (Next's icon file for that page)
writeFileSync('src/app/tools/calculator/icon.svg', tile);

const png = (scale, size, file) => sharp(Buffer.from(svg(scale, 0)), { density: (72 * size) / 64 }).resize(size, size).png().toFile(file);
await png(1, 512, `${OUT}/icon-512.png`);
await png(1, 192, `${OUT}/icon-192.png`);
await png(0.84, 512, `${OUT}/icon-maskable-512.png`);
await png(0.92, 180, `${OUT}/apple-touch-icon.png`);
await png(0.92, 180, 'src/app/tools/calculator/apple-icon.png');
console.log(`Wrote ${OUT}/${name}, the PNGs and src/app/tools/calculator/icon.svg and apple-icon.png`);

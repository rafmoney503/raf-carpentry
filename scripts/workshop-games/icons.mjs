#!/usr/bin/env node
/* The Workshop Games app icons: a stack of boards on the dark blueprint the games are drawn on, the top one
   (Timber Stack's yellow) landing a little off, its overhang cut off and falling, and a blue height line up the
   side. Run from the repo: `node scripts/workshop-games/icons.mjs` (uses sharp, already a dependency). */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'public/images/tools/games';
mkdirSync(OUT, { recursive: true });

function art(scale) {
  // drawn on 512; `scale` shrinks the picture round the middle (the maskable icon keeps it in the safe circle)
  const boards = [
    { x: 92, w: 328, c: '#e2c08c', e: '#b8935c' }, // birch ply
    { x: 108, w: 300, c: '#c88f56', e: '#9c6a3a' }, // oak
    { x: 118, w: 268, c: '#8a5a3b', e: '#5e3b24' }, // walnut
    { x: 132, w: 236, c: '#e8c573', e: '#b9964a' }, // pine
  ];
  const H = 50, base = 398;
  let s = '';
  boards.forEach((b, i) => {
    const y = base - (i + 1) * H;
    s += `<rect x="${b.x}" y="${y}" width="${b.w}" height="${H - 4}" rx="4" fill="${b.c}" stroke="${b.e}" stroke-width="3"/>`;
    // a grain line along each board
    s += `<path d="M${b.x + 18} ${y + H / 2 - 3} C ${b.x + b.w * 0.35} ${y + H / 2 - 9}, ${b.x + b.w * 0.6} ${y + H / 2 + 5}, ${b.x + b.w - 20} ${y + H / 2 - 4}" fill="none" stroke="${b.e}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;
  });
  // the top board, in Timber Stack's yellow, landed a little to the right of the one below
  const ty = base - 5 * H;
  s += `<rect x="132" y="${ty}" width="236" height="${H - 4}" rx="4" fill="#f2c94c" stroke="#b8902a" stroke-width="3"/>`;
  // its overhang, cut off, falling away on the right
  s += `<g transform="translate(404 ${ty + 6}) rotate(24)"><rect x="0" y="0" width="58" height="${H - 4}" rx="4" fill="#f2c94c" stroke="#b8902a" stroke-width="3"/></g>`;
  // the saw line where it was cut
  s += `<path d="M368 ${ty - 12} V${ty + H + 4}" stroke="#f4f1ea" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"/>`;
  // the height line up the left, with its arrows
  s += `<g stroke="#8ea6ff" stroke-width="5" stroke-linecap="round" fill="none"><path d="M60 ${base} V${ty}"/><path d="M48 ${base} H72 M48 ${ty} H72"/><path d="M60 ${ty + 2} l-10 16 M60 ${ty + 2} l10 16 M60 ${base - 2} l-10 -16 M60 ${base - 2} l10 -16"/></g>`;
  // the floor
  s += `<path d="M72 ${base + 2} H440" stroke="#f4f1ea" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`;
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${s}</g>`;
}

function svg(scale) {
  let grid = '';
  for (let i = 32; i < 512; i += 32) {
    const strong = i % 128 === 0;
    const op = strong ? 0.2 : 0.08;
    grid += `<path d="M${i} 0 V512 M0 ${i} H512" stroke="rgb(127,155,255)" stroke-opacity="${op}" stroke-width="${strong ? 2 : 1.5}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#121518"/>${grid}${art(scale)}</svg>`;
}

const big = Buffer.from(svg(1));
const safe = Buffer.from(svg(0.78));
await sharp(big).resize(512, 512).png().toFile(`${OUT}/icon-512.png`);
await sharp(big).resize(192, 192).png().toFile(`${OUT}/icon-192.png`);
await sharp(safe).resize(512, 512).png().toFile(`${OUT}/icon-maskable-512.png`);
await sharp(Buffer.from(svg(0.9))).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
await sharp(Buffer.from(svg(0.9))).resize(180, 180).png().toFile('src/app/tools/games/apple-icon.png');
console.log('Wrote the icons to', OUT, 'and src/app/tools/games/apple-icon.png');

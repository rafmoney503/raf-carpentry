// Writes src/app/learn/learn.css from the mv-lg-* classes used in src/components/learn/scenes.tsx.
//   node scripts/learn/css.mjs
// A scene times its parts with class names: the numbers are % of the 7 s loop.
//   mv-lg-show-A      comes in at A and stays            mv-lg-off-A      there until A, then gone
//   mv-lg-win-A-B     there only from A to B              mv-lg-pop-A      pops in at A
//   mv-lg-draw-A-B    a line (pathLength 1, .mv-lg-line) draws from A to B
//   mv-lg-in-A        fades in at A while moving in from --dx / --dy (12% long)
//   mv-lg-go-A-B      moves from --dx / --dy to its place between A and B (slide: at a steady speed)
//   mv-lg-rot-A-B     springs from --r to straight (turn: gently; trace: draw at a steady speed)
//   mv-lg-growx-A-B   grows from nothing, left to right
//   mv-lg-tap-A       two knocks                            mv-lg-ping-A     a ring going out, once
//   mv-lg-puff-A      a speck of dust thrown to --dx / --dy mv-lg-buzz-A-B   shakes while a drill runs
//   mv-lg-wig-A-B     across by --dx, back past, then home  mv-lg-tug-A      pulled down twice
// plus the moves in OWN below. Without motion (or the class), a part sits where it ends up; off, win, ping,
// puff and the loop bar are hidden then.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/components/learn/scenes.tsx'), 'utf8');
const used = [...new Set(src.match(/mv-lg-[a-z]+(?:-\d+){0,2}/g) ?? [])].filter((c) => c !== 'mv-lg-line').sort();

const n = (v) => +Math.max(0, Math.min(100, v)).toFixed(2);
const FROM = 'translate(var(--dx, 0px), var(--dy, 0px))';

const FAMILY = {
  show: (a) => ['linear', `0%, ${a}% { opacity: 0; } ${n(a + 2.5)}%, 100% { opacity: 1; }`],
  off: (a) => ['linear', `0%, ${a}% { opacity: 1; } ${n(a + 2.5)}%, 100% { opacity: 0; }`],
  win: (a, b) => ['linear', `0%, ${a}% { opacity: 0; } ${n(a + 2.5)}%, ${b}% { opacity: 1; } ${n(b + 2.5)}%, 100% { opacity: 0; }`],
  pop: (a) => ['ease-out', `0%, ${a}% { opacity: 0; transform: scale(0.4); } ${n(a + 3)}% { opacity: 1; transform: scale(1.14); } ${n(a + 6)}%, 100% { opacity: 1; transform: scale(1); }`],
  draw: (a, b = a + 10) => ['ease-in-out', `0%, ${a}% { stroke-dashoffset: 1; opacity: 0; } ${n(a + 0.5)}% { stroke-dashoffset: 1; opacity: 1; } ${b}%, 100% { stroke-dashoffset: 0; opacity: 1; }`],
  in: (a) => ['cubic-bezier(0.3, 0.7, 0.2, 1)', `0%, ${a}% { opacity: 0; transform: ${FROM}; } ${n(a + 2)}% { opacity: 1; } ${n(a + 12)}%, 100% { opacity: 1; transform: translate(0, 0); }`],
  go: (a, b) => ['ease-in-out', `0%, ${a}% { transform: ${FROM}; } ${b}%, 100% { transform: translate(0, 0); }`],
  slide: (a, b) => ['linear', `0%, ${a}% { transform: ${FROM}; } ${b}%, 100% { transform: translate(0, 0); }`],
  rot: (a, b) => ['cubic-bezier(0.3, 1.4, 0.5, 1)', `0%, ${a}% { transform: rotate(var(--r, 0deg)); } ${b}%, 100% { transform: rotate(0deg); }`],
  turn: (a, b) => ['ease-in-out', `0%, ${a}% { transform: rotate(var(--r, 0deg)); } ${b}%, 100% { transform: rotate(0deg); }`],
  trace: (a, b) => ['linear', `0%, ${a}% { stroke-dashoffset: 1; opacity: 0; } ${n(a + 0.5)}% { stroke-dashoffset: 1; opacity: 1; } ${b}%, 100% { stroke-dashoffset: 0; opacity: 1; }`],
  growx: (a, b) => ['linear', `0%, ${a}% { transform: scaleX(0); } ${b}%, 100% { transform: scaleX(1); }`],
  tap: (a) => ['ease-in-out', `0%, ${a}% { transform: scale(1); } ${n(a + 1.5)}% { transform: scale(0.82); } ${n(a + 3)}% { transform: scale(1); } ${n(a + 5)}% { transform: scale(0.82); } ${n(a + 6.5)}%, 100% { transform: scale(1); }`],
  ping: (a) => ['ease-out', `0%, ${a}% { opacity: 0; transform: scale(0.3); } ${n(a + 1)}% { opacity: 0.95; } ${n(a + 9)}%, 100% { opacity: 0; transform: scale(1.5); }`],
  puff: (a) => ['ease-out', `0%, ${a}% { opacity: 0; transform: translate(0, 0); } ${n(a + 1)}% { opacity: 0.9; } ${n(a + 9)}%, 100% { opacity: 0; transform: ${FROM}; }`],
  buzz: (a, b) => {
    let s = `0%, ${a}% { transform: translate(0, 0); }`;
    for (let t = a + 1, k = 0; t < b; t += 1, k++) s += ` ${t}% { transform: translate(0, ${k % 2 ? '-0.7px' : '0.7px'}); }`;
    return ['linear', `${s} ${b}%, 100% { transform: translate(0, 0); }`];
  },
  wig: (a, b) => {
    const d = (b - a) / 3;
    return ['ease-in-out', `0%, ${a}% { transform: translateX(0); } ${n(a + d)}% { transform: translateX(var(--dx, 0px)); } ${n(a + 2 * d)}% { transform: translateX(calc(var(--dx, 0px) * -0.5)); } ${b}%, 100% { transform: translateX(0); }`];
  },
  tug: (a) => ['ease-in-out', `0%, ${a}% { transform: translateY(0); } ${n(a + 3)}% { transform: translateY(3px); } ${n(a + 6)}% { transform: translateY(0); } ${n(a + 10)}% { transform: translateY(3px); } ${n(a + 13)}%, 100% { transform: translateY(0); }`],
};

/* one drawing's own moves */
const OWN = {
  // the loop's own clock, along the bottom edge
  bar: ['linear', '0% { opacity: 0.55; transform: scaleX(0); } 100% { opacity: 0.55; transform: scaleX(1); }'],
  // the drill comes to the wall, bores in until the tape touches (44 to 84 px), and comes back out
  drill: ['ease-in-out', '0%, 18% { transform: translateX(0); } 26%, 28% { transform: translateX(44px); animation-timing-function: linear; } 55%, 62% { transform: translateX(84px); animation-timing-function: ease-in-out; } 76%, 100% { transform: translateX(0); }'],
  // a spring toggle: pushed through the board folded, its wings open, then it's pulled back tight
  toggle: ['ease-in-out', '0%, 66% { opacity: 0; transform: translateX(-44px); } 67% { opacity: 1; transform: translateX(-44px); } 76%, 84% { opacity: 1; transform: translateX(18px); } 92%, 100% { opacity: 1; transform: translateX(0); }'],
};

const HIDDEN_AT_REST = ['off', 'win', 'ping', 'puff'];
const rules = [];
const frames = [];
const unknown = [];
for (const cls of used) {
  const m = /^mv-lg-([a-z]+)((?:-\d+)*)$/.exec(cls);
  const nums = m[2] ? m[2].slice(1).split('-').map(Number) : [];
  const made = nums.length === 0 ? OWN[m[1]] : FAMILY[m[1]]?.(...nums);
  if (!made) {
    unknown.push(cls);
    continue;
  }
  rules.push(`  .${cls} { animation: ${cls} var(--lg-loop) ${made[0]} infinite both; }`);
  frames.push(`@keyframes ${cls} { ${made[1]} }`);
}
if (unknown.length) {
  console.error('No move for:', unknown.join(', '));
  process.exit(1);
}

const css = `/* The moving drawings in the Learn guides (src/components/learn/scenes.tsx). MADE BY scripts/learn/css.mjs from the
   mv-lg-* classes the scenes use: change the scenes, run the script, never edit this file.

   Each step's drawing loops every 7 s: parts come in, the tool does its job, the result holds, then it starts again.
   A drawing only moves while it is on screen (MotionObserver sets data-play; motion.css pauses every mv-* part
   otherwise) and only for people who haven't asked for less motion; without the moves every part sits where it
   ends up, so the drawing is the finished step. The numbers in a class are % of the loop (see the script). */

:root { --lg-loop: 7s; }

/* the drawings' own materials, like the decking drawing's timber: only inside these drawings */
.lg-art {
  --lg-plaster: #fbfbf9; --lg-board: #e9e8e1; --lg-cavity: #dcddd6; --lg-timber: #e8cf9f; --lg-grain: #b48f55;
  --lg-ply: #f1e0bd; --lg-ply-dark: #dfc594; --lg-brick: #dba88c; --lg-mortar: #f4e7dc; --lg-steel: #c5cbd1;
  --lg-tool: #2a3037; --lg-plug: #e6b655; --lg-glass: #dfe8ee;
}
.lg-art text { font-family: var(--font-mono); }

.mv-lg-line { stroke-dasharray: 1 1; stroke-dashoffset: 0; }
${HIDDEN_AT_REST.map((f) => `[class*='mv-lg-${f}-']`).join(', ')}, .mv-lg-bar { opacity: 0; }

/* the drawing's frame: edge to edge on a phone, on a white mount like the photos from 640 px */
.lg-mount { margin-inline: -20px; border-block: 1px solid var(--color-line-strong); background: var(--color-mount); }
@media (min-width: 640px) {
  .lg-mount { margin-inline: 0; padding: 10px; border: 1px solid var(--color-line-strong); border-radius: 2px; box-shadow: 0 22px 40px -28px rgb(22 25 28 / 0.55); }
}

@media (prefers-reduced-motion: no-preference) {
${rules.join('\n')}
}

${frames.join('\n')}
`;
fs.writeFileSync(path.join(root, 'src/app/learn/learn.css'), css);
console.log(`learn.css: ${used.length} moves, ${(css.length / 1024).toFixed(1)} KB`);

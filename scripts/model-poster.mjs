// The still shown before a 3D model loads (and when a phone has no WebGL): the model's opening view, taken from
// a page on a local server with reduced motion on (no swing) and the zoom buttons hidden.
//
//   node scripts/model-poster.mjs <page url> <out.png> [tab]
//     e.g. node scripts/model-poster.mjs http://localhost:3456/portfolio/curved-seat-kennington /tmp/kenn.png
//          node scripts/model-poster.mjs http://localhost:3456/d/k7m2q9xd /tmp/opt2.png 2   (a design's second option)
//   then: python3 scripts/poster-fit.py <out.png> <poster.jpg> 1600 1200   (tall pieces; 1600 800 for wide ones)
//
// Uses the Chromium that Playwright finds (software WebGL), so it is slow: allow a couple of minutes a model.
import { chromium } from 'playwright';

const [url, out, tab] = process.argv.slice(2);
if (!url || !out) {
  console.error('node scripts/model-poster.mjs <page url> <out.png> [tab]');
  process.exit(1);
}
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(url, { waitUntil: 'networkidle' });
if (tab && Number(tab) > 1) {
  await p.locator('[role="tab"]').nth(Number(tab) - 1).click({ force: true });
  await p.waitForTimeout(500);
}
const canvas = p.locator('canvas.cursor-grab');
await canvas.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await p.waitForFunction(() => document.querySelector('canvas.cursor-grab')?.classList.contains('opacity-100'), null, { timeout: 170000 });
await p.addStyleTag({ content: 'header, .fixed, .m3d-tools { visibility: hidden !important; }' });
await p.waitForTimeout(8000);
const box = await canvas.boundingBox();
console.log('stage', box.width, box.height);
await canvas.screenshot({ path: out });
await b.close();

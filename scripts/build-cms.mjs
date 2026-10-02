// Builds the TinaCMS admin (/admin) before the Next.js build.
// The website itself never depends on TinaCMS (pages read content/*.json from disk),
// so a missing key or a TinaCloud hiccup must not stop the site from deploying.
import { spawnSync } from 'node:child_process';

const hasKeys = Boolean(process.env.NEXT_PUBLIC_TINA_CLIENT_ID && process.env.TINA_TOKEN);

if (!hasKeys) {
  console.warn(
    '\n[cms] NEXT_PUBLIC_TINA_CLIENT_ID and TINA_TOKEN are not set, so /admin was not built.\n' +
      '[cms] The website still builds. Add both keys in Vercel > Settings > Environment Variables to turn the editor on.\n'
  );
  process.exit(0);
}

const result = spawnSync('npx', ['tinacms', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.status !== 0) {
  console.warn('\n[cms] TinaCMS build failed (see above), so /admin may be out of date. Continuing with the website build.\n');
}
process.exit(0);

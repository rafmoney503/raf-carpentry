import { readFileSync } from 'fs';
import { join } from 'path';

/* Money pots (29 Oct 2026, Raf: the claude.ai version only opened inside the Claude app, 'not a separate app on
   screen', then 'go' to moving it onto the website): Rafal Solutions' money and deadlines app, full screen from its
   own home screen icon. The page is one HTML file (app.html here, the same app as the claude.ai artifact it came
   from) with a small stand-in for the artifact's window.claude: its data goes to /api/pots and Ask Claude to
   /api/pots/ask, both behind the Job Kit's PIN (src/lib/pots-server.ts). Built once at deploy time. Not linked
   anywhere, not in Google (robots.ts), not counted in the visit stats. */
export const dynamic = 'force-static';

export function GET() {
  const html = readFileSync(join(process.cwd(), 'src/app/pots/app.html'), 'utf8');
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

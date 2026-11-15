import type { PageReport } from '@/lib/fbpage-types';
import { appStyle } from './ui';

/* The parts of HQ's Facebook section with no state, usable on the server and in the browser. */

/* Facebook's own blue for the section, as each app has its own colour. */
export const FB_STYLE = appStyle({ color: '#1877f2', light: '#6ea8ff', ink: '#ffffff' });

export function PagePic({ r, size = 44 }: { r: PageReport; size?: number }) {
  if (r.page?.picture) return <img className="fb-pic" src={r.page.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" />;
  return (
    <span className="tile" aria-hidden="true" style={{ width: size, height: size }}>
      {(r.page?.name ?? 'C')[0]}
    </span>
  );
}

/* What to do when the Page can't be read: a headline, what to do, and whether it's done in the Job Kit. */
export function fbProblem(state: string, detail?: string, pages?: string[]): { h: string; p: string; kit?: boolean } {
  const say: Record<string, { h: string; p: string; kit?: boolean }> = {
    'not-set-up': { h: 'Facebook isn’t set up on rafcarpentry.com', p: `It’s missing ${detail || 'its Meta settings'} in Vercel.` },
    'hq-not-set-up': { h: 'HQ can’t ask rafcarpentry.com yet', p: 'Add HQ_NOTIFY_SECRET to the rafal-hq project in Vercel (the same value as on raf-carpentry), then redeploy.' },
    'not-connected': { h: 'Facebook isn’t connected', p: 'Open the Job Kit, Social media, and Connect Instagram and Facebook.', kit: true },
    'not-shared': {
      h: 'The login doesn’t share the Cabinet OS Page yet',
      p: `In the Job Kit: Social media, Connect again, and tick Cabinet OS when Facebook asks which Pages.${pages?.length ? ` It shares ${pages.join(', ')} now.` : ''}`,
      kit: true,
    },
    expired: { h: 'Facebook wants you to connect again', p: 'Open the Job Kit, Social media, Connect again. The counts so far are kept.', kit: true },
  };
  return say[state] ?? { h: 'Couldn’t read Facebook just now', p: detail ? `${detail}. HQ tries again in a minute.` : 'HQ tries again in a minute.' };
}

export function FbSetup({ state, detail, pages }: { state: string; detail?: string; pages?: string[] }) {
  const s = fbProblem(state, detail, pages);
  return (
    <section className="setup">
      <h2>{s.h}</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{s.p}</p>
      {s.kit ? (
        <a className="btn solid" href="https://www.rafcarpentry.com/job-kit" target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
          Open the Job Kit
        </a>
      ) : null}
    </section>
  );
}

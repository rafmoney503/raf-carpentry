import { when } from '@/lib/time';
import type { Report } from '@/lib/types';
import { appStyle } from './ui';

/* Are the sites up, and what went live last. */
export function Health({ r }: { r: Report }) {
  const down = r.sites.filter((s) => s.up && !s.up.ok);
  const failed = r.sites.filter((s) => s.deploy?.state === 'ERROR');
  const latest = r.sites
    .filter((s) => s.deploy && s.deploy.state === 'READY')
    .sort((a, b) => (b.deploy?.at ?? 0) - (a.deploy?.at ?? 0))[0];
  const good = !down.length && !failed.length;
  return (
    <section aria-label="Sites up" className="card">
      <div className="health-row">
        <span className={`okdot${good ? '' : ' bad'}`} aria-hidden="true" />
        <b>
          {down.length
            ? `${down.map((s) => s.name).join(' and ')} ${down.length === 1 ? 'is' : 'are'} not answering`
            : `All ${r.sites.length} sites are up`}
        </b>
        <span className="stamp">checked {when(r.at)}</span>
      </div>
      <div className="health-bars" aria-hidden="true">
        {r.sites.map((s) => (
          <span key={s.key} className={`appc${s.up && !s.up.ok ? ' bad' : ''}`} style={appStyle(s)} />
        ))}
      </div>
      {failed.length ? (
        <p>
          {`The last update to ${failed.map((s) => s.name).join(' and ')} didn\u2019t go live: the site still shows the version before.`}
        </p>
      ) : null}
      {latest?.deploy ? (
        <p className="note">
          Last change to go live: {latest.name}, {when(latest.deploy.at)}
          {latest.deploy.message ? ` (“${latest.deploy.message}”)` : ''}
        </p>
      ) : !r.vercel ? (
        <p className="note">Updates going live show here once HQ has the Vercel token.</p>
      ) : null}
    </section>
  );
}

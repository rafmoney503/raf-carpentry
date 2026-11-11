import Link from 'next/link';
import { diff, num, pctChange, plural } from '@/lib/format';
import type { Report, SiteStats } from '@/lib/types';
import { Pill, Spark, appStyle } from './ui';

const DASH = 'https://vercel.com/rafals-projects-ecbcd9de';

/* The few numbers that matter for each app, besides visitors. */
export function keyNumbers(s: SiteStats, r: Report): string[] {
  const out: string[] = [];
  if (s.key === 'rafcarpentry' && r.leads) {
    for (const g of r.leads.rafsite.filter((g) => g.week > 0).slice(0, 3)) out.push(`${g.week} ${g.short}`);
  }
  if (s.key === 'cabinetos' && r.leads) {
    const c = r.leads.cabinetos;
    out.push(plural(c.signupsWeek, 'sign-up'), plural(c.accounts, 'account'), `${c.payingTotal} paying`);
  }
  for (const x of s.extras) if (x.week > 0) out.push(`${x.week} ${x.label}`);
  return out.slice(0, 5);
}

export function AppCard({ s, r, range }: { s: SiteStats; r: Report; range: 'today' | 'week' }) {
  const wk = range === 'week';
  const value = wk ? s.week : s.today;
  const c = wk ? pctChange(s.week, s.lastWeek) : s.yesterdayByNow === null ? null : diff(s.today, s.yesterdayByNow);
  const text = c ? (wk ? (c.text === 'Same' ? 'Same as week before' : `${c.text} on week before`) : `${c.text} on yesterday`) : wk ? 'New this week' : '';
  const chips = keyNumbers(s, r);
  return (
    <Link href={`/apps/${s.key}`} className="app appc" style={appStyle(s)} aria-label={`${s.name}: ${value} visitors ${wk ? 'in the last 7 days' : 'today'}. Open its page.`}>
      <div className="app-row">
        <span className="tile" aria-hidden="true">
          {s.initial}
        </span>
        <span className="app-name">
          <b>{s.name}</b>
          <small>{s.sub}</small>
        </span>
        <span className="app-num">
          <b>{num(value)}</b>
          {text ? <Pill tone={c?.tone ?? 'flat'}>{text}</Pill> : null}
        </span>
      </div>
      <Spark values={s.days.slice(-14).map((d) => d.visitors)} />
      {chips.length ? (
        <div className="chips">
          <span className="k">7 days:</span>
          {chips.map((x) => (
            <span key={x} className="chip">
              {x}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function OffCard({ sites }: { sites: SiteStats[] }) {
  return (
    <div className="off" id="counting">
      {sites.map((s) => (
        <div key={s.key} className="off-row appc" style={appStyle(s)}>
          <span className="tile" aria-hidden="true">
            {s.initial}
          </span>
          <span className="app-name">
            <b>{s.name}</b>
            <small>
              {s.status === 'not-counting'
                ? 'Live, not counting visits yet'
                : s.status === 'no-token'
                  ? 'Waiting for the Vercel token'
                  : `Couldn’t read it just now${s.error ? `: ${s.error}` : ''}`}
            </small>
          </span>
          {s.status === 'not-counting' ? (
            <a className="btn" href={`${DASH}/${s.vercelName}/analytics`} target="_blank" rel="noreferrer">
              Switch on
            </a>
          ) : (
            <Link className="btn" href={`/apps/${s.key}`}>
              Open
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

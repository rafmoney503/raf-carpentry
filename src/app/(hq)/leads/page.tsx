import Link from 'next/link';
import { appStyle } from '@/components/ui';
import { plural, sum } from '@/lib/format';
import { getReport } from '@/lib/report';
import { siteByKey } from '@/lib/sites';
import { dayLetter, shortDay } from '@/lib/time';

export const dynamic = 'force-dynamic';

/* Everyone who reached out or signed up, across the apps. */
export default async function LeadsPage() {
  const r = await getReport();
  const L = r.leads;
  const rc = siteByKey('rafcarpentry')!;
  const cos = siteByKey('cabinetos')!;
  const b3 = r.sites.find((s) => s.key === 'builditin3d');
  const cosSite = r.sites.find((s) => s.key === 'cabinetos');
  const rows: { name: string; app: string; n: number; last: number; site: typeof rc }[] = [];
  if (L) {
    for (const g of L.rafsite.filter((g) => g.week || g.last)) rows.push({ name: `${g.label} taps`, app: 'rafcarpentry.com', n: g.week, last: g.last, site: rc });
    rows.push({ name: 'New accounts', app: 'CabinetOS', n: L.cabinetos.signupsWeek, last: L.cabinetos.signupsLast, site: cos });
  }
  for (const x of cosSite?.extras ?? []) rows.push({ name: `People who ${x.label}`, app: 'CabinetOS', n: x.week, last: x.last, site: cos });
  for (const x of b3?.extras ?? []) rows.push({ name: `People who ${x.label}`, app: 'Build It in 3D', n: x.week, last: x.last, site: siteByKey('builditin3d')! });

  const days = L?.rafsiteDays ?? [];
  const sdays = L?.cabinetos.signupsDays ?? [];
  const max = Math.max(1, ...days.map((d) => d.taps + (sdays.find((x) => x.day === d.day)?.n ?? 0)));

  return (
    <>
      <div className="hello">
        <p>The 7 days to yesterday</p>
        <h1>Leads</h1>
        <p className="lead">
          {L
            ? `${plural(sum(L.rafsite.map((g) => g.week)), 'tap')} to get in touch on rafcarpentry.com and ${plural(L.cabinetos.signupsWeek, 'new CabinetOS account')}.`
            : 'Quote taps and sign-ups come from Supabase, which HQ couldn’t read just now.'}
        </p>
      </div>

      {L ? (
        <section aria-label="Every day" className="card">
          <div className="head">
            <h2>Every day</h2>
            <span>14 days</span>
          </div>
          <div className="daychart" style={{ height: 120 }}>
            {days.map((d) => {
              const s = sdays.find((x) => x.day === d.day)?.n ?? 0;
              return (
                <div key={d.day} role="img" aria-label={`${shortDay(d.day)}: ${d.taps} taps, ${s} sign-ups`} style={{ height: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2 }}>
                  <span style={{ display: 'block', height: Math.round((s / max) * 110), background: cos.color, borderRadius: 3 }} />
                  <span style={{ display: 'block', height: Math.max(2, Math.round((d.taps / max) * 110)), background: rc.color, borderRadius: 3 }} />
                </div>
              );
            })}
          </div>
          <div className="daylabels" aria-hidden="true">
            {days.map((d) => (
              <span key={d.day}>{dayLetter(d.day)}</span>
            ))}
          </div>
          <div className="key">
            <span>
              <i style={{ background: rc.color }} />
              Taps to get in touch (rafcarpentry.com)
            </span>
            <span>
              <i style={{ background: cos.color }} />
              CabinetOS sign-ups
            </span>
          </div>
        </section>
      ) : null}

      <section aria-label="All apps" className="card">
        <div className="head">
          <h2>All apps</h2>
          <span>was = the 7 days before</span>
        </div>
        <ul className="rows">
          {rows.map((x) => (
            <li key={x.app + x.name} className="appc" style={appStyle(x.site)}>
              <span>
                {x.name}
                <small>{x.app}</small>
              </span>
              <b>
                {x.n}
                <small>{x.last ? `was ${x.last}` : ''}</small>
              </b>
              <span className="track">
                <span className="fill" style={{ width: `${Math.round((x.n / Math.max(1, ...rows.map((y) => y.n))) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="note">
          Taps are on the buttons. The people behind them are in ServiceM8 and the{' '}
          <a href="https://www.rafcarpentry.com/job-kit" target="_blank" rel="noreferrer">
            Job Kit
          </a>
          ; CabinetOS accounts in its <a href="https://www.cabinetos.co.uk/admin/status" target="_blank" rel="noreferrer">status app</a>.
        </p>
      </section>

      <p className="stamp">
        <Link href="/">Back to Today</Link>
      </p>
    </>
  );
}

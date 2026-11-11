import Link from 'next/link';
import { notFound } from 'next/navigation';
import { keyNumbers } from '@/components/apps';
import { SiteDays } from '@/components/sitedays';
import { Icon, InsightCard, Pill, appStyle } from '@/components/ui';
import { countryName, deviceName, diff, median, num, pageName, pctChange, plural } from '@/lib/format';
import { getReport } from '@/lib/report';
import { siteByKey } from '@/lib/sites';
import { addDays, rangeText, when } from '@/lib/time';

export const dynamic = 'force-dynamic';

const DASH = 'https://vercel.com/rafals-projects-ecbcd9de';

export default async function AppPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ day?: string }> }) {
  const { key } = await params;
  const { day } = await searchParams;
  if (!siteByKey(key)) notFound();
  const r = await getReport();
  const s = r.sites.find((x) => x.key === key);
  if (!s) notFound();

  const ch = pctChange(s.week, s.lastWeek);
  const typical = median(s.days.slice(0, -1).map((d) => d.visitors));
  const insights = r.insights.filter((i) => i.site === key);
  const spike = insights.find((i) => i.id.startsWith('spike:'));
  const range = rangeText(addDays(r.today, -7), addDays(r.today, -1));
  const maxSrc = Math.max(1, ...s.sources.map((x) => x.visitors));
  const maxPage = Math.max(1, ...s.pages.map((x) => x.visitors));
  const maxC = Math.max(1, ...s.countries.map((x) => x.visitors));
  const allDev = s.devices.reduce((a, d) => a + d.visitors, 0) || 1;
  const yd = s.yesterdayByNow === null ? null : diff(s.today, s.yesterdayByNow);

  return (
    <div className="appc stack" style={{ ...appStyle(s), gap: 14 }}>
      <div className="top" style={{ justifyContent: 'space-between' }}>
        <Link href="/" className="back">
          <Icon name="back" size={20} />
          HQ
        </Link>
        <a className="round" href={s.url} target="_blank" rel="noreferrer" aria-label={`Open ${s.sub}`}>
          <Icon name="open" size={18} />
        </a>
      </div>

      <div className="apphead">
        <span className="tile" aria-hidden="true">
          {s.initial}
        </span>
        <div>
          <h1>{s.name}</h1>
          <small>
            {s.sub} · {range}
          </small>
        </div>
      </div>

      {s.status !== 'ok' ? (
        <section className="setup">
          <h2>{s.status === 'not-counting' ? 'Not counting visits yet' : s.status === 'no-token' ? 'Waiting for the Vercel token' : 'Couldn’t read it just now'}</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>
            {s.status === 'not-counting'
              ? `${s.name} is live, but Vercel Web Analytics isn’t switched on for it, so HQ has nothing to show. In Vercel: the ${s.vercelName} project, Analytics, Enable. If the site’s code doesn’t have the analytics script yet, ask Claude to add it.`
              : s.status === 'no-token'
                ? 'Add VERCEL_ACCESS_TOKEN to the rafal-hq project (see Today).'
                : s.error}
          </p>
          {s.status === 'not-counting' ? (
            <a className="btn solid" href={`${DASH}/${s.vercelName}/analytics`} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
              Open its Analytics in Vercel
            </a>
          ) : null}
        </section>
      ) : (
        <>
          <div className="hero">
            <b>{num(s.week)}</b>
            <span>visitors in the 7 days to yesterday</span>
            {ch ? <Pill tone={ch.tone}>{ch.text === 'Same' ? 'Same as the week before' : `${ch.text} on the week before (${s.lastWeek})`}</Pill> : null}
          </div>
          {spike ? <p className="callout">{spike.body}</p> : null}

          <div className="facts">
            <div className="fact">
              <b>{s.today}</b>
              <span>today so far{yd ? `, ${yd.text} on yesterday by now` : ''}</span>
            </div>
            <div className="fact">
              <b>{s.yesterday}</b>
              <span>yesterday</span>
            </div>
            <div className="fact">
              <b>{num(s.weekViews)}</b>
              <span>pages opened, 7 days</span>
            </div>
            {s.homeOnly !== null && s.week ? (
              <div className="fact">
                <b>{Math.round((s.homeOnly / s.week) * 100)}%</b>
                <span>saw only the home page</span>
              </div>
            ) : null}
            {s.extras.map((x) => (
              <div key={x.key} className="fact">
                <b>{x.week}</b>
                <span>
                  {x.label}
                  {x.last ? ` (${x.last} the week before)` : ''}
                </span>
              </div>
            ))}
          </div>

          <SiteDays days={s.days.slice(-15)} start={day} typical={typical} />

          {insights.filter((i) => !i.id.startsWith('spike:')).map((i) => (
            <InsightCard key={i.id} i={i} />
          ))}

          {key === 'rafcarpentry' && r.leads ? (
            <section aria-label="Getting in touch" className="pulse grid-bg">
              <div className="head">
                <h2 style={{ margin: 0, fontSize: 18 }}>Getting in touch</h2>
                <span style={{ color: 'var(--pulse-muted)' }}>{plural(r.leads.rafsite.reduce((a, g) => a + g.week, 0), 'tap')} · 7 days</span>
              </div>
              <ul className="rows">
                {r.leads.rafsite.filter((g) => g.week || g.last).map((g) => (
                  <li key={g.goal}>
                    <span>{g.label}</span>
                    <b>
                      {g.week}
                      <small style={{ color: 'var(--pulse-muted)' }}>{g.last ? `was ${g.last}` : ''}</small>
                    </b>
                    <span className="track" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <span className="fill" style={{ width: `${Math.round((g.week / Math.max(1, ...r.leads!.rafsite.map((x) => x.week))) * 100)}%`, background: g.goal === 'quote' ? '#ffe45c' : '#7d97ff' }} />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="foot" style={{ border: 0, padding: 0 }}>
                Taps on the buttons. Finished briefs land in ServiceM8 and the Job Kit.
              </p>
            </section>
          ) : null}

          {key === 'cabinetos' && r.leads ? (
            <section aria-label="Accounts" className="card">
              <div className="head">
                <h2>Accounts</h2>
                <span>{plural(r.leads.cabinetos.accounts, 'account')} in all</span>
              </div>
              <div className="facts">
                <div className="fact">
                  <b>{r.leads.cabinetos.signupsWeek}</b>
                  <span>sign-ups, 7 days{r.leads.cabinetos.signupsLast ? ` (${r.leads.cabinetos.signupsLast} the week before)` : ''}</span>
                </div>
                <div className="fact">
                  <b>{r.leads.cabinetos.payingTotal}</b>
                  <span>paying now</span>
                </div>
              </div>
              {r.leads.cabinetos.paying.length ? (
                <div className="chips">
                  {r.leads.cabinetos.paying.map((p) => (
                    <span key={p.plan + p.status} className="chip">
                      {p.n} {p.plan[0].toUpperCase() + p.plan.slice(1)}
                      {p.status === 'active' ? '' : ` (${p.status.replace('_', ' ')})`}
                    </span>
                  ))}
                </div>
              ) : null}
              {r.leads.cabinetos.sketchupWeek.length ? (
                <p className="note">
                  SketchUp extension, 7 days: {r.leads.cabinetos.sketchupWeek.map((x) => `${x.n} ${x.action === 'download' ? 'downloads' : x.action === 'connect' ? 'sign-ins' : x.action === 'send' ? 'sent to CabinetOS' : x.action === 'exercise' ? 'exercises passed' : x.action}`).join(' · ')}
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="split2">
            <section aria-label="Where they came from" className="card" id="sources">
              <div className="head">
                <h2>Where they came from</h2>
                <span>Links, 7 days</span>
              </div>
              {s.sources.length ? (
                <ul className="rows">
                  {s.sources.slice(0, 8).map((x) => (
                    <li key={x.key}>
                      <span>
                        {x.name}
                        {x.isNew ? (
                          <span className="new" style={{ marginInlineStart: 8 }}>
                            New
                          </span>
                        ) : null}
                      </span>
                      <b>{x.visitors}</b>
                      <span className="track">
                        <span className="fill" style={{ width: `${Math.round((x.visitors / maxSrc) * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No links from other sites this week.</p>
              )}
              <p className="note">Everyone else typed the address or used a saved link.</p>
            </section>

            <section aria-label="Most viewed pages" className="card" id="pages">
              <div className="head">
                <h2>Most viewed pages</h2>
                <span>People, 7 days</span>
              </div>
              <ol className="ranked">
                {s.pages.filter((p) => p.path !== 'Others').slice(0, 8).map((p, i) => (
                  <li key={p.path}>
                    <span className="bg" style={{ width: `${Math.round((p.visitors / maxPage) * 100)}%` }} aria-hidden="true" />
                    <span className="r">{i + 1}</span>
                    <span className="p">{pageName(p.path)}</span>
                    <b>{p.visitors}</b>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="split2">
            <section aria-label="Countries" className="card">
              <div className="head">
                <h2>Where they are</h2>
                <span>7 days</span>
              </div>
              <ul className="rows">
                {s.countries.map((c) => (
                  <li key={c.name}>
                    <span>{countryName(c.name)}</span>
                    <b>{c.visitors}</b>
                    <span className="track">
                      <span className="fill" style={{ width: `${Math.round((c.visitors / maxC) * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Devices" className="card">
              <div className="head">
                <h2>On what</h2>
                <span>7 days</span>
              </div>
              <ul className="rows">
                {s.devices.map((d) => (
                  <li key={d.name}>
                    <span>{deviceName(d.name)}</span>
                    <b>
                      {Math.round((d.visitors / allDev) * 100)}%<small>{d.visitors}</small>
                    </b>
                    <span className="track">
                      <span className="fill" style={{ width: `${Math.round((d.visitors / allDev) * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}

      <section aria-label="Up and updates" className="card">
        <div className="health-row">
          <span className={`okdot${s.up && !s.up.ok ? ' bad' : ''}`} aria-hidden="true" />
          <b>{!s.up ? 'Not checked' : s.up.ok ? `Up · answered in ${s.up.ms} ms` : s.up.status ? `Answered ${s.up.status}` : 'Not answering'}</b>
        </div>
        {s.deploy ? (
          <p className="note">
            {s.deploy.state === 'READY' ? 'Last update went live' : s.deploy.state === 'ERROR' ? 'Last update failed' : `Last update: ${s.deploy.state.toLowerCase()}`} {when(s.deploy.at)}
            {s.deploy.message ? `: “${s.deploy.message}”` : ''}
          </p>
        ) : null}
        {keyNumbers(s, r).length ? <p className="note">7 days: {keyNumbers(s, r).join(' · ')}</p> : null}
      </section>
    </div>
  );
}

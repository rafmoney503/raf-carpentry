'use client';

import Link from 'next/link';
import { useState } from 'react';
import { diff, num, pctChange, plural, sum } from '@/lib/format';
import { clock, dayNumber, greeting, longDay, shortDay, when } from '@/lib/time';
import type { Report, SiteStats } from '@/lib/types';
import { AppCard, OffCard } from './apps';
import { Health } from './health';
import { Icon, InsightCard, Mark } from './ui';

type Range = 'today' | 'week';

export function Today({ r, now }: { r: Report; now: number }) {
  const [range, setRange] = useState<Range>('week');
  const wk = range === 'week';
  const counted = r.sites.filter((s) => s.status === 'ok');
  const off = r.sites.filter((s) => s.status !== 'ok');

  const total = sum(counted.map((s) => (wk ? s.week : s.today)));
  const before = wk ? sum(counted.map((s) => s.lastWeek)) : counted.every((s) => s.yesterdayByNow !== null) ? sum(counted.map((s) => s.yesterdayByNow ?? 0)) : null;
  const change = wk ? pctChange(total, before ?? 0) : before === null ? null : diff(total, before);
  const changeText = change ? (wk ? `${change.text === 'Same' ? 'Same as' : change.text + ' on'} the week before` : `${change.text} on yesterday by now`) : '';

  const taps = r.leads ? sum(r.leads.rafsite.map((g) => g.week)) : null;
  const signups = r.leads?.cabinetos.signupsWeek ?? null;
  const busiest = [...counted].sort((a, b) => (wk ? b.week - a.week : b.today - a.today))[0];

  const lead = !r.vercel
    ? 'Connect HQ to Vercel to see your visitors. Quote taps and sign-ups are below.'
    : wk
      ? [
          `${plural(total, 'person', 'people')} visited your sites in the 7 days to yesterday.`,
          taps ? `${plural(taps, 'tap')} to get in touch on rafcarpentry.com.` : '',
          signups ? `CabinetOS got ${plural(signups, 'new account')}.` : '',
        ].filter(Boolean).join(' ')
      : `${plural(total, 'person', 'people')} so far today${change ? `, ${change.text === 'same' ? 'the same as' : change.text + ' on'} yesterday by now` : ''}.${busiest && busiest.today ? ` ${busiest.name} is busiest.` : ''}`;

  const upCount = r.sites.filter((s) => s.up?.ok).length;

  return (
    <>
      <div className="top">
        <Link href="/" className="brand">
          <Mark />
          <span>
            <b>HQ</b>
            <small>Rafal Solutions</small>
          </span>
        </Link>
        <span className="stamp">Updated {clock(r.at)}</span>
        <a className="round" href="/?fresh=1" aria-label="Get the numbers again">
          <Icon name="refresh" size={18} />
        </a>
      </div>

      <div className="hello-row">
        <div className="hello">
          <p>{longDay(r.today)}</p>
          <h1>{greeting(new Date(now))}, Rafal</h1>
          <p className="lead">{lead}</p>
        </div>
        <div className="seg" role="group" aria-label="Time range">
          <button type="button" aria-pressed={!wk} onClick={() => setRange('today')}>
            Today
          </button>
          <button type="button" aria-pressed={wk} onClick={() => setRange('week')}>
            Last 7 days
          </button>
        </div>
      </div>

      {!r.vercel ? <ConnectVercel /> : null}
      {r.problems.map((p) => (
        <p key={p} className="problem">
          {p}
        </p>
      ))}

      <div className="kpis">
        <div className="kpi hot">
          <span className="t">Visitors, {wk ? '7 days to yesterday' : 'today'}</span>
          <span className="n">{r.vercel ? num(total) : '\u2013'}</span>
          <span className="n2">{r.vercel ? changeText || `${counted.length} sites counted` : 'Needs the Vercel token'}</span>
        </div>
        <div className="kpi">
          <span className="t">Getting in touch</span>
          <span className="n">{taps ?? '–'}</span>
          <span className="n2">Taps on rafcarpentry.com, 7 days</span>
        </div>
        <div className="kpi">
          <span className="t">New CabinetOS accounts</span>
          <span className="n">{signups ?? '–'}</span>
          <span className="n2">{r.leads ? `${r.leads.cabinetos.accounts} in all · ${r.leads.cabinetos.payingTotal} paying` : '7 days'}</span>
        </div>
        <div className="kpi">
          <span className="t">Sites up</span>
          <span className="n">
            {upCount} of {r.sites.length}
          </span>
          <span className="n2">Checked {clock(r.at)}</span>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          {r.vercel ? (
            <section aria-label="Visitors" className="pulse grid-bg">
              <div className="head">
                <span className="lbl">Visitors · {wk ? 'last 7 days' : 'today'}</span>
                {changeText ? <span className="pill y">{changeText}</span> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span className="big">{num(total)}</span>
                <span style={{ fontSize: 15, color: 'var(--pulse-muted)' }}>people across {plural(counted.length, 'site')}</span>
              </div>
              <div className="stacked" role="img" aria-label={counted.map((s) => `${s.name} ${wk ? s.week : s.today}`).join(', ')}>
                {counted.map((s) => (
                  <span key={s.key} style={{ flex: `${Math.max(wk ? s.week : s.today, 0.0001)} 1 0`, background: s.light }} />
                ))}
              </div>
              <ul className="legend">
                {counted.map((s) => {
                  const v = wk ? s.week : s.today;
                  const c = wk ? pctChange(s.week, s.lastWeek) : s.yesterdayByNow === null ? null : diff(s.today, s.yesterdayByNow);
                  return (
                    <li key={s.key}>
                      <span className="sq" style={{ background: s.light }} aria-hidden="true" />
                      <span style={{ marginInlineEnd: 'auto' }}>{s.name}</span>
                      {c ? <span className={`ch tone-${c.tone}`}>{wk ? (c.text === 'Same' ? 'same as before' : c.text) : `${c.text} on yesterday`}</span> : null}
                      <b>{num(v)}</b>
                    </li>
                  );
                })}
              </ul>
              <DayChart sites={counted} />
              {off.length ? <p className="foot">{off.map((s) => s.name).join(' and ')} {off.length === 1 ? 'isn’t' : 'aren’t'} counted yet.</p> : null}
            </section>
          ) : null}
          <div className="desk-only">
            <Health r={r} />
          </div>
        </div>

        <div className="stack">
          <div className="section">
            <h2>Worth knowing</h2>
            <span>{r.insights.length ? plural(r.insights.length, 'thing') : 'All quiet'}</span>
          </div>
          {r.insights.length ? (
            r.insights.slice(0, 6).map((i) => <InsightCard key={i.id} i={i} />)
          ) : (
            <p className="empty">Nothing stands out today. HQ looks every few minutes.</p>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Your apps</h2>
        <span>{wk ? 'Visitors, 7 days to yesterday' : 'Visitors today'}</span>
      </div>
      <div className="apps-grid">
        {counted.map((s) => (
          <AppCard key={s.key} s={s} r={r} range={range} />
        ))}
      </div>
      {off.length ? <OffCard sites={off} /> : null}

      <div className="phone-only">
        <Health r={r} />
      </div>
      <p className="stamp" style={{ textAlign: 'center' }}>
        Numbers from {when(r.at, new Date(now))}. Days run midnight to midnight UK time.
      </p>
    </>
  );
}

/* On a computer: the last 14 days of every counted site, stacked. Tap a day. */
function DayChart({ sites }: { sites: SiteStats[] }) {
  const days = sites[0]?.days.slice(-14) ?? [];
  const [sel, setSel] = useState(days.length - 1);
  if (!days.length) return null;
  const totals = days.map((_, i) => sum(sites.map((s) => s.days.slice(-14)[i]?.visitors ?? 0)));
  const max = Math.max(1, ...totals);
  const d = days[sel];
  return (
    <div className="desk-only" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
      <p className="readout" aria-live="polite">
        <b>{totals[sel]}</b>
        <span>
          {shortDay(d.day)}
          {sel === days.length - 1 ? ', so far' : ''}
        </span>
        <em>{sites.map((s) => `${s.name} ${s.days.slice(-14)[sel]?.visitors ?? 0}`).join(' · ')}</em>
      </p>
      <div className="daychart" style={{ height: 200 }}>
        {days.map((day, i) => (
          <button key={day.day} type="button" aria-pressed={i === sel} aria-label={`${shortDay(day.day)}: ${totals[i]} visitors`} onClick={() => setSel(i)} style={{ height: 200 }}>
            {[...sites].reverse().map((s, j) => {
              const v = s.days.slice(-14)[i]?.visitors ?? 0;
              return <span key={s.key} style={{ height: Math.round((v / max) * 184), background: s.light }} />;
            })}
          </button>
        ))}
      </div>
      <div className="daylabels" aria-hidden="true">
        {days.map((day, i) => (
          <span key={day.day} className={i === sel ? 'on' : undefined}>
            {dayNumber(day.day)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ConnectVercel() {
  return (
    <section className="setup">
      <h2>Connect HQ to Vercel</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>HQ reads your visitors with a Vercel token that can only read. It takes a minute:</p>
      <ol>
        <li>
          Open{' '}
          <a href="https://vercel.com/account/settings/tokens" target="_blank" rel="noreferrer">
            vercel.com/account/settings/tokens
          </a>{' '}
          and create a token called HQ, scope Rafal&apos;s projects.
        </li>
        <li>In the rafal-hq project: Settings, Environment Variables, add VERCEL_ACCESS_TOKEN with the token, Production, Sensitive.</li>
        <li>Redeploy rafal-hq (or tell Claude), then open HQ again.</li>
      </ol>
    </section>
  );
}

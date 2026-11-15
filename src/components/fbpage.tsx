'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FbDay, FbProgress } from '@/lib/fbprogress';
import { daysAgo, signed } from '@/lib/fbprogress';
import type { PageReport } from '@/lib/fbpage-types';
import { plural } from '@/lib/format';
import { shortDay, dayNumber } from '@/lib/time';
import { FB_STYLE, PagePic, fbProblem } from './fbparts';

/* The followers a day, from the first day counted. Tap a day. */
export function FbFollowers({ days, since }: { days: FbDay[]; since: string | null }) {
  const last = days.length - 1;
  const [sel, setSel] = useState(last);
  const d = days[sel];
  if (!d) return null;
  const max = Math.max(1, ...days.map((x) => x.followers ?? 0));
  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  return (
    <section aria-label="Followers a day" className="card">
      <div className="head">
        <h2>Followers a day</h2>
        <span>{days.length > 1 ? 'Tap a day' : ''}</span>
      </div>
      <p className="readout" aria-live="polite">
        <b>{d.followers ?? '–'}</b>
        <span>
          {shortDay(d.day)}
          {sel === last ? ', now' : ''}
        </span>
        <em>{d.gained === null ? (d.day === since ? 'the first day counted' : 'not counted that day') : d.gained === 0 ? 'no new followers' : `${signed(d.gained)} that day`}</em>
      </p>
      <div className="daychart" style={{ height: 120, ...cols }}>
        {days.map((x, i) => (
          <button key={x.day} type="button" aria-pressed={i === sel} aria-label={`${shortDay(x.day)}: ${x.followers ?? 'not counted'}`} onClick={() => setSel(i)} style={{ height: 120 }}>
            <span
              className="top-bar"
              style={{
                height: x.followers === null ? 3 : Math.max(4, Math.round((x.followers / max) * 112)),
                background: x.followers === null ? 'var(--dim-bar)' : i === last ? 'var(--app)' : 'color-mix(in srgb, var(--app) 55%, var(--card))',
              }}
            />
          </button>
        ))}
      </div>
      <div className="daylabels" aria-hidden="true" style={cols}>
        {days.map((x, i) => (
          <span key={x.day} className={i === sel ? 'on' : undefined}>
            {days.length > 16 && i % 3 && i !== last ? '' : dayNumber(x.day)}
          </span>
        ))}
      </div>
      {days.length < 4 && since ? (
        <p className="note">Counting since {shortDay(since)}. HQ and the Job Kit keep one count a day, so this fills in as the days go.</p>
      ) : null}
    </section>
  );
}

/* The card on Today and on the CabinetOS page: where the Page is, and what wants Rafal. */
export function FbCard({ r, p }: { r: PageReport; p: FbProgress }) {
  const name = r.page?.name ?? 'Cabinet OS';
  return (
    <Link href="/facebook" className="app appc fb-card" style={FB_STYLE} aria-label={`${name} on Facebook: ${p.followers ?? 0} followers. See its progress`}>
      <div className="app-row">
        <PagePic r={r} size={40} />
        <span className="app-name">
          <b>{name} on Facebook</b>
          <small>{p.dayN ? `Day ${p.dayN}` : 'Facebook Page'}{p.lastPost ? ` · last post ${daysAgo(p.lastPost.days)}` : ' · no posts yet'}</small>
        </span>
        <span className="app-num">
          <b>{p.followers ?? '–'}</b>
          {p.week && p.week.change ? <span className={`pill ${p.week.change > 0 ? 'up' : 'down'}`}>{signed(p.week.change)} {p.week.full ? 'this week' : 'so far'}</span> : <span className="pill flat">followers</span>}
        </span>
      </div>
      {p.next ? (
        <div className="fb-bar" role="img" aria-label={`${p.next.left} more to ${p.next.at} followers`}>
          <span style={{ width: `${Math.max(2, Math.round(p.next.share * 100))}%` }} />
        </div>
      ) : null}
      <p className="fb-line">
        {p.next ? `${p.next.left} more to ${p.next.at}` : ''}
        {p.toAnswer.length ? (
          <>
            {' · '}
            <b>{plural(p.toAnswer.length, 'comment')} to answer</b>
          </>
        ) : null}
        <span className="fb-go" aria-hidden="true">
          See its progress →
        </span>
      </p>
    </Link>
  );
}

/* What Today and the CabinetOS page get: the Page and its sums, or why it couldn't be read. */
export type FbShown = { ok: true; r: PageReport; p: FbProgress } | { ok: false; state: string; detail?: string; pages?: string[] };

/* Today's card: the Page when it could be read, else a line saying what's wrong (both open the section). */
export function FbShortCard({ fb }: { fb: FbShown }) {
  if (fb.ok) return <FbCard r={fb.r} p={fb.p} />;
  const s = fbProblem(fb.state, fb.detail, fb.pages);
  return (
    <Link href="/facebook" className="app appc fb-card" style={FB_STYLE}>
      <div className="app-row">
        <span className="tile" aria-hidden="true">
          C
        </span>
        <span className="app-name">
          <b>Cabinet OS on Facebook</b>
          <small>{s.h}</small>
        </span>
      </div>
      <p className="fb-line">
        <span className="fb-go" aria-hidden="true">
          See what to do →
        </span>
      </p>
    </Link>
  );
}

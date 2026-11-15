import Link from 'next/link';
import type { AdsReport } from '@/lib/ads-types';
import { adSums, adsProblem, draftGroups, money } from '@/lib/adsums';
import { plural } from '@/lib/format';
import { appStyle } from './ui';

/* The parts of HQ's Ads section with no state, usable on the server and in the browser. Meta's own blue. */
export const ADS_STYLE = appStyle({ color: '#0866ff', light: '#5c9dff', ink: '#ffffff' });

export function AdsSetup({ state, detail }: { state: string; detail?: string }) {
  const s = adsProblem(state, detail);
  return (
    <section className="setup" data-ads-setup={state}>
      <h2>{s.h}</h2>
      <ol>
        {s.steps.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ol>
      {s.kit ? (
        <a className="btn solid" href="https://www.rafcarpentry.com/job-kit?social=open" target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>
          Open the Job Kit
        </a>
      ) : null}
    </section>
  );
}

/* Today's card: the week's ads for both businesses, or the drafts waiting, or what to do first. */
export type AdsShown = { ok: true; r: AdsReport } | { ok: false; state: string };
export function AdsShortCard({ ads }: { ads: AdsShown }) {
  const r = ads.ok ? ads.r : null;
  const waiting = r ? draftGroups(r.drafts, 'both').waiting.length : 0;
  const s = r?.state === 'ok' ? adSums(r, 'both') : null;
  let line: string;
  let small: string;
  if (s && s.spend > 0) {
    const bits = [`${money(s.spend, r!.meta!.currency)} spent`, `${plural(s.clicks, 'click')}`];
    if (s.ours?.enquiries) bits.push(plural(s.ours.enquiries, 'enquiry', 'enquiries'));
    if (s.ours?.signups) bits.push(plural(s.ours.signups, 'sign-up'));
    small = `This week · ${plural(s.live.length, 'ad')} running`;
    line = bits.join(' · ');
  } else if (s) {
    small = 'No ads running this week';
    line = waiting ? `${plural(waiting, 'ad')} written for you to look at` : 'Write a few from your job photos';
  } else {
    small = r ? adsProblem(r.state, r.detail).h : adsProblem(ads.ok ? 'error' : ads.state).h;
    line = waiting ? `${plural(waiting, 'ad')} written for you to look at` : 'Ready ads from your job photos';
  }
  return (
    <Link href="/ads" className="app appc fb-card" style={ADS_STYLE} data-ads-card>
      <div className="app-row">
        <span className="tile" aria-hidden="true">
          Ad
        </span>
        <span className="app-name">
          <b>Facebook and Instagram ads</b>
          <small>{small}</small>
        </span>
        {s && s.spend > 0 && (s.perEnquiry !== null || s.perSignup !== null) ? (
          <span className="app-num">
            <b>{money((s.perEnquiry ?? s.perSignup)!, r!.meta!.currency)}</b>
            <span className="pill flat">{s.perEnquiry !== null ? 'an enquiry' : 'a sign-up'}</span>
          </span>
        ) : null}
      </div>
      <p className="fb-line">
        {waiting && s && s.spend > 0 ? (
          <>
            {line} · <b>{plural(waiting, 'new ad')} to look at</b>
          </>
        ) : (
          line
        )}
        <span className="fb-go" aria-hidden="true">
          Open ads →
        </span>
      </p>
    </Link>
  );
}

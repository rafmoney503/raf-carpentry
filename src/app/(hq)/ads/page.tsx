import Link from 'next/link';
import { AdDays, DraftCard, WriteAds } from '@/components/ads';
import { ADS_STYLE, AdsSetup } from '@/components/adsparts';
import { Icon, Pill } from '@/components/ui';
import { getAds } from '@/lib/ads';
import type { AdRow, AdsReport } from '@/lib/ads-types';
import { BUSINESS_NAME, PICKS, RESULT_MANY, adSums, draftGroups, money, pct, statusWords, type Pick } from '@/lib/adsums';
import { num, pctChange, plural } from '@/lib/format';
import { rangeText, when } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* Facebook and Instagram ads for both businesses (15 Nov 2026, Raf: 'create another section for ads for facebook
   and instagram as i need to push hard', then 'Both' and 'Results + ready ads'). The results from Meta (spend, reach,
   clicks, the best ad, Facebook against Instagram, every campaign and ad), what they brought (enquiries on
   rafcarpentry.com, sign-ups on CabinetOS, from the website counters), and the ads Claude writes from the job photos
   for Rafal to approve. Read through rafcarpentry.com (src/lib/ads.ts); nothing here changes an ad or spends money. */
export default async function AdsPage({ searchParams }: { searchParams: Promise<{ b?: string; days?: string; fresh?: string }> }) {
  const q = await searchParams;
  const pick: Pick = q.b === 'raf' || q.b === 'cabinetos' ? q.b : 'both';
  const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  const res = await getAds(days, q.fresh === '1');
  const href = (o: { b?: Pick; days?: number }) => {
    const p = new URLSearchParams();
    const b = o.b ?? pick;
    const d = o.days ?? days;
    if (b !== 'both') p.set('b', b);
    if (d !== 30) p.set('days', String(d));
    const s = p.toString();
    return `/ads${s ? `?${s}` : ''}`;
  };

  return (
    <div className="appc stack" style={{ ...ADS_STYLE, gap: 14 }}>
      <div className="top" style={{ justifyContent: 'space-between' }}>
        <Link href="/" className="back">
          <Icon name="back" size={20} />
          HQ
        </Link>
        <span style={{ display: 'flex', gap: 8 }}>
          <a className="round" href={`${href({})}${href({}).includes('?') ? '&' : '?'}fresh=1`} aria-label="Get the numbers again">
            <Icon name="refresh" size={18} />
          </a>
          <a className="round" href="https://adsmanager.facebook.com" target="_blank" rel="noreferrer" aria-label="Open Meta Ads Manager">
            <Icon name="open" size={18} />
          </a>
        </span>
      </div>

      <div className="apphead">
        <span className="tile" aria-hidden="true">
          Ad
        </span>
        <div>
          <h1>Ads</h1>
          <small>Facebook and Instagram · {pick === 'both' ? 'Raf Carpentry and CabinetOS' : BUSINESS_NAME[pick]}</small>
        </div>
      </div>

      <div className="adx-pickers">
        <nav className="adx-seg adx-seg3" aria-label="Which business">
          {PICKS.map((p) => (
            <Link key={p.key} href={href({ b: p.key })} aria-current={pick === p.key ? 'page' : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
        <nav className="adx-seg adx-seg3" aria-label="Which days">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={href({ days: d })} aria-current={days === d ? 'page' : undefined}>
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      {!res.ok ? <AdsSetup state={res.why === 'not-set-up' ? 'hq-not-set-up' : 'error'} detail={res.detail} /> : <Body r={res.report} pick={pick} />}
    </div>
  );
}

function Body({ r, pick }: { r: AdsReport; pick: Pick }) {
  const s = adSums(r, pick);
  const cur = r.meta?.currency ?? 'GBP';
  const g = draftGroups(r.drafts, pick);
  const change = s.before ? pctChange(s.spend, s.before.spend) : null;
  const showRaf = pick !== 'cabinetos';
  const showCos = pick !== 'raf';

  return (
    <>
      {r.state !== 'ok' ? <AdsSetup state={r.state} detail={r.detail} /> : null}

      {r.state === 'ok' ? (
        <>
          <div className="hero">
            <b>{money(s.spend, cur)}</b>
            <span>
              spent {rangeText(r.since, r.until)}
              {s.live.length ? `, ${plural(s.live.length, 'ad')} running now` : ''}
            </span>
            {change ? <Pill tone="flat">{change.text} on the {r.days} days before</Pill> : null}
          </div>

          <div className="facts">
            <div className="fact">
              <b>{num(s.clicks)}</b>
              <span>
                link clicks{s.cpc !== null ? `, ${money(s.cpc, cur)} each` : ''}
              </span>
            </div>
            <div className="fact">
              <b>{num(s.reach)}</b>
              <span>
                {s.reachAdded && s.ads.length > 1 ? 'people reached (up to)' : 'people reached'}
                {s.ctr !== null ? `, ${pct(s.ctr)} clicked` : ''}
              </span>
            </div>
            {showRaf ? (
              <div className="fact" data-fact="enquiries">
                <b>{s.ours ? num(oursFor(r, 'raf').enquiries) : '–'}</b>
                <span>{s.perEnquiry !== null ? `enquiries, ${money(s.perEnquiry, cur)} each` : 'enquiries from ads'}</span>
              </div>
            ) : null}
            {showCos ? (
              <div className="fact" data-fact="signups">
                <b>{s.ours ? num(oursFor(r, 'cabinetos').signups) : '–'}</b>
                <span>{s.perSignup !== null ? `CabinetOS sign-ups, ${money(s.perSignup, cur)} each` : 'CabinetOS sign-ups from ads'}</span>
              </div>
            ) : null}
            {pick !== 'both' ? (
              <div className="fact">
                <b>{s.live.length}</b>
                <span>{s.live.length === 1 ? 'ad running now' : 'ads running now'}</span>
              </div>
            ) : null}
          </div>
          {s.meta ? <p className="adx-meta">Meta also counts {num(s.meta.n)} {RESULT_MANY[s.meta.kind]}.</p> : null}

          {s.spend > 0 || s.ads.length ? <AdDays days={s.days} currency={cur} pick={pick} /> : null}

          {s.best ? (
            <section className="card" aria-label="Best ad">
              <div className="head">
                <h2>Best ad</h2>
                <span>{s.best.why}</span>
              </div>
              <AdLine a={s.best.ad} cur={cur} big />
            </section>
          ) : null}

          {s.places && s.places.some((p) => p.spend > 0) ? <Places r={r} /> : null}

          <section className="card" aria-label="Ads">
            <div className="head">
              <h2>Ads</h2>
              <span>{s.ads.length ? `${plural(s.ads.length, 'ad')} · ${plural(s.campaigns.length, 'campaign')}` : 'None yet'}</span>
            </div>
            {s.ads.length ? (
              <ul className="adx-ads">
                {s.ads.map((a) => (
                  <li key={a.id}>
                    <AdLine a={a} cur={cur} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">
                {pick === 'both' ? 'No ads in your ad account yet.' : `No ${BUSINESS_NAME[pick]} ads yet.`} Approve one of the ads below and make it in Ads Manager: it shows here with its numbers once it runs.
              </p>
            )}
            {r.meta && r.meta.accounts.length ? (
              <p className="note">
                {r.meta.accounts.length === 1 ? 'Ad account' : 'Ad accounts'}: {r.meta.accounts.map((a) => `${a.name}${a.active ? '' : ' (not active)'}`).join(', ')}.
                {s.ads.some((a) => !a.business) ? ' Ads whose link goes to neither site, and whose campaign name says neither, count under Both only.' : ''}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      <Organic r={r} pick={pick} />

      <div className="section">
        <h2>Ready ads</h2>
        <span>{g.waiting.length ? `${g.waiting.length} to look at` : 'Written from your photos'}</span>
      </div>
      {r.draftsError ? <p className="problem">The ads written so far couldn’t be read just now. HQ tries again in a minute.</p> : null}
      <WriteAds pick={pick} canWrite={r.canWrite} />
      <div className="adx-drafts">
        {[...g.live, ...g.waiting, ...g.approved].map((d) => (
          <DraftCard key={d.id} d={d} open={d.status === 'approved' && !d.live} />
        ))}
      </div>
      {!g.live.length && !g.waiting.length && !g.approved.length ? <p className="empty">No ads written yet. Tap Write 3 ads and they come here, each with its picture, words and who to show it to.</p> : null}
      {g.no.length ? (
        <details className="adx-folded">
          <summary>Not for me ({g.no.length})</summary>
          <div className="adx-drafts">
            {g.no.map((d) => (
              <DraftCard key={d.id} d={d} />
            ))}
          </div>
        </details>
      ) : null}

      <p className="stamp" style={{ textAlign: 'center' }}>
        Read {when(r.at)}
        {r.who ? ` with ${r.who}’s Facebook login` : ''}. Ads and money from Meta; enquiries and sign-ups from the website counters, by the ads’ URL parameters. HQ only reads: making, pausing or paying for an ad happens in Ads Manager.
      </p>
    </>
  );
}

function oursFor(r: AdsReport, b: 'raf' | 'cabinetos') {
  return adSums(r, b).ours ?? { visits: 0, enquiries: 0, signups: 0, fb: 0, ig: 0, untagged: 0, untaggedEnq: 0, untaggedSignups: 0 };
}

function AdLine({ a, cur, big = false }: { a: AdRow; cur: string; big?: boolean }) {
  const st = statusWords(a.status);
  const ctr = a.impressions ? (a.clicks / a.impressions) * 100 : null;
  return (
    <div className={`fbpost${big ? ' fbpost-lg' : ''}`} data-ad={a.id}>
      {a.thumb ? <img src={a.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="fbpost-none" aria-hidden="true" />}
      <span className="fbpost-body">
        <span className="fbpost-when">
          <span className={`adx-st${st.on ? ' on' : st.bad ? ' bad' : ''}`}>{st.text}</span>
          {a.business ? ` · ${BUSINESS_NAME[a.business]}` : ''} · {a.campaign || 'no campaign'}
        </span>
        <span className="fbpost-text">{a.headline || a.name}</span>
        <span className="fbpost-nums">
          <b>{money(a.spend, cur)}</b> · <b>{num(a.clicks)}</b> {a.clicks === 1 ? 'click' : 'clicks'}
          {a.clicks ? ` (${money(a.spend / a.clicks, cur)} each)` : ''}
          {ctr !== null ? ` · ${pct(ctr)} clicked` : ''}
          {a.result && a.result.kind !== 'landing' ? ` · ${num(a.result.n)} ${RESULT_MANY[a.result.kind]}` : ''}
        </span>
      </span>
    </div>
  );
}

function Places({ r }: { r: AdsReport }) {
  const cur = r.meta!.currency;
  const rows = r.meta!.places.filter((p) => p.spend > 0 || p.clicks > 0);
  const total = rows.reduce((t, p) => t + p.spend, 0) || 1;
  const name: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Other apps (Audience Network)', other: 'Elsewhere' };
  return (
    <section className="card" aria-label="Facebook and Instagram">
      <div className="head">
        <h2>Where they showed</h2>
        <span>All ads</span>
      </div>
      <ul className="adx-places">
        {rows.map((p) => (
          <li key={p.place}>
            <span className="adx-place-top">
              <b>{name[p.place]}</b>
              <span>
                {money(p.spend, cur)} · {plural(p.clicks, 'click')}
                {p.clicks ? `, ${money(p.spend / p.clicks, cur)} each` : ''}
              </span>
            </span>
            <span className="fb-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(2, Math.round((p.spend / total) * 100))}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* What the website counters saw from Facebook and Instagram: with the ads' parameters, and without (posts, or an
   ad made without them). */
function Organic({ r, pick }: { r: AdsReport; pick: Pick }) {
  if (!r.ours) return r.oursError ? <p className="problem">The website counters didn’t answer just now: enquiries and sign-ups show again in a minute.</p> : null;
  const raf = oursFor(r, 'raf');
  const cos = oursFor(r, 'cabinetos');
  const rows: { name: string; ads: string; posts: string }[] = [];
  if (pick !== 'cabinetos')
    rows.push({
      name: 'rafcarpentry.com',
      ads: `${plural(raf.visits, 'visit')} from ads, ${plural(raf.enquiries, 'enquiry', 'enquiries')}`,
      posts: `${plural(raf.untagged, 'visit')} from posts and links, ${plural(raf.untaggedEnq, 'enquiry', 'enquiries')}`,
    });
  if (pick !== 'raf')
    rows.push({
      name: 'cabinetos.co.uk',
      ads: `${plural(cos.visits, 'visitor')} from ads, ${plural(cos.signups, 'sign-up')}`,
      posts: `${plural(cos.untagged, 'visitor')} from posts and links, ${plural(cos.untaggedSignups, 'sign-up')}`,
    });
  return (
    <section className="card" aria-label="What the websites saw" data-ours>
      <div className="head">
        <h2>On your websites</h2>
        <span>From Facebook and Instagram</span>
      </div>
      <ul className="adx-ours">
        {rows.map((x) => (
          <li key={x.name}>
            <b>{x.name}</b>
            <span>{x.ads}</span>
            <span className="note">{x.posts}</span>
          </li>
        ))}
      </ul>
      <p className="note">An enquiry is Send to Raf, WhatsApp, a call or an email tapped in that visit; a sign-up is a CabinetOS account made that day. Ads count here when they carry their URL parameters.</p>
    </section>
  );
}

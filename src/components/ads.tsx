'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CTA_LABEL, type AdDraft, type Business } from '@/lib/ads-types';
import { BUSINESS_NAME, money, statusWords, type DayRow, type Pick } from '@/lib/adsums';
import { plural } from '@/lib/format';
import { dayNumber, shortDay, when } from '@/lib/time';

const SITE = 'https://www.rafcarpentry.com';

/* Spend a day, with the clicks and what came of them. Tap a day. */
export function AdDays({ days, currency, pick }: { days: DayRow[]; currency: string; pick: Pick }) {
  const last = days.length - 1;
  const [sel, setSel] = useState(last);
  const d = days[sel];
  if (!d) return null;
  const max = Math.max(1, ...days.map((x) => x.spend));
  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };
  const got = [pick !== 'cabinetos' ? plural(d.enquiries, 'enquiry', 'enquiries') : '', pick !== 'raf' ? plural(d.signups, 'sign-up') : ''].filter(Boolean).join(', ');
  return (
    <section aria-label="Spent a day" className="card">
      <div className="head">
        <h2>Spent a day</h2>
        <span>Tap a day</span>
      </div>
      <p className="readout" aria-live="polite">
        <b>{money(d.spend, currency)}</b>
        <span>
          {shortDay(d.day)}
          {sel === last ? ', today' : ''}
        </span>
        <em>
          {plural(d.clicks, 'click')}, {got}
        </em>
      </p>
      <div className="daychart" style={{ height: 120, ...cols }}>
        {days.map((x, i) => (
          <button key={x.day} type="button" aria-pressed={i === sel} aria-label={`${shortDay(x.day)}: ${money(x.spend, currency)}`} onClick={() => setSel(i)} style={{ height: 120 }}>
            <span
              className="top-bar"
              style={{
                height: x.spend ? Math.max(4, Math.round((x.spend / max) * 104)) : 3,
                background: !x.spend ? 'var(--dim-bar)' : x.enquiries || x.signups ? 'var(--app)' : 'color-mix(in srgb, var(--app) 50%, var(--card))',
              }}
            />
          </button>
        ))}
      </div>
      <div className="daylabels" aria-hidden="true" style={cols}>
        {days.map((x, i) => (
          <span key={x.day} className={i === sel ? 'on' : undefined}>
            {days.length > 16 && i % (days.length > 40 ? 7 : 3) && i !== last ? '' : dayNumber(x.day)}
          </span>
        ))}
      </div>
      <p className="note">Full-colour bars: days that brought {pick === 'cabinetos' ? 'a sign-up' : pick === 'raf' ? 'an enquiry' : 'an enquiry or a sign-up'}.</p>
    </section>
  );
}

function Copy({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="adx-copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          },
          () => undefined,
        );
      }}
      aria-label={`Copy the ${label.toLowerCase()}`}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Field({ label, text, copy = true }: { label: string; text: string; copy?: boolean }) {
  if (!text) return null;
  return (
    <div className="adx-field">
      <div className="adx-field-top">
        <span>{label}</span>
        {copy ? <Copy label={label} text={text} /> : null}
      </div>
      <p>{text}</p>
    </div>
  );
}

async function send(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; detail?: string; drafts?: AdDraft[] }> {
  const res = await fetch('/api/ads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false, error: 'offline' };
  return (await res.json().catch(() => ({ ok: false, error: 'unreachable' }))) as { ok: boolean; error?: string; detail?: string };
}

const PROBLEM: Record<string, string> = {
  'not-set-up': 'Claude isn’t set up on rafcarpentry.com (ANTHROPIC_API_KEY).',
  'ai-key': 'The Claude key on rafcarpentry.com was turned down.',
  'ai-limit': 'Your Claude API credit has run out: top up in the Claude Console, then try again.',
  'ai-busy': 'Claude is busy. Try again in a minute.',
  'ai-error': 'Claude’s answer couldn’t be used. Try again.',
  store: 'The drafts store didn’t answer. Try again in a minute.',
  offline: 'No signal. Try again when you’re back online.',
  unreachable: 'rafcarpentry.com didn’t answer. Try again in a minute.',
  gone: 'That ad isn’t there any more.',
  bad: 'Something was wrong with that request.',
};

/* One ad Claude wrote: the picture and words as it would show, what to paste where, and Rafal's answer. */
export function DraftCard({ d, open = false }: { d: AdDraft; open?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const mark = async (status: 'new' | 'approved' | 'no') => {
    setBusy(status);
    setErr('');
    const r = await send({ action: 'mark', id: d.id, status });
    setBusy('');
    if (!r.ok) setErr(PROBLEM[r.error ?? ''] ?? PROBLEM.unreachable);
    else router.refresh();
  };
  const st = d.live ? statusWords(d.live.status) : null;
  const pageName = d.business === 'raf' ? 'Rafal Carpentry Services' : 'Cabinet OS';
  const insta = d.business === 'raf' ? '@rafcarpentry' : '@cabinetos';
  const host = d.page.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
  return (
    <article className={`adx-draft${d.status === 'no' ? ' adx-no' : ''}`} data-draft={d.id} data-status={d.live ? 'live' : d.status}>
      <div className="adx-top">
        <span className={`pill ${d.live ? (st!.on ? 'up' : 'flat') : d.status === 'approved' ? 'up' : d.status === 'no' ? 'down' : 'y'}`}>
          {d.live ? (st!.on ? 'Running' : st!.text) : d.status === 'approved' ? 'Approved' : d.status === 'no' ? 'Not for me' : 'New'}
        </span>
        <span className="adx-biz">{BUSINESS_NAME[d.business]}</span>
        {d.offer === 'black-friday' ? <span className="pill down">Black Friday only, 23 to 30 Nov</span> : null}
        <span className="adx-when">Written {when(d.at)}</span>
      </div>

      <div className="adx-preview" aria-label="How the ad looks">
        <div className="adx-who">
          <span className="adx-dot" aria-hidden="true">
            {pageName[0]}
          </span>
          <span>
            <b>{pageName}</b>
            <small>Sponsored</small>
          </span>
        </div>
        <p className="adx-text">{d.text}</p>
        <img
          src={`${SITE}${d.photo.src}`}
          alt={d.photo.alt}
          loading="lazy"
          className="adx-pic"
          // as a feed shows it: the picture's own shape, but no taller than 4:5 and no wider than 1.91:1
          style={{ aspectRatio: String(d.photo.w && d.photo.h ? Math.min(1.91, Math.max(0.8, d.photo.w / d.photo.h)) : 1) }}
        />
        <div className="adx-bar">
          <span>
            <small>{host.toUpperCase()}</small>
            <b>{d.headline}</b>
            {d.description ? <em>{d.description}</em> : null}
          </span>
          <span className="adx-cta">{CTA_LABEL[d.cta] ?? 'Learn more'}</span>
        </div>
      </div>

      {d.live ? (
        <p className="adx-live" data-live>
          In Ads Manager as “{d.live.name}”: {money(d.live.spend)} spent, {plural(d.live.clicks, 'click')} in this period.
        </p>
      ) : null}

      <p className="adx-angle">
        <b>Why it should work:</b> {d.angle}
      </p>
      <div className="adx-aud">
        <span>
          <b>Who to show it to</b> {d.audience.where}
          {d.audience.ages ? `, ages ${d.audience.ages}` : ''}
        </span>
        {d.audience.interests.length ? (
          <span className="chips">
            {d.audience.interests.map((x) => (
              <span key={x} className="chip">
                {x}
              </span>
            ))}
          </span>
        ) : null}
        {d.audience.note ? <span className="note">{d.audience.note}</span> : null}
      </div>

      {d.status !== 'no' ? (
        <details className="adx-how" open={open}>
          <summary>{d.status === 'approved' ? 'Make it in Ads Manager: what to paste where' : 'What to paste where in Ads Manager'}</summary>
          <ol>
            <li>
              In Ads Manager: <b>Create</b>, then <b>Traffic</b> (it sends people to the page), Continue.
            </li>
            <li>
              Ad set: Location <b>{d.audience.where}</b>
              {d.audience.ages ? (
                <>
                  , age <b>{d.audience.ages}</b>
                </>
              ) : null}
              {d.audience.interests.length ? ', and the interests above under Detailed targeting' : ''}. Budget: start with <b>£5 a day for 7 days</b> (£35), then keep the ads that bring{' '}
              {d.business === 'raf' ? 'enquiries' : 'sign-ups'} and stop the rest.
            </li>
            <li>
              Ad: Facebook Page <b>{pageName}</b>, Instagram <b>{insta}</b>. Media: the picture (
              <a href={`${SITE}${d.photo.src}`} target="_blank" rel="noreferrer">
                open it
              </a>
              , then save it).
            </li>
          </ol>
          <Field label="Primary text" text={d.text} />
          <Field label="Headline" text={d.headline} />
          <Field label="Description" text={d.description} />
          <Field label="Call to action" text={CTA_LABEL[d.cta] ?? 'Learn more'} copy={false} />
          <Field label="Website URL" text={d.page} />
          <Field label="URL parameters (under Tracking)" text={d.params} />
          <p className="note">The URL parameters let HQ count the visits, enquiries and sign-ups each ad brings, and find the ad here once it runs. Meta only charges once you press Publish in Ads Manager.</p>
        </details>
      ) : null}

      <div className="adx-btns">
        {d.status === 'new' ? (
          <>
            <button type="button" className="btn solid" disabled={!!busy} onClick={() => void mark('approved')}>
              {busy === 'approved' ? 'Saving…' : 'Approve'}
            </button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => void mark('no')}>
              {busy === 'no' ? 'Saving…' : 'Not for me'}
            </button>
          </>
        ) : (
          <button type="button" className="btn" disabled={!!busy} onClick={() => void mark('new')}>
            {busy ? 'Saving…' : d.status === 'approved' ? 'Undo approve' : 'Bring it back'}
          </button>
        )}
      </div>
      {err ? (
        <p className="problem" role="alert">
          {err}
        </p>
      ) : null}
    </article>
  );
}

/* Ask Claude for new ads from the job photos (Raf Carpentry) or CabinetOS's screens. */
export function WriteAds({ pick, canWrite }: { pick: Pick; canWrite: boolean }) {
  const router = useRouter();
  const [business, setBusiness] = useState<Business>(pick === 'cabinetos' ? 'cabinetos' : 'raf');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    const r = await send({ action: 'write', business, count: 3, note });
    setBusy(false);
    if (!r.ok) {
      setErr(`${PROBLEM[r.error ?? ''] ?? PROBLEM.unreachable}${r.detail && r.error === 'ai-error' ? ` (${r.detail})` : ''}`);
      return;
    }
    setNote('');
    setMsg(`${plural(r.drafts?.length ?? 0, 'new ad')} for ${BUSINESS_NAME[business]}, at the top of the list.`);
    router.refresh();
  };
  return (
    <section className="card adx-write" aria-label="Write new ads">
      <div className="head">
        <h2>Write new ads</h2>
        <span>3 at a time, about a minute</span>
      </div>
      <p>Claude looks at your job photos (or CabinetOS’s screens), picks the best and writes the words, who to show them to and why. Nothing is posted or paid: you approve each one and make it in Ads Manager yourself.</p>
      <div className="adx-seg" role="group" aria-label="Which business">
        {(['raf', 'cabinetos'] as Business[]).map((b) => (
          <button key={b} type="button" aria-pressed={business === b} onClick={() => setBusiness(b)}>
            {BUSINESS_NAME[b]}
          </button>
        ))}
      </div>
      <label className="adx-note">
        <span>Anything to aim for? (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          placeholder={business === 'raf' ? 'e.g. alcove units in Crouch End, or the wardrobe price' : 'e.g. the SketchUp extension, or Black Friday'}
          maxLength={300}
        />
      </label>
      <button type="button" className="btn solid" disabled={busy || !canWrite} onClick={() => void go()} style={{ alignSelf: 'flex-start' }} data-write>
        {busy ? 'Writing 3 ads… about a minute' : `Write 3 ads for ${BUSINESS_NAME[business]}`}
      </button>
      {!canWrite ? <p className="note">Claude isn’t set up on rafcarpentry.com (ANTHROPIC_API_KEY).</p> : null}
      {msg ? (
        <p className="adx-done" role="status">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="problem" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}

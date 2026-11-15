'use client';

import { useState } from 'react';
import { clock } from '@/lib/time';
import {
  LI_FIELDS,
  LINKEDIN_ANALYTICS,
  LINKEDIN_PROFILE,
  STALE_DAYS,
  ageWords,
  readBox,
  summarise,
  type LiKey,
  type LiList,
} from '@/lib/linkedin-types';

/* Rafal's LinkedIn numbers on Today: followers, connections, profile views, search appearances and post impressions,
   as LinkedIn's own Analytics box shows them, with Update to type today's in. */
export function LinkedInCard({ list: first }: { list: LiList }) {
  const [list, setList] = useState(first);
  const [open, setOpen] = useState(false);
  const s = summarise(list);
  const stale = !s || s.age >= STALE_DAYS;

  return (
    <article className={`card li${stale ? ' alertcard' : ''}`} data-hq-linkedin>
      <div className="ins-top">
        <span className="mark li-mark" aria-hidden="true">
          in
        </span>
        <span className="where">
          LinkedIn ·{' '}
          <a href={LINKEDIN_PROFILE} target="_blank" rel="noreferrer">
            rafaljanczy
          </a>
        </span>
      </div>
      {s ? (
        <>
          <h3>{s.headline}</h3>
          <ul className="li-grid">
            {s.values.map((v) => (
              <li key={v.key} data-li={v.key}>
                <b>{v.now === null ? '–' : v.now.toLocaleString('en-GB')}</b>
                <span>{v.label}</span>
                <small>
                  {v.span}
                  {v.change ? (
                    <em className={v.change > 0 ? 'up' : 'down'}>
                      {' '}
                      {v.change > 0 ? '+' : '−'}
                      {Math.abs(v.change).toLocaleString('en-GB')} since {s.since}
                    </em>
                  ) : null}
                </small>
              </li>
            ))}
          </ul>
          <p className="note" data-li-age>
            {stale ? `Last put in ${ageWords(s.age)}. LinkedIn doesn't let apps read these, so type this week's in.` : `Put in ${ageWords(s.age)} at ${clock(s.latest.at)}${s.latest.source === 'browser' ? ', read from your profile by Claude' : ''}.`}
          </p>
        </>
      ) : (
        <>
          <h3>Add your LinkedIn numbers</h3>
          <p className="note">LinkedIn doesn&apos;t let apps read a profile&apos;s numbers, so type them in from its Analytics box once a week and HQ keeps the history.</p>
        </>
      )}
      {open ? (
        <LiForm list={list} onSaved={(l) => { setList(l); setOpen(false); }} onCancel={() => setOpen(false)} />
      ) : (
        <div className="li-acts">
          <button type="button" className={`btn${stale ? ' solid' : ''}`} onClick={() => setOpen(true)} data-li-update>
            {s ? 'Update the numbers' : 'Add the numbers'}
          </button>
          <a className="act" href={LINKEDIN_ANALYTICS} target="_blank" rel="noreferrer">
            Open LinkedIn analytics
            <span aria-hidden="true">→</span>
          </a>
        </div>
      )}
    </article>
  );
}

function LiForm({ list, onSaved, onCancel }: { list: LiList; onSaved: (l: LiList) => void; onCancel: () => void }) {
  const last = list.rows[list.rows.length - 1];
  const [boxes, setBoxes] = useState<Record<LiKey, string>>(() => {
    const o = {} as Record<LiKey, string>;
    for (const f of LI_FIELDS) o[f.key] = last && last.day === list.today && last[f.key] !== null ? String(last[f.key]) : '';
    return o;
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const body: Partial<Record<LiKey, number>> = {};
    for (const f of LI_FIELDS) {
      const v = readBox(boxes[f.key]);
      if (v === null) {
        setErr(`${f.label}: type a whole number, like 1,530.`);
        return;
      }
      if (v !== '') body[f.key] = v;
    }
    if (!Object.keys(body).length) {
      setErr('Type at least one number.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/linkedin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await res.json().catch(() => null)) as { list?: LiList } | null;
      if (!res.ok || !j?.list) throw new Error();
      onSaved(j.list);
    } catch {
      setErr('That didn’t save. Check the signal and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="li-form" data-li-form>
      <p className="note">
        From{' '}
        <a href={LINKEDIN_ANALYTICS} target="_blank" rel="noreferrer">
          LinkedIn analytics
        </a>{' '}
        and your profile. Leave a box empty to skip it.
      </p>
      <div className="li-boxes">
        {LI_FIELDS.map((f) => (
          <label key={f.key}>
            <span>
              {f.label} <small>{f.span}</small>
            </span>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={boxes[f.key]}
              onChange={(e) => setBoxes((b) => ({ ...b, [f.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
              data-li-box={f.key}
            />
          </label>
        ))}
      </div>
      {err ? (
        <p className="note li-err" role="alert">
          {err}
        </p>
      ) : null}
      <div className="li-acts">
        <button type="button" className="btn solid" onClick={save} disabled={busy} data-li-save>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Receipt from '../Receipt';
import { reasonText, sendEnquiry, type ProjectAnswers } from '@/lib/enquiry-client';
import { whatsappUrl } from '@/lib/site';

/* Start a project: seven quick questions, one at a time, about the website, app or system someone has in mind.
   Big answers to tap, a row of seven planks that the yellow ball climbs as they go, and a summary before it is sent.
   It goes to Rafal's ServiceM8 like the contact form (/api/enquiry, source 'start'), or by WhatsApp with the answers
   typed in. Used on the /start page and in the sheet that opens from the floating button (StartSheet.tsx). */

export const WHAT = ['A website', 'A phone app', 'A system that joins my tools', 'Not sure yet'];
export const BIZ = ['A trade: carpenter, builder, decorator', 'A shop or a salon', 'An office or a service', 'Something else'];
export const TOOLS = ['ServiceM8', 'Xero or QuickBooks', 'Spreadsheets', 'Paper and WhatsApp', 'A website already', 'Nothing yet'];
export const PAINS = ['Quoting', 'Chasing payments', 'Typing things twice', 'Booking visits', 'Getting found online', 'Paperwork'];
export const BUDGET = ['Under £1,000', '£1,000 to £3,000', '£3,000 to £8,000', 'Over £8,000', 'Not sure yet'];
export const WHEN = ['As soon as possible', 'In 1 to 3 months', 'Just exploring'];

export type StartPreset = Partial<Pick<ProjectAnswers, 'what' | 'business' | 'tools' | 'pains' | 'note'>>;

const QUESTIONS = [
  { title: 'What would you like built?', hint: 'Pick the closest. “Not sure yet” is a good answer.' },
  { title: 'What kind of business is it?', hint: 'So the first sketch speaks your language.' },
  { title: 'What do you use now?', hint: 'Tap all that fit. Whatever I build joins up with these.' },
  { title: 'What eats your time?', hint: 'Tap all that fit, or say it in your own words.' },
  { title: 'Roughly what budget?', hint: 'So I suggest the right size of first step. You see a mockup before you spend anything.' },
  { title: 'When would you like it?', hint: 'No pressure either way.' },
  { title: 'Where should I reply?', hint: 'Your name, and a mobile number or an email.' },
];
const COLOURS = ['learn', 'design', 'make', 'fit', 'run', 'learn', 'design'];

const blank: ProjectAnswers = { what: '', business: '', tools: [], pains: [], note: '', budget: '', when: '' };

export default function StartProject({ preset, onDone, idPrefix = 'sp' }: { preset?: StartPreset; onDone?: () => void; idPrefix?: string }) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<ProjectAnswers>(() => ({ ...blank, ...preset }));
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ job: string; emailed: boolean } | null>(null);
  const opened = useRef(0);
  const head = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    opened.current = Date.now();
  }, []);

  // after Next or Back, the new question's title gets the focus, so a screen reader reads it and the keyboard starts
  // there; if the top of the questions has gone under the top bar or far down the screen, it comes back into view
  useEffect(() => {
    if (!moved.current) return;
    head.current?.focus({ preventScroll: true });
    const r = root.current?.getBoundingClientRect();
    if (r && (r.top < 70 || r.top > window.innerHeight * 0.5)) root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step, done]);

  const pick = (key: 'what' | 'business' | 'budget' | 'when', v: string) => setA((s) => ({ ...s, [key]: s[key] === v ? '' : v }));
  const toggle = (key: 'tools' | 'pains', v: string) => setA((s) => ({ ...s, [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v] }));

  const isEmail = contact.includes('@');
  const payload = {
    name: name.trim(),
    email: isEmail ? contact.trim() : '',
    mobile: isEmail ? '' : contact.trim(),
    trade: a.business || 'Not said',
    message: a.note.trim(),
    project: a,
  };
  const can = [!!a.what, !!a.business, a.tools.length > 0, a.pains.length > 0 || a.note.trim().length > 0, !!a.budget, !!a.when, true][step];
  const needs = ['Pick one to go on.', 'Pick one to go on.', 'Tap at least one, or “Nothing yet”.', 'Tap at least one, or write a line.', 'Pick one, or “Not sure yet”.', 'Pick one to go on.', ''][step];

  const go = (n: number) => {
    moved.current = true;
    setError('');
    setStep(n);
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFailed(false);
    if (!payload.name) return setError(reasonText('name'));
    if (!payload.email && payload.mobile.replace(/\D/g, '').length < 10) return setError(reasonText('contact'));
    setSending(true);
    const r = await sendEnquiry({ ...payload, source: 'start', website, ms: Date.now() - opened.current });
    setSending(false);
    moved.current = true;
    if (r.ok) {
      setDone({ job: r.job, emailed: r.emailed });
      onDone?.();
    } else {
      setError(reasonText(r.reason));
      setFailed(!['name', 'contact', 'email', 'message'].includes(r.reason));
    }
  }

  const waText = [
    `Hi Rafal, this is ${payload.name || '[your name]'}. I'd like to start a project.`,
    a.what ? `Build: ${a.what}` : '',
    a.business ? `Business: ${a.business}` : '',
    a.tools.length ? `Uses now: ${a.tools.join(', ')}` : '',
    a.pains.length ? `Wastes time: ${a.pains.join(', ')}` : '',
    a.note ? a.note : '',
    a.budget ? `Budget: ${a.budget}` : '',
    a.when ? `When: ${a.when}` : '',
    'From rafalsolutions.co.uk',
  ]
    .filter(Boolean)
    .join('\n');

  const summary = [
    { k: 'Build', v: a.what },
    { k: 'Business', v: a.business },
    { k: 'Uses now', v: a.tools.join(', ') },
    { k: 'Wastes time', v: [...a.pains, a.note.trim()].filter(Boolean).join(', ') },
    { k: 'Budget', v: a.budget },
    { k: 'When', v: a.when },
  ];

  if (done) {
    return (
      <div className="sp sp-done" ref={root}>
        <h2 className="sr" ref={head} tabIndex={-1}>
          Sent
        </h2>
        <Receipt
          first={payload.name.split(' ')[0] || 'there'}
          job={done.job}
          emailed={done.emailed}
          hasEmail={Boolean(payload.email)}
          onAgain={() => {
            setDone(null);
            setA(blank);
            setStep(0);
            opened.current = Date.now();
          }}
        />
      </div>
    );
  }

  const q = QUESTIONS[step];
  const opt = (label: string, on: boolean, onClick: () => void, multi = false) => (
    <button key={label} type="button" className={`sp-opt${multi ? ' multi' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="sp-tick" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.4l3 3 6-6.6" />
        </svg>
      </span>
      {label}
    </button>
  );

  return (
    <div className="sp" data-c={COLOURS[step]} ref={root}>
      {/* seven planks rising, the ball on the current one */}
      <div className="sp-ladder" aria-hidden="true">
        {QUESTIONS.map((_, i) => (
          <span key={i} className={`sp-plank${i < step ? ' past' : i === step ? ' now' : ''}`} data-c={COLOURS[i]} style={{ '--i': i } as React.CSSProperties} />
        ))}
        <span className="sp-ball" style={{ '--i': step } as React.CSSProperties}>
          <span key={step} />
        </span>
      </div>
      <p className="sp-count mono">
        Question {step + 1} of {QUESTIONS.length}
      </p>
      <h2 className="sp-title" ref={head} tabIndex={-1}>
        {q.title}
      </h2>
      <p className="sp-hint">{q.hint}</p>

      {step === 6 ? (
        <form className="sp-form" onSubmit={send} noValidate>
          <div className="field">
            <label htmlFor={`${idPrefix}-name`}>Your name</label>
            <input id={`${idPrefix}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-contact`}>Mobile or email</label>
            <input id={`${idPrefix}-contact`} className="input" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" inputMode="email" />
          </div>
          <div className="honey" aria-hidden="true">
            <label htmlFor={`${idPrefix}-website`}>Leave this empty</label>
            <input id={`${idPrefix}-website`} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
          <dl className="sp-sum">
            {summary.map((r) => (
              <div key={r.k}>
                <dt>{r.k}</dt>
                <dd>{r.v || '–'}</dd>
              </div>
            ))}
          </dl>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sp-nav">
            <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
              Back
            </button>
            <button type="submit" className="btn" disabled={sending}>
              <span className="dot" aria-hidden="true" />
              {sending ? 'Sending…' : 'Send to Rafal'}
            </button>
          </div>
          {failed ? (
            <a className="btn btn-wa" href={whatsappUrl(waText)} target="_blank" rel="noopener">
              Send it on WhatsApp instead
            </a>
          ) : null}
          <p className="form-note">
            {failed ? null : (
              <>
                Or <a href={whatsappUrl(waText)} target="_blank" rel="noopener">send it on WhatsApp</a>, typed in for you.{' '}
              </>
            )}
            I reply within 24 hours with what I&apos;d build first. <a href="/privacy">How I handle your details</a>.
          </p>
        </form>
      ) : (
        <>
          <div className={`sp-opts${step === 2 || step === 3 ? ' two' : ''}`} role="group" aria-label={q.title}>
            {step === 0 && WHAT.map((v) => opt(v, a.what === v, () => pick('what', v)))}
            {step === 1 && BIZ.map((v) => opt(v, a.business === v, () => pick('business', v)))}
            {step === 2 && TOOLS.map((v) => opt(v, a.tools.includes(v), () => toggle('tools', v), true))}
            {step === 3 && PAINS.map((v) => opt(v, a.pains.includes(v), () => toggle('pains', v), true))}
            {step === 4 && BUDGET.map((v) => opt(v, a.budget === v, () => pick('budget', v)))}
            {step === 5 && WHEN.map((v) => opt(v, a.when === v, () => pick('when', v)))}
          </div>
          {step === 3 ? (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor={`${idPrefix}-note`} className="small">
                In your own words <span className="hint">(optional)</span>
              </label>
              <input id={`${idPrefix}-note`} className="input" value={a.note} onChange={(e) => setA((s) => ({ ...s, note: e.target.value }))} placeholder="One line is plenty" />
            </div>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sp-nav">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
                Back
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn" aria-disabled={!can} onClick={() => (can ? go(step + 1) : setError(needs))}>
              Next
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

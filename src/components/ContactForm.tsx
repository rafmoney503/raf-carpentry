'use client';

import { useEffect, useRef, useState } from 'react';
import Receipt from './Receipt';
import { reasonText, sendEnquiry, whatsappText } from '@/lib/enquiry-client';
import { whatsappUrl } from '@/lib/site';

const TRADES = ['Decorator', 'Carpenter or joiner', 'Kitchen fitter', 'Builder', 'Electrician', 'Plumber', 'Something else'];

export default function ContactForm() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [trade, setTrade] = useState('Decorator');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ job: string; emailed: boolean } | null>(null);
  const opened = useRef(Date.now());

  // The search's "nothing found" and the planner can hand over words for the message box.
  useEffect(() => {
    const fill = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      if (t) setMessage((m) => m || t);
    };
    window.addEventListener('fill-contact', fill);
    // The header search's "Send it to Rafal" hands its words over from another page.
    try {
      const handed = sessionStorage.getItem('contact-prefill');
      if (handed) {
        sessionStorage.removeItem('contact-prefill');
        setMessage((m) => m || handed);
      }
    } catch {
      /* storage blocked: the form simply starts empty */
    }
    return () => window.removeEventListener('fill-contact', fill);
  }, []);

  const payload = { name: name.trim(), company: company.trim(), trade, email: email.trim(), mobile: mobile.trim(), message: message.trim() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFailed(false);
    if (!payload.name) return setError(reasonText('name'));
    if (!payload.email && payload.mobile.replace(/\D/g, '').length < 10) return setError(reasonText('contact'));
    if (!payload.message) return setError(reasonText('message'));
    setSending(true);
    const r = await sendEnquiry({ ...payload, source: 'contact', website, ms: Date.now() - opened.current });
    setSending(false);
    if (r.ok) setDone({ job: r.job, emailed: r.emailed });
    else {
      setError(reasonText(r.reason));
      setFailed(!['name', 'contact', 'email', 'message'].includes(r.reason));
    }
  }

  if (done)
    return (
      <div className="form-card">
        <Receipt
          first={payload.name.split(' ')[0] || 'there'}
          job={done.job}
          emailed={done.emailed}
          hasEmail={Boolean(payload.email)}
          onAgain={() => {
            setDone(null);
            setMessage('');
            opened.current = Date.now();
          }}
        />
      </div>
    );

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="c-name">Your name</label>
          <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="c-company">
            Business name <span className="hint">(optional)</span>
          </label>
          <input id="c-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-trade">Your trade</label>
        <select id="c-trade" className="input" value={trade} onChange={(e) => setTrade(e.target.value)}>
          {TRADES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="c-mobile">
            Mobile <span className="hint">(or email)</span>
          </label>
          <input id="c-mobile" className="input" type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-message">What slows you down?</label>
        <textarea id="c-message" className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="E.g. working out paint for every job takes my evenings" />
      </div>
      <div className="honey" aria-hidden="true">
        <label htmlFor="c-website">Leave this empty</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={sending}>
          {sending ? 'Sending…' : 'Send it to Rafal'}
        </button>
        {failed ? (
          <a className="btn btn-wa" href={whatsappUrl(whatsappText(payload))} target="_blank" rel="noopener">
            Send on WhatsApp
          </a>
        ) : null}
      </div>
      <p className="form-note">
        It goes straight into my ServiceM8 as a job. Only I see it. <a href="/privacy">How I handle your details</a>.
      </p>
    </form>
  );
}

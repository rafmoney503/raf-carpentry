'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Receipt from './Receipt';
import type { SketchPreset } from './OpenSketch';
import { reasonText, sendEnquiry, whatsappText } from '@/lib/enquiry-client';
import { whatsappUrl } from '@/lib/site';

/* "Sketch my system": the floating pill (bottom right, from the first scroll until the contact section) opens a
   planner. The visitor picks their trade, taps what eats their time and how many hours a week, and gets a system
   sketch straight away: the parts they'd get, joined up the way the Job Kit is, what that time costs them a year
   and a rough build time. Then it goes to Rafal's ServiceM8 like the contact form, or by WhatsApp. */

const TRADES = ['Decorator', 'Carpenter or joiner', 'Kitchen fitter', 'Builder', 'Electrician', 'Plumber', 'Something else'];
const PAINS = ['Writing quotes', 'Working out materials', 'Enquiries going missing', 'Chasing payments', 'Booking visits and jobs', 'Paperwork on site', 'Asking for reviews', 'Keeping customers updated'];
const RATES = [40, 60, 80];
const WEEKS = 46;

type Part = { title: string; text: string };

function partFor(pain: string, trade: string): Part {
  const t = trade.toLowerCase();
  const dec = t.startsWith('decorator');
  const carp = t.startsWith('carpenter');
  switch (pain) {
    case 'Writing quotes':
      if (dec) return { title: 'Quotes from the paint schedule', text: 'Materials and time priced from your own rates, sent from your phone' };
      if (carp) return { title: 'Quotes from the cut list', text: 'Boards, hardware and labour from the CabinetOS job' };
      return { title: 'Quote builder', text: 'Your rates and your logo, sent from your phone in minutes' };
    case 'Working out materials':
      if (dec) return { title: 'Paint schedule', text: 'Litres and tins per coat, by brush or spray' };
      if (carp) return { title: 'CabinetOS cut lists', text: 'Parts, boards and waste worked out from the drawing' };
      if (t.startsWith('kitchen')) return { title: 'Fitting pack', text: 'Units, appliances, worktop and fixings list per kitchen' };
      if (t.startsWith('builder')) return { title: 'Materials per stage', text: 'An order list for each stage of the job' };
      if (t.startsWith('electric') || t.startsWith('plumb')) return { title: 'Parts list per job', text: 'Picked from your usual parts and filed on the job' };
      return { title: 'Materials list', text: 'Worked out from the job, not from memory' };
    case 'Enquiries going missing':
      return { title: 'Enquiry inbox', text: 'Website, WhatsApp and email into one list in ServiceM8' };
    case 'Chasing payments':
      return { title: 'Money owed, every morning', text: "What's left on each job, with the reminder already written" };
    case 'Booking visits and jobs':
      return { title: 'Diary', text: "ServiceM8's schedule on your phone, confirmed on WhatsApp in one tap" };
    case 'Paperwork on site':
      return { title: 'Job photos and forms', text: 'Photos, notes and certificates filed on the job from your phone' };
    case 'Asking for reviews':
      return { title: 'Review requests', text: 'Finished jobs ask for their Google review; you press send' };
    case 'Keeping customers updated':
      return { title: 'Client updates', text: 'Photos and next steps each week, drafted for you to send' };
    default:
      return { title: pain, text: 'Your own problem: we start here' };
  }
}

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export default function SystemSketch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pillHidden, setPillHidden] = useState(true);
  const [trade, setTrade] = useState('');
  const [pains, setPains] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [hours, setHours] = useState(5);
  const [rate, setRate] = useState(60);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ job: string; emailed: boolean } | null>(null);
  const opened = useRef(0);

  const open = useCallback((preset: SketchPreset = {}) => {
    if (preset.trade) setTrade(preset.trade);
    if (preset.pain) {
      if (PAINS.includes(preset.pain)) setPains((p) => (p.includes(preset.pain!) ? p : [...p, preset.pain!]));
      else setCustom(preset.pain);
    }
    opened.current = Date.now();
    dialog.current?.showModal();
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => open((e as CustomEvent<SketchPreset>).detail ?? {});
    window.addEventListener('open-sketch', onOpen);
    return () => window.removeEventListener('open-sketch', onOpen);
  }, [open]);

  // The pill shows once the visitor has scrolled a little, and steps aside while the contact section is on screen.
  useEffect(() => {
    let contactOnScreen = false;
    const update = () => setPillHidden(window.scrollY < 480 || contactOnScreen);
    const contact = document.getElementById('contact');
    const io = contact
      ? new IntersectionObserver(([e]) => {
          contactOnScreen = e.isIntersecting;
          update();
        })
      : null;
    if (contact && io) io.observe(contact);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', update);
      io?.disconnect();
    };
  }, []);

  const close = () => {
    dialog.current?.close();
    setIsOpen(false);
  };

  const parts = [...pains.map((p) => partFor(p, trade || 'Something else')), ...(custom ? [partFor(custom, trade)] : [])];
  const yearHours = hours * WEEKS;
  const weeks = parts.length <= 2 ? 2 : parts.length <= 4 ? 3 : 4;
  const isEmail = contact.includes('@');
  const message = [custom ? `In my words: ${custom}` : '', parts.length ? `Sketch: ${parts.map((p) => p.title).join(', ')}` : ''].filter(Boolean).join('\n');
  const payload = {
    name: name.trim(),
    email: isEmail ? contact.trim() : '',
    mobile: isEmail ? '' : contact.trim(),
    trade: trade || 'Not said',
    message,
    sketch: { trade, pains: custom ? [...pains, custom] : pains, hours, modules: parts.map((p) => p.title) },
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFailed(false);
    if (!pains.length && !custom) return setError('Tap at least one thing that eats your time.');
    if (!payload.name) return setError(reasonText('name'));
    if (!payload.email && payload.mobile.replace(/\D/g, '').length < 10) return setError(reasonText('contact'));
    setSending(true);
    const r = await sendEnquiry({ ...payload, source: 'sketch', website, ms: Date.now() - opened.current });
    setSending(false);
    if (r.ok) setDone({ job: r.job, emailed: r.emailed });
    else {
      setError(reasonText(r.reason));
      setFailed(!['name', 'contact', 'email', 'message'].includes(r.reason));
    }
  }

  return (
    <>
      <button type="button" className="float-pill" data-hidden={pillHidden || isOpen} onClick={() => open()} aria-haspopup="dialog">
        <span className="dot" aria-hidden="true" />
        Sketch my system <small>60 sec</small>
      </button>

      <dialog
        ref={dialog}
        className="planner"
        aria-labelledby="planner-title"
        onClose={() => setIsOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="planner-panel">
          <div className="planner-head">
            <b id="planner-title">Sketch my system</b>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              Close
            </button>
          </div>

          <div className="planner-body">
            {done ? (
              <Receipt
                first={payload.name.split(' ')[0] || 'there'}
                job={done.job}
                emailed={done.emailed}
                hasEmail={Boolean(payload.email)}
                onAgain={() => {
                  setDone(null);
                  opened.current = Date.now();
                }}
              />
            ) : (
              <>
                <div className="q">
                  <b>
                    <span className="q-num">1</span>Your trade
                  </b>
                  <div className="opts">
                    {TRADES.map((t) => (
                      <button key={t} type="button" className="chip" aria-pressed={trade === t} onClick={() => setTrade(trade === t ? '' : t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="q">
                  <b>
                    <span className="q-num">2</span>What eats your time? <span className="muted" style={{ fontWeight: 400 }}>Tap all that apply</span>
                  </b>
                  <div className="opts">
                    {PAINS.map((p) => (
                      <button key={p} type="button" className="chip" aria-pressed={pains.includes(p)} onClick={() => setPains((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="field">
                    <label htmlFor="s-custom" className="small" style={{ fontWeight: 600 }}>
                      Something else? <span className="hint">(optional)</span>
                    </label>
                    <input id="s-custom" className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="In your own words" />
                  </div>
                </div>

                <div className="q">
                  <label htmlFor="s-hours" style={{ fontWeight: 600 }}>
                    <span className="q-num">3</span>Hours a week it costs you: <span className="mono">{hours}</span>
                  </label>
                  <input id="s-hours" className="range" type="range" min={1} max={20} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                  <div className="opts" role="group" aria-label="What an hour of your time is worth">
                    {RATES.map((r) => (
                      <button key={r} type="button" className="chip" aria-pressed={rate === r} onClick={() => setRate(r)}>
                        £{r} an hour
                      </button>
                    ))}
                  </div>
                  <p className="cost" aria-live="polite">
                    That&apos;s <strong>{yearHours} hours</strong> a year, about <strong>{money(yearHours * rate)}</strong> of your time.
                  </p>
                </div>

                <div className="q">
                  <b>
                    <span className="q-num">4</span>Your system sketch
                  </b>
                  <div className="blueprint" aria-live="polite">
                    <div className="bp-title">
                      <span>Sketch · {trade || 'your trade'}</span>
                      <span>Not to scale</span>
                    </div>
                    {parts.length ? (
                      <ol className="bp-list">
                        {parts.map((p, i) => (
                          <li key={p.title + i}>
                            <i>{String(i + 1).padStart(2, '0')}</i>
                            <span>
                              <b>{p.title}</b>
                              <em>{p.text}</em>
                            </span>
                          </li>
                        ))}
                        <li className="end">
                          <i>✓</i>
                          <span>
                            <b>Your phone: Today</b>
                            <em>Everything above in one list, in the order it needs doing</em>
                          </span>
                        </li>
                      </ol>
                    ) : (
                      <p className="bp-empty">Tap what eats your time and the parts of your system appear here.</p>
                    )}
                    {parts.length ? (
                      <div className="bp-foot">
                        <span>{parts.length + 1} parts, joined to ServiceM8</span>
                        <span>Rough build: about {weeks} weeks</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <form className="q" onSubmit={send} noValidate>
                  <b>
                    <span className="q-num">5</span>Send it to me
                  </b>
                  <div className="form-row">
                    <div className="field">
                      <label htmlFor="s-name">Your name</label>
                      <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </div>
                    <div className="field">
                      <label htmlFor="s-contact">Email or mobile</label>
                      <input id="s-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" inputMode="email" />
                    </div>
                  </div>
                  <div className="honey" aria-hidden="true">
                    <label htmlFor="s-website">Leave this empty</label>
                    <input id="s-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </div>
                  {error ? (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className="form-actions">
                    <button type="submit" className="btn" disabled={sending}>
                      {sending ? 'Sending…' : 'Send my sketch to Rafal'}
                    </button>
                    <a className={failed ? 'btn btn-wa' : 'btn btn-ghost'} href={whatsappUrl(whatsappText(payload))} target="_blank" rel="noopener">
                      WhatsApp it instead
                    </a>
                  </div>
                  <p className="form-note">
                    It lands in my ServiceM8 as a job, with this sketch. <a href="/privacy">How I handle your details</a>.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

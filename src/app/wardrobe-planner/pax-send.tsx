'use client';
import { useEffect, useRef, useState } from 'react';
import { shrinkPhoto } from '@/app/job-kit/media';
import { hatch } from '../how-it-works/sketches';
import {
  PAX_MAX_SHOTS,
  PAX_PLANNER_URL,
  PAX_WANTS,
  PAX_WANTS_START,
  paxMessage,
  paxMissing,
  readCode,
  type PaxWantKey,
  type PaxWants,
} from '@/lib/pax-design';

/* "Got an IKEA PAX design?" in the wardrobe planner (23 Oct 2026, Raf: 'is there a way to connect with ikea pax
   planner on rafcarpentry website', then 'yes'). IKEA's planner can't be embedded and has no API, so the customer
   sends what IKEA gives them: the design code (or the share link), screenshots or the product list. They tick what
   they want from Raf (the drawing shows it: what he makes in blue, IKEA's parts white), add a rough size and their
   details, and it goes with Send to Raf (POST /api/brief: a Quote job in ServiceM8 and an email to Raf, the
   screenshots onto the job as the brief's photos do). No planner design goes with it, so nothing goes to CabinetOS.
   It covers the whole planner (view and steps), like the quick guide covers the steps; the planner's own design is
   kept as it was. Opened from the Space and Send steps, the quick guide and /wardrobe-planner#ikea-pax. */

export type PlannerBits = {
  space?: () => { wall: number; ceiling: number; sized: boolean };
  contact?: () => { name: string; phone: string; email: string; postcode: string; when: string; notes: string };
};

type Shot = { id: string; blob: Blob; thumb: string };
type Sent = { name: string; email: string; shots: number; of: number; message: string };

const PHONE = '07792 860221';
const WHEN = ['As soon as possible', 'In 1 to 3 months', 'In 3 to 6 months', 'Just getting a price'];

/* POST that tries again once after a short wait when the line drops or the server is busy. */
async function post(url: string, body: BodyInit, json = true): Promise<Response> {
  const go = () => fetch(url, { method: 'POST', body, ...(json ? { headers: { 'Content-Type': 'application/json' } } : {}) });
  try {
    const r = await go();
    if (r.status !== 429 && r.status < 500) return r;
  } catch {
    /* try again below */
  }
  await new Promise((res) => setTimeout(res, 1500));
  return go();
}

export default function PaxSend({ open, onClose, planner }: { open: boolean; onClose: () => void; planner: () => PlannerBits }) {
  const [code, setCode] = useState('');
  const [wants, setWants] = useState<PaxWants>(PAX_WANTS_START);
  const [shots, setShots] = useState<Shot[]>([]);
  const [adding, setAdding] = useState(0);
  const [shotNote, setShotNote] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [list, setList] = useState('');
  const [wall, setWall] = useState('');
  const [ceiling, setCeiling] = useState('');
  const [c, setC] = useState({ name: '', phone: '', email: '', postcode: '', when: '', notes: '' });
  const [sending, setSending] = useState<null | { shot: number; of: number }>(null);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState<Sent | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trapRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLElement>(null);

  // Opening: take the sizes and details already typed in the planner (into boxes still empty), start at the top
  // with focus on the title.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const p = planner();
      const sp = p.space?.();
      if (sp?.sized) {
        if (!wall) setWall(String(sp.wall));
        if (!ceiling) setCeiling(String(sp.ceiling));
      }
      const pc = p.contact?.();
      if (pc) setC((cur) => ({ name: cur.name || pc.name, phone: cur.phone || pc.phone, email: cur.email || pc.email, postcode: cur.postcode || pc.postcode, when: cur.when || pc.when, notes: cur.notes }));
    }
  }
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo(0, 0);
    titleRef.current?.focus({ preventScroll: true });
  }, [open]);

  const toggle = (k: PaxWantKey) => setWants((w) => ({ ...w, [k]: !w[k] }));
  const field = (k: keyof typeof c) => ({
    value: c[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setC((cur) => ({ ...cur, [k]: e.target.value }));
      setErr('');
    },
  });

  const addShots = async (files: FileList | null) => {
    const take = Array.from(files ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name));
    if (fileRef.current) fileRef.current.value = '';
    const room = PAX_MAX_SHOTS - shots.length;
    if (!take.length || room <= 0) return;
    setErr('');
    setShotNote(take.length > room ? `Added ${room}: that's the most here. Send any more on WhatsApp after.` : '');
    setAdding(Math.min(room, take.length));
    for (const f of take.slice(0, room)) {
      try {
        const p = await shrinkPhoto(f);
        setShots((cur) => (cur.length >= PAX_MAX_SHOTS ? cur : [...cur, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blob: p.blob, thumb: p.thumb }]));
      } catch {
        setShotNote('One picture could not be opened. Try another, or send it on WhatsApp.');
      }
      setAdding((n) => Math.max(0, n - 1));
    }
  };

  const design = { name: c.name, code, list, shots: shots.length, wants, wall, ceiling, when: c.when, notes: c.notes };

  const send = async () => {
    if (sending) return;
    const miss = paxMissing({ ...design, mobile: c.phone, email: c.email });
    if (miss) {
      setErr(
        miss === 'design'
          ? 'Add your IKEA design code, a screenshot or the list, so I can see your design.'
          : miss === 'name'
            ? 'Add your name.'
            : miss === 'contact'
              ? 'Add your mobile or email so I can reply.'
              : 'That email address looks incomplete.',
      );
      const id = miss === 'design' ? 'pax-code' : miss === 'name' ? 'pax-name' : miss === 'email' ? 'pax-email' : 'pax-phone';
      const el = root.current?.querySelector<HTMLElement>(`#${id}`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setErr('');
    setSending({ shot: -1, of: shots.length });
    const okMobile = c.phone.replace(/\D/g, '').length >= 10;
    const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim());
    const message = paxMessage(design);
    try {
      const r = await post(
        '/api/brief',
        JSON.stringify({
          name: c.name.trim(),
          mobile: okMobile ? c.phone.trim() : '',
          email: okEmail ? c.email.trim() : '',
          address: c.postcode.trim(),
          message,
          photos: shots.length,
          company: trapRef.current?.value ?? '',
          ms: Math.round(performance.now()),
          choices: { what: ['Fitted wardrobe'], room: [], uses: [], material: ['IKEA PAX built in'] },
        }),
      );
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; token?: string; error?: string };
      if (!r.ok || !j.ok) {
        setErr(
          j.error === 'name'
            ? 'Add your name.'
            : j.error === 'contact'
              ? 'Add your mobile or email so I can reply.'
              : j.error === 'busy'
                ? 'That has been sent a few times already. Wait a few minutes or call me.'
                : `It did not send. Try again, or call ${PHONE}.`,
        );
        setSending(null);
        return;
      }
      let ok = 0;
      for (let i = 0; i < shots.length && j.token; i++) {
        setSending({ shot: i, of: shots.length });
        const fd = new FormData();
        fd.set('token', j.token);
        fd.set('i', String(i));
        fd.set('file', shots[i].blob, `ikea-design-${i + 1}.jpg`);
        try {
          if ((await post('/api/brief/photo', fd, false)).ok) ok++;
        } catch {
          /* counted as not sent; the done card says so */
        }
      }
      if (j.token && shots.length) await post('/api/brief/done', JSON.stringify({ token: j.token })).catch(() => null);
      setSent({ name: c.name.trim(), email: okEmail ? c.email.trim() : '', shots: ok, of: shots.length, message });
      setSending(null);
      scrollRef.current?.scrollTo(0, 0);
    } catch {
      setErr(`It did not send. Check your signal and try again, or call ${PHONE}.`);
      setSending(null);
    }
  };

  const linked = readCode(code).kind === 'link';
  const first = (sent?.name ?? '').split(' ')[0];

  return (
    <section
      id="wp-pax"
      ref={root}
      className="paxs"
      hidden={!open}
      aria-labelledby="wp-pax-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !sending) onClose();
      }}
    >
      <div className="paxs-pic" aria-hidden="true">
        <div className="paxs-pic-in">
          <p className="paxs-pic-title">What I add round your PAX</p>
          <PaxBuiltIn wants={wants} onToggle={toggle} />
          <Legend />
        </div>
      </div>

      <div className="paxs-side">
        <div className="paxs-scroll" ref={scrollRef}>
          <div className="paxs-head">
            <div>
              <p className="guide-kicker">IKEA PAX built in</p>
              <h2 id="wp-pax-title" ref={titleRef} tabIndex={-1}>
                {sent ? `Sent. Thanks${first ? `, ${first}` : ''}` : 'Send me your IKEA design'}
              </h2>
            </div>
            <button type="button" className="ib paxs-x" onClick={onClose} aria-label="Close, back to the planner" disabled={!!sending}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          {sent ? (
            <div className="done">
              <p className="lede">
                Your IKEA design is with me{sent.of ? `, with ${sent.shots} of ${sent.of} ${sent.of === 1 ? 'screenshot' : 'screenshots'}` : ''}. I’ll open it in IKEA’s
                planner and reply within 24 hours with a price and a free visit to measure up{sent.email ? `. A thank-you email is on its way to ${sent.email}` : ''}.
              </p>
              {sent.shots < sent.of ? <p className="hint">Some screenshots didn’t go through. Send them on WhatsApp ({PHONE}).</p> : null}
              <pre>{sent.message}</pre>
              <div className="contact">
                <span>
                  Call <span className="mono">{PHONE}</span>
                </span>
                <span>
                  Email <span className="mono">info@rafcarpentry.com</span>
                </span>
              </div>
            </div>
          ) : (
            <>
              <p className="lede">Designed it in IKEA’s PAX planner? Send me the design code and I’ll build it in, wall to wall and up to the ceiling.</p>

              <div className="grp">
                <h3>
                  <i className="paxs-n">1</i>Your IKEA design code
                </h3>
                <div className="field">
                  <label htmlFor="pax-code">Design code or share link</label>
                  <input
                    id="pax-code"
                    className="mono"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setErr('');
                    }}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={400}
                    placeholder="The code from IKEA"
                  />
                  <small className="priv">
                    {linked ? 'A link works: it opens your design. ' : ''}In IKEA’s PAX planner, press Finalise: the code is at the bottom of the page. Or use the share button and
                    paste the link. Any change makes a new code, so send the latest.{' '}
                    <a href={PAX_PLANNER_URL} target="_blank" rel="noopener noreferrer" className="paxs-ext">
                      Open IKEA’s PAX planner
                    </a>
                  </small>
                </div>
              </div>

              <div className="grp">
                <h3>
                  <i className="paxs-n">2</i>What you’d like from me
                </h3>
                <div className="paxs-inline-pic" aria-hidden="true">
                  <PaxBuiltIn wants={wants} onToggle={toggle} />
                  <Legend />
                </div>
                <div className="paxs-wants" role="group" aria-label="What you'd like from me">
                  {PAX_WANTS.map((w) => (
                    <button key={w.key} type="button" className="chip paxs-want" aria-pressed={wants[w.key]} data-want={w.key} onClick={() => toggle(w.key)}>
                      <span className="paxs-box" aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                          <path d="M3.5 8.5l3 3 6-7" />
                        </svg>
                      </span>
                      <span>
                        {w.title}
                        <small>{w.sub}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="note">You order the PAX from IKEA. I make what’s blue in the drawing, in MDF ready for your decorator.</p>
              </div>

              <div className="grp">
                <h3>
                  <i className="paxs-n">3</i>Screenshots or IKEA’s list
                  <span className="paxs-opt">optional</span>
                </h3>
                {shots.length || adding ? (
                  <ul className="paxs-shots" aria-label="Your screenshots">
                    {shots.map((s, i) => (
                      <li key={s.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.thumb} alt={`Screenshot ${i + 1}`} />
                        <button type="button" aria-label={`Remove screenshot ${i + 1}`} onClick={() => setShots((cur) => cur.filter((x) => x.id !== s.id))}>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 6l12 12M18 6 6 18" />
                          </svg>
                        </button>
                      </li>
                    ))}
                    {Array.from({ length: adding }, (_, i) => (
                      <li key={`a${i}`} className="paxs-adding" aria-label="Adding a screenshot" />
                    ))}
                  </ul>
                ) : null}
                <input ref={fileRef} id="pax-shots" type="file" accept="image/*" multiple className="paxs-file" onChange={(e) => addShots(e.target.files)} />
                <div className="paxs-row">
                  {shots.length < PAX_MAX_SHOTS ? (
                    <label htmlFor="pax-shots" className="wbtn paxs-add">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3.5" y="5.5" width="17" height="13" rx="1" />
                        <path d="M3.5 15.5l5-4.5 4 3.5 2.5-2 5.5 4.5M12 2.5v6M9 5.5h6" />
                      </svg>
                      {shots.length ? 'Add more' : 'Add screenshots'}
                    </label>
                  ) : null}
                  <button type="button" className="wbtn ghost paxs-add" aria-expanded={listOpen} aria-controls="pax-list" onClick={() => setListOpen((v) => !v)}>
                    {listOpen ? 'Hide the list' : 'Paste IKEA’s list'}
                  </button>
                </div>
                {shotNote ? (
                  <p className="hint" role="status">
                    {shotNote}
                  </p>
                ) : null}
                {listOpen ? (
                  <div className="field">
                    <label htmlFor="pax-list">IKEA’s product list</label>
                    <textarea id="pax-list" value={list} onChange={(e) => {
                        setList(e.target.value);
                        setErr('');
                      }} rows={5} placeholder="Copy the list from IKEA’s planner and paste it here" />
                  </div>
                ) : null}
                <p className="note sm">The design, the inside and the doors from IKEA’s planner. Up to {PAX_MAX_SHOTS} pictures.</p>
              </div>

              <div className="grp">
                <h3>
                  <i className="paxs-n">4</i>Your space
                  <span className="paxs-opt">rough is fine</span>
                </h3>
                <div className="row2 paxs-size">
                  <div className="field">
                    <label htmlFor="pax-wall">Width of the wall</label>
                    <div className="paxs-mm">
                      <input id="pax-wall" className="mono" inputMode="numeric" value={wall} onChange={(e) => setWall(e.target.value.replace(/[^\d]/g, '').slice(0, 5))} placeholder="2400" />
                      <span>mm</span>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="pax-ceiling">Ceiling height</label>
                    <div className="paxs-mm">
                      <input id="pax-ceiling" className="mono" inputMode="numeric" value={ceiling} onChange={(e) => setCeiling(e.target.value.replace(/[^\d]/g, '').slice(0, 5))} placeholder="2400" />
                      <span>mm</span>
                    </div>
                  </div>
                </div>
                <p className="note sm">For the fillers and the top. I measure properly on the free visit.</p>
              </div>

              <form
                className="grp"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <h3>
                  <i className="paxs-n">5</i>Your details
                </h3>
                <div className="field">
                  <label htmlFor="pax-name">Your name</label>
                  <input id="pax-name" autoComplete="name" {...field('name')} />
                  <small className="priv">Only sent to me. Nothing is kept on this website.</small>
                </div>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="pax-phone">Mobile</label>
                    <input id="pax-phone" type="tel" autoComplete="tel" inputMode="tel" {...field('phone')} />
                  </div>
                  <div className="field">
                    <label htmlFor="pax-email">Email</label>
                    <input id="pax-email" type="email" autoComplete="email" {...field('email')} />
                  </div>
                </div>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="pax-post">Postcode</label>
                    <input id="pax-post" autoComplete="postal-code" {...field('postcode')} />
                  </div>
                  <div className="field">
                    <label htmlFor="pax-when">When</label>
                    <select id="pax-when" {...field('when')}>
                      <option value="">Choose</option>
                      {WHEN.map((w) => (
                        <option key={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="pax-notes">Anything else</label>
                  <textarea id="pax-notes" placeholder="Sloping ceiling, skirting, sockets, a boiler, who orders from IKEA" {...field('notes')} />
                </div>
                <div className="hp" aria-hidden="true">
                  <label htmlFor="pax-company">Company</label>
                  <input id="pax-company" ref={trapRef} tabIndex={-1} autoComplete="off" />
                </div>
                <p className="note">Needs your mobile or email so I can reply.</p>
              </form>
            </>
          )}
        </div>
        <div className="foot paxs-foot">
          {err ? (
            <p className="err" role="alert">
              {err}
            </p>
          ) : null}
          <div className="paxs-btns">
            <button type="button" className="wbtn" onClick={onClose} disabled={!!sending}>
              {sent ? 'Back to the planner' : 'Back'}
            </button>
            {sent ? null : (
              <button type="button" className="wbtn primary" onClick={send} disabled={!!sending} data-pax-send>
                {sending
                  ? sending.shot < 0
                    ? 'Sending...'
                    : `Sending screenshot ${sending.shot + 1} of ${sending.of}...`
                  : shots.length
                    ? `Send to Raf, with ${shots.length} ${shots.length === 1 ? 'screenshot' : 'screenshots'}`
                    : 'Send to Raf'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <p className="paxs-legend">
      <span>
        <i className="mine" />I make it
      </span>
      <span>
        <i className="ikea" />
        From IKEA
      </span>
      <span>
        <i className="none" />
        Not asked for
      </span>
    </p>
  );
}

/* The PAX built in, from the front: walls each side, ceiling and floor, three PAX frames (100, 100, 50) with IKEA's
   doors. What the customer asks Raf for is drawn blue: fillers scribed to the walls, top boxes with an infill strip to
   the ceiling, a plinth, his own MDF doors; what they don't ask for is dashed. Tapping a part ticks it, as the chips
   do (the chips are what a screen reader or keyboard uses; this is a picture). */
/* A wavy pencil line, the shape a scribed edge is cut to: along x (or down y when `down`), a wave every 9 mm or so. */
function wave(x: number, y: number, len: number, down: boolean) {
  const n = Math.max(1, Math.round(len / 9));
  const s = len / n;
  const a = down ? `q-1.6 ${(s / 2).toFixed(2)} 0 ${s.toFixed(2)}` : `q${(s / 2).toFixed(2)} -2.2 ${s.toFixed(2)} 0`;
  const t = down ? `t0 ${s.toFixed(2)}` : `t${s.toFixed(2)} 0`;
  return `M${x} ${y}${a}${t.repeat(n - 1)}`;
}

function PaxBuiltIn({ wants, onToggle }: { wants: PaxWants; onToggle: (k: PaxWantKey) => void }) {
  const C = 14, F = 196, PL = 184, FT = 56; // ceiling, floor, plinth top, frames top
  const frames = [
    { x: 28, w: 105.6, doors: 2, label: 'PAX 100' },
    { x: 133.6, w: 105.6, doors: 2, label: 'PAX 100' },
    { x: 239.2, w: 52.8, doors: 1, label: 'PAX 50' },
  ];
  const part = (on: boolean) => (on ? 'pp on' : 'pp off');
  const door = wants.doors ? 'pd mine' : 'pd ikea';
  const handles = (x: number, w: number, n: number, y0: number, y1: number) =>
    n === 2
      ? `M${x + w / 2 - 3} ${y0}V${y1}M${x + w / 2 + 3} ${y0}V${y1}`
      : `M${x + w - 4} ${y0}V${y1}`;
  return (
    <svg className="paxs-svg" viewBox="0 0 320 214" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* ceiling, floor, walls */}
      <path d={hatch(4, 316, 6, C, 5)} className="pw" />
      <path d={hatch(4, 316, F, 204, 5)} className="pw" />
      <path d={hatch(4, 16, C, F, 5) + hatch(304, 316, C, F, 5)} className="pw" />
      <path d={`M4 ${C}H316M4 ${F}H316M16 ${C}V${F}M304 ${C}V${F}`} className="pl" />

      {/* top: boxes over each frame with an infill strip scribed to the ceiling, or the gap left */}
      <g className="tap" onClick={() => onToggle('top')}>
        <rect x="28" y={C} width="264" height={FT - C} className="hit" />
        {wants.top ? (
          <>
            <path d={`M28 ${C + 6}H292`} className="pp on" />
            <rect x="28" y={C} width="264" height="6" className="pp on" />
            <path d={wave(28, C + 3.4, 264, false)} className="pscribe" />
            {frames.map((f) => (
              <g key={`t${f.x}`}>
                <rect x={f.x} y={C + 6} width={f.w} height={FT - C - 6} className="pp on" />
                {f.doors === 2 ? <path d={`M${f.x + f.w / 2} ${C + 8}V${FT - 2}`} className="pdl" /> : null}
                <path d={handles(f.x, f.w, f.doors, FT - 10, FT - 4)} className="ph" />
              </g>
            ))}
            <text x="160" y={C + 25} className="pt knock" textAnchor="middle">
              top boxes, scribed to the ceiling
            </text>
          </>
        ) : (
          <>
            <rect x="28" y={C + 2} width="264" height={FT - C - 4} className="pp off" />
            <text x="160" y={C + 24} className="pt dim" textAnchor="middle">
              gap to the ceiling
            </text>
          </>
        )}
      </g>

      {/* fillers each side, scribed to the wall */}
      <g className="tap" onClick={() => onToggle('fillers')}>
        <rect x="16" y={C} width="12" height={F - C} className="hit" />
        <rect x="292" y={C} width="12" height={F - C} className="hit" />
        {[16, 292].map((x) => (
          <g key={x}>
            <rect x={x + (wants.fillers ? 0 : 1.5)} y={wants.fillers && wants.top ? C : FT + 1} width={wants.fillers ? 12 : 9} height={(wants.fillers && wants.top ? F - C : F - FT - 1) - (wants.fillers ? 0 : 1)} className={part(wants.fillers)} />
            {wants.fillers ? (
              <path d={wave(x === 16 ? 17.6 : 302.4, wants.top ? C + 2 : FT + 2, wants.top ? F - C - 4 : F - FT - 4, true)} className="pscribe" />
            ) : null}
            <text transform={`translate(${x + 6.8} ${(FT + PL) / 2}) rotate(-90)`} className={wants.fillers ? 'pt sm' : 'pt sm dim'} textAnchor="middle">
              {wants.fillers ? 'filler' : 'gap'}
            </text>
          </g>
        ))}
      </g>

      {/* the PAX frames and their doors (IKEA's, or Raf's MDF doors) */}
      <g className="tap" onClick={() => onToggle('doors')}>
        {frames.map((f) => (
          <g key={f.x}>
            <rect x={f.x} y={FT} width={f.w} height={PL - FT} className="pf" />
            {Array.from({ length: f.doors }, (_, i) => {
              const dw = f.w / f.doors;
              return <rect key={i} x={f.x + i * dw + 1.2} y={FT + 1.2} width={dw - 2.4} height={PL - FT - 2.4} className={door} />;
            })}
            <path d={handles(f.x, f.w, f.doors, 108, 132)} className="ph" />
            <text x={f.x + f.w / 2} y="211" className="pt" textAnchor="middle">
              {f.label}
            </text>
          </g>
        ))}
        <text x="186.4" y="98" className="pt knock" textAnchor="middle">
          {wants.doors ? 'my MDF doors' : 'IKEA doors'}
        </text>
      </g>

      {/* plinth along the floor, or the frames' own base */}
      <g className="tap" onClick={() => onToggle('plinth')}>
        <rect x="28" y={PL} width="264" height={F - PL} className="hit" />
        {wants.plinth ? (
          <>
            <rect x={wants.fillers ? 16 : 28} y={PL} width={wants.fillers ? 288 : 264} height={F - PL} className="pp on" />
            <text x="160" y={PL + 8.4} className="pt sm" textAnchor="middle">
              plinth
            </text>
          </>
        ) : (
          frames.map((f) => <rect key={f.x} x={f.x + 3} y={PL} width={f.w - 6} height={F - PL} className="pbase" />)
        )}
      </g>
    </svg>
  );
}

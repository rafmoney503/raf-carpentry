'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { openSketch } from './OpenSketch';
import { CABINETOS_URL } from '@/lib/site';

/* The hero search: "What slows your business down?". Everything is searched here in the browser, so it answers
   as the visitor types. The placeholder and the "Idea:" line change every few seconds (the idea whispers); tapping
   an idea runs it as a search. Nothing found opens the planner with their words. */

type Kind = 'Live' | 'Being built' | 'Idea' | 'Trade' | 'How I work';
type Item = { k: Kind; title: string; sub: string; href?: string; trade?: string; words: string };

const ITEMS: Item[] = [
  { k: 'Live', title: 'CabinetOS', sub: 'Cut lists, board layouts and drawings for wardrobe and cabinet makers.', href: CABINETOS_URL, words: 'cabinetos cut list cutlist cutlists cutting board boards sheet sheets optimise waste carpenter carpenters joiner joinery cabinet cabinets wardrobe wardrobes drawing drawings parts mdf materials' },
  { k: 'Live', title: 'Job Kit', sub: 'The phone app that runs my business: enquiries, diary, emails, texts, money owed.', href: '#systems', words: 'job kit phone app enquiry enquiries whatsapp lost diary schedule booking bookings email emails inbox reply replies text texts admin evenings paperwork today morning' },
  { k: 'Live', title: 'ServiceM8 connection', sub: 'Jobs, clients, diary, payments, photos, emails and texts, read and written through the official API.', href: '#servicem8', words: 'servicem8 service m8 sm8 api jobs job clients client diary schedule payments invoices photos attachments integration connect connected tradify xero' },
  { k: 'Live', title: 'Website brief to ServiceM8', sub: 'A customer sends their brief and photos. It lands as a job and they get a reply with designs like theirs.', href: '#flow', words: 'website form lead leads enquiry enquiries photos auto automatic reply email brief customers lost missed' },
  { k: 'Live', title: 'Wardrobe planner', sub: 'Customers plan their wardrobe in 3D on your site. You get the job and the cut list.', href: '#systems', words: 'wardrobe wardrobes planner configurator 3d design customer customers sizes doors' },
  { k: 'Being built', title: 'Paint schedule for decorators', sub: 'Litres per coat from the doors, fronts and panels. Brush or spray.', href: '#paint', words: 'paint painting painter painters decorator decorators decorating litres litre coats coat spray spraying brush primer undercoat doors door cupboards cupboard fronts m2 metres tins' },
  { k: 'Live', title: 'Money owed, every morning', sub: 'Who has paid, what is left, and a message ready to send.', href: '#flow', words: 'money payment payments chase chasing owe owed invoice invoices deposit deposits paid cash late' },
  { k: 'Live', title: 'Review requests', sub: 'A finished job asks for its Google review, ready for you to send.', href: '#flow', words: 'review reviews google ask stars finished feedback' },
  { k: 'Live', title: 'Replies drafted for you', sub: 'Claude writes the first draft of each reply. Nothing goes until you press send.', href: '#flow', words: 'reply replies email emails answer answering ai claude chatgpt draft drafts write writing messages' },
  { k: 'Idea', title: 'Quotes from the drawing', sub: 'Materials, labour and VAT worked out from the design you already drew.', trade: '', words: 'quote quotes quoting price pricing estimate estimates estimating evenings vat materials labour' },
  { k: 'Trade', title: 'Kitchen fitters', sub: 'Fitting packs, appliance lists and snagging photos.', trade: 'Kitchen fitter', words: 'kitchen kitchens fitter fitters fitting appliances snagging worktop worktops' },
  { k: 'Trade', title: 'Builders and renovators', sub: 'Stage payments, extras and client updates in one place.', trade: 'Builder', words: 'builder builders renovation renovations refurb extension stage payments extras variations bathroom bathrooms loft' },
  { k: 'Trade', title: 'Electricians and plumbers', sub: 'Job sheets, parts lists and certificates filed on the job.', trade: 'Electrician', words: 'electrician electricians electrical plumber plumbers plumbing heating gas boiler certificate certificates parts' },
  { k: 'How I work', title: 'How long it takes', sub: 'A mockup in 2 days. A working version in 2 to 4 weeks.', href: '#how', words: 'how long fast quick time delivery cost price process start weeks days own owner' },
];

const PH = ['quoting eats my evenings', 'enquiries get lost in WhatsApp', 'working out paint for 30 doors', 'cut lists by hand, every job', 'chasing customers for money', 'I forget to ask for reviews'];
const IDEAS = [
  { t: "A decorator's litres should come from the drawing, not a guess.", q: 'paint' },
  { t: 'Every enquiry should be a job before the kettle boils.', q: 'enquiries' },
  { t: 'A finished job should ask for its own review.', q: 'reviews' },
  { t: 'Customers should see their wardrobe in 3D before you quote.', q: 'wardrobe' },
  { t: 'Money owed should be on your phone every morning.', q: 'payments' },
  { t: 'Your job software should fill itself in from your website.', q: 'servicem8' },
];
const TRIES = ['quotes', 'enquiries', 'paint', 'ServiceM8', 'payments', 'reviews'];

function search(q: string) {
  const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  return ITEMS.map((it) => {
    const ws = `${it.words} ${it.title.toLowerCase()}`.split(/\s+/);
    let sc = 0;
    for (const t of terms) {
      if (ws.includes(t)) sc += 3;
      else if (ws.some((x) => x.startsWith(t) || (t.length > 3 && x.length > 3 && t.startsWith(x)))) sc += 1;
    }
    return { it, sc };
  })
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 5)
    .map((x) => x.it);
}

const pillClass = (k: Kind) => (k === 'Live' ? 'pill live' : k === 'Being built' ? 'pill built' : 'pill');

export default function HeroSearch() {
  const [q, setQ] = useState('');
  const [w, setW] = useState(0);
  const [fading, setFading] = useState(false);
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setInterval(() => {
      if (reduce) return setW((v) => v + 1);
      setFading(true);
      window.setTimeout(() => {
        setW((v) => v + 1);
        setFading(false);
      }, 350);
    }, 4200);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

  const results = useMemo(() => search(q), [q]);
  const show = focused && q.trim().length > 0;
  const idea = IDEAS[w % IDEAS.length];

  const pickItem = (it: Item) => {
    setFocused(false);
    if (!it.href) openSketch({ trade: it.trade, pain: it.k === 'Idea' ? 'Writing quotes' : undefined });
  };

  return (
    <>
      <form
        ref={box}
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const first = results[0];
          if (first?.href) {
            setFocused(false);
            if (first.href.startsWith('#')) document.querySelector(first.href)?.scrollIntoView({ behavior: 'smooth' });
            else window.open(first.href, '_blank', 'noopener');
          } else if (first) pickItem(first);
          else if (q.trim()) openSketch({ pain: q.trim() });
        }}
      >
        <label htmlFor="q">What slows your business down?</label>
        <div className="search-box">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5L21 21" />
          </svg>
          <input
            id="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setFocused(true);
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => e.key === 'Escape' && setFocused(false)}
            placeholder={`e.g. ${PH[w % PH.length]}`}
            aria-controls="q-results"
            aria-expanded={show}
          />
          {q ? (
            <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQ('')}>
              ×
            </button>
          ) : null}
        </div>
        {show ? (
          <div className="results" id="q-results">
            {results.length ? (
              <>
                <p className="results-head">
                  {results.length === 1 ? '1 match' : `${results.length} matches`} for “{q.trim()}”
                </p>
                {results.map((it) =>
                  it.href ? (
                    <a
                      key={it.title}
                      className="result"
                      href={it.href}
                      target={it.href.startsWith('http') ? '_blank' : undefined}
                      rel={it.href.startsWith('http') ? 'noopener' : undefined}
                      onClick={() => setFocused(false)}
                    >
                      <span className={pillClass(it.k)}>{it.k}</span>
                      <span className="result-text">
                        <strong>{it.title}</strong>
                        <span>{it.sub}</span>
                      </span>
                    </a>
                  ) : (
                    <button key={it.title} type="button" className="result" onClick={() => pickItem(it)}>
                      <span className={pillClass(it.k)}>{it.k}</span>
                      <span className="result-text">
                        <strong>{it.title}</strong>
                        <span>{it.sub} Sketch yours in 60 seconds.</span>
                      </span>
                    </button>
                  ),
                )}
              </>
            ) : (
              <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p>
                  <strong>Nothing built for that yet.</strong> That is usually where a new system starts.
                </p>
                <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openSketch({ pain: q.trim() })}>
                  Sketch a system for it
                </button>
              </div>
            )}
          </div>
        ) : null}
      </form>

      <div className="tries">
        <span className="muted">Try</span>
        {TRIES.map((t) => (
          <button
            key={t}
            type="button"
            className="chip"
            onClick={() => {
              setQ(t);
              setFocused(true);
              document.getElementById('q')?.focus();
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="idea"
        onClick={() => {
          setQ(idea.q);
          setFocused(true);
          document.getElementById('q')?.focus();
        }}
      >
        <span className="dot" aria-hidden="true" />
        <span className={`idea-text${fading ? ' fading' : ''}`} aria-live="off">
          <span style={{ color: 'var(--ink)' }}>Idea:</span> {idea.t}
        </span>
      </button>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { openSketch } from './OpenSketch';
import { HERO_ITEMS, type HeroItem, type HeroKind } from '@/lib/search';

/* The hero search: "What slows your business down?". Everything is searched here in the browser, so it answers
   as the visitor types. The placeholder and the "Idea:" line change every few seconds (the idea whispers); tapping
   an idea runs it as a search. Nothing found opens the planner with their words. */

type Kind = HeroKind;
type Item = HeroItem;
const ITEMS: Item[] = HERO_ITEMS;

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
  const router = useRouter();
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
            if (first.href.startsWith('/')) router.push(first.href);
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
                  it.href?.startsWith('/') ? (
                    <Link key={it.title} className="result" href={it.href} onClick={() => setFocused(false)}>
                      <span className={pillClass(it.k)}>{it.k}</span>
                      <span className="result-text">
                        <strong>{it.title}</strong>
                        <span>{it.sub}</span>
                      </span>
                    </Link>
                  ) : it.href ? (
                    <a key={it.title} className="result" href={it.href} target="_blank" rel="noopener" onClick={() => setFocused(false)}>
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

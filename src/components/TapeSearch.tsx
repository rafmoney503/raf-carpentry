'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { openSketch } from './OpenSketch';
import { KIND_LABEL, RUNNING_TODAY, SEARCH_TRIES, siteSearch, type Hit } from '@/lib/search';

/* The search in the header, drawn as a tape measure. The black case sits in the top bar; tap it (or press / on a
   computer) and the yellow blade pulls out across the bar, and you type on the blade. Results hang underneath as
   cut pieces of timber: the best match is the longest piece, in yellow, and the last piece sends the words to
   Rafal. Before anything is typed it shows the systems running today, CabinetOS first. Arrow keys move between
   pieces, Enter opens one, Esc puts the tape away. The case says Search: beside it on a computer, under it on a
   phone, where the bar has no room for a word beside it. */

const WIDTHS = [100, 88, 76, 64, 56]; // per cent of the blade: the best match is the longest piece
const WIDTHS_EMPTY = [100, 86, 72];

type Geo = { left: number; width: number; top: number; panelTop: number; panelLeft: number; panelWidth: number };

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export default function TapeSearch({ onOpen }: { onOpen?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [geo, setGeo] = useState<Geo | null>(null);
  const caseRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  // Before anything is typed the tape shows the systems running today, CabinetOS first.
  const typed = q.trim().length > 0;
  const hits = useMemo(() => (q.trim() ? siteSearch(q) : RUNNING_TODAY), [q]);

  // Where the blade goes: on a computer from just after the logo to the case, on a phone across the whole bar.
  const measure = useCallback(() => {
    const btn = caseRef.current;
    const row = btn?.closest('.head-row');
    const head = btn?.closest('.site-head');
    if (!btn || !row || !head) return;
    const r = row.getBoundingClientRect();
    const c = btn.getBoundingClientRect();
    const h = head.getBoundingClientRect();
    const desktop = window.matchMedia('(min-width: 1080px)').matches;
    const logo = row.querySelector('.logo')?.getBoundingClientRect();
    const left = desktop && logo ? logo.right - r.left + 20 : Math.max(-r.left + 12, -8);
    const width = c.left - r.left - 6 - left;
    const panelLeft = desktop ? r.left + left : 12;
    const panelWidth = desktop ? Math.max(width, 520) : window.innerWidth - 24;
    setGeo({ left, width, top: (r.height - 44) / 2, panelTop: h.bottom + 10, panelLeft, panelWidth });
  }, []);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setQ('');
    setActive(0);
    if (refocus) caseRef.current?.focus();
  }, []);

  const openSearch = useCallback(() => {
    onOpen?.();
    measure();
    setOpen(true);
    // Focus straight away, inside the tap, so phones bring up the keyboard.
    inputRef.current?.focus({ preventScroll: true });
  }, [measure, onOpen]);

  // A new page puts the tape away.
  useEffect(() => close(), [pathname, close]);

  // / or Ctrl/Cmd+K opens it from anywhere that isn't a text box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open) return;
      const k = e.key.toLowerCase();
      if ((k === '/' && !isTyping(e.target)) || (k === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openSearch]);

  useEffect(() => {
    if (!open) return;
    document.body.dataset.search = 'open';
    window.addEventListener('resize', measure);
    return () => {
      delete document.body.dataset.search;
      window.removeEventListener('resize', measure);
    };
  }, [open, measure]);

  useEffect(() => setActive(0), [q]);

  const run = (h: Hit) => {
    const words = q.trim();
    close();
    if (h.kind === 'sketch') return openSketch({ pain: words });
    if (h.kind === 'send') {
      try {
        sessionStorage.setItem('contact-prefill', words);
      } catch {
        /* private mode: the form simply starts empty */
      }
      if (pathname === '/contact') {
        window.dispatchEvent(new CustomEvent('fill-contact', { detail: words }));
        document.getElementById('form')?.scrollIntoView({ behavior: 'smooth' });
      } else router.push('/contact#form');
      return;
    }
    if (!h.href) return;
    if (h.external) window.open(h.href, '_blank', 'noopener');
    else router.push(h.href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      run(hits[active]);
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <>
      <button
        ref={caseRef}
        type="button"
        className={`tape-case${open ? ' open' : ''}`}
        aria-label={open ? 'Put the search away' : 'Search the site'}
        aria-expanded={open}
        aria-keyshortcuts="/"
        onClick={() => (open ? close(true) : openSearch())}
      >
        <span className="tape-body" aria-hidden="true">
          <span className="tape-reel" />
        </span>
        <span className="tape-label" aria-hidden="true">
          Search
        </span>
      </button>

      <div className={`tape-blade${open ? ' open' : ''}`} style={geo ? { left: geo.left, width: geo.width, top: geo.top } : undefined} aria-hidden={!open}>
        <span className="tape-hook" aria-hidden="true" />
        <input
          ref={inputRef}
          className="tape-input"
          type="search"
          role="combobox"
          aria-label="Search the site"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && hits.length ? optionId(active) : undefined}
          placeholder="Type a problem, a page or a sum"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          tabIndex={open ? 0 : -1}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="tape-hint" aria-hidden="true">
          {q ? `${hits.length} found` : 'Esc to put it away'}
        </span>
      </div>

      {open && geo
        ? createPortal(
            <>
              <div className="tape-dim" style={{ top: geo.panelTop - 10 }} onClick={() => close()} aria-hidden="true" />
              <div className="tape-panel" style={{ top: geo.panelTop, left: geo.panelLeft, width: geo.panelWidth }}>
                {!typed ? <p className="tape-note tape-note-top">Running today</p> : null}
                <ul id={listId} role="listbox" aria-label={typed ? 'Search results' : 'Systems running today'} className="tape-pieces">
                  {hits.map((h, i) => (
                    <li
                      key={`${h.kind}-${h.title}`}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      className={`piece${i === 0 && h.kind !== 'send' ? ' best' : ''}${h.kind === 'send' ? ' send' : ''}${i === active ? ' active' : ''}`}
                      style={{ width: `${(typed ? WIDTHS : WIDTHS_EMPTY)[i] ?? 56}%`, animationDelay: `${i * 45}ms` }}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(h)}
                    >
                      <span className="piece-text">
                        <b>{h.title}</b>
                        <span>{h.sub}</span>
                      </span>
                      {h.kind === 'sum' ? (
                        <span className="piece-big">
                          <b>{h.big}</b>
                          <em>{h.bigNote}</em>
                        </span>
                      ) : h.kind === 'send' ? (
                        <span aria-hidden="true">→</span>
                      ) : (
                        <span className="piece-kind">{typed ? KIND_LABEL[h.kind] : 'LIVE'}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {typed ? (
                  <p className="tape-note" aria-live="polite">
                    {hits.length} pieces · longest fits best
                  </p>
                ) : (
                  <div className="tape-tries">
                    <span>Try</span>
                    {SEARCH_TRIES.map((t) => (
                      <button key={t} type="button" onClick={() => setQ(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

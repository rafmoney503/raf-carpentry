'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KIND_LABEL, RUNNING_TODAY, SEARCH_TRIES, siteSearch, type Hit, type HitKind } from '@/lib/search';
import { useRunHit } from './useRunHit';

/* The search on a computer or an iPad: a "Search" button that looks like the Menu button. It opens one calm panel
   over the page with a big field; results come as you type, grouped (a paint sum first, then Systems, Pages, Trades,
   Questions, Connections, and 'Or' for sketching it or sending it to Rafal). Before anything is typed it shows the
   systems running today and a few words to try. Arrow keys move, Enter opens, Esc, Close or a click outside put it
   away. Ctrl/Cmd+K or / open it from anywhere that isn't a text box. Phones use MenuSearch inside the menu instead. */

export const SearchIcon = ({ size = 18 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 20 20" />
  </svg>
);

const GROUPS: { name: string; kinds: HitKind[] }[] = [
  { name: 'Paint sum', kinds: ['sum'] },
  { name: 'Systems', kinds: ['system'] },
  { name: 'Pages', kinds: ['page', 'section'] },
  { name: 'Trades', kinds: ['trade'] },
  { name: 'Questions', kinds: ['faq'] },
  { name: 'Connections', kinds: ['connection'] },
  { name: 'Or', kinds: ['sketch', 'whatsapp', 'send'] },
];

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export default function SearchSheet({ onOpen }: { onOpen?: () => void }) {
  const pathname = usePathname();
  const runHit = useRunHit();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const typed = q.trim().length > 0;
  const hits = useMemo(() => (typed ? siteSearch(q, 8) : RUNNING_TODAY), [q, typed]);
  // the results in the order they are shown, grouped
  const groups = useMemo(() => {
    if (!typed) return [{ name: 'Running today', items: hits }];
    return GROUPS.map((g) => ({ name: g.name, items: hits.filter((h) => g.kinds.includes(h.kind)) })).filter((g) => g.items.length);
  }, [hits, typed]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setQ('');
    setActive(0);
    if (refocus) btnRef.current?.focus();
  }, []);
  const openSheet = useCallback(() => {
    onOpen?.();
    setOpen(true);
  }, [onOpen]);

  // A new page puts it away.
  useEffect(() => close(), [pathname, close]);
  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open) return;
      const k = e.key.toLowerCase();
      if ((k === '/' && !isTyping(e.target)) || (k === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        openSheet();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, openSheet]);

  // while it is open: the page behind keeps still, the floating button steps aside, the field has the cursor
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    document.body.dataset.search = 'open';
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = before;
      delete document.body.dataset.search;
    };
  }, [open]);

  const run = (h: Hit) => {
    const words = q.trim();
    close();
    runHit(h, words);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && e.target === inputRef.current && flat[active]) {
      e.preventDefault();
      run(flat[active]);
    } else if (e.key === 'Tab' && sheetRef.current) {
      // keep the keyboard inside the panel while it is open
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('input, button'));
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;
  let n = -1;

  return (
    <>
      <button ref={btnRef} type="button" className="search-btn" aria-haspopup="dialog" aria-expanded={open} aria-keyshortcuts="Control+K Meta+K /" onClick={() => (open ? close(true) : openSheet())}>
        <SearchIcon />
        Search
      </button>
      {open
        ? createPortal(
            <>
              <div className="ss-dim" aria-hidden="true" onClick={() => close(true)} />
              <div ref={sheetRef} className="ss-sheet" role="dialog" aria-modal="true" aria-label="Search the site" onKeyDown={onKeyDown}>
                <div className="ss-field">
                  <SearchIcon size={22} />
                  <input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-label="Search the site"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={flat.length ? optionId(active) : undefined}
                    placeholder="What are you looking for?"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <button type="button" className="ss-close" onClick={() => close(true)}>
                    Close
                  </button>
                </div>
                <div className="ss-body">
                  <ul id={listId} role="listbox" aria-label={typed ? 'Search results' : 'Systems running today'} className="ss-list">
                    {groups.map((g) => [
                      <li key={`g-${g.name}`} role="presentation" className="ss-group">
                        {g.name}
                      </li>,
                      ...g.items.map((h) => {
                        n += 1;
                        const i = n;
                        return (
                          <li
                            key={`${h.kind}-${h.title}`}
                            id={optionId(i)}
                            role="option"
                            aria-selected={i === active}
                            className={`ss-row${i === active ? ' on' : ''}${typed && i === 0 && h.kind !== 'send' ? ' best' : ''}`}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => run(h)}
                          >
                            <span className="ss-text">
                              <b>
                                <span>{h.title}</span>
                              </b>
                              <span>{h.sub}</span>
                            </span>
                            {h.kind === 'sum' ? (
                              <span className="ss-big">
                                <b>{h.big}</b>
                                <em>{h.bigNote}</em>
                              </span>
                            ) : h.kind === 'send' || h.kind === 'sketch' ? (
                              <span className="ss-kind" aria-hidden="true">
                                →
                              </span>
                            ) : (
                              <span className="ss-kind">{typed ? KIND_LABEL[h.kind] : 'LIVE'}</span>
                            )}
                          </li>
                        );
                      }),
                    ])}
                  </ul>
                  {!typed ? (
                    <div className="ss-tries">
                      <span>Try</span>
                      {SEARCH_TRIES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setQ(t);
                            inputRef.current?.focus();
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

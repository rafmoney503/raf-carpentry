'use client';

import { useMemo } from 'react';
import { siteSearch, type Hit } from '@/lib/search';
import { SearchIcon } from './SearchSheet';
import { useRunHit } from './useRunHit';

/* The search on a phone: a field at the top of the menu, with a line under it. While something is typed the menu
   list makes way for the results: the best match large (with the yellow highlighter), then the rest as # tags, the
   same tags the menu uses. Enter opens the best match. The Header keeps the words, so the menu list can step aside. */

export default function MenuSearch({ q, setQ, onDone }: { q: string; setQ: (q: string) => void; onDone: () => void }) {
  const runHit = useRunHit();
  const typed = q.trim().length > 0;
  const hits = useMemo(() => (typed ? siteSearch(q, 7) : []), [q, typed]);
  const run = (h: Hit) => {
    const words = q.trim();
    onDone();
    runHit(h, words);
  };
  const best = hits.find((h) => h.kind !== 'send') ?? hits[0];
  const rest = hits.filter((h) => h !== best);

  return (
    <div className="ms">
      <label className="ms-field">
        <SearchIcon />
        <input
          type="search"
          aria-label="Search the site"
          placeholder="Search the site"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && best) {
              e.preventDefault();
              run(best);
            }
          }}
        />
        {typed ? (
          <button type="button" className="ms-clear" onClick={() => setQ('')}>
            Clear
          </button>
        ) : null}
      </label>
      {typed && best ? (
        <div className="ms-results" aria-live="polite">
          <button type="button" className="ms-best" onClick={() => run(best)}>
            <span className="kicker">{best.kind === 'send' ? 'Nothing on the site for that yet' : best.kind === 'sum' ? 'Paint sum' : 'Best match'}</span>
            <b>
              <span className="hl">{best.title}</span>
              {best.kind === 'sum' ? <em> {best.big}</em> : null}
            </b>
            <span>{best.sub}</span>
            <span className="link-more">
              Open it <span aria-hidden="true">→</span>
            </span>
          </button>
          {rest.length ? (
            <div className="tags ms-tags">
              {rest.map((h) => (
                <button key={`${h.kind}-${h.title}`} type="button" className="tag" onClick={() => run(h)}>
                  {h.kind === 'send' || h.kind === 'sketch' ? null : <span aria-hidden="true">#</span>}
                  {h.title.replace(/^# /, '')}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

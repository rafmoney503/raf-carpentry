'use client';

import { useMemo, useState } from 'react';
import { BOARDS, BOARDS_CHECKED, CHANGES, CW, CWORKSHOP_CUTLIST, CWORKSHOP_PHONE, CWORKSHOP_URL, FAMILY_NAME, FAMILY_ORDER, PRICE_BASE, SERVICES } from '@/lib/cworkshop-boards';
import { money2, ownPrices, SHEET_YIELD, type Board, type PriceKey, type Prices } from '@/lib/quote-sums';
import { matches } from '@/lib/search';
import { Icon } from './icons';
import { field, fieldSized, label } from './parts';

/* The Job Kit's Cworkshop screen (4 Nov 2026, Raf: 'can we create section where you will check Cworkshop decor
   finishes find prices and in quotes laminated project finish based on one or two boards ... and also add edge
   banding prices, cutting and other extra services they add'). What the Quotes' finished-board option is worked out
   from: Cworkshop's service prices (cutting is on their pages; edging, drilling and delivery aren't, so they start as
   guesses until Raf types his own from their cutting list app) and every decor with its sheet price and his own
   price if he has one. All of it comes from content/cworkshop.json, which Claude checks every Monday
   (scripts/CWORKSHOP.md); his own prices are kept with his price list (row '_prices'), only the ones he changed, so a
   Cworkshop price that moves still reaches every quote unless he has typed his own. */

const PAGE = 30; // decors shown at a time: there are a few hundred
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const num = (s: string) => {
  const v = Number.parseFloat(s.replace(/[£,\s]/g, ''));
  return Number.isFinite(v) ? v : NaN;
};

export function CworkshopView({ prices, savedAt, onSave }: { prices: Prices; savedAt: number; onSave: (p: Record<string, unknown>) => void }) {
  // his own: shown in the box; empty = Cworkshop's (or my guess)
  const startSvc = () => Object.fromEntries(SERVICES.map((s) => [s.key, Math.abs(prices[s.key] - PRICE_BASE[s.key]) > 1e-9 ? String(prices[s.key]) : '']));
  const startBoards = () => Object.fromEntries(Object.entries(prices.boards).map(([k, v]) => [k, String(v)]));
  const [svc, setSvc] = useState<Record<string, string>>(startSvc);
  const [boards, setBoards] = useState<Record<string, string>>(startBoards);
  const [q, setQ] = useState('');
  const [fam, setFam] = useState('');
  const [saved, setSaved] = useState('');
  const [allChanges, setAllChanges] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const svcValue = (k: PriceKey) => {
    const v = num(svc[k] ?? '');
    return v >= 0 && v < 10000 ? v : PRICE_BASE[k];
  };
  const boardsNow = () =>
    Object.fromEntries(
      Object.entries(boards)
        .map(([k, v]) => [k, num(v)] as const)
        .filter(([, v]) => v > 0 && v < 5000),
    );
  const changed = SERVICES.some((s) => Math.abs(svcValue(s.key) - prices[s.key]) > 1e-9) || JSON.stringify(boardsNow()) !== JSON.stringify(prices.boards);
  const save = () => {
    const full: Prices = { ...prices, boards: boardsNow() };
    for (const s of SERVICES) full[s.key] = svcValue(s.key);
    onSave(ownPrices(full, PRICE_BASE));
    setSaved('Saved. Every quote uses these now, on your phone and computer.');
  };

  const families = FAMILY_ORDER.filter((f) => BOARDS.some((b) => b.family === f));
  const shown = useMemo(() => BOARDS.filter((b) => (!fam || b.family === fam) && (!q.trim() || matches([b.name, b.code, b.brand ?? '', b.family, FAMILY_NAME[b.family] ?? '', b.describe].join(' '), q))), [q, fam]);
  const changes = [...CHANGES].reverse();

  return (
    <div className="pt-7">
      <p className="kicker">Quotes · finished board</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="swatch" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Cworkshop
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted">
        What the finished-board option in your quotes is worked out from: their decors, cutting, edging and the extras. Before VAT. Claude checks their website every Monday and notes anything that changed.
      </p>
      <p className="mt-2 font-mono text-[12.5px] text-faint" data-cw-checked>
        Last checked {day(BOARDS_CHECKED)} by {CW.checkedBy}
        {savedAt ? ` · your prices changed ${new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
      </p>

      <section className="mt-7" data-cw-services>
        <h2 className={label}>Their services</h2>
        <ul className="mt-2 divide-y divide-line rounded-sm border border-line-strong bg-mount">
          {SERVICES.map((s) => {
            const mine = svc[s.key] !== '' && Math.abs(svcValue(s.key) - PRICE_BASE[s.key]) > 1e-9;
            return (
              <li key={s.key} className="flex items-center gap-3 px-3.5 py-2.5" data-cw-service={s.key}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">{s.label}</span>
                  <span className="block text-[12.5px] leading-snug text-muted">
                    {s.published ? (
                      <>
                        On their website: <b className="font-semibold text-ink">{money2(s.price)}</b> {s.unit}
                        {s.checked ? `, ${day(s.checked)}` : ''}.
                      </>
                    ) : (
                      <>
                        <b className="font-semibold text-ink">My guess {money2(s.price)}</b>: not on their website.
                      </>
                    )}
                    {mine ? ' Yours is used.' : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-mono text-[13px] text-faint">£</span>
                  <input
                    inputMode="decimal"
                    value={svc[s.key] ?? ''}
                    placeholder={s.price.toFixed(2)}
                    onChange={(e) => setSvc({ ...svc, [s.key]: e.target.value })}
                    aria-label={`Your price: ${s.label}`}
                    className={`${fieldSized} h-11 w-[88px] text-right font-mono text-[15px]`}
                  />
                  <span className="w-[46px] font-mono text-[11.5px] leading-tight text-faint">{s.unit}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Edging, drilling and delivery are only priced in their cutting list app. Put one job in it, then type what it charges here: every quote uses yours from then on.{' '}
          <a href={CWORKSHOP_CUTLIST} target="_blank" rel="noreferrer" className="text-accent underline">
            Their cutting list
          </a>{' '}
          or{' '}
          <a href={`tel:${CWORKSHOP_PHONE.replace(/\s/g, '')}`} className="text-accent underline">
            call {CWORKSHOP_PHONE}
          </a>
          .
        </p>
        <details className="mt-3 rounded-sm border border-line bg-paper px-3.5 py-2.5">
          <summary className="cursor-pointer text-[14.5px] font-semibold">How a quote uses them</summary>
          <ul className="mt-2 list-disc pl-5 text-[14px] leading-relaxed text-muted">
            <li>Sheets from the parts: the doors, the frame you see (plinth, top infill, fillers) and the inside (carcass, two shelves a unit, 18 mm backs), {Math.round(SHEET_YIELD * 100)}% of each sheet used. One board throughout shares its offcuts.</li>
            <li>Cutting for every sheet.</li>
            <li>2 mm edging round every door and drawer front and on the edges of the frame you see; 1 mm on the carcass and shelf fronts and drawer box tops.</li>
            <li>Hinge holes (when you tick it on the quote): a hinge per 600 mm or so of door height, 2 to 5 a door.</li>
            <li>Fast Flow when you tick it; delivery unless you untick it.</li>
          </ul>
        </details>
      </section>

      <section className="mt-7">
        <h2 className={label}>Lead times and edging</h2>
        <ul className="mt-2 list-disc pl-5 text-[14.5px] leading-relaxed">
          {CW.leadTimes.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li>{CW.edging}</li>
        </ul>
      </section>

      <section className="mt-8" data-cw-decors>
        <h2 className={label}>
          Decors ({BOARDS.length}), a sheet
        </h2>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search: oak, grey, walnut, U702…"
          aria-label="Search the decors"
          className={`${field} mt-2 h-11 w-full`}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Families">
          {['', ...families].map((f) => (
            <button
              key={f || 'all'}
              type="button"
              aria-pressed={fam === f}
              onClick={() => {
                setFam(f);
                setLimit(PAGE);
              }}
              className={`min-h-9 rounded-sm border px-2.5 font-mono text-[12.5px] ${fam === f ? 'border-ink bg-ink text-paper' : 'border-line-strong text-muted'}`}
            >
              {f ? FAMILY_NAME[f] : 'All'} {f ? BOARDS.filter((b) => b.family === f).length : BOARDS.length}
            </button>
          ))}
        </div>
        {!shown.length ? <p className="mt-3 font-mono text-[13.5px] text-faint">No decor matches. Try another word.</p> : null}
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shown.slice(0, limit).map((b) => (
            <li key={b.code}>
              <Decor b={b} value={boards[b.code] ?? ''} onChange={(v) => setBoards({ ...boards, [b.code]: v })} />
            </li>
          ))}
        </ul>
        {shown.length > limit ? (
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="btn btn-ghost btn-sm mt-3" data-cw-more>
            Show {Math.min(PAGE, shown.length - limit)} more ({shown.length - limit} left)
          </button>
        ) : null}
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          A decor that isn&rsquo;t here: tell Claude its name or code from{' '}
          <a href={CWORKSHOP_URL} target="_blank" rel="noreferrer" className="text-accent underline">
            Cworkshop&rsquo;s site
          </a>{' '}
          and it goes in with its price.
        </p>
      </section>

      <section className="mt-8" data-cw-changes>
        <h2 className={label}>What changed</h2>
        <ul className="mt-2 grid grid-cols-1 gap-2">
          {(allChanges ? changes : changes.slice(0, 3)).map((c, i) => (
            <li key={`${c.at}-${i}`} className="rounded-sm border border-line bg-mount px-3.5 py-2.5 text-[14px] leading-relaxed">
              <span className="font-mono text-[12px] text-faint">{day(c.at)}</span>
              <span className="mt-0.5 block">{c.text}</span>
            </li>
          ))}
        </ul>
        {changes.length > 3 && !allChanges ? (
          <button type="button" onClick={() => setAllChanges(true)} className="mt-2 font-mono text-[13px] text-accent underline">
            Show all {changes.length}
          </button>
        ) : null}
      </section>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-paper px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={save} disabled={!changed} className="btn btn-primary w-full disabled:opacity-50" data-cw-save>
          Save my prices
        </button>
        {saved && !changed ? <p className="mt-1.5 text-center font-mono text-[12.5px] text-muted">{saved}</p> : null}
      </div>
    </div>
  );
}

function Decor({ b, value, onChange }: { b: Board; value: string; onChange: (v: string) => void }) {
  const offer = b.offerEnds && b.normalExVat ? ` on offer to ${day(b.offerEnds)} (usually ${money2(b.normalExVat)})` : '';
  return (
    <div className="flex h-full gap-3 rounded-sm border border-line-strong bg-mount p-2.5" data-cw-decor={b.code}>
      <span aria-hidden className="h-12 w-12 shrink-0 rounded-sm border border-line-strong" style={{ background: b.hex }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight">{b.name}</span>
        <span className="mt-0.5 block font-mono text-[11.5px] text-faint">
          {b.brand ?? 'Egger'} · {b.code} · {b.thick ?? 18} mm
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-muted">{b.describe}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[13.5px]">
            Cworkshop <b className="font-semibold">{money2(b.exVat)}</b>
            <span className="text-muted">{offer}</span>
          </span>
          <a href={b.url} target="_blank" rel="noreferrer" className="font-mono text-[12.5px] text-accent underline">
            Their page
          </a>
        </span>
        <label className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[13px] text-muted">Yours £</span>
          <input
            inputMode="decimal"
            value={value}
            placeholder={b.exVat.toFixed(2)}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Your price for ${b.name}`}
            className={`${fieldSized} h-10 w-[92px] text-right font-mono text-[14.5px]`}
          />
        </label>
      </span>
    </div>
  );
}

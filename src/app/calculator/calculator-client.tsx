'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  calcCharFromKey,
  clearCalcHistory,
  evalDimExpression,
  formatMm,
  isClearKey,
  isTypingTarget,
  loadCalcHistory,
  previewDimExpression,
  saveCalcEntry,
  startsNewCalc,
  toFeetInches,
  toInches,
  type CalcHistoryEntry,
} from '@/lib/calc';

/* Same keys as the CabinetOS Quick calc. */
type Key = { k: string; label: string; aria?: string; kind?: 'op' | 'eq' | 'fn'; span?: boolean };
const KEYS: Key[] = [
  { k: 'back', label: '⌫', aria: 'Delete last', kind: 'fn' },
  { k: 'paren', label: '( )', aria: 'Bracket', kind: 'fn' },
  { k: '%', label: '%', aria: 'Percent', kind: 'fn' },
  { k: '÷', label: '÷', aria: 'Divide', kind: 'op' },
  { k: '7', label: '7' }, { k: '8', label: '8' }, { k: '9', label: '9' },
  { k: '×', label: '×', aria: 'Multiply', kind: 'op' },
  { k: '4', label: '4' }, { k: '5', label: '5' }, { k: '6', label: '6' },
  { k: '−', label: '−', aria: 'Minus', kind: 'op' },
  { k: '1', label: '1' }, { k: '2', label: '2' }, { k: '3', label: '3' },
  { k: '+', label: '+', aria: 'Plus', kind: 'op' },
  { k: '0', label: '0' }, { k: '.', label: '.', aria: 'Point' },
  { k: '=', label: '=', aria: 'Equals', kind: 'eq', span: true },
];

/* Real sums from fitted furniture. 18 mm board, 3 mm door gaps. */
const EXAMPLES = [
  { title: 'Inside width of a 600 mm unit', expr: '600 − 18 × 2' },
  { title: 'Two doors on a 1200 mm opening, 3 mm gaps', expr: '(1200 − 3 × 3) ÷ 2' },
  { title: 'Gap between 3 shelves, 2000 mm inside', expr: '(2000 − 3 × 18) ÷ 4' },
  { title: 'Three 600 mm units plus two end panels', expr: '600 × 3 + 18 × 2' },
  { title: 'Skirting round a 4 × 3 m room, plus 10%', expr: '(4000 + 3000) × 2 + 10%' },
];

const BOARD_L = 2440;
const BOARD_W = 1220;

/* Puts spaces round operators so a sum reads like it would on paper ("−" after an operator stays a minus sign). */
function pretty(expr: string) {
  const s = expr.replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('+−×÷'.includes(c)) {
      const unary = c === '−' && (i === 0 || '(+−×÷'.includes(s[i - 1]));
      out += unary ? c : ` ${c} `;
    } else out += c;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function boardNote(v: number) {
  if (v <= BOARD_W) return `Fits across the board width, ${formatMm(BOARD_W - v)} mm spare`;
  if (v <= BOARD_L) return `Fits along the board, ${formatMm(+(BOARD_L - v).toFixed(3))} mm spare`;
  return `Longer than a board by ${formatMm(+(v - BOARD_L).toFixed(3))} mm`;
}

export default function CalculatorClient() {
  const [expr, setExpr] = useState('');
  const [done, setDone] = useState(false); // true straight after "=", until the next key
  const [history, setHistory] = useState<CalcHistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [lastSum, setLastSum] = useState(''); // the sum that "=" just worked out, shown above the answer
  const exprRef = useRef(expr);
  const doneRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  exprRef.current = expr;
  doneRef.current = done;

  useEffect(() => {
    setHistory(loadCalcHistory());
  }, []);

  const value = previewDimExpression(expr);
  const finished = evalDimExpression(expr);

  const evaluate = useCallback(() => {
    const current = exprRef.current;
    const v = evalDimExpression(current) ?? previewDimExpression(current);
    if (v === null) return;
    if (String(v) !== current) {
      setHistory(saveCalcEntry({ expr: pretty(current), result: v }));
      setLastSum(pretty(current));
    } else setLastSum('');
    setExpr(String(v));
    setDone(true);
  }, []);

  const append = useCallback((ch: string) => {
    const fresh = doneRef.current && startsNewCalc(ch);
    setDone(false);
    setExpr((e) => (fresh ? '' : e) + ch);
  }, []);

  const back = useCallback(() => {
    setDone(false);
    setExpr((e) => e.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setDone(false);
    setExpr('');
  }, []);

  const paren = useCallback(() => {
    const fresh = doneRef.current;
    setDone(false);
    setExpr((prev) => {
      const e = fresh ? '' : prev;
      const open = (e.match(/\(/g) ?? []).length - (e.match(/\)/g) ?? []).length;
      const last = e.slice(-1);
      // Close a bracket only when there's one open and the last thing typed was a number or ")".
      return e + (open > 0 && /[0-9.)%]/.test(last) ? ')' : '(');
    });
  }, []);

  const press = (k: string) => {
    if (k === 'back') return back();
    if (k === 'paren') return paren();
    if (k === '=') return evaluate();
    append(k);
  };

  // Typing on a keyboard works straight away, like in CabinetOS.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      // Someone who tabbed to a link or button still uses Enter and Space to press it.
      // After a mouse click or tap the button isn't :focus-visible, so Enter means "=".
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof HTMLElement && e.target.closest('a, button') && e.target.matches(':focus-visible')) return;
      const has = exprRef.current.length > 0;
      let handled = true;
      if (e.key === 'Enter' || e.key === '=') evaluate();
      else if (e.key === 'Backspace') { if (has) back(); }
      else if (isClearKey(e.key)) { if (has) clear(); else handled = false; }
      else {
        const ch = calcCharFromKey(e.key);
        if (ch !== null) append(ch);
        else handled = false;
      }
      if (handled) e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [evaluate, back, clear, append]);

  const copy = async () => {
    if (value === null) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const load = (e: string) => {
    setExpr(e.replace(/\s+/g, ''));
    setDone(false);
    if (window.matchMedia('(max-width: 767px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showBar = value !== null && value > 0;
  const fill = showBar ? Math.min(value / BOARD_L, 1) * 100 : 0;
  const over = showBar && value > BOARD_L;
  const feet = value !== null ? toFeetInches(value) : null;

  return (
    <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-6">
      {/* The calculator */}
      <div ref={panelRef} className="scroll-mt-24 md:col-span-7 lg:col-span-6">
        <div className="mount !p-0">
          {/* Display */}
          <div className="border-b border-line-strong bg-mount">
            <div className="calc-ticks" aria-hidden="true" />
            <div className="px-5 pb-5 pt-3 md:px-7 md:pb-6">
              <div className="flex min-h-[28px] items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-mono text-[15px] text-muted" aria-label="Sum">
                  {done && lastSum ? (
                    <span>{lastSum} =</span>
                  ) : expr ? (
                    pretty(expr)
                  ) : (
                    <span className="text-faint">Type a sum</span>
                  )}
                  {!done ? <span className="calc-caret" aria-hidden="true" /> : null}
                </p>
                {expr ? (
                  <button type="button" onClick={clear} className="flex-none rounded-sm border border-line-strong px-2.5 py-1 font-mono text-[12px] text-muted transition-colors hover:border-ink hover:text-ink">
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-2 flex items-end justify-between gap-4" aria-live="polite" aria-atomic="true">
                <p className="min-w-0 flex-1 truncate font-display text-[52px] font-[650] leading-none tracking-[-0.03em] tabular-nums md:text-[64px]">
                  {value !== null ? (
                    <span className={done || finished !== null || !expr ? 'text-ink' : 'text-ink/60'}>{formatMm(value)}</span>
                  ) : (
                    <span className="text-faint">{expr ? '—' : '0'}</span>
                  )}
                  <span className="ml-2 font-mono text-[16px] font-normal tracking-normal text-faint">mm</span>
                </p>
                <button
                  type="button"
                  onClick={copy}
                  disabled={value === null}
                  className="mb-1 flex-none rounded-sm border border-line-strong px-3 py-1.5 font-mono text-[12px] text-accent transition-colors hover:border-accent disabled:opacity-40"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Other units */}
              <dl className="mt-5 grid grid-cols-3 border-t border-line pt-4 font-mono text-[12px]">
                <div>
                  <dt className="text-faint">cm</dt>
                  <dd className="mt-1 text-[14px] text-ink">{value !== null ? formatMm(+(value / 10).toFixed(4)) : '–'}</dd>
                </div>
                <div>
                  <dt className="text-faint">metres</dt>
                  <dd className="mt-1 text-[14px] text-ink">{value !== null ? formatMm(+(value / 1000).toFixed(4)) : '–'}</dd>
                </div>
                <div>
                  <dt className="text-faint">inches</dt>
                  <dd className="mt-1 text-[14px] text-ink">
                    {value !== null ? toInches(value) : '–'}
                    {feet ? <span className="block text-faint">{feet}</span> : null}
                  </dd>
                </div>
              </dl>

              {/* Against a full board */}
              <div className="mt-5">
                <div className="flex items-baseline justify-between font-mono text-[12px] text-faint">
                  <span>Against a {formatMm(BOARD_L)} × {formatMm(BOARD_W)} board</span>
                  <span className={over ? 'text-accent' : ''}>{showBar ? `${Math.round((value / BOARD_L) * 100)}%` : ''}</span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-raised">
                  <div className={`calc-bar-fill absolute inset-y-0 left-0 rounded-full ${over ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${fill}%` }} />
                  <span className="absolute -top-1 bottom-[-4px] left-1/2 w-px bg-line-strong" aria-hidden="true" />
                </div>
                <div className="relative mt-1.5 h-4 font-mono text-[11px] text-faint" aria-hidden="true">
                  <span className="absolute left-0">0</span>
                  <span className="absolute left-1/2 -translate-x-1/2">1220</span>
                  <span className="absolute right-0">2440</span>
                </div>
                <p className={`mt-2 min-h-[20px] text-[14px] ${over ? 'text-accent' : 'text-muted'}`}>{showBar ? boardNote(value) : ''}</p>
              </div>
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2 bg-raised p-3 md:gap-2.5 md:p-4">
            {KEYS.map((key) => (
              <button
                key={key.k}
                type="button"
                aria-label={key.aria}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => press(key.k)}
                className={`calc-key h-14 rounded-sm border text-[21px] transition-colors md:h-[60px] ${key.span ? 'col-span-2' : ''} ${
                  key.kind === 'eq'
                    ? 'border-accent bg-accent font-semibold text-on-accent hover:bg-accent-hover'
                    : key.kind === 'op'
                      ? 'border-line-strong bg-mount font-medium text-accent hover:border-accent'
                      : key.kind === 'fn'
                        ? 'border-line bg-paper font-mono text-[17px] text-muted hover:border-ink hover:text-ink'
                        : 'border-line-strong bg-mount font-medium tabular-nums text-ink hover:border-ink'
                }`}
              >
                {key.label}
              </button>
            ))}
          </div>
        </div>

        {/* History */}
        {history.length > 0 ? (
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-[13px] text-faint">Your recent sums</h2>
              <button
                type="button"
                onClick={() => {
                  clearCalcHistory();
                  setHistory([]);
                }}
                className="font-mono text-[12px] text-faint transition-colors hover:text-ink"
              >
                Clear list
              </button>
            </div>
            <ul className="mt-2 border-t border-line">
              {history.slice(0, 5).map((h) => (
                <li key={h.expr} className="border-b border-line">
                  <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => load(h.expr)} className="flex w-full items-baseline justify-between gap-4 py-2.5 text-left font-mono text-[14px] transition-colors hover:text-accent">
                    <span className="min-w-0 truncate text-muted">{h.expr}</span>
                    <span className="flex-none text-ink">= {formatMm(h.result)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Examples and notes */}
      <aside className="md:col-span-5 md:col-start-8">
        <h2 className="font-display text-[24px] font-[650] tracking-[-0.02em]">Try a real sum</h2>
        <p className="mt-2 text-[15px] text-muted">Tap one to load it. These are the sums I do on every wardrobe, with 18 mm board.</p>
        <ul className="mt-5 border-t border-line">
          {EXAMPLES.map((ex) => (
            <li key={ex.expr} className="border-b border-line">
              <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => load(ex.expr)} className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-4 text-left">
                <span className="text-[16px] font-medium text-ink transition-colors group-hover:text-accent">{ex.title}</span>
                <span className="row-span-2 font-mono text-[15px] text-ink">= {formatMm(evalDimExpression(ex.expr) ?? 0)}</span>
                <span className="mt-1 font-mono text-[13px] text-faint">{ex.expr}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-8 hidden md:block">
          <h3 className="font-mono text-[13px] text-faint">On a keyboard</h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px] text-muted">
            <li><kbd className="calc-kbd">0–9</kbd> numbers</li>
            <li><kbd className="calc-kbd">x</kbd> or <kbd className="calc-kbd">*</kbd> times</li>
            <li><kbd className="calc-kbd">Enter</kbd> equals</li>
            <li><kbd className="calc-kbd">⌫</kbd> delete</li>
            <li><kbd className="calc-kbd">Esc</kbd> clear</li>
            <li><kbd className="calc-kbd">( )</kbd> brackets</li>
          </ul>
        </div>

        <div className="mt-8 rounded-sm border border-line bg-raised p-5">
          <p className="font-mono text-[13px] text-accent">From CabinetOS</p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            This is the quick calc built into CabinetOS, my cut list app. The full app turns your units into cut lists and board layouts.
          </p>
          <Link href="/cabinetos" className="link-more mt-3 text-[15px]">
            See CabinetOS <span aria-hidden="true">→</span>
          </Link>
        </div>
      </aside>
    </div>
  );
}

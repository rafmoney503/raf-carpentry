/* Workshop calculator maths. Same keys and behaviour as the CabinetOS Quick calc, with a small
   parser instead of eval, so % works like a phone calculator and a half-typed sum still shows
   an answer while you type. All numbers are millimetres. */

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] | null {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      if ((raw.match(/\./g) ?? []).length > 1 || raw === '.') return null;
      out.push({ t: 'num', v: parseFloat(raw) });
      i = j;
    } else if ('+-*/()%'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else return null;
  }
  return out;
}

type Factor = { value: number; pct: boolean; raw: number };

function evaluateTokens(toks: Tok[]): number | null {
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;

  function factor(): Factor {
    if (isOp('-')) { i++; const f = factor(); return { value: -f.value, pct: f.pct, raw: -f.raw }; }
    if (isOp('+')) { i++; return factor(); }
    let v: number;
    const t = peek();
    if (t?.t === 'num') { v = t.v; i++; }
    else if (isOp('(')) {
      i++;
      v = expr();
      if (!isOp(')')) throw new Error('bracket');
      i++;
    } else throw new Error('value');
    if (isOp('%')) { i++; return { value: v / 100, pct: true, raw: v }; }
    return { value: v, pct: false, raw: v };
  }

  // A term on its own like "10%" keeps its percent flag, so "2400 + 10%" adds 10% of 2400.
  function term(): Factor {
    const first = factor();
    if (!isOp('*') && !isOp('/')) return first;
    let v = first.value;
    while (isOp('*') || isOp('/')) {
      const op = toks[i++].v;
      const f = factor();
      if (op === '*') v *= f.value;
      else {
        if (f.value === 0) throw new Error('divide by zero');
        v /= f.value;
      }
    }
    return { value: v, pct: false, raw: v };
  }

  function expr(): number {
    let left = term().value;
    while (isOp('+') || isOp('-')) {
      const op = toks[i++].v;
      const r = term();
      const amount = r.pct ? (left * r.raw) / 100 : r.value;
      left = op === '+' ? left + amount : left - amount;
    }
    return left;
  }

  try {
    const v = expr();
    if (i !== toks.length) return null;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Exact answer of a finished sum, or null if it doesn't add up. */
export function evalDimExpression(expr: string): number | null {
  const toks = tokenize(expr);
  if (!toks || toks.length === 0) return null;
  const v = evaluateTokens(toks);
  return v === null ? null : round(v);
}

/** Answer while still typing: ignores a trailing operator and closes any open brackets. */
export function previewDimExpression(expr: string): number | null {
  let e = expr.trim().replace(/[+\-−×÷*/(\s]+$/, '');
  const open = (e.match(/\(/g) ?? []).length - (e.match(/\)/g) ?? []).length;
  if (open > 0) e += ')'.repeat(open);
  return evalDimExpression(e);
}

/* Readouts under the answer */

function fraction16(inches: number) {
  const sign = inches < 0 ? '-' : '';
  const a = Math.abs(inches);
  let whole = Math.floor(a);
  let n = Math.round((a - whole) * 16);
  if (n === 16) { whole += 1; n = 0; }
  let d = 16;
  while (n > 0 && n % 2 === 0) { n /= 2; d /= 2; }
  return { sign, whole, frac: n ? `${n}/${d}` : '' };
}

/** 2400 mm → 94 1/2″ */
export function toInches(mm: number) {
  const { sign, whole, frac } = fraction16(mm / 25.4);
  if (!whole && !frac) return '0″';
  return `${sign}${whole ? whole : ''}${whole && frac ? ' ' : ''}${frac}″`;
}

/** 2400 mm → 7′ 10 1/2″ (only used from a foot up) */
export function toFeetInches(mm: number) {
  const totalIn = Math.abs(mm) / 25.4;
  if (totalIn < 12) return null;
  const { whole, frac } = fraction16(totalIn);
  const ft = Math.floor(whole / 12);
  const inch = whole % 12;
  const inchPart = inch || frac ? ` ${inch ? inch : ''}${inch && frac ? ' ' : ''}${frac}″` : '';
  return `${mm < 0 ? '-' : ''}${ft}′${inchPart}`;
}

export function formatMm(n: number) {
  n = Math.round(n * 1000) / 1000; // no 418.66700000000003
  const [i, d] = String(Math.abs(n)).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '−' : ''}${grouped}${d ? '.' + d : ''}`;
}

/* Keyboard helpers, same mapping as CabinetOS */

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return INPUT_TAGS.has(target.tagName) || target.isContentEditable;
}

export function calcCharFromKey(key: string): string | null {
  if (/^[0-9]$/.test(key)) return key;
  if (key === '.' || key === ',') return '.';
  if (key === '+') return '+';
  if (key === '-') return '−';
  if (key === '*' || key === 'x' || key === 'X') return '×';
  if (key === '/') return '÷';
  if (key === '(' || key === ')') return key;
  if (key === '%') return '%';
  return null;
}

export function isClearKey(key: string) {
  return key === 'Delete' || key === 'Escape' || key === 'c' || key === 'C';
}

/** After "=", a number starts a new sum; an operator carries the answer on (2400 → 2400÷3). */
export function startsNewCalc(ch: string) {
  return /^[0-9.(]$/.test(ch);
}

/* History, kept in this browser only */

export type CalcHistoryEntry = { expr: string; result: number };
const HISTORY_KEY = 'raf_calc_history';
const MAX_HISTORY = 8;

export function loadCalcHistory(): CalcHistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(v) ? v.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveCalcEntry(entry: CalcHistoryEntry): CalcHistoryEntry[] {
  const next = [entry, ...loadCalcHistory().filter((h) => h.expr !== entry.expr)].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* private window: history just lasts for this visit */
  }
  return next;
}

export function clearCalcHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* nothing to clear */
  }
}

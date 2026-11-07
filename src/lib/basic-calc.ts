/* The simple calculator at /tools/calculator (7 Nov 2026, Raf picked mockup C2, with C3 for night mode, on the
   'Basic calculator mockups' design canvas). A plain four-function calculator: type a number, press an operator,
   type the next, press =. No imports, so it runs in tests. */

export type CalcOp = '÷' | '×' | '−' | '+';
export type CalcKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back' | 'C' | CalcOp | '=';

export type CalcState = {
  /** the number on the display, as typed or worked out ("-12.5") */
  cur: string;
  /** the number before the operator */
  prev: string | null;
  op: CalcOp | null;
  /** the next digit starts a new number (just after an operator or =) */
  fresh: boolean;
  /** the sum just worked out ("600 − 36 =") or why it couldn't be */
  done: string;
  err: boolean;
};

export const CALC_START: CalcState = { cur: '0', prev: null, op: null, fresh: false, done: '', err: false };

/** most digits a number can have */
export const MAX_DIGITS = 12;

const OPS: readonly CalcOp[] = ['÷', '×', '−', '+'];
const DIV_ZERO = "Can't divide by 0";

export function isOp(k: string): k is CalcOp {
  return (OPS as readonly string[]).includes(k);
}

function calc(a: number, op: CalcOp, b: number): number | null {
  if (op === '÷') return b === 0 ? null : a / b;
  if (op === '×') return a * b;
  if (op === '−') return a - b;
  return a + b;
}

/** 0.1 + 0.2 gives 0.3, not 0.30000000000000004 */
export function tidy(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  const s = String(parseFloat(n.toPrecision(MAX_DIGITS)));
  return s === '-0' ? '0' : s;
}

/** "-1234.5" → "−1,234.5" */
export function showNumber(t: string | null): string {
  if (t == null) return '';
  let s = t;
  if (s.includes('e')) return s.replace('-', '−');
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [int, dec] = s.split('.');
  return (neg ? '−' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec !== undefined ? '.' + dec : '');
}

function failed(): CalcState {
  return { cur: '0', prev: null, op: null, fresh: true, done: DIV_ZERO, err: true };
}

export function pressKey(state: CalcState, k: CalcKey): CalcState {
  let s: CalcState = { ...state };
  if (s.err) {
    // after an error any key starts again; a digit or point also starts the new number
    s = { ...CALC_START };
    if (!/^[0-9.]$/.test(k)) return s;
  }
  if (/^[0-9]$/.test(k)) {
    if (s.fresh) s.done = '';
    if (s.fresh || s.cur === '0') s.cur = k;
    else if (s.cur === '-0') s.cur = '-' + k;
    else if (s.cur.replace(/[-.]/g, '').length < MAX_DIGITS) s.cur += k;
    s.fresh = false;
    return s;
  }
  if (k === '.') {
    if (s.fresh) {
      s.done = '';
      s.cur = '0.';
      s.fresh = false;
    } else if (!s.cur.includes('.') && !s.cur.includes('e')) s.cur += '.';
    return s;
  }
  if (k === 'back') {
    if (s.fresh) return s;
    s.cur = s.cur.length > 1 ? s.cur.slice(0, -1) : '0';
    if (s.cur === '-' || s.cur === '') s.cur = '0';
    return s;
  }
  if (k === 'C') return { ...CALC_START };
  if (isOp(k)) {
    if (s.op && !s.fresh) {
      const r = calc(+s.prev!, s.op, +s.cur);
      if (r === null) return failed();
      s.cur = tidy(r);
    }
    s.prev = s.cur;
    s.op = k;
    s.fresh = true;
    s.done = '';
    return s;
  }
  // =
  if (!s.op) return s;
  const b = s.fresh ? s.prev! : s.cur;
  const r = calc(+s.prev!, s.op, +b);
  if (r === null) return failed();
  s.done = `${showNumber(s.prev)} ${s.op} ${showNumber(b)} =`;
  s.cur = tidy(r);
  s.prev = null;
  s.op = null;
  s.fresh = true;
  return s;
}

export type CalcView = {
  /** the big number */
  big: string;
  /** the small line above it: "600 −" while typing the next number, "600 − 36 =" after = */
  line: string;
  /** the operator waiting for the next number, lit up */
  lit: CalcOp | null;
  err: boolean;
};

export function calcView(s: CalcState): CalcView {
  return {
    big: s.err ? 'Error' : showNumber(s.cur),
    line: s.op ? `${showNumber(s.prev)} ${s.op}` : s.done,
    lit: s.op && s.fresh ? s.op : null,
    err: s.err,
  };
}

/* The Job Kit's personal to do (26 Oct 2026, Raf: 'create separate todo personal like daily chores unrelated to
   website and programming in a smart way'). The sums only, no imports: what a typed line means ('Bins out every
   Tuesday 7pm'), when a repeating chore comes round again, and which group each one sits in. Days are local dates as
   'YYYY-MM-DD' (the phone is in London); the sums go through UTC noon so a clock change never moves a day. */

export type Unit = 'day' | 'week' | 'month' | 'year';
export type Repeat = {
  every: number; // 1 = every week, 2 = every other week ...
  unit: Unit;
  days?: number[]; // weekly on these days, 0 Sunday to 6 Saturday
  dom?: number; // monthly or yearly on this day of the month (31 = the last day in shorter months)
};
export type Chore = {
  id: string;
  text: string;
  due: string | null; // null = any time
  time?: string | null; // 'HH:MM'
  rep?: Repeat | null;
  done?: number | null; // a one-off ticked (ms)
  last?: number | null; // a repeating one last ticked (ms)
  was?: string | null; // its date before that tick, so 'Not done' can put it back
  note?: string;
  created: number;
  at: number; // last change, for keeping the phone and the computer in step
};

/* ---------- days ---------- */

export const dayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parts = (key: string) => key.split('-').map(Number) as [number, number, number];
const utc = (key: string) => {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d, 12);
};
const fromUtc = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
export const addDays = (key: string, n: number) => fromUtc(utc(key) + n * 864e5);
export const weekday = (key: string) => new Date(utc(key)).getUTCDay();
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 864e5);
const lastDom = (y: number, m: number) => new Date(Date.UTC(y, m, 0, 12)).getUTCDate(); // m 1-12
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDom(y, m))).padStart(2, '0')}`;
export function addMonths(key: string, n: number, dom?: number) {
  const [y, m, d] = parts(key);
  const t = y * 12 + (m - 1) + n;
  return ymd(Math.floor(t / 12), (t % 12) + 1, dom ?? d);
}
const mon0 = (wd: number) => (wd + 6) % 7; // Monday = 0: a UK week

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;

/* ---------- repeats ---------- */

/* Counted from the day it's done (water the plants every 3 days) or kept to its own days (bins on a Tuesday, the MOT on
   its date). */
export const fromDone = (r: Repeat) => r.unit === 'day' || (r.unit === 'week' && !r.days?.length);

/* The next time round after `key`. */
export function step(key: string, r: Repeat): string {
  const n = Math.max(1, Math.round(r.every) || 1);
  if (r.unit === 'day') return addDays(key, n);
  if (r.unit === 'month') return addMonths(key, n, r.dom);
  if (r.unit === 'year') return addMonths(key, 12 * n, r.dom);
  const days = [...new Set(r.days ?? [])].filter((d) => d >= 0 && d <= 6).sort((a, b) => mon0(a) - mon0(b));
  if (!days.length) return addDays(key, 7 * n);
  const at = mon0(weekday(key));
  const later = days.find((d) => mon0(d) > at);
  if (later !== undefined) return addDays(key, mon0(later) - at);
  // round to the first of the days, n weeks on
  return addDays(key, 7 * n - at + mon0(days[0]));
}

/* The first one on or after today, for a new repeating chore with no date of its own. */
export function firstDue(r: Repeat, today: string): string {
  if (r.unit === 'week' && r.days?.length) {
    for (let i = 0; i < 7; i++) {
      const k = addDays(today, i);
      if (r.days.includes(weekday(k))) return k;
    }
  }
  if ((r.unit === 'month' || r.unit === 'year') && r.dom) {
    const [y, m] = parts(today);
    const k = ymd(y, m, r.dom);
    return k >= today ? k : addMonths(k, 1, r.dom);
  }
  return today;
}

/* When it comes round after being ticked today: always after today, so a late tick never leaves a pile behind. */
export function nextDue(c: Chore, today: string): string | null {
  const r = c.rep;
  if (!r) return c.due;
  if (fromDone(r) || !c.due) return step(today, r);
  let k = step(c.due, r);
  for (let i = 0; k <= today && i < 2000; i++) k = step(k, r);
  return k;
}

export function describe(r: Repeat | null | undefined, due?: string | null): string {
  if (!r) return '';
  const n = Math.max(1, Math.round(r.every) || 1);
  const days = [...new Set(r.days ?? [])].sort((a, b) => mon0(a) - mon0(b));
  if (r.unit === 'day') return n === 1 ? 'Every day' : n === 2 ? 'Every other day' : `Every ${n} days`;
  if (r.unit === 'week') {
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)) && n === 1) return 'Weekdays';
    if (days.length === 2 && days.includes(6) && days.includes(0) && n === 1) return 'Weekends';
    if (days.length === 7 && n === 1) return 'Every day';
    const list = days.map((d) => DAY_SHORT[d]);
    const named = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
    if (named) return n === 1 ? `Every ${named}` : n === 2 ? `Every other ${named}` : `Every ${n} weeks on ${named}`;
    return n === 1 ? 'Every week' : n === 2 ? 'Every 2 weeks' : `Every ${n} weeks`;
  }
  if (r.unit === 'month') {
    const on = r.dom === 31 ? ' on the last day' : r.dom ? ` on the ${ord(r.dom)}` : '';
    return n === 1 ? `Every month${on}` : n === 3 && !on ? 'Every 3 months' : `Every ${n} months${on}`;
  }
  const on = due ? ` on ${parts(due)[2]} ${MONTHS[parts(due)[1] - 1]}` : '';
  return n === 1 ? `Every year${on}` : `Every ${n} years${on}`;
}

/* A chore's date and repeat made to agree after either was changed by hand: a weekly one lands on one of its days, a
   monthly or yearly one keeps to its date's day of the month (the last day stays the last day). */
export function fitRepeat(rep: Repeat | null, due: string | null, today: string): { rep: Repeat | null; due: string | null } {
  if (!rep) return { rep, due };
  const r: Repeat = { ...rep, every: Math.min(99, Math.max(1, Math.round(rep.every) || 1)) };
  if (r.unit === 'week' && r.days?.length) {
    r.days = [...new Set(r.days)].sort((a, b) => mon0(a) - mon0(b));
    return { rep: r, due: due && r.days.includes(weekday(due)) ? due : firstDue(r, due ?? today) };
  }
  if (r.unit === 'week' || r.unit === 'day') return { rep: { every: r.every, unit: r.unit }, due: due ?? today };
  if (!due) return { rep: r, due: firstDue(r, today) };
  const [y, m, d] = parts(due);
  if (!(r.dom === 31 && d === lastDom(y, m))) r.dom = d;
  return { rep: r, due };
}

/* ---------- words for a day ---------- */

export function dateWords(key: string, today: string): string {
  const [y, m, d] = parts(key);
  const gap = daysBetween(today, key);
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Tomorrow';
  if (gap === -1) return 'Yesterday';
  if (gap > 1 && gap < 7) return DAY_NAMES[weekday(key)];
  const base = `${DAY_SHORT[weekday(key)]} ${d} ${MONTHS[m - 1]}`;
  return y === parts(today)[0] ? base : `${base} ${y}`;
}
export const lateWords = (key: string, today: string) => {
  const g = daysBetween(key, today);
  return g === 1 ? 'since yesterday' : g < 7 ? `${g} days late` : g < 14 ? 'a week late' : g < 60 ? `${Math.floor(g / 7)} weeks late` : 'a while late';
};

/* ---------- reading a typed line ---------- */

const DAY_RE = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const FULL_DAY_RE = '(monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const dayNo = (w: string) => ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'].indexOf(w.slice(0, 2).toLowerCase());
const monthNo = (w: string) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(w.slice(0, 3).toLowerCase()) + 1;
const NUMS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const num = (w: string) => (/^\d+$/.test(w) ? Number(w) : NUMS[w.toLowerCase()] ?? NaN);
const unitOf = (w: string): Unit => (/^d/i.test(w) ? 'day' : /^w/i.test(w) ? 'week' : /^m/i.test(w) ? 'month' : 'year');

export type Parsed = { text: string; due: string | null; time: string | null; rep: Repeat | null };

/* 'Bins out every Tuesday 7pm', 'Car MOT 14 March every year', 'Pay council tax on the 1st every month',
   'Water the plants every 3 days', 'Call mum Sunday', 'Dentist 12 Nov at 9:30', 'Buy milk tomorrow'. What isn't a
   day, time or repeat is the chore's name. */
export function parseChore(input: string, today: string): Parsed {
  let s = ` ${input.replace(/\s+/g, ' ').trim()} `;
  let time: string | null = null;
  let rep: Repeat | null = null;
  let due: string | null = null;
  let dom: number | undefined;
  const cut = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = s.match(re);
    if (!m || m.index === undefined) return false;
    if (fn(m) === false) return false;
    s = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`;
    return true;
  };

  // a time: 7pm, 7.30pm, at 19:00, noon
  void (cut(/\s(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)(?=\W)/i, (m) => {
    let h = Number(m[1]);
    const mi = Number(m[2] || 0);
    if (h < 1 || h > 12 || mi > 59) return false;
    if (/pm/i.test(m[3]) && h < 12) h += 12;
    if (/am/i.test(m[3]) && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  }) ||
    cut(/\s(?:at\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)(?=\W)(?!\s*\/)/i, (m) => {
      time = `${m[1].padStart(2, '0')}:${m[2]}`;
    }) ||
    cut(/\s(?:at\s+)?(noon|midday)(?=\W)/i, () => {
      time = '12:00';
    }));

  // repeats
  const daysList = (txt: string) => [...txt.matchAll(new RegExp(DAY_RE, 'gi'))].map((x) => dayNo(x[1]));
  void (cut(new RegExp(`\\s(?:every|each)\\s+(other|second|2nd|alternate)\\s+${DAY_RE}s?(?=\\W)`, 'i'), (m) => {
    rep = { every: 2, unit: 'week', days: [dayNo(m[2])] };
  }) ||
    cut(/\s(?:every|each)\s+(?:other|second)\s+(day|week|month|year)(?=\W)/i, (m) => {
      rep = { every: 2, unit: unitOf(m[1]) };
    }) ||
    cut(/\s(?:every|each)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?|years?)(?=\W)/i, (m) => {
      rep = { every: num(m[1]), unit: unitOf(m[2]) };
    }) ||
    cut(/\s(?:(?:every|each)\s+(?:weekday|working\s+day|work\s+day)s?|weekdays|mon(?:day)?\s*(?:-|to)\s*fri(?:day)?)(?=\W)/i, () => {
      rep = { every: 1, unit: 'week', days: [1, 2, 3, 4, 5] };
    }) ||
    cut(/\s(?:(?:every|each)\s+weekend|weekends|(?:on\s+)?sat(?:urday)?s?\s+and\s+sun(?:day)?s?)(?=\W)/i, () => {
      rep = { every: 1, unit: 'week', days: [6, 0] };
    }) ||
    cut(new RegExp(`\\s(?:every|each|on)\\s+${DAY_RE}s?((?:\\s*(?:,|and|&)\\s*${DAY_RE}s?)*)(?=\\W)`, 'i'), (m) => {
      // 'on Tuesday' alone is a one-off; 'every Tuesday', 'on Tuesdays' and 'on Mon and Thu' repeat
      const plural = new RegExp(`${DAY_RE}s\\b`, 'i').test(m[0].replace(/^\s*on\s+/i, '')) && !/^\s*on\s+(?:tues|thurs)\b/i.test(m[0]);
      const days = daysList(m[0].replace(/^\s*(?:every|each|on)\s+/i, ''));
      if (/^\s*on/i.test(m[0]) && !plural && days.length < 2) return false;
      rep = { every: 1, unit: 'week', days: [...new Set(days)] };
    }) ||
    cut(new RegExp(`\\s${FULL_DAY_RE}s(?=\\W)`, 'i'), (m) => {
      rep = { every: 1, unit: 'week', days: [dayNo(m[1])] };
    }) ||
    cut(/\s(?:(?:every|each)\s+(?:day|morning|evening|night)|daily|nightly)(?=\W)/i, () => {
      rep = { every: 1, unit: 'day' };
    }) ||
    cut(/\s(?:(?:every|each)\s+fortnight|fortnightly|bi-?weekly)(?=\W)/i, () => {
      rep = { every: 2, unit: 'week' };
    }) ||
    cut(/\s(?:(?:every|each|once\s+a)\s+week|weekly)(?=\W)/i, () => {
      rep = { every: 1, unit: 'week' };
    }) ||
    cut(/\s(?:(?:every|each)\s+quarter|quarterly)(?=\W)/i, () => {
      rep = { every: 3, unit: 'month' };
    }) ||
    cut(/\s(?:(?:every|each|once\s+a)\s+month|monthly)(?=\W)/i, () => {
      rep = { every: 1, unit: 'month' };
    }) ||
    cut(/\s(?:(?:every|each|once\s+a)\s+year|yearly|annually)(?=\W)/i, () => {
      rep = { every: 1, unit: 'year' };
    }));

  // a day of the month: 'on the 1st', '1st of every month', 'the 28th'
  const r0 = rep as Repeat | null;
  if (r0?.unit === 'month') {
    void (cut(/\s(?:on\s+)?(?:the\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th))(?:\s+of(?:\s+(?:the|every|each))?(?:\s+month)?)?(?=\W)/i, (m) => {
      const d = Number(m[1] ?? m[2]);
      if (d < 1 || d > 31) return false;
      dom = d;
    }) || cut(/\s(?:on\s+)?the\s+last\s+day(?:\s+of\s+the\s+month)?(?=\W)/i, () => {
      dom = 31;
    }));
  }

  // a date
  const year = parts(today)[0];
  const dated = (y: number | null, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > lastDom(y ?? year, m)) return false;
    let k = ymd(y ?? year, m, d);
    if (y === null && k < today) k = ymd(year + 1, m, d);
    due = k;
    if (!dom) dom = d;
  };
  const yr = (w?: string) => (w ? (w.length === 2 ? 2000 + Number(w) : Number(w)) : null);
  void (cut(/\s(?:on\s+)?(?:the\s+)?day\s+after\s+tomorrow(?=\W)/i, () => {
    due = addDays(today, 2);
  }) ||
    cut(/\s(?:today|tonight|this\s+(?:morning|afternoon|evening))(?=\W)/i, () => {
      due = today;
    }) ||
    cut(/\s(?:tomorrow|tmrw|tmr)(?:\s+(?:morning|afternoon|evening|night))?(?=\W)/i, () => {
      due = addDays(today, 1);
    }) ||
    cut(/\s(?:this\s+|at\s+the\s+)?weekend(?=\W)/i, () => {
      const wd = weekday(today);
      due = wd === 6 || wd === 0 ? today : addDays(today, 6 - wd);
    }) ||
    cut(/\snext\s+week(?=\W)/i, () => {
      due = addDays(today, 7 - mon0(weekday(today)));
    }) ||
    cut(/\snext\s+month(?=\W)/i, () => {
      due = addMonths(today, 1, 1);
    }) ||
    cut(/\sin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?|years?)(?=\W)/i, (m) => {
      const n = num(m[1]);
      const u = unitOf(m[2]);
      due = u === 'day' ? addDays(today, n) : u === 'week' ? addDays(today, 7 * n) : addMonths(today, u === 'month' ? n : 12 * n);
    }) ||
    cut(new RegExp(`\\s(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s+(\\d{4}))?(?=\\W)`, 'i'), (m) => dated(yr(m[3]), monthNo(m[2]), Number(m[1]))) ||
    cut(new RegExp(`\\s(?:on\\s+)?${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=\\W)`, 'i'), (m) => dated(yr(m[3]), monthNo(m[1]), Number(m[2]))) ||
    cut(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?=\W)/, (m) => dated(yr(m[3]), Number(m[2]), Number(m[1]))) ||
    cut(new RegExp(`\\s(?:on\\s+)?next\\s+${DAY_RE}(?=\\W)`, 'i'), (m) => {
      const want = dayNo(m[1]);
      const gap = (want - weekday(today) + 7) % 7;
      due = addDays(today, gap === 0 ? 7 : gap);
    }) ||
    cut(new RegExp(`\\s(?:on\\s+|this\\s+)?${FULL_DAY_RE}(?=\\W)`, 'i'), (m) => {
      due = addDays(today, (dayNo(m[1]) - weekday(today) + 7) % 7);
    }) ||
    cut(new RegExp(`\\s(?:on|by)\\s+${DAY_RE}(?=\\W)`, 'i'), (m) => {
      due = addDays(today, (dayNo(m[1]) - weekday(today) + 7) % 7);
    }) ||
    cut(/\son\s+the\s+(\d{1,2})(?:st|nd|rd|th)?(?=\W)/i, (m) => {
      const d = Number(m[1]);
      if (d < 1 || d > 31) return false;
      const [y, mo] = parts(today);
      const k = ymd(y, mo, d);
      due = k >= today ? k : addMonths(k, 1, d);
    }));

  const r = rep as Repeat | null;
  if (r) {
    if ((r.unit === 'month' || r.unit === 'year') && dom) r.dom = dom;
    if (r.unit === 'week' && r.days?.length && due) {
      // 'every other Thursday from next week': the date picks which week
      if (!r.days.includes(weekday(due))) due = firstDue(r, due);
    }
    if (!due) due = firstDue(r, today);
  }

  let text = s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:on|at|by|every|each|the|in|for|from|and|-|,|–)\s+)+/i, '')
    .replace(/(?:\s+(?:on|at|by|every|each|the|in|for|from|and|of|-|,|–))+$/i, '')
    .replace(/[\s,;:–-]+$/, '')
    .trim();
  if (!text) text = input.trim();
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return { text, due, time, rep: r };
}

/* ---------- ticking ---------- */

export function tick(c: Chore, now: number, today: string): Chore {
  if (c.rep) return { ...c, last: now, was: c.due, due: nextDue(c, today), at: now };
  return { ...c, done: now, at: now };
}
/* 'Not done': back to where it was before the tick. */
export function untick(c: Chore, now: number): Chore {
  if (c.rep) return { ...c, last: null, due: c.was ?? c.due, was: null, at: now };
  return { ...c, done: null, at: now };
}

/* ---------- groups ---------- */

export type Group = { key: 'late' | 'today' | 'tomorrow' | 'week' | 'later' | 'any' | 'done'; title: string; items: Chore[] };

const byTime = (a: Chore, b: Chore) =>
  (a.due ?? '9999').localeCompare(b.due ?? '9999') || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.created - b.created;

export function groups(list: Chore[], today: string, todayStart: number): Group[] {
  const open = list.filter((c) => !c.done);
  const late = open.filter((c) => c.due && c.due < today).sort(byTime);
  const now = open.filter((c) => c.due === today).sort(byTime);
  const tomorrow = open.filter((c) => c.due === addDays(today, 1)).sort(byTime);
  const week = open.filter((c) => c.due && c.due > addDays(today, 1) && c.due <= addDays(today, 6)).sort(byTime);
  const later = open.filter((c) => c.due && c.due > addDays(today, 6)).sort(byTime);
  const any = open.filter((c) => !c.due).sort((a, b) => a.created - b.created);
  const done = list
    .filter((c) => (c.done && c.done >= todayStart) || (c.rep && c.last && c.last >= todayStart))
    .sort((a, b) => (b.done ?? b.last ?? 0) - (a.done ?? a.last ?? 0));
  const out: Group[] = [
    { key: 'late', title: 'Late', items: late },
    { key: 'today', title: 'Today', items: now },
    { key: 'tomorrow', title: 'Tomorrow', items: tomorrow },
    { key: 'week', title: 'This week', items: week },
    { key: 'later', title: 'Later', items: later },
    { key: 'any', title: 'Any time', items: any },
    { key: 'done', title: 'Done today', items: done },
  ];
  return out.filter((g) => g.items.length);
}

/* For Today's box: what's late or due today. */
export const dueNow = (list: Chore[], today: string) => list.filter((c) => !c.done && c.due && c.due <= today).sort(byTime);

/* Ideas to start from when the list is empty: the words go into the box, the day is theirs to add. */
export const STARTERS = [
  'Bins out every ',
  'Recycling out every other ',
  'Food shop every Saturday',
  'Change the bedsheets every 2 weeks',
  'Water the plants every 3 days',
  'Test the smoke alarms every month',
  'Car MOT every year on ',
  'Car insurance renewal every year on ',
  'Boiler service every year on ',
];

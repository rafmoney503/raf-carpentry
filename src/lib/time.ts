/* Days and hours in London. Vercel's day buckets are UTC days (the same as London in winter, an hour off in
   summer); HQ's own sums of today and yesterday use London midnight from the hourly buckets. */

export const TZ = 'Europe/London';

/* 'YYYY-MM-DD' of `d` in London. */
export function londonDay(d: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/* The London hour 0-23 of `d`. */
export function londonHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));
}

/* Minutes London is ahead of UTC at `d` (0 or 60). */
function offsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const n = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}

/* The instant London's day `day` ('YYYY-MM-DD') starts. */
export function londonMidnight(day: string): Date {
  const [y, m, dd] = day.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, dd, 0, 0));
  return new Date(guess.getTime() - offsetMinutes(guess) * 60000);
}

/* 'YYYY-MM-DD' plus `n` days. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, w };
}

/* 'Wed 4 Nov' */
export function shortDay(day: string): string {
  const p = parts(day);
  return `${DOW[p.w]} ${p.d} ${MON[p.m - 1]}`;
}

/* '4 November' */
export function dayMonth(day: string): string {
  const p = parts(day);
  return `${p.d} ${MON_LONG[p.m - 1]}`;
}

/* 'Wednesday 11 November' */
export function longDay(day: string): string {
  const p = parts(day);
  return `${DOW_LONG[p.w]} ${p.d} ${MON_LONG[p.m - 1]}`;
}

/* 'W' */
export function dayLetter(day: string): string {
  return DOW[parts(day).w][0];
}

export function dayNumber(day: string): number {
  return parts(day).d;
}

/* '21:40' in London */
export function clock(d: Date | number): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d));
}

/* 'Good morning' / 'Good afternoon' / 'Good evening' */
export function greeting(d: Date = new Date()): string {
  const h = londonHour(d);
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/* '10 Nov at 22:34', or 'today at 09:12', 'yesterday at 18:01' */
export function when(at: number, now: Date = new Date()): string {
  const day = londonDay(new Date(at));
  const today = londonDay(now);
  const c = clock(at);
  if (day === today) return `today at ${c}`;
  if (day === addDays(today, -1)) return `yesterday at ${c}`;
  const p = parts(day);
  return `${p.d} ${MON[p.m - 1]} at ${c}`;
}

/* '5 to 11 November' or '29 October to 4 November' */
export function rangeText(from: string, to: string): string {
  const a = parts(from);
  const b = parts(to);
  if (a.m === b.m) return `${a.d} to ${b.d} ${MON_LONG[b.m - 1]}`;
  return `${a.d} ${MON_LONG[a.m - 1]} to ${b.d} ${MON_LONG[b.m - 1]}`;
}

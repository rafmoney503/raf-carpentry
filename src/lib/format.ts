/* Small words and numbers, used by the server and the screens. */

export function plural(n: number, one: string, many: string = one + 's'): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}

export function num(n: number): string {
  return n.toLocaleString('en-GB');
}

/* Change from `before` to `now` as '+12%' / '−20%' / 'Same', or null when there's nothing to compare with. */
export function pctChange(now: number, before: number): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (before <= 0) return null;
  const p = Math.round(((now - before) / before) * 100);
  if (Math.abs(p) < 3) return { text: 'Same', tone: 'flat' };
  return { text: `${p > 0 ? '+' : '−'}${Math.abs(p)}%`, tone: p > 0 ? 'up' : 'down' };
}

/* '+7' / '−3' / 'same' */
export function diff(now: number, before: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  const d = now - before;
  if (d === 0) return { text: 'same', tone: 'flat' };
  return { text: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, tone: d > 0 ? 'up' : 'down' };
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/* A page path as a short name: '/' → 'Home', '/tools/games/app' → 'tools / games / app'. */
export function pageName(path: string): string {
  if (!path || path === '/') return 'Home';
  if (path === 'Others') return 'Other pages';
  const t = path.replace(/^\//, '').replace(/\//g, ' / ').replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const COUNTRIES: Record<string, string> = {
  GB: 'United Kingdom', PL: 'Poland', US: 'United States', IE: 'Ireland', DE: 'Germany', FR: 'France', ES: 'Spain',
  IT: 'Italy', NL: 'Netherlands', UA: 'Ukraine', IN: 'India', CA: 'Canada', AU: 'Australia', AE: 'United Arab Emirates',
  RO: 'Romania', LT: 'Lithuania', SE: 'Sweden', NO: 'Norway', BE: 'Belgium', PT: 'Portugal', CH: 'Switzerland',
};

export function countryName(code: string): string {
  if (!code) return 'Unknown';
  if (code === 'Others') return 'Other countries';
  return COUNTRIES[code.toUpperCase()] ?? code.toUpperCase();
}

export function deviceName(d: string): string {
  const k = d.toLowerCase();
  if (k === 'mobile') return 'Phone';
  if (k === 'desktop') return 'Computer';
  if (k === 'tablet') return 'Tablet';
  if (k === 'others') return 'Other';
  return d || 'Unknown';
}

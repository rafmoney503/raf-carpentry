/* Goodnotes notebooks on a job (26 Oct 2026, Raf: 'is there a way to connect goodnotes with jobkit so my notes go
   straight to client card', then 'go'): the sums shared by the server (src/lib/goodnotes.ts) and the Job Kit
   (src/app/job-kit/goodnotes.tsx). No imports. Goodnotes' auto-backup puts each notebook in Raf's Dropbox as a
   PDF, in folders like Goodnotes' own; a notebook whose name starts with the ServiceM8 job number ('1234 Smith kitchen',
   '#1234 - Smith', 'J1234 Smith') belongs to that job, and any other one can be linked to a job by hand. */

export type Notebook = {
  id: string; // Dropbox's file id ('id:...')
  name: string; // without .pdf
  path: string; // folders under the backup folder and the name: 'Clients/1234 Smith kitchen'
  size: number; // bytes
  at: string; // last changed (ISO)
  number: string; // the job number at the start of the name, or ''
};

/* The job number a notebook's name starts with ('' if none): digits, maybe after #, J or 'Job', then a break. A date
   isn't a job number (4 Nov 2026: Raf's notebooks have names like '12.05.2026', which read as job 12 and so couldn't
   be linked by hand), nor is a year notebook's name ('2026', '2026 Jobs', '2026 notes'). */
export function numberOf(name: string): string {
  const t = name.trim();
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(?!\d)/.test(t) || /^(?:19|20)\d\d[./-]\d{1,2}[./-]\d{1,2}(?!\d)/.test(t) || /^(?:19|20)\d\d(?:$|\s+(?:jobs?|notes?|notebook|work|clients?|year|diary|site|visits?)\b)/i.test(t)) return '';
  const m = t.match(/^(?:#|j(?:ob)?\s*#?\s*)?(\d{1,7})(?=$|[\s\-–_.,:;)(])/i);
  return m ? String(Number(m[1])) : '';
}

/* ---------- pages of a notebook on a job (4 Nov 2026, Raf: one notebook for the year, a job on each page: 'yes we
   have to do page linking for job'). The job's marks keep { notebook path: page numbers }; pages are counted from 1, as
   Goodnotes shows them. */

/* Page numbers tidied: whole numbers from 1, no repeats, in order. */
export const cleanPages = (pages: unknown, max = 2000): number[] =>
  Array.isArray(pages) ? [...new Set(pages.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b).slice(0, 200) : [];

/* Runs of pages: [3, 7, 8, 9, 12] -> [[3, 3], [7, 9], [12, 12]]. */
function runs(pages: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of cleanPages(pages)) {
    const last = out[out.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else out.push([p, p]);
  }
  return out;
}

/* 'page 14', 'pages 14 and 15', 'pages 14 to 16', 'pages 3, 7 to 9 and 12' */
export function pagesWords(pages: number[]): string {
  const ps = cleanPages(pages);
  if (!ps.length) return 'no pages';
  if (ps.length === 1) return `page ${ps[0]}`;
  const parts = runs(ps).map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a} to ${b}`));
  const flat = parts.join(', ').split(', ');
  const all = parts.length === 1 && !parts[0].includes(',') ? parts[0] : `${flat.slice(0, -1).join(', ')} and ${flat[flat.length - 1]}`;
  return `pages ${all}`;
}

/* For a file name and a key: 'p14-15', 'p3,7-9,12'. */
export const pagesSlug = (pages: number[]) => `p${runs(pages).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(',')}`;

/* The pages of this notebook linked to other jobs: page -> those jobs. */
export function pagesElsewhere(gnPages: Record<string, Record<string, number[]> | undefined>, path: string, job: string): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [uuid, links] of Object.entries(gnPages)) {
    if (uuid === job) continue;
    for (const p of cleanPages(links?.[path])) out.set(p, [...(out.get(p) ?? []), uuid]);
  }
  return out;
}

const sameNumber = (a: string, b: string) => Boolean(a) && Boolean(b) && String(Number(a)) === String(Number(b));

/* The notebooks for a job: by its number, plus any linked by hand (by path, so a notebook backed up again under a new
   id still counts), newest change first. */
export function notebooksFor(all: Notebook[], jobNumber: string, linked: string[] = []): Notebook[] {
  return all.filter((n) => sameNumber(n.number, jobNumber) || linked.includes(n.path)).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/* Notebooks that belong to no job yet (no number from a job on the list, not linked anywhere): the ones offered to
   link, newest first. */
export function looseNotebooks(all: Notebook[], jobNumbers: string[], linkedPaths: string[]): Notebook[] {
  return all
    .filter((n) => !jobNumbers.some((j) => sameNumber(n.number, j)) && !linkedPaths.includes(n.path))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export const sizeWords = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/* The name it has on the ServiceM8 job. */
export const attachName = (n: Pick<Notebook, 'name'>, pages?: number[]) =>
  `Goodnotes - ${n.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)}${pages?.length ? ` ${pagesSlug(pages)}` : ''}.pdf`;

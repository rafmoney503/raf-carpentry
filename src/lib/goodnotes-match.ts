/* Goodnotes notebooks on a job (26 Oct 2026, Raf: 'is there a way to connect goodnotes with jobkit so my notes go
   straight to client card', then 'go'): the sums shared by the server (src/lib/goodnotes.ts) and the Job Kit
   (src/app/job-kit/goodnotes.tsx). No imports. Goodnotes' auto-backup puts each notebook in the mailbox's OneDrive as a
   PDF, in folders like Goodnotes' own; a notebook whose name starts with the ServiceM8 job number ('1234 Smith kitchen',
   '#1234 - Smith', 'J1234 Smith') belongs to that job, and any other one can be linked to a job by hand. */

export type Notebook = {
  id: string; // OneDrive's item id
  name: string; // without .pdf
  path: string; // folders under the backup folder and the name: 'Clients/1234 Smith kitchen'
  size: number; // bytes
  at: string; // last changed (ISO)
  number: string; // the job number at the start of the name, or ''
};

/* The job number a notebook's name starts with ('' if none): digits, maybe after #, J or 'Job', then a break. */
export function numberOf(name: string): string {
  const m = name.trim().match(/^(?:#|j(?:ob)?\s*#?\s*)?(\d{1,7})(?=$|[\s\-–_.,:;)(])/i);
  return m ? String(Number(m[1])) : '';
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
export const attachName = (n: Pick<Notebook, 'name'>) => `Goodnotes - ${n.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)}.pdf`;

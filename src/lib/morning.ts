import 'server-only';
import { morningSummary } from './insights';
import type { Note } from './push';
import type { Report } from './types';

/* What the morning summary says: yesterday in one line, then anything new worth knowing (at most two). */
export function morningNotes(r: Report, sinceMs: number): Note[] {
  const head = morningSummary(r.sites, r.leads, r.today, r.messages);
  const notes: Note[] = [{ title: head.title, body: head.body || 'Open HQ for the details.', url: '/', tag: `hq-${r.today}` }];
  const fresh = r.insights.filter((i) => i.tone !== 'setup' && i.firstSeen && new Date(i.firstSeen).getTime() >= sinceMs);
  if (fresh.length === 1) {
    notes.push({ title: fresh[0].title, body: fresh[0].body, url: fresh[0].action && !fresh[0].action.external ? fresh[0].action.href : '/', tag: `hq-new-${r.today}` });
  } else if (fresh.length > 1) {
    notes.push({ title: `${fresh.length} things worth knowing`, body: fresh.slice(0, 3).map((i) => i.title).join(' · '), url: '/', tag: `hq-new-${r.today}` });
  }
  return notes;
}

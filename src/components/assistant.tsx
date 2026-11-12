import type { AssistantSummary } from '@/lib/assistant';
import { plural } from '@/lib/format';
import { clock, when } from '@/lib/time';

const JOB_KIT = 'https://www.rafcarpentry.com/job-kit';

/* New enquiries from the Job Kit assistant, at the top of Today. */
export function AssistantCard({ a, now }: { a: AssistantSummary; now: number }) {
  const n = a.recent.length;
  const fresh = a.recent.filter((e) => now - e.at < 24 * 3600 * 1000).length;
  const left = [a.mails.enquiries ? plural(a.mails.enquiries, 'enquiry email', 'enquiry emails') + ' to add yourself' : '', a.mails.leads ? plural(a.mails.leads, 'lead from a website', 'leads from websites') : '', a.mails.maybe ? `${plural(a.mails.maybe, 'email')} that might be an enquiry` : ''].filter(Boolean);
  return (
    <article className={`card enq${a.problems.length ? ' alertcard' : ''}`} data-hq-assistant>
      <div className="ins-top">
        <span className={`mark ${n ? 'info' : 'good'}`} aria-hidden="true">
          {n || '✓'}
        </span>
        <span className="where">
          Job Kit assistant · {a.paused ? 'paused' : a.checkedAt ? `checked ${clock(a.checkedAt)}` : 'not run yet'}
        </span>
        {fresh ? <span className="new">New</span> : null}
      </div>
      <h3>{n ? `${plural(n, 'new enquiry', 'new enquiries')} in the last 3 days` : 'No new enquiries in the last 3 days'}</h3>
      {n ? (
        <ul className="enq-list">
          {a.recent.slice(0, 4).map((e) => (
            <li key={e.id}>
              <p className="enq-name">
                <em>
                  <b>{e.name}</b>
                  {e.area ? `, ${e.area}` : ''}
                </em>
                <span>
                  {e.source ? `${e.source} · ` : ''}
                  {when(e.at, new Date(now)).replace(/^today at /, '')}
                </span>
              </p>
              {e.what ? <p className="enq-what">{e.what}</p> : null}
              {e.lines.length ? <p className="enq-lines">{e.lines.join(' · ')}</p> : null}
              <p className="enq-needs">Needs you: {e.needs.toLowerCase()}.</p>
            </li>
          ))}
          {n > 4 ? <li className="note">and {n - 4} more in the Job Kit</li> : null}
        </ul>
      ) : null}
      {left.length ? <p className="note">Also left for you: {left.join(', ')}.</p> : null}
      {a.problems.map((p) => (
        <p key={p} className="note enq-problem">
          {p}
        </p>
      ))}
      <p className="note">{a.week}</p>
      <a className={`act${n ? ' dark' : ''}`} href={JOB_KIT} target="_blank" rel="noreferrer">
        {n ? 'Check them in the Job Kit' : 'Open the Job Kit'}
        <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}

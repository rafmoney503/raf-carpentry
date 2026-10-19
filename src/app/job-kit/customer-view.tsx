'use client';
import { useEffect, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import { gbp, moneyLine, moneyOf, wa } from './current';
import { fetchCustomer, personName, postcodeOf, savedCustomers, type Client, type CustomerDetail } from './customers';
import { Icon } from './icons';
import { readPin } from './uploader';
import { clock, problemText } from './sm8-post';

/* One customer from ServiceM8: who they are, how to reach them, and every job they've had (any status, any age),
   newest first. A job opens like a current job (emails and texts, money, diary, Where it's up to), so an old
   Unsuccessful quote can be brought back, a finished job asked for a review, or a new enquiry put on their record.
   The last customers opened stay on the phone, so this opens with no signal too. */

const DAY = 864e5;
const day = (s: string | null) => (s && Number.isFinite(Date.parse(s)) ? new Date(Date.parse(s)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const month = (s: string) => new Date(Date.parse(s)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

function statusLine(j: CurrentJob) {
  if (j.status === 'Work Order') return `Work Order${j.workOrder ? ` since ${day(j.workOrder)}` : ''}`;
  if (j.status === 'Completed') return `Completed${j.completed ? ` ${day(j.completed)}` : ''}`;
  if (j.status === 'Unsuccessful') return `Unsuccessful${j.lost ? ` ${day(j.lost)}` : ''}`;
  const age = j.created ? Math.floor((Date.now() - Date.parse(j.created)) / DAY) : NaN;
  return `Quote${j.created ? `, enquiry ${day(j.created)}` : ''}${Number.isFinite(age) && age > 60 ? ' (old)' : ''}`;
}

/* "4 jobs since Mar 2024 · £18,400 of work · £2,000 left to pay" */
function summary(jobs: CurrentJob[]) {
  if (!jobs.length) return 'No jobs in ServiceM8 yet.';
  const dates = jobs.map((j) => j.created).filter((d): d is string => Boolean(d) && Number.isFinite(Date.parse(d!)));
  const first = dates.sort()[0];
  const work = jobs.filter((j) => j.status === 'Work Order' || j.status === 'Completed');
  const total = work.reduce((s, j) => s + (moneyOf(j).total ?? 0), 0);
  const knowsPaid = work.every((j) => moneyOf(j).payments !== null || j.paid);
  const left = work.reduce((s, j) => s + (moneyOf(j).left ?? 0), 0);
  const quotes = jobs.filter((j) => j.status === 'Quote').length;
  return [
    `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}${first ? ` since ${month(first)}` : ''}`,
    total ? `${gbp(total)} of work` : '',
    total && knowsPaid ? (left ? `${gbp(left)} left to pay` : 'all paid') : '',
    quotes ? `${quotes} open ${quotes === 1 ? 'quote' : 'quotes'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function CustomerView({
  uuid,
  fallback,
  onLoaded,
  onOpenJob,
  onNew,
}: {
  uuid: string;
  fallback?: Client; // from the search list, shown while ServiceM8 answers
  onLoaded: (d: CustomerDetail) => void;
  onOpenJob: (j: CurrentJob) => void;
  onNew: (c: Client) => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');
  const load = () => {
    setLoading(true);
    setProblem('');
    void fetchCustomer(readPin(), uuid).then((r) => {
      setLoading(false);
      if (!r.ok) {
        setProblem(problemText(r.error, r.detail));
        return;
      }
      setDetail(r.data);
      onLoaded(r.data);
    });
  };
  useEffect(() => {
    setDetail(savedCustomers()[uuid]);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per customer
  }, [uuid]);

  const client = detail?.client ?? fallback;
  if (!client)
    return (
      <div className="pt-16 text-center">
        {problem ? <p className="text-[15px]">{problem}</p> : <p className="font-mono text-[14px] text-faint">Getting the customer from ServiceM8…</p>}
      </div>
    );
  const jobs = detail?.jobs ?? [];
  const lead = client.people[0];
  const first = (lead?.first || client.name).split(/\s+/)[0];

  return (
    <div className="pt-5">
      <p className="kicker flex items-center gap-1.5">
        <Icon name="person" className="h-[15px] w-[15px]" />
        Customer
      </p>
      <h1 className="mt-1 font-display text-[28px] font-[680] leading-[1.05] tracking-[-0.025em]">{client.name}</h1>
      {client.address ? <p className="mt-1 whitespace-pre-line text-[15.5px] text-muted">{client.address}</p> : null}

      {client.people.length ? (
        <ul className="mt-4 grid gap-3">
          {client.people.map((p, i) => {
            const n = personName(p);
            const tel = p.mobile || p.phone;
            return (
              <li key={i} className="rounded-sm border border-line-strong bg-mount px-3.5 py-3">
                {n && n.toLowerCase() !== client.name.toLowerCase() ? <p className="font-semibold">{n}</p> : null}
                <p className="font-mono text-[13.5px] leading-relaxed text-muted">
                  {[p.mobile, p.phone && p.phone !== p.mobile ? p.phone : '', p.email].filter(Boolean).map((v) => (
                    <span key={v} className="block break-all">
                      {v}
                    </span>
                  ))}
                </p>
                {tel ? (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {p.mobile ? (
                      <a href={wa(p.mobile, `Hi ${p.first || first}, `)} className="btn btn-whatsapp btn-sm" target="_blank" rel="noopener">
                        WhatsApp
                      </a>
                    ) : null}
                    <a href={`tel:${tel.replace(/\s+/g, '')}`} className="btn btn-ghost btn-sm">
                      Call
                    </a>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-faint">No phone or email on this customer in ServiceM8.</p>
      )}

      {detail ? <p className="mt-4 font-mono text-[13px] leading-relaxed text-ink">{summary(jobs)}</p> : null}

      <button type="button" className="btn btn-primary mt-4 w-full" onClick={() => onNew(client)}>
        New enquiry for {first}
      </button>

      <section className="mt-7">
        <h2 className="font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">Jobs in ServiceM8{detail ? ` (${jobs.length})` : ''}</h2>
        {problem ? (
          <p role="alert" className="mt-2.5 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
            {problem}
            {detail ? ` Showing what this phone had from ${clock(detail.at)}.` : ''}
          </p>
        ) : null}
        {!detail && loading ? <p className="mt-2.5 font-mono text-[13.5px] text-faint">Getting their jobs from ServiceM8…</p> : null}
        {jobs.length ? (
          <ul className="mt-2.5 grid gap-3">
            {jobs.map((j) => {
              const money = moneyLine(j);
              const owed = j.status === 'Completed' && (moneyOf(j).left ?? 0) > 0;
              return (
                <li key={j.uuid}>
                  <button
                    type="button"
                    data-jk-id={j.uuid}
                    onClick={() => onOpenJob(j)}
                    className={`block w-full rounded-sm border bg-mount px-3.5 py-3 text-left transition-colors hover:border-ink ${j.status === 'Quote' || j.status === 'Work Order' ? 'border-accent/60' : 'border-line-strong'}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={`font-mono text-[12.5px] ${j.status === 'Quote' || j.status === 'Work Order' ? 'text-accent' : 'text-faint'}`}>{statusLine(j)}</span>
                      {j.number ? <span className="shrink-0 font-mono text-[12px] text-faint">#{j.number}</span> : null}
                    </span>
                    {j.description ? <span className="mt-1 line-clamp-2 block text-[15px] leading-snug">{j.description}</span> : null}
                    {j.address && j.address !== client.address ? <span className="mt-0.5 block truncate text-[13.5px] text-muted">{postcodeOf(j.address) || j.address.split(/\n|,/)[0]}</span> : null}
                    {money ? <span className={`mt-1 block font-mono text-[12.5px] ${owed ? 'font-semibold text-ink' : 'text-faint'}`}>{money}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <p className="mt-5 flex flex-wrap items-center gap-x-3 font-mono text-[12.5px] text-faint">
        <span>From ServiceM8{detail ? `, ${clock(detail.at)}` : ''}</span>
        <button type="button" onClick={load} className="h-9 text-accent underline" disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </p>
    </div>
  );
}

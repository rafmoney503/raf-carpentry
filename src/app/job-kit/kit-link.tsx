'use client';
import { useEffect, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import { field } from './parts';
import { monthName, type Job } from './store';

/* A Job Kit job (photos for the website) and the ServiceM8 job it's for (Raf, 12 Nov 2026: "If in a jobkit I
   started new jobkit job add option in customer card to link it"). Start the Job Kit from a job links them by
   itself; a job started on its own from Today can be linked afterwards, from either side:
   - KitLink, in a ServiceM8 job's From here: the Job Kit jobs not linked to any job, same area first.
   - Sm8Link, at the top of a Job Kit job: the customer's job it's for, or pick one.
   The link is the Job Kit job's `sm8`, kept in step with the computer like the rest of the job. */

/* The same area: one place's words inside the other's, whole words only, so N2 isn't N22. */
const words = (s: string) => ` ${(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(' ')} `;
const near = (a: string, b: string) => {
  const x = words(a);
  const y = words(b);
  return x.trim() !== '' && y.trim() !== '' && (x.includes(y) || y.includes(x));
};
const photos = (n: number) => (n === 1 ? '1 photo' : `${n} photos`);

/* Tap, then "Tap again" within 5 s. */
function useTwoTaps() {
  const [armed, setArmed] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return {
    armed,
    tap(run: () => void) {
      clearTimeout(t.current);
      if (!armed) {
        setArmed(true);
        t.current = setTimeout(() => setArmed(false), 5000);
        return;
      }
      setArmed(false);
      run();
    },
  };
}

/* ---------- on the ServiceM8 job ---------- */

export function KitLink({
  job,
  kitJob,
  choices,
  counts,
  onOpen,
  onStart,
  onLink,
}: {
  job: CurrentJob;
  kitJob?: Job; // linked already
  choices: Job[]; // Job Kit jobs (not design requests) linked to no ServiceM8 job
  counts: Record<string, number>; // photos and clips on each
  onOpen: (k: Job) => void;
  onStart: () => void;
  onLink?: (id: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const unlink = useTwoTaps();
  const place = `${job.area} ${job.address}`;

  if (kitJob)
    return (
      <div className="grid gap-1.5" data-kit-linked={kitJob.id}>
        <button type="button" className="btn btn-ghost w-full" onClick={() => onOpen(kitJob)}>
          Open the Job Kit job
        </button>
        <p className="text-[13.5px] leading-snug text-muted">
          {note ? <span className="font-semibold text-ink">{note} </span> : null}
          Linked: {kitJob.what}
          {kitJob.area ? `, ${kitJob.area}` : ''} · {photos(counts[kitJob.id] ?? 0)}
          {onLink ? (
            <>
              {' · '}
              <button
                type="button"
                data-kit-unlink
                className="inline-flex min-h-[32px] items-center font-semibold text-accent underline underline-offset-2"
                onClick={() =>
                  unlink.tap(() => {
                    setNote('');
                    void onLink(null);
                  })
                }
              >
                {unlink.armed ? 'Tap again to unlink' : 'Unlink'}
              </button>
            </>
          ) : null}
        </p>
      </div>
    );

  const list = [...choices].sort((a, b) => Number(near(b.area, place)) - Number(near(a.area, place)) || b.updatedAt - a.updatedAt);
  const close = list.filter((k) => near(k.area, place));
  const shown = open ? list : close.slice(0, 3);
  const link = async (k: Job) => {
    if (!onLink || busy) return;
    setBusy(k.id);
    try {
      await onLink(k.id);
      setNote('Linked.');
      setOpen(false);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="grid gap-2">
      <button type="button" className="btn btn-ghost w-full" onClick={onStart}>
        Start the Job Kit (photos for the website)
      </button>
      {onLink && list.length ? (
        <div className="rounded-sm border border-line-strong bg-mount p-3" data-kit-choices>
          <p className="text-[14.5px] font-semibold leading-snug">Started one already for {job.first || job.name}?</p>
          <p className="mt-0.5 text-[13px] leading-snug text-faint">
            {close.length && !open
              ? `${close.length === 1 ? 'This Job Kit job is' : 'These Job Kit jobs are'} in the same area and not linked to a customer yet.`
              : 'Job Kit jobs not linked to a customer yet, newest first.'}
          </p>
          {shown.length ? (
            <ul className="mt-2 grid gap-1.5">
              {shown.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    data-kit-choice={k.id}
                    disabled={Boolean(busy)}
                    onClick={() => void link(k)}
                    className="flex w-full items-center gap-3 rounded-sm border border-line-strong bg-paper px-3 py-2 text-left hover:border-ink disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug">
                        {k.what}
                        {near(k.area, place) ? <span className="ml-2 font-mono text-[11.5px] font-normal text-accent">same area</span> : null}
                      </span>
                      <span className="block truncate text-[13.5px] text-muted">
                        {[k.area, monthName(k.month), photos(counts[k.id] ?? 0), k.readyAt ? 'sent' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-accent">{busy === k.id ? 'Linking…' : 'Link'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {list.length > shown.length ? (
            <button type="button" data-kit-more className="mt-2 inline-flex min-h-[40px] items-center font-semibold text-accent underline underline-offset-2" onClick={() => setOpen(true)}>
              {shown.length ? `Show all ${list.length}` : `Link a Job Kit job you've started (${list.length})`}
            </button>
          ) : open && close.length < list.length && close.length ? (
            <button type="button" className="mt-2 inline-flex min-h-[40px] items-center text-[13.5px] text-muted underline underline-offset-2" onClick={() => setOpen(false)}>
              Just the same area
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- on the Job Kit job ---------- */

export function Sm8Link({
  job,
  sm8Job,
  sm8Jobs,
  kitOn,
  onLink,
  onOpen,
  onOpenKit,
}: {
  job: Job; // the Job Kit job
  sm8Job?: CurrentJob; // the job it's linked to, when this device has it
  sm8Jobs: CurrentJob[]; // to pick one
  kitOn: (uuid: string) => Job | undefined; // another Job Kit job already on that ServiceM8 job
  onLink: (uuid: string | null) => Promise<void>;
  onOpen: (uuid: string) => void;
  onOpenKit: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [clash, setClash] = useState<{ uuid: string; other: Job } | null>(null);
  const unlink = useTwoTaps();

  if (job.sm8)
    return (
      <div className="mt-2 rounded-sm border border-line-strong bg-mount" data-sm8-linked={job.sm8}>
        {sm8Job ? (
          <button type="button" onClick={() => onOpen(sm8Job.uuid)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14.5px]">
            <span className="min-w-0 flex-1">
              For <span className="font-semibold">{sm8Job.name}</span>
              <span className="text-muted">
                {' '}
                · #{sm8Job.number} · {sm8Job.status}
              </span>
            </span>
            <span aria-hidden className="text-accent">
              →
            </span>
          </button>
        ) : (
          <p className="px-3 py-2 text-[14.5px] text-muted">Linked to a customer’s job that isn’t in your current jobs on this device.</p>
        )}
        <div className="border-t border-line px-3 py-1">
          <button type="button" data-sm8-unlink className="inline-flex min-h-[36px] items-center text-[13.5px] font-semibold text-accent underline underline-offset-2" onClick={() => unlink.tap(() => void onLink(null))}>
            {unlink.armed ? 'Tap again to unlink it' : 'Not this customer? Unlink'}
          </button>
        </div>
      </div>
    );

  if (!picking)
    return (
      <button type="button" data-sm8-link onClick={() => setPicking(true)} className="mt-2 flex w-full items-center gap-2 rounded-sm border border-dashed border-line-strong bg-mount px-3 py-2 text-left text-[14.5px]">
        <span className="min-w-0 flex-1">
          Not linked to a customer yet. <span className="font-semibold text-accent">Link it to their job</span>
        </span>
        <span aria-hidden className="text-accent">
          →
        </span>
      </button>
    );

  const typed = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = sm8Jobs
    .filter((j) => j.status !== 'Unsuccessful')
    .filter((j) => typed.every((w) => `${j.name} ${j.area} ${j.address} ${j.description} ${j.number}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(near(job.area, `${b.area} ${b.address}`)) - Number(near(job.area, `${a.area} ${a.address}`)) || (b.created ?? '').localeCompare(a.created ?? ''))
    .slice(0, 8);
  const pick = (uuid: string) => {
    const other = kitOn(uuid);
    if (other && other.id !== job.id) return setClash({ uuid, other });
    setPicking(false);
    void onLink(uuid);
  };

  return (
    <div className="mt-2 grid gap-2 rounded-sm border border-line-strong bg-mount p-3" data-sm8-picker>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14.5px] font-semibold">Which customer’s job is it?</p>
        <button type="button" className="min-h-[36px] text-[13.5px] text-muted underline underline-offset-2" onClick={() => setPicking(false)}>
          Cancel
        </button>
      </div>
      <input
        type="search"
        className={`${field} h-11`}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setClash(null);
        }}
        placeholder="Name, area or job number"
        aria-label="Find the customer’s job"
        autoComplete="off"
        enterKeyHint="search"
      />
      {clash ? (
        <div role="alert" className="rounded-sm border border-ink bg-paper p-3 text-[14.5px] leading-relaxed">
          That job already has a Job Kit job: <span className="font-semibold">{clash.other.what}</span>. Unlink that one first if it’s the wrong one.
          <div className="mt-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenKit(clash.other.id)}>
              Open that one
            </button>
          </div>
        </div>
      ) : null}
      {list.length ? (
        <ul className="grid gap-1.5">
          {list.map((j) => {
            const other = kitOn(j.uuid);
            return (
              <li key={j.uuid}>
                <button type="button" data-sm8-choice={j.uuid} onClick={() => pick(j.uuid)} className="w-full rounded-sm border border-line-strong bg-paper px-3 py-2 text-left hover:border-ink">
                  <span className="block font-semibold leading-snug">
                    {j.name}
                    {near(job.area, `${j.area} ${j.address}`) ? <span className="ml-2 font-mono text-[11.5px] font-normal text-accent">same area</span> : null}
                  </span>
                  <span className="block truncate text-[13.5px] text-muted">
                    #{j.number} · {j.status} · {j.area || j.address}
                    {other && other.id !== job.id ? ' · has a Job Kit job' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-mono text-[13px] text-faint">{sm8Jobs.length ? 'No job matches.' : 'Your current jobs haven’t loaded yet. Open Current jobs once, then try again.'}</p>
      )}
    </div>
  );
}

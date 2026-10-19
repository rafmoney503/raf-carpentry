'use client';
import { useEffect, useRef, useState } from 'react';
import Mark from './mark';
import { field } from './parts';
import type { CurrentJob } from './current';
import type { Job } from './store';
import type { ReadyInfo } from './designs';

/* "Where this design is", on a design once it's ready (Raf, 19 Oct 2026: "how do I attach on website the 3d created
   design which now don't have jobs done yet and later when job done how to add it to my work ... and also to the 3d
   design library ... create question on new 3d design is it already added to job and 3d design library. Also check
   automatically if that design is already there"). Four lines, each checked by itself every time the app opens:
   - The job in ServiceM8: linked (made from the job, or picked here), with the jobs that look like it first and a
     warning when the job already has a design.
   - Designs in 3D (rafcarpentry.com/designs): the question, "Show it on the website?", answered once the customer
     is happy; the answer goes to the inbox with the request and the next design run (every 2 hours) sets the
     design's `public` to match. Built: the finished job shows there instead, never both.
   - My Work: the finished job page built from it (a job JSON with "design": its code), the Job Kit job on its way,
     or Start the Job Kit for it.
   - Design library: always, as the design or, once built, as the finished job. */

const SITE = 'https://www.rafcarpentry.com';
const STATUS: Record<string, string> = { Quote: 'Quote', 'Work Order': 'Work Order', Completed: 'Completed', Unsuccessful: 'Unsuccessful' };

export function DesignPlaces({
  job,
  ready,
  kitJob,
  kitDone,
  sm8Job,
  sm8Jobs,
  designOn,
  onPublish,
  onLink,
  onStartKit,
  onOpenKit,
  onOpenSm8,
  onOpenDesign,
  onLibrary,
}: {
  job: Job; // the design request
  ready: ReadyInfo;
  kitJob?: Job; // the Job Kit job built from it
  kitDone?: { slug: string; title: string }; // that job's page, once on the website
  sm8Job?: CurrentJob; // the ServiceM8 job it's for, when the phone has it
  sm8Jobs: CurrentJob[]; // to pick one
  designOn: (uuid: string) => Job | undefined; // another design request already on that ServiceM8 job
  onPublish: (ok: boolean) => void;
  onLink: (uuid: string | undefined) => void;
  onStartKit: () => void;
  onOpenKit: (id: string) => void;
  onOpenSm8: (uuid: string) => void;
  onOpenDesign: (id: string) => void;
  onLibrary: () => void;
}) {
  const built = ready.job ?? kitDone;
  const first = sm8Job?.first || 'the customer';
  return (
    <section className="mt-5 rounded-sm border border-line-strong bg-mount" aria-labelledby="where-design">
      <div className="border-b border-line px-4 pb-3 pt-3.5">
        <h2 id="where-design" className="text-[19px] font-[650]">
          Where this design is
        </h2>
        <p className="mt-0.5 text-[13.5px] leading-snug text-faint">Checked by itself each time the app opens, so nothing goes on twice.</p>
      </div>
      <ol className="divide-y divide-line">
        <JobRow job={job} sm8Job={sm8Job} sm8Jobs={sm8Jobs} designOn={designOn} onLink={onLink} onOpenSm8={onOpenSm8} onOpenDesign={onOpenDesign} />
        <WebsiteRow job={job} ready={ready} built={Boolean(built)} first={first} onPublish={onPublish} />
        <Row
          mark={built ? 'sent' : kitJob ? 'sending' : 'waiting'}
          title="My Work"
          text={
            built
              ? `Built: ${built.title}. It’s on My Work with its photos.`
              : kitJob?.readyAt
              ? 'Photos sent. Tell Claude “process the Job Kit job” and the job page goes on My Work, using this design.'
              : kitJob
              ? 'Job Kit job started. Send the photos once it’s finished.'
              : 'Not built yet. Once it is, start the Job Kit for it: the job page goes on My Work and takes the design’s place on Designs in 3D.'
          }
        >
          {built ? (
            <a href={`${SITE}/portfolio/${built.slug}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
              Open the job page
            </a>
          ) : kitJob ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenKit(kitJob.id)}>
              Open the Job Kit job
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onStartKit}>
              Start the Job Kit for it
            </button>
          )}
        </Row>
        <Row
          mark="sent"
          title="Design library"
          text={
            built
              ? 'In your Design library as the finished job, to send to anyone who wants something similar.'
              : 'In your Design library, to send to anyone who wants something similar.'
          }
        >
          <button type="button" className="btn btn-ghost btn-sm" onClick={onLibrary}>
            Open the library
          </button>
        </Row>
      </ol>
    </section>
  );
}

function Row({
  mark,
  title,
  text,
  children,
}: {
  mark: 'sent' | 'sending' | 'waiting' | 'lost';
  title: string;
  text: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 px-4 py-3.5">
      <span className="pt-[3px]">
        <Mark state={mark} />
      </span>
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{title}</p>
        <div className="mt-0.5 text-[14.5px] leading-relaxed text-muted">{text}</div>
        {children ? <div className="mt-2.5 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </li>
  );
}

/* The website: the question, then on its way, on, coming off, or the finished job there instead. */
function WebsiteRow({ job, ready, built, first, onPublish }: { job: Job; ready: ReadyInfo; built: boolean; first: string; onPublish: (ok: boolean) => void }) {
  const [sure, setSure] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const ask = job.design?.publish;
  const live = Boolean(ready.public);
  const title = 'Designs in 3D, on the website';
  const NEXT = 'at the next design check (every 2 hours, 7am to 9pm)';

  if (built) return <Row mark="sent" title={title} text="The finished job shows there now, with its photos, so the design isn’t on as well." />;
  if (live && ask?.ok !== false)
    return (
      <Row
        mark="sent"
        title={title}
        text={
          <>
            On the website, area only.{' '}
            {ready.web ? (
              <a
                href={`${SITE}${ready.web}`}
                target="_blank"
                rel="noopener"
                className="mt-0.5 block break-words font-mono text-[13px] text-accent underline-offset-2 hover:underline"
              >
                {`rafcarpentry.com${ready.web.split('#')[0]}`}
              </a>
            ) : (
              'rafcarpentry.com/designs'
            )}
          </>
        }
      >
        <button
          type="button"
          className={`btn btn-sm ${sure ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            if (!sure) {
              setSure(true);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => setSure(false), 5000);
              return;
            }
            setSure(false);
            onPublish(false);
          }}
        >
          {sure ? 'Tap again to take it off' : 'Take it off'}
        </button>
      </Row>
    );
  if (live)
    return (
      <Row mark="sending" title={title} text={`Coming off ${NEXT}.`}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPublish(true)}>
          Keep it on
        </button>
      </Row>
    );
  if (ask?.ok)
    return (
      <Row mark="sending" title={title} text={`Going on ${NEXT}. Area only, never their name or street.`}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPublish(false)}>
          Not yet, keep it off
        </button>
      </Row>
    );
  if (ask)
    return (
      <Row mark="waiting" title={title} text="Not on the website. It stays private: only people you send the link to see it.">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPublish(true)}>
          Show it after all
        </button>
      </Row>
    );
  return (
    <Row
      mark="lost"
      title="Show it on the website?"
      text={`On rafcarpentry.com/designs, for people looking for ideas. Only once ${first} is happy with that: it shows the area, never their name or street.`}
    >
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onPublish(true)}>
        Yes, they’re happy
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPublish(false)}>
        Not this one
      </button>
    </Row>
  );
}

/* The job in ServiceM8: linked, or pick one (the ones in the same area first). */
function JobRow({
  job,
  sm8Job,
  sm8Jobs,
  designOn,
  onLink,
  onOpenSm8,
  onOpenDesign,
}: {
  job: Job;
  sm8Job?: CurrentJob;
  sm8Jobs: CurrentJob[];
  designOn: (uuid: string) => Job | undefined;
  onLink: (uuid: string | undefined) => void;
  onOpenSm8: (uuid: string) => void;
  onOpenDesign: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');
  const [clash, setClash] = useState<{ uuid: string; other: Job } | null>(null);
  const title = 'The job in ServiceM8';

  if (job.sm8)
    return (
      <Row
        mark="sent"
        title={title}
        text={
          sm8Job
            ? `${sm8Job.name} · #${sm8Job.number} · ${STATUS[sm8Job.status] ?? sm8Job.status}`
            : 'Linked to a job that isn’t in your current jobs any more.'
        }
      >
        {sm8Job ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenSm8(sm8Job.uuid)}>
            Open the job
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onLink(undefined)}>
          Unlink
        </button>
      </Row>
    );

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const area = job.area.trim().toLowerCase();
  const near = (j: CurrentJob) => Boolean(area) && `${j.area} ${j.address}`.toLowerCase().includes(area);
  const list = sm8Jobs
    .filter((j) => j.status !== 'Unsuccessful')
    .filter((j) => words.every((w) => `${j.name} ${j.area} ${j.address} ${j.description} ${j.number}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(near(b)) - Number(near(a)) || (b.created ?? '').localeCompare(a.created ?? ''))
    .slice(0, 8);
  const pick = (uuid: string) => {
    const other = designOn(uuid);
    if (other && other.id !== job.id) return setClash({ uuid, other });
    onLink(uuid);
    setPicking(false);
  };

  return (
    <Row
      mark="waiting"
      title={title}
      text={picking ? 'Pick the job this design is for:' : 'Not linked to a job yet. Linking it keeps the design, the job and its photos together.'}
    >
      {!picking ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>
          Link a job
        </button>
      ) : (
        <div className="grid w-full gap-2">
          <input
            type="search"
            className={`${field} h-11`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setClash(null);
            }}
            placeholder="Name, area or job number"
            aria-label="Find the job"
            autoComplete="off"
            enterKeyHint="search"
          />
          {clash ? (
            <div role="alert" className="rounded-sm border border-ink bg-paper p-3 text-[14.5px] leading-relaxed">
              That job already has a design: <span className="font-semibold">{clash.other.what}</span>.
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenDesign(clash.other.id)}>
                  Open that one
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    onLink(clash.uuid);
                    setClash(null);
                    setPicking(false);
                  }}
                >
                  Link this one as well
                </button>
              </div>
            </div>
          ) : null}
          {list.length ? (
            <ul className="grid gap-1.5">
              {list.map((j) => (
                <li key={j.uuid}>
                  <button
                    type="button"
                    onClick={() => pick(j.uuid)}
                    className="w-full rounded-sm border border-line-strong bg-paper px-3 py-2 text-left hover:border-ink"
                  >
                    <span className="block font-semibold leading-snug">
                      {j.name}
                      {near(j) ? <span className="ml-2 font-mono text-[11.5px] font-normal text-accent">same area</span> : null}
                    </span>
                    <span className="block truncate text-[13.5px] text-muted">
                      #{j.number} · {j.status} · {j.area || j.address}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-mono text-[13px] text-faint">
              {sm8Jobs.length ? 'No job matches.' : 'Your current jobs haven’t loaded yet. Open Current jobs once, then try again.'}
            </p>
          )}
          <button type="button" className="justify-self-start text-[14px] text-muted underline-offset-2 hover:underline" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      )}
    </Row>
  );
}

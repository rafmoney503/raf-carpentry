'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import type { Mail, Thread } from '@/lib/servicem8-mail';
import { SIGN_OFF } from '@/lib/mail-text';
import { Icon } from './icons';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';

/* A job's emails (Current jobs, the job, Emails): the conversation with the customer, oldest at the top, and a
   box to write the next one. It goes out through ServiceM8 and is filed on the job, and the customer's reply
   comes back to the job in ServiceM8 (src/lib/servicem8-mail.ts). On this phone: the last conversation per job
   (so it opens at once and with no signal), what's being written (until it's sent), and emails just sent that
   ServiceM8's list doesn't show yet. */

const CACHE_KEY = 'raf_jobkit_mail'; // job uuid -> { thread, at }
const DRAFTS_KEY = 'raf_jobkit_mail_drafts'; // job uuid -> { to, subject, text }
const SENT_KEY = 'raf_jobkit_mail_sent'; // job uuid -> emails sent from here, until ServiceM8 lists them
const SHOW = 5;

type Draft = { to?: string; subject?: string; text?: string };
type Cache = Record<string, { thread: Thread; at: number }>;

const read = <T,>(key: string, empty: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(key) || 'null') as T) ?? empty;
  } catch {
    return empty;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* no storage */
  }
};
function keep<T>(key: string, uuid: string, v: T | undefined, max = 25) {
  const all = read<Record<string, T>>(key, {});
  delete all[uuid];
  const next = v === undefined ? all : { [uuid]: v, ...all };
  write(key, Object.fromEntries(Object.entries(next).slice(0, max)));
}

const fetchMail = (job: CurrentJob) => post<{ thread: Thread }>(readPin(), { action: 'mail', job: job.uuid, email: job.email });
const sendMail = (job: string, to: string, subject: string, text: string) => post<{ thread: Thread; sent: Mail }>(readPin(), { action: 'send-mail', job, to, subject, text });

const plainSubject = (s: string) => s.replace(/^(\s*(re|fwd?|aw|odp)\s*:\s*)+/i, '').trim();
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

/* "Today, 21:40", "Yesterday, 08:12", "Tue 13 Oct, 9:05" from ServiceM8's London time. */
function whenText(at: string | null) {
  if (!at) return '';
  const day = at.slice(0, 10);
  const today = new Date().toLocaleDateString('sv-SE');
  const yest = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE');
  const time = at.slice(11, 16).replace(/^0(\d)/, '$1');
  const date = new Date(`${day}T12:00`);
  const d = day === today ? 'Today' : day === yest ? 'Yesterday' : `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
  return `${d}, ${time}`;
}

/* Is this email from ServiceM8's list the one sent from here (same subject, within 20 minutes, or the same start)? */
const sameMail = (a: Mail, b: Mail) => {
  if (a.dir !== 'out' || b.dir !== 'out') return false;
  const close = a.at && b.at ? Math.abs(Date.parse(a.at) - Date.parse(b.at)) <= 20 * 60e3 : false;
  const start = (m: Mail) => m.text.replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
  return (close && plainSubject(a.subject).toLowerCase() === plainSubject(b.subject).toLowerCase()) || (start(a).length > 10 && start(a) === start(b));
};

export function EmailBox({ job, what, replyAt, onSeen }: { job: CurrentJob; what: string; replyAt?: string; onSeen: (at: string) => void }) {
  const [thread, setThread] = useState<Thread | null>(() => read<Cache>(CACHE_KEY, {})[job.uuid]?.thread ?? null);
  const [sentHere, setSentHere] = useState<Mail[]>(() => read<Record<string, Mail[]>>(SENT_KEY, {})[job.uuid] ?? []);
  const [draft, setDraftState] = useState<Draft>(() => read<Record<string, Draft>>(DRAFTS_KEY, {})[job.uuid] ?? {});
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const [sendProblem, setSendProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [tried, setTried] = useState(false);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const textRef = useRef<HTMLTextAreaElement>(null);

  // What ServiceM8 lists, plus what was sent from here and isn't in its list yet (kept 30 days at most).
  const listed = thread?.mails ?? [];
  const pending = sentHere.filter((p) => !listed.some((m) => m.id === p.id || sameMail(m, p)) && Date.now() - Date.parse(p.at ?? '') < 30 * 864e5);
  const mails = [...listed, ...pending].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
  const shown = all ? mails : mails.slice(-SHOW);

  const takeThread = useCallback(
    (t: Thread) => {
      setThread(t);
      keep<Cache[string]>(CACHE_KEY, job.uuid, { thread: t, at: Date.now() });
      // Sent from here and now in ServiceM8's list: no need to keep the phone's copy.
      setSentHere((list) => {
        const left = list.filter((p) => !t.mails.some((m) => m.id === p.id || sameMail(m, p)));
        keep<Mail[]>(SENT_KEY, job.uuid, left.length ? left : undefined, 50);
        return left;
      });
      const newest = t.mails.filter((m) => m.dir === 'in' && m.at).reduce((k, m) => (m.at! > k ? m.at! : k), '');
      const seen = [newest, replyAt ?? ''].sort().pop() ?? '';
      if (seen) onSeen(seen);
    },
    [job.uuid, replyAt, onSeen],
  );

  const take = useRef(takeThread);
  useEffect(() => {
    take.current = takeThread;
  }, [takeThread]);
  const load = useCallback(() => {
    setLoading(true);
    setProblem('');
    void fetchMail(job).then((r) => {
      setLoading(false);
      if (r.ok) take.current(r.data.thread);
      else setProblem(problemText(r.error, r.detail));
    });
    // Once when the job opens (and when its email changes in ServiceM8); Refresh asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.uuid, job.email]);
  useEffect(() => {
    load();
  }, [load]);

  // The boxes: who to (the job's email, else the address in the conversation), the subject (Re: the last one, else
  // what the job is), and the message ("Hi Sarah," to start). Changes are kept on the phone until it's sent.
  const lastIn = [...mails].reverse().find((m) => m.dir === 'in' && m.from);
  const lastOut = [...mails].reverse().find((m) => m.dir === 'out' && m.to);
  const toDefault = job.email || lastIn?.from.split(', ')[0] || lastOut?.to.split(', ')[0] || '';
  const lastSubject = [...mails].reverse().find((m) => m.subject)?.subject;
  const subjectDefault = lastSubject
    ? `Re: ${plainSubject(lastSubject)}`
    : what
      ? `${job.status === 'Quote' || job.status === 'Unsuccessful' ? 'Your enquiry' : 'Your job'}: ${what}`
      : 'Raf Carpentry';
  const textDefault = `Hi ${job.first || 'there'},\n\n`;
  const to = draft.to ?? toDefault;
  const subject = draft.subject ?? subjectDefault;
  const text = draft.text ?? textDefault;
  const setDraft = (patch: Draft) => {
    const next = { ...draft, ...patch };
    setDraftState(next);
    keep<Draft>(DRAFTS_KEY, job.uuid, next);
    setJustSent(false);
  };
  const written = text.trim() && text.trim() !== textDefault.trim();

  const send = () => {
    setTried(true);
    setSendProblem('');
    if (!isEmail(to) || !subject.trim() || !written) {
      if (!written) textRef.current?.focus();
      return;
    }
    setBusy(true);
    void sendMail(job.uuid, to.trim(), subject.trim(), text.trim()).then((r) => {
      setBusy(false);
      if (!r.ok) {
        setSendProblem(problemText(r.error, r.detail));
        return;
      }
      setSentHere((list) => {
        const next = [...list, r.data.sent];
        keep<Mail[]>(SENT_KEY, job.uuid, next, 50);
        return next;
      });
      takeThread(r.data.thread);
      setDraftState({});
      keep<Draft>(DRAFTS_KEY, job.uuid, undefined);
      setTried(false);
      setJustSent(true);
    });
  };

  const name = job.first || job.name;
  const readable = thread ? thread.readable : true;
  return (
    <section id="emails" className="mt-6 scroll-mt-4 rounded-sm border border-line-strong bg-mount p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[19px] font-[650]">
          <Icon name="mail" className="h-[22px] w-[22px] text-accent" />
          Emails
        </h2>
        <button type="button" onClick={load} disabled={loading} className="h-9 font-mono text-[13px] text-accent underline">
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {problem ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
          {thread ? ' Showing what was here before.' : ''}
        </p>
      ) : null}
      {!thread && loading ? <p className="mt-2 font-mono text-[13.5px] text-faint">Getting the emails from ServiceM8…</p> : null}
      {thread && !mails.length ? <p className="mt-2 text-[14.5px] text-muted">{readable ? 'No emails on this job in ServiceM8 yet.' : 'No emails sent from the Job Kit on this job yet.'}</p> : null}

      {mails.length > shown.length ? (
        <button type="button" onClick={() => setAll(true)} className="mt-3 h-10 text-[14.5px] text-accent underline">
          Show {mails.length - shown.length} earlier {mails.length - shown.length === 1 ? 'email' : 'emails'}
        </button>
      ) : null}
      {shown.length ? (
        <ol className="mt-3 grid gap-2.5">
          {shown.map((m, i) => {
            const prev = shown[i - 1];
            const showSubject = m.subject && (!prev || plainSubject(prev.subject).toLowerCase() !== plainSubject(m.subject).toLowerCase());
            const isOpen = open[m.id + i];
            const long = !m.full && m.text.length > 700;
            const body = isOpen ? m.full || m.text : long ? `${m.text.slice(0, 600).replace(/\s+\S*$/, '')}…` : m.text;
            const local = pending.includes(m);
            return (
              <li key={m.id + i} className={m.dir === 'out' ? 'ml-5' : 'mr-5'}>
                <div className={`rounded-sm border px-3 py-2.5 ${m.dir === 'out' ? 'border-accent/30 bg-accent-soft' : 'border-line-strong bg-paper'}`}>
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[12px] text-faint">
                    <span className={m.dir === 'in' ? 'font-semibold text-ink' : ''}>{m.dir === 'out' ? 'You' : name}</span>
                    <span>{whenText(m.at)}</span>
                  </p>
                  {showSubject ? <p className="mt-1 text-[13.5px] font-semibold leading-snug [overflow-wrap:anywhere]">{m.subject}</p> : null}
                  {body ? (
                    <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">{body}</p>
                  ) : m.keys ? (
                    <p className="mt-1 text-[14px] leading-relaxed text-muted">
                      The Job Kit couldn’t find the words in this email; it’s on the job in ServiceM8. Tell Claude these names so it can be fixed:{' '}
                      <span className="font-mono text-[12px] [overflow-wrap:anywhere]">{m.keys.join(', ')}</span>
                    </p>
                  ) : null}
                  {m.full || long ? (
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id + i]: !isOpen }))} className="mt-1 h-9 text-[14px] text-accent underline">
                      {isOpen ? 'Show less' : m.full ? 'Show the whole email' : 'Show all of it'}
                    </button>
                  ) : null}
                  {local ? <p className="mt-1 font-mono text-[11.5px] text-faint">Sent from the Job Kit{readable ? ', on its way to ServiceM8’s list' : ''}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {thread && !readable ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Their replies are on the job in ServiceM8: it doesn’t let the Job Kit read emails on your account yet. What you send from here shows above, and a copy goes on the job as a note.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-line pt-4">
        {justSent ? (
          <p role="status" className="rounded-sm border border-accent bg-accent-soft px-3 py-2.5 text-[14.5px] leading-relaxed">
            Sent through ServiceM8 and filed on the job. {readable ? `${name}’s reply will show here.` : `${name}’s reply goes to the job in ServiceM8.`}
          </p>
        ) : null}
        <label className="grid gap-1.5">
          <span className={label}>To</span>
          <input
            className={`${field} h-12 ${tried && !isEmail(to) ? 'border-ink' : ''}`}
            type="email"
            inputMode="email"
            autoCapitalize="off"
            autoComplete="off"
            value={to}
            placeholder="their email"
            onChange={(e) => setDraft({ to: e.target.value.replace(/\s+/g, '') })}
          />
          {tried && !isEmail(to) ? <span className="text-[14px] font-semibold">{to.trim() ? 'That email address doesn’t look right.' : 'Type their email address.'}</span> : null}
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Subject</span>
          <input className={`${field} h-12 ${tried && !subject.trim() ? 'border-ink' : ''}`} value={subject} onChange={(e) => setDraft({ subject: e.target.value })} />
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Message</span>
          <textarea
            ref={textRef}
            className={`${field} min-h-[150px] py-2.5 leading-relaxed ${tried && !written ? 'border-ink' : ''}`}
            rows={6}
            value={text}
            onChange={(e) => setDraft({ text: e.target.value })}
          />
          {tried && !written ? <span className="text-[14px] font-semibold">Write the message first.</span> : null}
        </label>
        <p className="font-mono text-[12px] leading-relaxed text-faint">Signed off with: {SIGN_OFF.join(' · ')}</p>
        {sendProblem ? (
          <p role="alert" className="rounded-sm border border-ink px-3 py-2.5 text-[14.5px] leading-relaxed">
            {sendProblem} It wasn’t sent; what you wrote is kept here.
          </p>
        ) : null}
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={send}>
          {busy ? 'Sending…' : 'Send through ServiceM8'}
        </button>
        <p className="font-mono text-[12px] leading-relaxed text-faint">
          It goes from ServiceM8 and is filed on this job; their reply comes back to the job.
        </p>
      </div>
    </section>
  );
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import type { Mail, Thread } from '@/lib/servicem8-mail';
import { e164, SIGN_OFF, SMS_SIGN_OFF, textCredits } from '@/lib/mail-text';
import { Icon } from './icons';
import { field, label } from './parts';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';

/* A job's emails and texts (Current jobs, the job, Emails and texts): the conversation with the customer, oldest at
   the top, and a box to write the next one, as an email or a text. It goes out through ServiceM8 and is filed on
   the job, and the customer's reply comes back to the job in ServiceM8 (src/lib/servicem8-mail.ts). On a finished
   (Completed) job the box also offers the review request: one tap writes it, Raf checks it and sends it.
   On this phone: the last conversation per job (so it opens at once and with no signal), what's being written
   (until it's sent), and messages just sent that ServiceM8's list doesn't show yet. */

const CACHE_KEY = 'raf_jobkit_mail'; // job uuid -> { thread, at }
const DRAFTS_KEY = 'raf_jobkit_mail_drafts'; // job uuid -> { mode, to, number, subject, text }
const SENT_KEY = 'raf_jobkit_mail_sent'; // job uuid -> messages sent from here, until ServiceM8 lists them
const SHOW = 5;
const dayText = (t: number) => {
  const d = new Date(t);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
};

type Mode = 'email' | 'sms';
type Draft = { mode?: Mode; to?: string; number?: string; subject?: string; text?: string };
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

const fetchMail = (job: CurrentJob) => post<{ thread: Thread }>(readPin(), { action: 'mail', job: job.uuid, email: job.email, mobile: job.mobile });
// save: the job has no email in ServiceM8, so the address typed here is saved on it.
const sendMail = (job: CurrentJob, to: string, subject: string, text: string, save: boolean) =>
  post<{ thread: Thread; sent: Mail; saved?: boolean }>(readPin(), { action: 'send-mail', job: job.uuid, to, subject, text, save, mobile: job.mobile });
const sendText = (job: CurrentJob, to: string, text: string) => post<{ thread: Thread; sent: Mail }>(readPin(), { action: 'send-text', job: job.uuid, to, text, email: job.email });

/* The review request, the same words as the website's Ask for a review (src/app/review/send), to the thank-you
   page with the Google review button (and a "something not quite right? tell me" line). */
const REVIEW_LINK = 'www.rafcarpentry.com/review';
export const isReviewAsk = (m: Mail) => m.dir === 'out' && m.text.includes('rafcarpentry.com/review');
const reviewText = (mode: Mode, first: string) =>
  mode === 'sms'
    ? `Hi ${first}, thanks for having me. If you're happy with the work, a Google review would really help: ${REVIEW_LINK}`
    : `Hi ${first},\n\nThanks again for having me, I hope you're enjoying it.\n\nIf you're happy with the work, a quick Google review would really help other people find me. It only takes a minute:\nhttps://${REVIEW_LINK}\n\nThanks,`;
const REVIEW_SUBJECT = 'Thank you from Raf Carpentry';

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

/* Is this message from ServiceM8's list the one sent from here (same subject, within 20 minutes, or the same start)? */
const sameMail = (a: Mail, b: Mail) => {
  if (a.dir !== 'out' || b.dir !== 'out' || (a.via ?? 'email') !== (b.via ?? 'email')) return false;
  const close = a.at && b.at ? Math.abs(Date.parse(a.at) - Date.parse(b.at)) <= 20 * 60e3 : false;
  const start = (m: Mail) => m.text.replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
  return (close && plainSubject(a.subject).toLowerCase() === plainSubject(b.subject).toLowerCase()) || (start(a).length > 10 && start(a) === start(b));
};

export function EmailBox({
  job,
  what,
  replyAt,
  onSeen,
  review,
}: {
  job: CurrentJob;
  what: string;
  replyAt?: string;
  onSeen: (at: string) => void;
  review?: { askedAt?: number; onAsked: () => void }; // on a Completed job
}) {
  const [thread, setThread] = useState<Thread | null>(() => read<Cache>(CACHE_KEY, {})[job.uuid]?.thread ?? null);
  const [sentHere, setSentHere] = useState<Mail[]>(() => read<Record<string, Mail[]>>(SENT_KEY, {})[job.uuid] ?? []);
  const [draft, setDraftState] = useState<Draft>(() => read<Record<string, Draft>>(DRAFTS_KEY, {})[job.uuid] ?? {});
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const [sendProblem, setSendProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState<Mode | null>(null);
  const [tried, setTried] = useState(false);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const textRef = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState('');

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
    // Once when the job opens (and when its email or mobile changes in ServiceM8); Refresh asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.uuid, job.email, job.mobile]);
  useEffect(() => {
    load();
  }, [load]);

  // The boxes. Email: who to (the job's email, else the address in the conversation), the subject (Re: the last
  // one, else what the job is). Text: the job's mobile, else the number in the conversation. The message starts
  // "Hi Sarah,". Email when there's an address to send to, else text when there's a mobile. Changes are kept on
  // the phone until it's sent.
  const first = job.first || 'there';
  const lastIn = [...mails].reverse().find((m) => m.dir === 'in' && (m.via ?? 'email') === 'email' && m.from);
  const lastOut = [...mails].reverse().find((m) => m.dir === 'out' && (m.via ?? 'email') === 'email' && m.to);
  const toDefault = job.email || lastIn?.from.split(', ')[0] || lastOut?.to.split(', ')[0] || '';
  const lastText = [...mails].reverse().find((m) => m.via === 'sms' && (m.dir === 'in' ? m.from : m.to));
  const numberDefault = job.mobile || (lastText ? (lastText.dir === 'in' ? lastText.from : lastText.to) : '');
  const mode: Mode = draft.mode ?? (isEmail(toDefault) || !e164(numberDefault) ? 'email' : 'sms');
  const lastSubject = [...mails].reverse().find((m) => m.subject)?.subject;
  const subjectDefault = lastSubject
    ? `Re: ${plainSubject(lastSubject)}`
    : what && !/^(something else|not sure|other|anything)\b/i.test(what)
      ? `${job.status === 'Quote' || job.status === 'Unsuccessful' ? 'Your enquiry' : 'Your job'}: ${what}`
      : job.status === 'Quote' || job.status === 'Unsuccessful'
        ? 'Your enquiry with Raf Carpentry'
        : 'Your job with Raf Carpentry';
  const startOf = (m: Mode) => (m === 'sms' ? `Hi ${first}, ` : `Hi ${first},\n\n`);
  const to = draft.to ?? toDefault;
  const number = draft.number ?? numberDefault;
  const subject = draft.subject ?? subjectDefault;
  const text = draft.text ?? startOf(mode);
  const setDraft = (patch: Draft) => {
    const next = { ...draft, ...patch };
    setDraftState(next);
    keep<Draft>(DRAFTS_KEY, job.uuid, next);
    setJustSent(null);
    setSendProblem('');
  };
  const written = Boolean(text.trim()) && text.trim() !== startOf(mode).trim();
  // Email or text: what's written stays; an untouched start or review request is swapped for the other kind's.
  const switchTo = (m: Mode) => {
    if (m === mode) return;
    const t = draft.text;
    const swap = t === undefined || t === startOf(mode) ? undefined : t === reviewText(mode, first) ? reviewText(m, first) : t;
    setDraft({ mode: m, text: swap, ...(swap === reviewText(m, first) && m === 'email' ? { subject: REVIEW_SUBJECT } : {}) });
    setTried(false);
  };

  // The review request on a finished job: asked already (from the phone's mark or an earlier message with the link)?
  const askedMail = mails.find(isReviewAsk);
  const askedAt = review ? (review.askedAt ?? (askedMail?.at ? Date.parse(askedMail.at) : undefined)) : undefined;
  const writeReview = () => {
    const m: Mode = e164(numberDefault) ? 'sms' : 'email';
    setDraft({ mode: m, text: reviewText(m, first), ...(m === 'email' ? { subject: REVIEW_SUBJECT } : {}) });
    setTried(false);
    textRef.current?.focus({ preventScroll: true });
    textRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const finish = (sent: Mail, t: Thread) => {
    setSentHere((list) => {
      const next = [...list, sent];
      keep<Mail[]>(SENT_KEY, job.uuid, next, 50);
      return next;
    });
    takeThread(t);
    if (review && isReviewAsk(sent)) review.onAsked();
    setDraftState({ mode });
    keep<Draft>(DRAFTS_KEY, job.uuid, { mode });
    setTried(false);
    setJustSent(mode);
  };

  const send = () => {
    setTried(true);
    setSendProblem('');
    // Something missing: say so by the button and take him to the box (focusing it in the tap opens the keyboard).
    const missing =
      mode === 'email' && !isEmail(to)
        ? { el: toRef.current, say: to.trim() ? 'The email address in To doesn’t look right. Check it, then send again.' : 'Type their email address in To first, then send again.' }
        : mode === 'sms' && !e164(number)
          ? { el: toRef.current, say: number.trim() ? 'The mobile number in To doesn’t look right. Check it, then send again.' : 'Type their mobile number in To first, then send again.' }
          : mode === 'email' && !subject.trim()
            ? { el: subjectRef.current, say: 'Add a subject, then send again.' }
            : !written
              ? { el: textRef.current, say: mode === 'sms' ? 'Write the text first.' : 'Write the message first.' }
              : null;
    if (missing) {
      setSendProblem(missing.say);
      missing.el?.focus({ preventScroll: true });
      missing.el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    const failed = (error: string, detail?: string) => setSendProblem(`${problemText(error, detail)} It wasn’t sent; what you wrote is kept here.`);
    if (mode === 'sms') {
      void sendText(job, number.trim(), text.trim()).then((r) => {
        setBusy(false);
        if (!r.ok) failed(r.error, r.detail);
        else finish(r.data.sent, r.data.thread);
      });
      return;
    }
    const save = !job.email && !saved;
    void sendMail(job, to.trim(), subject.trim(), text.trim(), save).then((r) => {
      setBusy(false);
      if (!r.ok) return failed(r.error, r.detail);
      if (r.data.saved) setSaved(to.trim());
      finish(r.data.sent, r.data.thread);
    });
  };

  const name = job.first || job.name;
  const emailsRead = thread ? thread.readable : true;
  const textsRead = thread?.texts !== false; // unknown counts as yes
  const credits = textCredits(text);
  const length = `${text.trim()}\n${SMS_SIGN_OFF}`.length;
  const kindWord = (m: Mail) => (m.via === 'sms' ? 'Text' : 'Email');
  const replyHere = justSent === 'sms' ? textsRead : emailsRead;
  return (
    <section id="emails" className="mt-6 scroll-mt-4 rounded-sm border border-line-strong bg-mount p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[19px] font-[650]">
          <Icon name="mail" className="h-[22px] w-[22px] text-accent" />
          Emails and texts
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
      {!thread && loading ? <p className="mt-2 font-mono text-[13.5px] text-faint">Getting the messages from ServiceM8…</p> : null}
      {thread && !mails.length ? <p className="mt-2 text-[14.5px] text-muted">{emailsRead ? 'No emails or texts on this job in ServiceM8 yet.' : 'Nothing sent from the Job Kit on this job yet.'}</p> : null}

      {mails.length > shown.length ? (
        <button type="button" onClick={() => setAll(true)} className="mt-3 h-10 text-[14.5px] text-accent underline">
          Show {mails.length - shown.length} earlier
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
                    <span>
                      <span className={m.dir === 'in' ? 'font-semibold text-ink' : ''}>{m.dir === 'out' ? 'You' : name}</span> · {kindWord(m)}
                    </span>
                    <span>{whenText(m.at)}</span>
                  </p>
                  {showSubject ? <p className="mt-1 text-[13.5px] font-semibold leading-snug [overflow-wrap:anywhere]">{m.subject}</p> : null}
                  {body ? (
                    <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">{body}</p>
                  ) : m.keys ? (
                    <p className="mt-1 text-[14px] leading-relaxed text-muted">
                      The Job Kit couldn’t find the words in this {m.via === 'sms' ? 'text' : 'email'}; it’s on the job in ServiceM8. Tell Claude these names so it can be fixed:{' '}
                      <span className="font-mono text-[12px] [overflow-wrap:anywhere]">{m.keys.join(', ')}</span>
                    </p>
                  ) : null}
                  {m.full || long ? (
                    <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id + i]: !isOpen }))} className="mt-1 h-9 text-[14px] text-accent underline">
                      {isOpen ? 'Show less' : m.full ? 'Show the whole email' : 'Show all of it'}
                    </button>
                  ) : null}
                  {local ? <p className="mt-1 font-mono text-[11.5px] text-faint">Sent from the Job Kit{(m.via === 'sms' ? textsRead : emailsRead) ? ', on its way to ServiceM8’s list' : ''}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {thread && (!emailsRead || !textsRead) ? (
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          {!emailsRead && !textsRead
            ? 'Their replies are on the job in ServiceM8: it doesn’t let the Job Kit read emails or texts on your account yet. What you send from here shows above, and a copy goes on the job as a note.'
            : !emailsRead
              ? 'Their email replies are on the job in ServiceM8: it doesn’t let the Job Kit read emails on your account yet. Emails you send from here show above, and a copy goes on the job as a note.'
              : 'Their text replies are on the job in ServiceM8: it doesn’t let the Job Kit read texts on your account yet. Texts you send from here show above, and a copy goes on the job as a note.'}
        </p>
      ) : null}

      {review ? (
        askedAt ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 border-t border-line pt-3 text-[14.5px] text-muted">
            <span>You asked {name} for a review{Number.isFinite(askedAt) ? ` on ${dayText(askedAt)}` : ''}.</span>
            <button type="button" onClick={writeReview} className="h-9 text-accent underline">
              Write it again
            </button>
          </p>
        ) : (
          <div className="mt-4 rounded-sm border border-accent bg-accent-soft px-3.5 py-3">
            <p className="font-semibold">Job finished: ask {name} for a Google review</p>
            <p className="mt-1 text-[14.5px] leading-relaxed text-muted">One tap writes it {e164(numberDefault) ? 'as a text' : 'as an email'} with the link to your review page. Check it, then send.</p>
            <button type="button" onClick={writeReview} className="btn btn-primary btn-sm mt-3">
              Write the review request
            </button>
          </div>
        )
      ) : null}

      <div className="mt-4 grid gap-3 border-t border-line pt-4">
        {justSent ? (
          <p role="status" className="rounded-sm border border-accent bg-accent-soft px-3 py-2.5 text-[14.5px] leading-relaxed">
            {justSent === 'sms' ? 'Text sent' : 'Sent'} through ServiceM8 and filed on the job. {replyHere ? `${name}’s reply will show here.` : `${name}’s reply goes to the job in ServiceM8.`}
            {saved && justSent === 'email' ? ` ${saved} is saved on the job in ServiceM8 now.` : ''}
          </p>
        ) : null}
        <div role="radiogroup" aria-label="Send as" className="grid grid-cols-2 gap-1.5">
          {(['email', 'sms'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => switchTo(m)}
              className={`h-11 rounded-sm border text-[15px] ${mode === m ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line-strong text-ink'}`}
            >
              {m === 'email' ? 'Email' : 'Text'}
            </button>
          ))}
        </div>
        {mode === 'email' ? (
          <>
            <label className="grid gap-1.5">
              <span className={label}>To</span>
              {!job.email && !toDefault ? (
                <span className="text-[14px] leading-snug text-muted">There’s no email on this job in ServiceM8. Type theirs here: it’s saved on the job when you send.</span>
              ) : null}
              <input
                ref={toRef}
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
              <input ref={subjectRef} className={`${field} h-12 ${tried && !subject.trim() ? 'border-ink' : ''}`} value={subject} onChange={(e) => setDraft({ subject: e.target.value })} />
            </label>
          </>
        ) : (
          <label className="grid gap-1.5">
            <span className={label}>To</span>
            {!numberDefault ? <span className="text-[14px] leading-snug text-muted">There’s no mobile on this job in ServiceM8. Type theirs here.</span> : null}
            <input
              ref={toRef}
              className={`${field} h-12 font-mono ${tried && !e164(number) ? 'border-ink' : ''}`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={number}
              placeholder="07…"
              onChange={(e) => setDraft({ number: e.target.value })}
            />
            {tried && !e164(number) ? <span className="text-[14px] font-semibold">{number.trim() ? 'That mobile number doesn’t look right.' : 'Type their mobile number.'}</span> : null}
          </label>
        )}
        <label className="grid gap-1.5">
          <span className={label}>{mode === 'sms' ? 'Text' : 'Message'}</span>
          <textarea
            ref={textRef}
            className={`${field} ${mode === 'sms' ? 'min-h-[110px]' : 'min-h-[150px]'} py-2.5 leading-relaxed ${tried && !written ? 'border-ink' : ''}`}
            rows={mode === 'sms' ? 4 : 6}
            value={text}
            onChange={(e) => setDraft({ text: e.target.value })}
          />
          {tried && !written ? <span className="text-[14px] font-semibold">{mode === 'sms' ? 'Write the text first.' : 'Write the message first.'}</span> : null}
        </label>
        {mode === 'sms' ? (
          <p className="font-mono text-[12px] leading-relaxed text-faint">
            Signed: {SMS_SIGN_OFF} · {length} characters ·{' '}
            <span className={credits > 1 ? 'font-semibold text-ink' : ''}>
              {credits} text {credits === 1 ? 'credit' : 'credits'}
            </span>{' '}
            (one per 153 characters)
          </p>
        ) : (
          <p className="font-mono text-[12px] leading-relaxed text-faint">Signed off with: {SIGN_OFF.join(' · ')}</p>
        )}
        {sendProblem ? (
          <p role="alert" className="rounded-sm border border-ink px-3 py-2.5 text-[14.5px] leading-relaxed">
            {sendProblem}
          </p>
        ) : null}
        <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={send}>
          {busy ? 'Sending…' : mode === 'sms' ? 'Send text through ServiceM8' : 'Send email through ServiceM8'}
        </button>
        <p className="font-mono text-[12px] leading-relaxed text-faint">
          {mode === 'sms'
            ? 'It goes from ServiceM8 with its Reply here link, and is filed on this job; their reply comes back to the job.'
            : 'It goes from ServiceM8 and is filed on this job; their reply comes back to the job.'}
        </p>
      </div>
    </section>
  );
}

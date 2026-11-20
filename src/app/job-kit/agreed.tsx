'use client';

import { useEffect, useRef, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import { fieldOf, fromWords, GROUPS, noteText, soundsLikeYes, type Agreed, type AgreedOk, type AgreedSent, type AgreedView, type Field, type GroupId } from '@/lib/job-agreed';
import { showNumber } from '@/lib/wa-live';
import { Chips, field, label } from './parts';
import { SecIcon } from './job-menu';
import { post, problemText } from './sm8-post';
import { readPin } from './uploader';
import { QuoteWaSend, sentWhen, useWaWindow, type WaSent } from './quote-wa';

/* What's agreed: every choice that can catch Raf out on the day, agreed with the client in writing before he says
   yes to the job (Raf, 20 Nov 2026: "What type of door? Is the door have handles or knobs? Do they have push to open?
   Height, depth, everything before I accept with the client, otherwise I am surprised").
   The list is filled in on the visit (some of it known already from their enquiry, the rough quote and ServiceM8),
   sent to them as one message (WhatsApp from the Job Kit, his WhatsApp app, email or copy), kept on the ServiceM8
   job as a note, and marked agreed when they say yes. Moving the job to Work Order before then asks first
   (current.tsx). The answers are kept in the job's marks, so the phone and the computer show the same. */

const HOW_OK: { id: AgreedOk['how']; label: string }[] = [
  { id: 'whatsapp', label: 'On WhatsApp' },
  { id: 'email', label: 'By email' },
  { id: 'text', label: 'By text' },
  { id: 'in-person', label: 'In person' },
];
const HOW_SENT: Record<AgreedSent['how'], string> = { whatsapp: 'on WhatsApp from the Job Kit', 'wa-app': 'on WhatsApp', email: 'by email', copy: 'copied to send' };
const HOW_YES: Record<AgreedOk['how'], string> = { whatsapp: 'on WhatsApp', email: 'by email', text: 'by text', 'in-person': 'in person' };

const intl = (m: string) => m.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '44');
const newUuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`);

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* The record on the ServiceM8 job: made with its own uuid when the list goes out, then updated with their yes. */
async function saveNote(job: string, uuid: string, text: string) {
  const r = await post<{ ok: true }>(readPin(), { action: 'note-save', job, uuid, text, isNew: true });
  return r.ok ? '' : problemText(r.error, r.detail);
}

export function AgreedBox({
  job,
  agree,
  view,
  first,
  onPatch,
  waTo,
  waLiveInAt,
  reply,
  onEmail,
  onWorkOrder,
}: {
  job: CurrentJob;
  agree?: Agreed;
  view: AgreedView;
  first: string;
  onPatch: (fn: (a: Agreed) => Agreed) => void;
  waTo: string; // their WhatsApp number (the chat the job came from, else the job's mobile)
  waLiveInAt?: number | null;
  reply?: { at: number; text: string } | null; // their newest WhatsApp message after the list went, as the Job Kit has it
  onEmail: (subject: string, text: string) => void;
  onWorkOrder?: () => Promise<void>; // the job is still a Quote: move it on once they've agreed
}) {
  const who = first || 'them';
  const firstMissing = view.missing[0]?.group;
  const [open, setOpen] = useState<Set<GroupId>>(() => new Set(view.state === 'empty' || view.state === 'filling' ? (firstMissing ? [firstMissing] : []) : []));
  const [showMsg, setShowMsg] = useState(false);
  const [noteProblem, setNoteProblem] = useState('');
  const [yesHow, setYesHow] = useState<AgreedOk['how'] | null>(null);
  const [copied, setCopied] = useState(false);
  const [unsure, setUnsure] = useState(false); // tapped Send with things still to agree
  const [moveSure, setMoveSure] = useState(false);
  const [moving, setMoving] = useState(false);
  const win = useWaWindow(job.status === 'Quote' || job.status === 'Work Order' ? waTo : '', waLiveInAt);
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(disarm.current), []);

  // The note in ServiceM8 follows the list: made when it goes, updated with their yes (and tried again until it's there).
  const pendingNote = agree?.sent && (!agree.sent.noted || (agree.ok && !agree.ok.noted)) ? agree : null;
  const noteKey = pendingNote ? `${pendingNote.sent!.note}:${pendingNote.sent!.noted}:${pendingNote.ok?.at ?? ''}:${pendingNote.ok?.noted ?? ''}` : '';
  useEffect(() => {
    if (!pendingNote?.sent?.note) return;
    let alive = true;
    const a = pendingNote;
    void saveNote(job.uuid, a.sent!.note!, noteText({ sent: a.sent!, ok: a.ok }, job.name)).then((problem) => {
      if (!alive) return;
      setNoteProblem(problem);
      if (problem) return;
      onPatch((cur) =>
        cur.sent?.note === a.sent!.note
          ? { ...cur, sent: { ...cur.sent!, noted: true }, ok: cur.ok && cur.ok.at === a.ok?.at ? { ...cur.ok, noted: true } : cur.ok }
          : cur,
      );
    });
    return () => {
      alive = false;
    };
    // the note is the same while its key is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey]);

  if (job.status === 'Unsuccessful') return null;
  if (job.status === 'Completed' && !agree?.sent) return null;

  const setValue = (id: string, value: string) => onPatch((a) => ({ ...a, v: { ...(a.v ?? {}), [id]: value }, na: (a.na ?? []).filter((x) => x !== id), at: Date.now() }));
  const setNa = (id: string, on: boolean) => onPatch((a) => ({ ...a, na: on ? [...new Set([...(a.na ?? []), id])] : (a.na ?? []).filter((x) => x !== id), at: Date.now() }));
  const toggle = (g: GroupId) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    return n;
  });
  const goTo = (f: Field) => {
    setOpen((s) => new Set([...s, f.group]));
    setTimeout(() => {
      const el = document.getElementById(`ag-${f.id}`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, r.top + window.scrollY - window.innerHeight / 2 + Math.min(r.height, 200) / 2), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      (el.querySelector('input,textarea,button') as HTMLElement | null)?.focus({ preventScroll: true });
    }, 60);
  };

  const record = (how: AgreedSent['how'], wa?: WaSent) => {
    const sent: AgreedSent = { at: wa?.at ?? Date.now(), how, hash: view.hash, text: view.message, note: newUuid(), ...(wa ? { wa } : {}) };
    setNoteProblem('');
    setUnsure(false);
    onPatch((a) => ({ ...a, sent, ok: undefined }));
  };
  const markYes = (how: AgreedOk['how']) => {
    const words = how === 'whatsapp' && reply ? reply.text : undefined;
    onPatch((a) => (a.sent ? { ...a, ok: { at: Date.now(), how, hash: a.sent.hash, ...(words ? { words } : {}) } } : a));
    setYesHow(null);
  };

  const groups = GROUPS.filter((g) => g.kinds.includes(view.kind));
  const pct = view.total ? Math.round((view.done / view.total) * 100) : 0;
  const sent = agree?.sent;
  const ok = agree?.ok;
  const subject = `What we’ve agreed for your ${(job.description ? whatWord(job.description) : 'job').toLowerCase()}`;
  const replyFresh = reply && sent && reply.at > sent.at ? reply : null;

  return (
    <section
      id="agree"
      data-jsec="agree"
      data-jsec-note={view.state === 'ok' ? 'OK ✓' : view.state === 'sent' ? 'waiting' : `${view.done}/${view.total}`}
      data-jsec-alert={job.status !== 'Completed' && view.state !== 'ok' && (job.status === 'Work Order' || Boolean(sent)) ? '1' : undefined}
      data-agree-state={view.state}
      className="mt-3 rounded-sm border border-line-strong bg-mount p-4"
    >
      <h2 className="flex items-center gap-2.5 text-[19px] font-[650]">
        <SecIcon k="agree" />
        What’s agreed
      </h2>

      {/* Where it's up to, in one box */}
      {view.state === 'ok' ? (
        <div className="jk-agree-ok mt-3 rounded-sm border px-3 py-2.5" data-agree-ok>
          <p className="text-[16px] font-[650] text-ink">
            <span aria-hidden className="jk-agree-tick">✓ </span>
            {cap(who)} agreed it {HOW_YES[ok!.how]}, {sentWhen(ok!.at)}
          </p>
          {ok!.words ? <p className="mt-1 text-[14.5px] italic leading-snug text-muted">“{clip(ok!.words, 160)}”</p> : null}
          {ok!.how === 'in-person' ? <p className="mt-1 text-[14px] leading-snug text-muted">A yes in person is hard to prove later: ask {who} to reply “yes” to the message too.</p> : null}
          <p className="mt-1 font-mono text-[12.5px] text-muted">{agree?.ok?.noted ? 'On the job in ServiceM8 as a note' : 'Saving it on the job in ServiceM8…'}</p>
        </div>
      ) : view.state === 'changed' ? (
        <div className="mt-3 rounded-sm border border-ink px-3 py-2.5" data-agree-changed>
          <p className="text-[16px] font-[650] text-ink">You’ve changed it since {who} agreed ({sentWhen(ok!.at)})</p>
          <p className="mt-0.5 text-[14.5px] leading-snug text-muted">Send {who} the new version and get a yes for that one, or put it back as it was.</p>
        </div>
      ) : view.state === 'sent' ? (
        <div className="mt-3 rounded-sm border border-line-strong bg-paper px-3 py-2.5" data-agree-waiting>
          <p className="text-[16px] font-[650] text-ink">
            Sent to {who} {HOW_SENT[sent!.how]}, {sentWhen(sent!.at)}. Waiting for {pos(who)} OK.
          </p>
          {replyFresh ? (
            <div className="mt-2 rounded-sm border border-line bg-mount px-2.5 py-2" data-agree-reply>
              <p className="font-mono text-[12.5px] text-muted">
                {cap(who)} replied on WhatsApp, {sentWhen(replyFresh.at)}
              </p>
              <p className="mt-0.5 text-[15px] leading-snug">“{clip(replyFresh.text, 220)}”</p>
              {soundsLikeYes(replyFresh.text) ? (
                <button type="button" className="btn btn-primary btn-sm mt-2 w-full" onClick={() => markYes('whatsapp')} data-agree-yes-reply>
                  That’s a yes: mark it agreed
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[15.5px] leading-relaxed">
            {view.state === 'ready'
              ? `Everything’s filled in. Send it to ${who} for ${pos(who)} OK before you say yes to the job.`
              : `Agree every choice with ${who} before you say yes to the job, then send it for a written OK. Nothing left to guess on the day.`}
          </p>
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-raised" aria-hidden>
              <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
            <span className="shrink-0 font-mono text-[13px] text-muted" data-agree-count>
              {view.done} of {view.total} agreed
            </span>
          </div>
          {view.missing.length ? (
            <div className="mt-2.5">
              <p className={label}>Still to agree</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" data-agree-missing>
                {view.missing.slice(0, 8).map((f) => (
                  <button key={f.id} type="button" onClick={() => goTo(f)} className="min-h-9 rounded-sm border border-dashed border-line-strong bg-paper px-2.5 text-[14px]">
                    {missingName(f)}
                  </button>
                ))}
                {view.missing.length > 8 ? <span className="self-center font-mono text-[12.5px] text-faint">+ {view.missing.length - 8} more</span> : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* What kind of job: fitted furniture gets doors, handles, inside and finish; other work one box for the work */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2" data-agree-kind>
        <span className={label}>Job</span>
        {(['furniture', 'other'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={view.kind === k}
            onClick={() => onPatch((a) => ({ ...a, kind: k, at: Date.now() }))}
            className={`min-h-9 rounded-sm border px-2.5 text-[14px] ${view.kind === k ? 'border-ink bg-ink text-on-accent' : 'border-line-strong bg-mount'}`}
          >
            {k === 'furniture' ? 'Fitted furniture' : 'Other work'}
          </button>
        ))}
      </div>

      {/* The list, a fold per group (minmax: a long summary line mustn't widen the column past the screen) */}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
        {groups.map((g) => {
          const fs = view.fields.filter((f) => f.group === g.id);
          const left = view.missing.filter((f) => f.group === g.id).length;
          const isOpen = open.has(g.id);
          return (
            <div key={g.id} className="rounded-sm border border-line bg-paper" data-agree-group={g.id}>
              <button type="button" onClick={() => toggle(g.id)} aria-expanded={isOpen} className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-[650]">{g.title}</span>
                  <span className="block truncate text-[13.5px] text-muted">{summaryOf(fs, view)}</span>
                </span>
                <span className={`shrink-0 font-mono text-[12.5px] ${left ? 'text-ink' : 'text-muted'}`} data-agree-left={left}>
                  {left ? `${left} to agree` : '✓'}
                </span>
                <span aria-hidden className="shrink-0 text-faint">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen ? (
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 border-t border-line px-3 pb-3.5 pt-3">
                  {fs.map((f) => (
                    <FieldRow key={f.id} f={f} view={view} onValue={(val) => setValue(f.id, val)} onNa={(on) => setNa(f.id, on)} />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Sending it, and their yes */}
      <div className="mt-4 border-t border-line pt-3.5">
        <button type="button" className="h-9 text-[14.5px] text-accent underline" onClick={() => setShowMsg((s) => !s)} aria-expanded={showMsg} data-agree-show>
          {showMsg ? 'Hide the message' : `Show the message ${who} gets`}
        </button>
        {showMsg ? (
          <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-paper p-3 font-sans text-[14.5px] leading-relaxed" data-agree-message>
            {view.message}
          </pre>
        ) : null}

        {view.state !== 'ok' && job.status !== 'Completed' ? (
          <>
            {view.missing.length && view.state !== 'sent' ? (
              <p className="mt-2 text-[14px] leading-snug" data-agree-warn>
                <b>{view.missing.length} not agreed yet</b> ({view.missing.slice(0, 4).map(missingName).join(', ').toLowerCase()}
                {view.missing.length > 4 ? '…' : ''}). They’re left out of the message.
              </p>
            ) : null}
            {view.state === 'sent' ? null : unsure || !view.missing.length || sent ? (
              <SendRow
                job={job}
                first={first}
                waTo={waTo}
                win={win}
                message={view.message}
                sent={sent?.wa && sent.hash === view.hash ? sent.wa : undefined}
                changed={Boolean(sent)}
                onSent={record}
                onEmail={() => {
                  onEmail(subject, view.message);
                  record('email');
                }}
                onCopy={async () => {
                  if (await copy(view.message)) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                    record('copy');
                  }
                }}
                copied={copied}
              />
            ) : (
              <button type="button" className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => setUnsure(true)} data-agree-send-anyway>
                Send it anyway, with {view.missing.length} left out
              </button>
            )}
          </>
        ) : null}

        {view.state === 'sent' ? (
          <div className="mt-3" data-agree-yes>
            <p className={label}>{cap(who)} said yes</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {HOW_OK.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={yesHow === h.id}
                  onClick={() => setYesHow(yesHow === h.id ? null : h.id)}
                  className={`min-h-11 rounded-sm border px-2 text-[14.5px] ${yesHow === h.id ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount'}`}
                >
                  {h.label}
                </button>
              ))}
            </div>
            {yesHow === 'in-person' ? <p className="mt-1.5 text-[14px] leading-snug text-muted">A yes in person is hard to prove later. Ask {who} to reply “yes” to the message as well.</p> : null}
            {yesHow ? (
              <button type="button" className="btn btn-primary btn-sm mt-2 w-full" onClick={() => markYes(yesHow)} data-agree-mark>
                Mark it agreed
              </button>
            ) : null}
            <button type="button" className="mt-1 h-9 text-[14px] text-muted underline" onClick={() => onPatch((a) => ({ ...a, sent: undefined }))}>
              Not sent after all
            </button>
          </div>
        ) : null}

        {view.state === 'ok' ? (
          <div className="mt-2 grid gap-2">
            {job.status === 'Quote' && onWorkOrder ? (
              <button
                type="button"
                disabled={moving}
                className={`btn btn-sm w-full ${moveSure ? 'btn-primary' : 'btn-ghost'}`}
                data-agree-workorder
                onClick={() => {
                  clearTimeout(disarm.current);
                  if (!moveSure) {
                    setMoveSure(true);
                    disarm.current = setTimeout(() => setMoveSure(false), 5000);
                    return;
                  }
                  setMoveSure(false);
                  setMoving(true);
                  void onWorkOrder().finally(() => setMoving(false));
                }}
              >
                {moveSure ? 'Tap again: Work Order' : `${cap(who)} said yes: move the job to Work Order`}
              </button>
            ) : null}
            <button type="button" className="h-9 text-[14px] text-muted underline" onClick={() => onPatch((a) => ({ ...a, ok: undefined }))}>
              Not agreed after all
            </button>
          </div>
        ) : null}

        {sent && view.state === 'changed' ? (
          <p className="mt-2 font-mono text-[12.5px] text-faint">The version {who} agreed is on the job in ServiceM8.</p>
        ) : null}
        {noteProblem ? (
          <p role="alert" className="mt-2 text-[14px] font-semibold leading-snug">
            Couldn’t save it on the ServiceM8 job: {noteProblem} It tries again when you open the job.
          </p>
        ) : sent && view.state === 'sent' ? (
          <p className="mt-2 font-mono text-[12.5px] text-faint">{sent.noted ? 'On the job in ServiceM8 as a note' : 'Saving it on the job in ServiceM8…'}</p>
        ) : null}
      </div>
    </section>
  );
}

/* The ways to send it: WhatsApp from the Job Kit (when WhatsApp allows), his WhatsApp app, email, copy. */
function SendRow({
  job,
  first,
  waTo,
  win,
  message,
  sent,
  changed,
  onSent,
  onEmail,
  onCopy,
  copied,
}: {
  job: CurrentJob;
  first: string;
  waTo: string;
  win: ReturnType<typeof useWaWindow>;
  message: string;
  sent?: WaSent;
  changed: boolean;
  onSent: (how: AgreedSent['how'], wa?: WaSent) => void;
  onEmail: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const who = first || 'them';
  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2" data-agree-send>
      {changed ? <p className="text-[14px] leading-snug text-muted">You’ve changed the list since it went. Send {who} this version.</p> : null}
      <QuoteWaSend wa={waTo} win={win} first={first} message={message} sent={sent} onSent={(rec) => onSent('whatsapp', rec)} what="the list" title="Sent on WhatsApp" below="Open in WhatsApp" />
      {job.mobile ? (
        <a href={`https://wa.me/${intl(job.mobile)}?text=${encodeURIComponent(message)}`} className={`btn btn-sm w-full ${win.state === 'open' ? 'btn-ghost' : 'btn-whatsapp'}`} target="_blank" rel="noopener" onClick={() => onSent('wa-app')} data-agree-wa-app>
          {win.state === 'open' ? 'Open in WhatsApp' : `WhatsApp ${who}`}
        </a>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {job.email ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onEmail} data-agree-email>
            Email it
          </button>
        ) : null}
        <button type="button" className={`btn btn-ghost btn-sm ${job.email ? '' : 'col-span-2'}`} onClick={onCopy} data-agree-copy>
          {copied ? 'Copied' : 'Copy the message'}
        </button>
      </div>
      <p className="font-mono text-[12px] leading-relaxed text-faint">
        {waTo ? `WhatsApp to ${showNumber(waTo)}. ` : ''}A copy goes on the job in ServiceM8 as a note when it’s sent.
      </p>
    </div>
  );
}

/* One answer */
function FieldRow({ f, view, onValue, onNa }: { f: Field; view: AgreedView; onValue: (v: string) => void; onNa: (on: boolean) => void }) {
  const value = view.values[f.id] ?? '';
  const skip = view.skip.has(f.id);
  const from = view.from[f.id];
  const id = `ag-${f.id}`;
  const missing = !f.optional && !skip && !value.trim();
  const head = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <label htmlFor={f.kind === 'chips' || f.kind === 'inout' ? undefined : `${id}-in`} className={`${label} ${missing ? 'text-ink' : ''}`}>
        {f.label}
        {f.optional ? ' (optional)' : ''}
      </label>
      {from && value ? <span className="font-mono text-[11.5px] text-accent">{fromWords[from]}</span> : null}
      {f.optional || skip ? null : (
        <button type="button" className="-my-2 ml-auto py-2 pl-2 text-[13px] text-faint underline" onClick={() => onNa(true)} data-agree-na>
          Not on this job
        </button>
      )}
    </div>
  );
  if (skip) {
    const auto = !view.na.has(f.id);
    return (
      <div id={id} className="flex flex-wrap items-center gap-x-2 text-[14px] text-faint" data-agree-field={f.id} data-agree-skipped>
        <span className="line-through">{f.label}</span>
        <span>{auto ? notNeeded(f.id, view) : 'not on this job'}</span>
        {!auto ? (
          <button type="button" className="h-9 text-accent underline" onClick={() => onNa(false)}>
            Put it back
          </button>
        ) : null}
      </div>
    );
  }
  let input: React.ReactNode;
  if (f.kind === 'chips') input = <Chips options={f.options ?? []} value={value ? [value] : []} onChange={(v) => onValue(v[0] ?? '')} />;
  else if (f.kind === 'inout')
    input = (
      <div className="grid grid-cols-2 gap-1.5">
        {(['in', 'out'] as const).map((x) => (
          <button
            key={x}
            type="button"
            aria-pressed={value === x}
            onClick={() => onValue(value === x ? '' : x)}
            className={`min-h-10 rounded-sm border px-2 text-[14.5px] ${value === x ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount'}`}
          >
            {x === 'in' ? 'In the price' : 'Not in it'}
          </button>
        ))}
      </div>
    );
  else if (f.kind === 'long')
    input = <textarea id={`${id}-in`} rows={3} value={value} onChange={(e) => onValue(e.target.value)} placeholder={f.placeholder} className={`${field} min-h-[84px] py-2 leading-snug`} />;
  else if (f.kind === 'date') input = <input id={`${id}-in`} type="date" value={value} onChange={(e) => onValue(e.target.value)} className={`${field} h-11`} />;
  else
    input = (
      <div className="flex items-center gap-2">
        <input
          id={`${id}-in`}
          type="text"
          inputMode={f.kind === 'mm' || f.kind === 'num' ? 'numeric' : undefined}
          value={value}
          onChange={(e) => onValue(f.kind === 'mm' || f.kind === 'num' ? e.target.value.replace(/[^\d,.]/g, '') : e.target.value)}
          placeholder={f.placeholder ?? (f.kind === 'mm' ? 'mm' : '')}
          className={`${field} h-11 ${f.kind === 'mm' || f.kind === 'num' ? 'max-w-[160px]' : ''}`}
        />
        {f.kind === 'mm' ? <span className="font-mono text-[13px] text-muted">mm</span> : null}
      </div>
    );
  return (
    <div id={id} data-agree-field={f.id} data-agree-missing-field={missing ? '1' : undefined}>
      {head}
      <div className="mt-1.5">{input}</div>
    </div>
  );
}

/* ---------- words ---------- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pos = (who: string) => (who === 'them' ? 'their' : `${who}’s`);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const whatWord = (d: string) => {
  const what = /^\s*What:\s*(.+)$/im.exec(d)?.[1] ?? d.split('\n').find((l) => l.trim() && !/^hi\b/i.test(l.trim())) ?? 'job';
  return clip(what.replace(/\s*\+\s*/g, ' and ').replace(/[.:,;]+$/, '').trim(), 40);
};
function notNeeded(id: string, view: AgreedView) {
  const v = view.values;
  if (v.doors === 'No doors' && ['doorCount', 'hinge', 'handles', 'handleModel', 'handleWho'].includes(id)) return 'not needed: no doors';
  if (v.doors === 'Sliding' && id === 'hinge') return 'not needed: sliding doors';
  if (['handleModel', 'handleWho'].includes(id)) return `not needed: ${v.handles.toLowerCase()}`;
  if (id === 'decor') return 'not needed: bare MDF';
  return 'not on this job';
}
function missingName(f: Field) {
  const names: Record<string, string> = { w: 'Width', h: 'Height', d: 'Depth', top: 'At the top', skirting: 'Skirting', plinth: 'Plinth', doors: 'Door style', doorCount: 'How many doors', hinge: 'Which way they open', handles: 'Handles', handleModel: 'Which handles', handleWho: 'Who buys the handles', inside: 'Inside', drawers: 'Drawers', lights: 'Lights', finish: 'Finish', decor: 'Colour or decor', ends: 'The ends', work: 'The work', old: 'Taking out', waste: 'Rubbish', makegood: 'Making good', decorating: 'Decorating', electrics: 'Electrics', price: 'Price', vat: 'VAT', deposit: 'Deposit', rest: 'The rest', start: 'Start date', days: 'Days on site', access: 'Parking' };
  return names[f.id] ?? fieldOf(f.id)?.label ?? f.id;
}
function summaryOf(fs: Field[], view: AgreedView) {
  const bits: string[] = [];
  const io = fs.filter((f) => f.kind === 'inout' && !view.skip.has(f.id));
  if (io.length) {
    const inP = io.filter((f) => view.values[f.id] === 'in').map((f) => missingName(f).toLowerCase());
    const outP = io.filter((f) => view.values[f.id] === 'out').map((f) => missingName(f).toLowerCase());
    if (inP.length) bits.push(`In: ${inP.join(', ')}`);
    if (outP.length) bits.push(`Not: ${outP.join(', ')}`);
  }
  const dims = fs.filter((f) => f.kind === 'mm' && !view.skip.has(f.id) && (view.values[f.id] ?? '').trim()).map((f) => Number(view.values[f.id].replace(/,/g, '')).toLocaleString('en-GB'));
  if (dims.length) bits.push(`${dims.join(' × ')} mm`);
  for (const f of fs) {
    if (view.skip.has(f.id) || f.kind === 'long' || f.kind === 'inout' || f.kind === 'mm') continue;
    const v = (view.values[f.id] ?? '').trim();
    if (!v) continue;
    if (f.kind === 'date') bits.push(new Date(`${v}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
    else bits.push(f.id === 'doorCount' ? `${v} doors` : f.id === 'days' ? `${v} days` : v);
  }
  return bits.length ? bits.join(' · ') : 'Nothing yet';
}

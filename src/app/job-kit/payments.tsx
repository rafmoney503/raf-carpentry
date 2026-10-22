'use client';
import { useEffect, useRef, useState } from 'react';
import type { CurrentJob, Payment } from '@/lib/servicem8';
import { gbp, money } from '@/lib/client-board';
import { addDays, nearDay, todayKey } from '@/lib/job-timeline';
import { field, label } from './parts';
import { post } from './sm8-post';

/* Adding a payment to a ServiceM8 job from the Job Kit (22 Oct 2026, Raf: 'is it possible to add option for payments
   in client card similar like in service m8 deposit everything with various methods and date to choose'). The same
   as ServiceM8's own Record Payment: deposit or payment, the amount, the day, how they paid, a note. It goes into
   ServiceM8 first (two taps, as every change of money or status here), then shows on the job, the Clients board and
   Today. Used in a job's Money box (current.tsx) and in a sheet over the Clients board (client-board.tsx). Payments
   are only added here: one typed wrong is changed or removed in ServiceM8. */

export type NewPayment = { uuid: string; amount: number; date: string; method: string; deposit: boolean; note: string };

export const sendPayment = (pin: string, job: string, p: NewPayment) => post<{ payment: Payment }>(pin, { action: 'pay', job, ...p });

/* ServiceM8's method is free text: these four first (in ServiceM8's own spelling when Raf's payments already use a
   different case), then up to three others he has used, most used first; Other types a new one. */
const BASE = ['Bank transfer', 'Cash', 'Card', 'Cheque'];
const keyOf = (m: string) =>
  m
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
export function methodsFrom(jobs: CurrentJob[]) {
  const seen = new Map<string, { name: string; n: number }>();
  for (const j of jobs)
    for (const p of j.payments ?? []) {
      const m = p.method.trim();
      if (!m) continue;
      const k = keyOf(m);
      const was = seen.get(k);
      seen.set(k, { name: was?.name ?? m, n: (was?.n ?? 0) + 1 });
    }
  const base = BASE.map((b) => seen.get(keyOf(b))?.name ?? b);
  const extra = [...seen.entries()]
    .filter(([k]) => !BASE.some((b) => keyOf(b) === k))
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 3)
    .map(([, v]) => v.name);
  return [...base, ...extra];
}

const LAST = 'raf_jobkit_pay_method';
const lastMethod = () => {
  try {
    return localStorage.getItem(LAST) || '';
  } catch {
    return '';
  }
};
const keepMethod = (m: string) => {
  try {
    localStorage.setItem(LAST, m);
  } catch {
    /* it just starts on Bank transfer next time */
  }
};

/* "1,500", "£1500.50", "1500.5" -> 1500.5; anything else -> NaN */
export function parseAmount(s: string) {
  const t = s.replace(/[£,\s]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) / 100 : NaN;
}

const newUuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

/* "£3,000 deposit, bank transfer, today" */
export const paymentWords = (p: { amount: number; deposit: boolean; method: string; date: string }, today = todayKey()) =>
  `${gbp(p.amount)} ${p.deposit ? 'deposit' : 'payment'}, ${p.method.toLowerCase()}, ${nearDay(p.date.slice(0, 10), today)}`;

const chip = (on: boolean) => `h-10 shrink-0 rounded-sm border px-3 text-[14.5px] ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount text-ink'}`;

export function PaymentForm({
  job,
  methods,
  onPay,
  onSaved,
  onCancel,
  focus,
}: {
  job: CurrentJob;
  methods: string[];
  onPay: (p: NewPayment) => Promise<string>; // '' when ServiceM8 has it, else what went wrong
  onSaved: (p: NewPayment) => void;
  onCancel: () => void;
  focus?: boolean;
}) {
  const today = todayKey();
  const { total, paid, left } = money(job);
  const nothingYet = !paid && !job.paid;
  const [deposit, setDeposit] = useState(nothingYet && job.status !== 'Completed');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const start = lastMethod();
  const [method, setMethod] = useState(start && methods.some((m) => keyOf(m) === keyOf(start)) ? methods.find((m) => keyOf(m) === keyOf(start))! : methods[0]);
  const [other, setOther] = useState(start && !methods.some((m) => keyOf(m) === keyOf(start)) ? start : '');
  const [useOther, setUseOther] = useState(Boolean(start && !methods.some((m) => keyOf(m) === keyOf(start))));
  const [note, setNote] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [uuid] = useState(newUuid); // the same for every try of this payment, so it can't go in twice
  const disarm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const amountBox = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearTimeout(disarm.current), []);
  useEffect(() => {
    if (focus) amountBox.current?.focus({ preventScroll: true });
  }, [focus]);

  const n = parseAmount(amount);
  const how = (useOther ? other : method).trim();
  const p: NewPayment = { uuid, amount: n, date, method: how, deposit, note: note.trim() };
  const ready = Number.isFinite(n) && n > 0 && Boolean(how) && date <= today;
  const over = Number.isFinite(n) && left !== null && left > 0 && n > left;
  const quick: [string, number][] = [];
  if (left && left > 0) quick.push([nothingYet ? `All of it ${gbp(left)}` : `What’s left ${gbp(left)}`, left]);
  if (nothingYet && total) quick.push([`Half ${gbp(Math.round(total / 2))}`, Math.round(total / 2)]);
  const change = () => {
    setSure(false);
    setProblem('');
  };

  const save = async () => {
    if (!ready) {
      setProblem(!Number.isFinite(n) || n <= 0 ? 'Type the amount in pounds, like 1500 or 1500.50.' : !how ? 'Pick how they paid, or type it under Other.' : 'Pick a day up to today.');
      if (!Number.isFinite(n) || n <= 0) amountBox.current?.focus();
      return;
    }
    clearTimeout(disarm.current);
    if (!sure) {
      setSure(true);
      disarm.current = setTimeout(() => setSure(false), 5000);
      return;
    }
    setSure(false);
    setBusy(true);
    setProblem('');
    const err = await onPay(p);
    setBusy(false);
    if (err) {
      setProblem(err);
      return;
    }
    keepMethod(how);
    onSaved(p);
  };

  return (
    <div className="grid gap-4" data-jk-pay-form>
      <div role="group" aria-label="Deposit or payment" className="flex gap-1.5">
        <button type="button" aria-pressed={deposit} className={chip(deposit)} onClick={() => (setDeposit(true), change())}>
          Deposit
        </button>
        <button type="button" aria-pressed={!deposit} className={chip(!deposit)} onClick={() => (setDeposit(false), change())}>
          Payment
        </button>
      </div>

      <label className="grid gap-1.5">
        <span className={label}>Amount</span>
        <span className="relative block">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-muted">
            £
          </span>
          <input
            ref={amountBox}
            className={`${field} h-12 pl-7 font-mono`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              change();
            }}
          />
        </span>
        {quick.length ? (
          <span className="flex flex-wrap gap-1.5">
            {quick.map(([t, v]) => (
              <button
                key={t}
                type="button"
                className="h-9 rounded-sm border border-line-strong bg-paper px-2.5 font-mono text-[13px] text-ink"
                onClick={() => {
                  setAmount(String(v));
                  change();
                }}
              >
                {t}
              </button>
            ))}
          </span>
        ) : null}
        {over ? <span className="text-[14px] text-muted">More than the {gbp(left!)} ServiceM8 has as left. Fine if the total is going up.</span> : null}
      </label>

      <div className="grid gap-1.5">
        <span className={label}>When</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={date === today} className={chip(date === today)} onClick={() => (setDate(today), change())}>
            Today
          </button>
          <button type="button" aria-pressed={date === addDays(today, -1)} className={chip(date === addDays(today, -1))} onClick={() => (setDate(addDays(today, -1)), change())}>
            Yesterday
          </button>
          <input
            type="date"
            aria-label="Another day"
            className={`${field} h-10 w-auto min-w-[150px] flex-1 font-mono text-[15px]`}
            max={today}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
              change();
            }}
          />
        </span>
      </div>

      <div className="grid gap-1.5">
        <span className={label}>How they paid</span>
        <span role="group" aria-label="How they paid" className="flex flex-wrap gap-1.5">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={!useOther && method === m}
              className={chip(!useOther && method === m)}
              onClick={() => {
                setMethod(m);
                setUseOther(false);
                change();
              }}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={useOther}
            className={chip(useOther)}
            onClick={() => {
              setUseOther(true);
              change();
            }}
          >
            Other
          </button>
        </span>
        {useOther ? (
          <input
            className={`${field} h-11`}
            placeholder="How they paid, e.g. PayPal"
            maxLength={40}
            autoFocus
            value={other}
            onChange={(e) => {
              setOther(e.target.value);
              change();
            }}
          />
        ) : null}
      </div>

      <label className="grid gap-1.5">
        <span className={label}>Note (optional)</span>
        <input
          className={`${field} h-11`}
          placeholder="Reference, e.g. invoice 1042"
          maxLength={200}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            change();
          }}
        />
      </label>

      {problem ? (
        <p role="alert" className="rounded-sm border border-ink bg-mount px-3 py-2 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      <div className="grid gap-2">
        <button
          type="button"
          disabled={busy}
          className={`btn btn-sm h-auto min-h-12 w-full whitespace-normal py-2.5 leading-snug ${sure ? 'btn-primary' : ready ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => void save()}
        >
          {busy ? 'Saving in ServiceM8…' : sure ? `Tap again: ${paymentWords(p, today)}` : 'Save in ServiceM8'}
        </button>
        <button type="button" className="h-10 text-[14.5px] text-muted underline" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="font-mono text-[12px] leading-relaxed text-faint">Goes into ServiceM8 as if you’d recorded it there. To change or remove a payment, do it in ServiceM8.</p>
    </div>
  );
}

/* After a payment is saved: what went in, and, on a job still on Quote, the step a deposit usually means. */
export function PaidNote({ p, job, onWorkOrder, onHide }: { p: NewPayment; job: CurrentJob; onWorkOrder?: () => void; onHide: () => void }) {
  const [sure, setSure] = useState(false);
  const [moved, setMoved] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <div role="status" className="grid gap-2 rounded-sm border border-line-strong bg-paper px-3.5 py-3">
      <p className="text-[15px] leading-snug">
        <b className="font-semibold">Saved in ServiceM8:</b> {paymentWords(p)}.
      </p>
      {moved && job.status === 'Work Order' ? <p className="text-[14px] leading-snug text-muted">Moved to Work Order in ServiceM8 too.</p> : null}
      {job.status === 'Quote' && onWorkOrder ? (
        <>
          <p className="text-[14px] leading-snug text-muted">A {p.deposit ? 'deposit' : 'payment'} usually means they’ve said yes.</p>
          <button
            type="button"
            className={`btn btn-sm w-full ${sure ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              clearTimeout(t.current);
              if (!sure) {
                setSure(true);
                t.current = setTimeout(() => setSure(false), 5000);
                return;
              }
              setSure(false);
              setMoved(true);
              onWorkOrder();
            }}
          >
            {sure ? 'Tap again: Work Order' : 'Move it to Work Order too'}
          </button>
        </>
      ) : null}
      <button type="button" className="justify-self-start text-[14px] text-muted underline" onClick={onHide}>
        Hide
      </button>
    </div>
  );
}

/* The sheet over the Clients board: the client, what they owe, the form; then the saved note. */
export function PaySheet({
  job,
  what,
  methods,
  onPay,
  onWorkOrder,
  onClose,
}: {
  job: CurrentJob;
  what: string;
  methods: string[];
  onPay: (p: NewPayment) => Promise<string>;
  onWorkOrder: () => void;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState<NewPayment | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const { total, paid, left, known } = money(job);
  return (
    <div className="jk-key-back" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="jk-pay-title" className="jk-key jk-plan" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[12.5px] text-faint">
          {job.name}
          {job.number ? ` · #${job.number}` : ''}
          {job.area ? ` · ${job.area}` : ''}
        </p>
        <h2 id="jk-pay-title" ref={title} tabIndex={-1} className="mt-0.5 font-display text-[22px] font-[680] leading-tight tracking-[-0.02em]">
          Add a payment
        </h2>
        {what ? <p className="mt-0.5 text-[14.5px] leading-snug text-muted">{what}</p> : null}
        <p className="mt-2 font-mono text-[13px] text-muted">
          {total === null
            ? paid
              ? `Paid ${gbp(paid)} so far · no total in ServiceM8 yet`
              : 'No total in ServiceM8 yet'
            : !known && !job.paid
            ? `${gbp(total)} · payments not read this time`
            : left === 0
            ? `${gbp(total)}, paid in full`
            : paid
            ? `${gbp(total)} · paid ${gbp(paid)} · ${gbp(left!)} left`
            : `${gbp(total)} · nothing paid yet`}
        </p>
        <div className="mt-4">
          {saved ? (
            <div className="grid gap-3">
              <PaidNote p={saved} job={job} onWorkOrder={onWorkOrder} onHide={onClose} />
              <button type="button" className="btn btn-ghost btn-sm w-full" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <PaymentForm job={job} methods={methods} onPay={onPay} onSaved={setSaved} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

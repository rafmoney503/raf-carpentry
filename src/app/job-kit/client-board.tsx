'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BOARD_STAGES, buildBoard, gbp, stageIndex, type BoardCard, type BoardStage } from '@/lib/client-board';
import { problemText, whatOf, type Marks, type Sm8 } from './current';
import { clock } from './sm8-post';
import { Icon } from './icons';
import { PaySheet, type NewPayment } from './payments';

/* The Clients board (22 Oct 2026, Raf: 'in section timeline i'd like to have a separate summary for current clients
   showing name, job required, status ... completed (where we can close the client off the board)'). Beside the Gantt
   chart in the Job timeline section: every client with a job in ServiceM8, in six steps (New enquiry, Quote, Quote
   sent, Accepted, Deposit paid, Completed), with the job, where it's up to, the money and anything waiting on Raf.
   The steps are worked out in src/lib/client-board.ts. A phone shows the steps one under another (a chip picks one);
   a computer shows them as columns side by side. A finished client is closed off with two taps (the same mark as
   Current jobs' 'Done with it'); nothing here changes ServiceM8. */

/* Gantt chart / Clients board, at the top of both screens of the section. */
export function TimelineTabs({ on, onGantt, onBoard }: { on: 'gantt' | 'board'; onGantt: () => void; onBoard: () => void }) {
  const tab = (id: 'gantt' | 'board', text: string, go: () => void) => (
    <button
      type="button"
      aria-current={on === id ? 'page' : undefined}
      onClick={on === id ? undefined : go}
      className={`h-10 flex-1 rounded-sm border px-3 font-mono text-[13px] sm:flex-none ${on === id ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount text-ink hover:border-ink'}`}
    >
      {text}
    </button>
  );
  return (
    <nav aria-label="Job timeline" className="mt-4 flex gap-1.5">
      {tab('gantt', 'Gantt chart', onGantt)}
      {tab('board', 'Clients board', onBoard)}
    </nav>
  );
}

/* Six little steps, filled up to where the job is. */
function Steps({ stage }: { stage: BoardStage }) {
  const at = stageIndex(stage);
  return (
    <span className="jk-steps mt-2.5" role="img" aria-label={`Step ${at + 1} of 6: ${BOARD_STAGES[at].name}`}>
      {BOARD_STAGES.map((s, i) => (
        <span key={s.id} className={i <= at ? 'on' : ''} />
      ))}
    </span>
  );
}

/* Close a finished client off the board: tap, then tap again within 5 seconds. */
function CloseButton({ card, onClose }: { card: BoardCard; onClose: () => void }) {
  const [sure, setSure] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const owed = (card.left ?? 0) > 0;
  return (
    <button
      type="button"
      onClick={() => {
        clearTimeout(t.current);
        if (!sure) {
          setSure(true);
          t.current = setTimeout(() => setSure(false), 5000);
          return;
        }
        setSure(false);
        onClose();
      }}
      className={`h-10 w-full font-mono text-[13px] ${sure ? 'font-semibold text-ink underline' : 'text-muted underline'}`}
    >
      {sure ? (owed ? `Tap again: close with ${gbp(card.left!)} unpaid` : 'Tap again to close') : 'Close it off the board'}
    </button>
  );
}

function Card({ c, onOpen, onClose, onPay, onSent }: { c: BoardCard; onOpen: (uuid: string) => void; onClose: (uuid: string) => void; onPay: (uuid: string) => void; onSent: (uuid: string) => void }) {
  const j = c.job;
  const what = j.description ? whatOf(j.description) : '';
  const owed = c.stage === 'completed' && (c.left ?? 0) > 0;
  // Money comes in from a quote sent on (a deposit) until a finished job is paid in full.
  const canPay = c.stage === 'sent' || c.stage === 'accepted' || (c.stage === 'deposit' && c.left !== 0) || (c.stage === 'completed' && c.left !== 0 && !j.paid);
  // The quote goes out by WhatsApp or by hand, so ServiceM8 doesn't know: one tap moves the card on (Undo in the note).
  const canSend = c.stage === 'enquiry' || c.stage === 'quote';
  return (
    <li className="min-w-0 rounded-sm border border-line-strong bg-mount" data-jk-id={j.uuid}>
      <button type="button" onClick={() => onOpen(j.uuid)} className="block w-full px-3.5 pb-3 pt-2.5 text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[16px] font-semibold leading-snug">{j.name || 'No name in ServiceM8'}</span>
          {j.number ? <span className="shrink-0 font-mono text-[12px] text-faint">#{j.number}</span> : null}
        </span>
        <span className={`mt-0.5 block text-[14.5px] leading-snug ${what ? '' : 'text-faint'}`}>{what || 'No job description in ServiceM8'}</span>
        {j.area ? <span className="block truncate text-[13.5px] text-muted">{j.area}</span> : null}
        <Steps stage={c.stage} />
        <span className="mt-1.5 block font-mono text-[12.5px] leading-snug text-faint">{c.words}</span>
        {c.money ? <span className={`mt-0.5 block font-mono text-[12.5px] leading-snug ${owed ? 'font-semibold text-ink' : 'text-muted'}`}>{c.money}</span> : null}
        {c.flag ? <span className={`mt-2 inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[11.5px] ${owed ? 'border-ink text-ink' : 'border-accent text-accent'}`}>{c.flag}</span> : null}
      </button>
      {canSend || canPay || c.stage === 'completed' ? (
        <div className="divide-y divide-line border-t border-line px-3.5">
          {canSend ? (
            <button type="button" onClick={() => onSent(j.uuid)} className="h-10 w-full font-mono text-[13px] text-accent underline">
              I’ve sent the quote
            </button>
          ) : null}
          {canPay ? (
            <button type="button" onClick={() => onPay(j.uuid)} className="h-10 w-full font-mono text-[13px] text-accent underline">
              {c.stage === 'sent' ? 'Add a deposit' : 'Add a payment'}
            </button>
          ) : null}
          {c.stage === 'completed' ? <CloseButton card={c} onClose={() => onClose(j.uuid)} /> : null}
        </div>
      ) : null}
    </li>
  );
}

const colMoney = (stage: BoardStage, cards: BoardCard[]) => {
  const sum = (f: (c: BoardCard) => number) => Math.round(cards.reduce((s, c) => s + f(c), 0) * 100) / 100;
  if (stage === 'sent') return sum((c) => c.total ?? 0);
  if (stage === 'accepted' || stage === 'deposit' || stage === 'completed') return sum((c) => c.left ?? 0);
  return 0;
};
const colMoneyWord = (stage: BoardStage) => (stage === 'sent' ? 'quoted' : stage === 'completed' ? 'to collect' : 'left');

export function ClientBoard({
  sm8,
  marks,
  loading,
  wide,
  onRefresh,
  onOpen,
  onClose,
  onGantt,
  methods,
  onPay,
  onWorkOrder,
  onQuoteSent,
}: {
  sm8: Sm8;
  marks: Marks;
  loading: boolean;
  wide: boolean; // columns side by side (a computer, not in the list beside a job)
  onRefresh: () => void;
  onOpen: (uuid: string) => void;
  onClose: (uuid: string, closed: boolean) => void;
  onGantt: () => void;
  methods: string[]; // how payments come in (payments.tsx methodsFrom)
  onPay: (uuid: string, p: NewPayment) => Promise<string>;
  onWorkOrder: (uuid: string) => void;
  onQuoteSent: (uuid: string, sent: boolean) => void; // the Job Kit's own mark, as the job screen's 'I've sent the quote'
}) {
  const board = useMemo(() => buildBoard(sm8.jobs, sm8.bookings, marks), [sm8.jobs, sm8.bookings, marks]);
  const [pick, setPick] = useState<BoardStage | 'all'>('all');
  const [showClosed, setShowClosed] = useState(false);
  const [closedNow, setClosedNow] = useState<{ uuid: string; name: string; kind: 'closed' | 'sent' } | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const payJob = payFor ? sm8.jobs.find((j) => j.uuid === payFor) : undefined;
  const problem = problemText(sm8.error, sm8.detail, sm8.at);
  const close = (uuid: string) => {
    onClose(uuid, true);
    setClosedNow({ uuid, name: sm8.jobs.find((j) => j.uuid === uuid)?.name ?? 'the client', kind: 'closed' });
  };
  const sent = (uuid: string) => {
    onQuoteSent(uuid, true);
    setClosedNow({ uuid, name: sm8.jobs.find((j) => j.uuid === uuid)?.name ?? 'the client', kind: 'sent' });
  };
  const cols = board.columns.filter((c) => pick === 'all' || c.stage === pick);

  const totals: [string, number, string][] = [
    ['Quotes out', board.quotesOut, `${board.columns[2].cards.length} sent`],
    ['To come', board.toCome, `${board.columns[3].cards.length + board.columns[4].cards.length} going ahead`],
    ['To collect', board.toCollect, ((n) => `${n} job${n === 1 ? '' : 's'}`)(board.columns[5].cards.filter((c) => (c.left ?? 0) > 0).length)],
  ];

  return (
    <div className="pt-7">
      <p className="kicker">Job timeline · every client from ServiceM8</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-[34px] font-[680] leading-[1.02] tracking-[-0.025em]">
        <Icon name="board" className="h-[32px] w-[32px] shrink-0 jk-sec-ink" />
        Clients board
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-mono text-[13px] text-faint">
        <span>From ServiceM8{sm8.at ? `, ${clock(sm8.at)}` : ''}</span>
        <button type="button" onClick={onRefresh} className="h-9 text-accent underline" disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </p>
      <TimelineTabs on="board" onGantt={onGantt} onBoard={() => {}} />
      {problem ? (
        <p role="alert" className="mt-3 rounded-sm border border-ink bg-mount px-3 py-2.5 text-[14.5px] leading-relaxed">
          {problem}
        </p>
      ) : null}
      {sm8.at && sm8.bookings === null ? (
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">ServiceM8 didn’t send the bookings this time, so a quote with a visit booked may show as a new enquiry. Refresh to try again.</p>
      ) : null}
      {closedNow ? (
        <p role="status" className="mt-4 flex items-center justify-between gap-3 rounded-sm border border-line-strong bg-mount px-3.5 py-2.5 text-[14.5px]">
          <span className="min-w-0">
            {closedNow.kind === 'sent' ? 'Moved to Quote sent: ' : 'Closed off the board: '}
            <b className="font-semibold">{closedNow.name}</b>
          </span>
          <span className="flex shrink-0 gap-4">
            <button
              type="button"
              className="h-9 font-semibold text-accent underline"
              onClick={() => {
                if (closedNow.kind === 'sent') onQuoteSent(closedNow.uuid, false);
                else onClose(closedNow.uuid, false);
                setClosedNow(null);
              }}
            >
              Undo
            </button>
            <button type="button" aria-label="Hide this note" className="h-9 w-6 text-[20px] leading-none text-faint" onClick={() => setClosedNow(null)}>
              ×
            </button>
          </span>
        </p>
      ) : null}

      {!sm8.at && !problem ? <p className="mt-7 font-mono text-[13.5px] text-faint">{loading ? 'Getting your clients from ServiceM8…' : 'Nothing yet.'}</p> : null}

      {payJob ? (
        <PaySheet
          job={payJob}
          what={payJob.description ? whatOf(payJob.description) : ''}
          methods={methods}
          onPay={(p) => onPay(payJob.uuid, p)}
          onWorkOrder={() => onWorkOrder(payJob.uuid)}
          onClose={() => setPayFor(null)}
        />
      ) : null}

      {sm8.at ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {totals.map(([name, n, sub]) => (
              <div key={name} className="min-w-0 rounded-sm border border-line-strong bg-mount px-2.5 py-2">
                <span className="block truncate font-mono text-[11px] uppercase tracking-[0.06em] text-faint">{name}</span>
                <span className="block truncate font-display text-[21px] font-[680] leading-tight tracking-[-0.01em]">{gbp(n)}</span>
                <span className="block truncate font-mono text-[11.5px] text-faint">{sub}</span>
              </div>
            ))}
          </div>

          {!wide ? (
            <div role="group" aria-label="Show" className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {[['all', 'All', board.count] as const, ...board.columns.map((c) => [c.stage, BOARD_STAGES[stageIndex(c.stage)].name, c.cards.length] as const)].map(([id, name, n]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={pick === id}
                  onClick={() => setPick(id)}
                  className={`h-9 shrink-0 rounded-sm border px-3 font-mono text-[13px] ${pick === id ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-mount text-ink'}`}
                >
                  {name} ({n})
                </button>
              ))}
            </div>
          ) : null}

          {wide ? (
            <div className="jk-board-wrap mt-6">
              <div className="jk-board">
                {board.columns.map((c) => {
                  const st = BOARD_STAGES[stageIndex(c.stage)];
                  const m = colMoney(c.stage, c.cards);
                  return (
                    <section key={c.stage} aria-label={st.name} className="jk-board-col">
                      <header className="jk-board-head">
                        <span className="font-mono text-[11.5px] text-faint">0{stageIndex(c.stage) + 1}</span>
                        <h2 className="text-[15.5px] font-semibold leading-tight">
                          {st.name} <span className="font-mono text-[13px] font-normal text-faint">({c.cards.length})</span>
                        </h2>
                        <span className="block font-mono text-[11.5px] leading-snug text-faint">{m ? `${gbp(m)} ${colMoneyWord(c.stage)}` : st.what}</span>
                      </header>
                      {c.cards.length ? (
                        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
                          {c.cards.map((card) => (
                            <Card key={card.job.uuid} c={card} onOpen={onOpen} onClose={close} onPay={setPayFor} onSent={sent} />
                          ))}
                        </ul>
                      ) : (
                        <p className="px-1 font-mono text-[12.5px] text-faint">None right now</p>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            cols.map((c) => {
              const st = BOARD_STAGES[stageIndex(c.stage)];
              const m = colMoney(c.stage, c.cards);
              return (
                <section key={c.stage} aria-label={st.name} className="mt-6">
                  <h2 className="flex items-baseline gap-2 font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint">
                    <span className="jk-sec-ink">0{stageIndex(c.stage) + 1}</span>
                    <span className="text-ink">
                      {st.name} ({c.cards.length})
                    </span>
                    {m ? <span className="ml-auto normal-case tracking-normal">{`${gbp(m)} ${colMoneyWord(c.stage)}`}</span> : null}
                  </h2>
                  <p className="mt-0.5 text-[13.5px] text-muted">{st.what}</p>
                  {c.cards.length ? (
                    <ul className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-2.5">
                      {c.cards.map((card) => (
                        <Card key={card.job.uuid} c={card} onOpen={onOpen} onClose={close} onPay={setPayFor} onSent={sent} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 font-mono text-[12.5px] text-faint">None right now</p>
                  )}
                </section>
              );
            })
          )}

          {!board.count ? <p className="mt-6 font-mono text-[13.5px] text-faint">No clients with an open job in ServiceM8.</p> : null}

          {board.closed.length ? (
            <div className="mt-8 border-t border-line pt-3">
              <button type="button" onClick={() => setShowClosed((v) => !v)} aria-expanded={showClosed} className="flex h-11 w-full items-center justify-between text-left text-[15.5px] font-semibold">
                <span>Closed off the board ({board.closed.length})</span>
                <span aria-hidden className="font-mono text-[13px] text-faint">
                  {showClosed ? 'Hide' : 'Show'}
                </span>
              </button>
              {showClosed ? (
                <>
                  <p className="text-[14px] leading-relaxed text-muted">
                    Finished and closed. They’re off Current jobs too. ServiceM8 keeps them, and they drop off the Job Kit 30 days after they were completed.
                  </p>
                  <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
                    {board.closed.map((c) => (
                      <li key={c.job.uuid} className="flex items-center gap-3 rounded-sm border border-line bg-mount px-3.5 py-2.5">
                        <button type="button" onClick={() => onOpen(c.job.uuid)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-semibold">{c.job.name}</span>
                          <span className="block truncate font-mono text-[12.5px] text-faint">
                            {c.words}
                            {c.money ? ` · ${c.money}` : ''}
                          </span>
                        </button>
                        <button type="button" onClick={() => onClose(c.job.uuid, false)} className="h-10 shrink-0 font-mono text-[13px] text-accent underline">
                          Put back
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

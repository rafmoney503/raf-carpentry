'use client';

import { CALC_NAMES, calcAnswer, calcKindsFor, fromDraft, shownFields, startDraft, type CalcDraft, type CalcKind } from '@/lib/job-calculators';
import type { Size } from './store';
import { field, label } from './parts';

/* "Calculator on the job page", on a Job Kit job's Notes tab (8 Nov 2026, Raf: "add calculators to relevant jobs in
   jobkit new job form as you created in the wall panelling job", then "Go"). Shown when the job is wall panelling
   (Batten grid or Picture frames) or decking (Decking). Raf fills in the job's real sizes, starting from its first
   size above, and sees the answer as he types, so it doubles as the setting-out on site. It goes to the inbox with
   the notes (job.json `calculator`, a notes.txt line), and the job page gets the calculator with those sizes. */

export default function JobCalc({ kinds, sizes, value, onChange }: { kinds: string[]; sizes: Size[]; value?: CalcDraft; onChange: (c: CalcDraft) => void }) {
  const suits = calcKindsFor(kinds);
  if (!suits.length) return null;
  const size = sizes.find((s) => s.w || s.h || s.d);
  const on = value && (value.kind === 'none' || suits.includes(value.kind)) ? value.kind : null;
  const pick = (kind: CalcKind | 'none') => {
    if (kind === 'none') onChange({ kind, v: value?.v ?? {} });
    else onChange({ kind, v: startDraft(kind, size, value?.v ?? {}) });
  };
  const set = (k: string, t: string) => value && onChange({ ...value, v: { ...value.v, [k]: t } });
  const kind = on && on !== 'none' ? on : null;
  const draft = kind && value ? value : null;
  const res = draft ? fromDraft(draft) : null;
  const answer = res?.calc ? calcAnswer(res.calc) : null;
  const badLabel = kind && res?.bad ? shownFields(kind, draft!.v).find((f) => f.key === res.bad)?.label : '';

  return (
    <fieldset data-job-calc>
      <legend className={label}>Calculator on the job page</legend>
      <p className="mt-1.5 text-[14.5px] leading-snug text-muted">
        Visitors put in their own sizes; it starts with this job&apos;s. Fill it in from the job and it works out the setting-out here too.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Which calculator">
        {[...suits, 'none' as const].map((k) => {
          const pressed = on === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={pressed}
              onClick={() => pick(k)}
              className={`min-h-10 rounded-sm border px-3 py-1.5 text-[15px] transition-colors ${pressed ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-ink'}`}
            >
              {k === 'none' ? 'None' : CALC_NAMES[k]}
            </button>
          );
        })}
      </div>

      {kind && draft ? (
        <div className="mt-3 rounded-sm border border-line bg-mount p-2.5">
          <div className="grid grid-cols-2 items-end gap-2.5">
            {shownFields(kind, draft.v).map((f) =>
              f.type === 'choice' ? (
                <div key={f.key} className="col-span-2 grid gap-1">
                  <span className="font-mono text-[11.5px] text-faint">{f.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {f.options!.map((o) => {
                      const pressed = (draft.v[f.key] ?? f.def) === o.v;
                      return (
                        <button
                          key={o.v}
                          type="button"
                          aria-pressed={pressed}
                          onClick={() => set(f.key, o.v)}
                          className={`min-h-10 rounded-sm border px-3 py-1.5 text-[14.5px] transition-colors ${pressed ? 'border-ink bg-ink text-on-accent' : 'border-line-strong bg-paper text-ink hover:border-ink'}`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <label key={f.key} className="grid min-w-0 gap-1">
                  <span className="font-mono text-[11.5px] text-faint">{f.label}</span>
                  <span className="relative">
                    <input
                      className={`${field} h-11 pr-10 font-mono ${res?.bad === f.key ? 'border-accent ring-2 ring-accent/20' : ''}`}
                      inputMode={f.type === 'count' ? 'numeric' : 'decimal'}
                      value={draft.v[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value.replace(f.type === 'count' ? /[^\d]/g : /[^\d.,]/g, '').slice(0, 7))}
                      placeholder={f.type === 'count' ? 'Auto' : 'mm'}
                      data-calc-field={f.key}
                    />
                    {f.type === 'mm' ? (
                      <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-faint">
                        mm
                      </span>
                    ) : null}
                  </span>
                </label>
              ),
            )}
          </div>
          <div className={`mt-3 rounded-sm px-3 py-2.5 ${answer?.ok ? 'bg-ink text-on-accent' : 'border border-line-strong bg-paper text-ink'}`} aria-live="polite" data-calc-answer>
            <p className={`font-mono text-[11px] uppercase tracking-[0.06em] ${answer?.ok ? 'text-on-accent/65' : 'text-faint'}`}>{CALC_NAMES[kind]} · as it will start on the page</p>
            <p className="mt-1 text-[15px] font-medium leading-snug">{answer ? answer.line : `Check the ${badLabel?.toLowerCase() || 'sizes'}: in mm, like 4105`}</p>
          </div>
        </div>
      ) : on === 'none' ? (
        <p className="mt-2 text-[14px] text-faint">No calculator on this job&apos;s page.</p>
      ) : null}
    </fieldset>
  );
}

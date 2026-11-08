'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

/* The pieces the calculators on the job pages share (PanellingCalculator, PictureFramesCalculator): a numbered
   question, a row of choices, a size in mm with − and +, a count with Auto, the "Rather I fit it?" card and the
   link that opens the same sizes in the Workshop Tools app. */

export function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
        {n} · {title}
      </p>
      {children}
    </div>
  );
}

export function Choice<T extends string | number | boolean>({
  options,
  value,
  onPick,
  cols = 2,
  mono = false,
}: {
  options: { v: T; label: string; sub?: string }[];
  value: T;
  onPick: (v: T) => void;
  cols?: 2 | 3 | 4;
  mono?: boolean;
}) {
  return (
    <div className={`grid gap-2.5 ${cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.v)}
            className={`flex min-h-12 flex-col justify-center gap-0.5 rounded-sm border-[1.5px] px-3 py-2.5 text-left transition-colors ${
              on ? 'border-ink bg-ink text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-accent'
            } ${mono ? 'items-center font-mono text-[15px]' : ''}`}
          >
            <span className={mono ? '' : 'text-[15px] font-semibold leading-tight'}>{o.label}</span>
            {o.sub ? <span className={`font-mono text-[11.5px] leading-snug ${on ? 'text-on-accent/80' : 'text-faint'}`}>{o.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** a size in mm, typed or nudged with − and + */
export function MmField({
  id,
  label,
  text,
  onText,
  step,
  onStep,
  read,
  min = 0,
}: {
  id: string;
  label: string;
  text: string;
  onText: (t: string) => void;
  step: number;
  onStep: (by: number) => void;
  read: (t: string) => number | null;
  min?: number;
}) {
  const v = read(text);
  const bad = v === null || v < min;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-medium">
        {label}
      </label>
      <div
        className={`flex h-12 overflow-hidden rounded-sm border bg-mount focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${
          bad ? 'border-accent ring-2 ring-accent/20' : 'border-line-strong'
        }`}
      >
        <button type="button" aria-label={`${label}: ${step} mm less`} onClick={() => onStep(-step)} className="w-11 flex-none text-[20px] text-muted transition-colors hover:text-ink">
          −
        </button>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => onText(e.target.value.slice(0, 7))}
          aria-invalid={bad || undefined}
          className="min-w-0 flex-1 bg-transparent text-center font-mono text-[18px] text-ink outline-none"
        />
        <span aria-hidden="true" className="flex items-center pr-1 font-mono text-[12px] text-faint">
          mm
        </span>
        <button type="button" aria-label={`${label}: ${step} mm more`} onClick={() => onStep(step)} className="w-11 flex-none text-[20px] text-muted transition-colors hover:text-ink">
          +
        </button>
      </div>
    </div>
  );
}

/** a count with − and +, and Auto beside it (0 = Auto) */
export function CountAuto({
  id,
  label,
  shown,
  auto,
  autoSub,
  onSet,
  max,
  unit,
  dataAttr,
}: {
  id: string;
  label: string;
  /** what's counted, for the − and + buttons' names: "One panel fewer" */
  unit: string;
  /** the count shown (what Auto works out, when it's on), or null for a dash */
  shown: number | null;
  auto: boolean;
  autoSub: string;
  onSet: (n: number) => void;
  max: number;
  dataAttr?: string;
}) {
  const now = shown ?? 1;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div>
        <p className="mb-1.5 text-[14px] font-medium" id={`${id}-label`}>
          {label}
        </p>
        <div className="flex h-12 overflow-hidden rounded-sm border border-line-strong bg-mount" role="group" aria-labelledby={`${id}-label`}>
          <button type="button" aria-label={`One ${unit} fewer`} onClick={() => onSet(Math.max(1, now - 1))} className="w-12 flex-none text-[20px] text-muted transition-colors hover:text-ink">
            −
          </button>
          <output className="flex flex-1 items-center justify-center font-mono text-[18px] text-ink" {...(dataAttr ? { [dataAttr]: '' } : {})}>
            {shown ?? '–'}
          </output>
          <button type="button" aria-label={`One ${unit} more`} onClick={() => onSet(Math.min(max, now + 1))} className="w-12 flex-none text-[20px] text-muted transition-colors hover:text-ink">
            +
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={auto}
        onClick={() => onSet(0)}
        className={`flex h-12 min-w-[96px] flex-col items-center justify-center rounded-sm border-[1.5px] px-3 transition-colors ${
          auto ? 'border-ink bg-ink text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-accent'
        }`}
      >
        <span className="text-[14px] font-semibold leading-tight">Auto</span>
        <span className={`font-mono text-[11px] leading-tight ${auto ? 'text-on-accent/80' : 'text-faint'}`}>{autoSub}</span>
      </button>
    </div>
  );
}

/** "Rather I fit it?": Get a quote, the list to WhatsApp, Copy the list */
export function RatherCard({ line, briefHref, text, fallback }: { line: string; briefHref: string; text: string; fallback: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the browser said no: Send this list to WhatsApp still works */
    }
  };
  return (
    <div className="mt-8 rounded-sm bg-ink p-5 text-on-accent md:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-on-accent/70">Rather I fit it?</p>
      <p className="mt-1.5 font-display text-[22px] font-[650] leading-tight tracking-[-0.01em]">{line}</p>
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Link href={briefHref} className="btn btn-primary w-full">
          Get a quote
        </Link>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text || fallback)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-12 items-center justify-center rounded-sm border-[1.5px] border-on-accent/30 px-4 text-[15px] font-medium text-on-accent transition-colors hover:border-on-accent"
        >
          Send this list to WhatsApp
        </a>
      </div>
      {text ? (
        <button type="button" onClick={copy} className="mt-3 font-mono text-[12.5px] text-on-accent/75 underline underline-offset-4 hover:text-on-accent">
          {copied ? 'Copied the list' : 'Copy the list'}
        </button>
      ) : null}
    </div>
  );
}

/** the same sizes opened in the Workshop Tools app */
export function AppLink({ href, data }: { href: string; data: string }) {
  return (
    <a href={href} className="group mt-4 flex items-center gap-3 rounded-sm border border-line bg-mount p-3 transition-colors hover:border-accent" {...{ [data]: '' }}>
      <Image src="/images/tools/workshop/icon-192.png" alt="" width={44} height={44} className="size-11 flex-none rounded-[10px]" />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-accent">Free app · works with no signal</span>
        <span className="block text-[15px] font-semibold leading-snug transition-colors group-hover:text-accent">Open these sizes in Workshop Tools</span>
      </span>
      <span aria-hidden="true" className="text-accent">
        →
      </span>
    </a>
  );
}

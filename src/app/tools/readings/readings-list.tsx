'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { messageFor, placesOf, readingLine, removeReadings, setLastPlace, updateReading, useReadings, whenSaved, type Reading } from '@/lib/readings';

/* The list on /tools/readings: places as chips (All, each place, No place), a card per reading with Edit and Delete
   (two taps), what gets sent, and a bar at the bottom that sends the readings shown on WhatsApp (to whoever they pick:
   no number in the link) or copies them. */

const TOOL_NAME: Record<Reading['tool'], string> = { level: 'Spirit level' };
const NONE = '\u0000none';
const noop = () => () => {};

export default function ReadingsList() {
  const list = useReadings();
  // false on the server and while hydrating, so the empty list isn't flashed before the browser's own is read
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [sel, setSel] = useState<string | null>(null); // null = All, NONE = no place
  const [armed, setArmed] = useState<string | null>(null);
  const [allArmed, setAllArmed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const places = placesOf(list);
  const noPlace = list.filter((r) => !r.place.trim()).length;
  const valid = sel === null || (sel === NONE ? noPlace > 0 : places.includes(sel));
  const cur = valid ? sel : null;
  const shown = list.filter((r) => cur === null || (cur === NONE ? !r.place.trim() : r.place.trim() === cur));
  const message = messageFor(shown, cur === null ? null : cur === NONE ? '' : cur);
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const disarmSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setArmed(null);
      setAllArmed(false);
    }, 5000);
  };
  const pick = (v: string | null) => {
    setSel(v);
    setArmed(null);
    setAllArmed(false);
    setEditing(null);
  };

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(message);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = message;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!ready) return <div className="min-h-[240px]" aria-hidden="true" />;

  if (!list.length) {
    return (
      <div className="mt-8 mb-20 rounded-sm border border-dashed border-line-strong bg-mount p-6 md:mb-28">
        <p className="text-[17px] font-[620]">Nothing saved yet.</p>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed text-muted">
          Open the spirit level, put the phone on what you&apos;re checking and tap Save. Give it a name and a place (the kitchen, a client&apos;s address) and it shows up here, ready to send.
        </p>
        <Link href="/tools/spirit-level" className="btn btn-primary mt-5">
          Open the spirit level
        </Link>
      </div>
    );
  }

  const chips: { key: string; v: string | null; label: string; n: number }[] = [
    { key: 'all', v: null, label: 'All', n: list.length },
    ...places.map((p) => ({ key: `p:${p}`, v: p, label: p, n: list.filter((r) => r.place.trim() === p).length })),
    ...(noPlace ? [{ key: 'none', v: NONE, label: 'No place', n: noPlace }] : []),
  ];

  return (
    <div className="mt-6">
      <div role="group" aria-label="Places" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((c) => {
          const on = cur === c.v;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => pick(c.v)}
              className={`flex h-11 flex-none items-center gap-2 whitespace-nowrap rounded-sm border px-3 text-[14px] font-[600] transition-colors ${on ? 'border-ink bg-ink text-mount' : 'border-line-strong bg-mount text-ink hover:border-accent'}`}
            >
              {c.label}
              <span className="font-mono text-[12px] font-normal opacity-75">{c.n}</span>
            </button>
          );
        })}
      </div>

      <ol className="mt-4 grid gap-2">
        {shown.map((r) => {
          const isArmed = armed === r.id;
          const placeName = r.place.trim() || 'No place';
          return (
            <li key={r.id} className="rounded-sm border border-line-strong bg-mount shadow-[0_1px_2px_rgb(22_25_28/0.05)]" data-reading={r.id}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-3 pl-3.5 pr-1.5">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] leading-tight">
                    <span className="uppercase tracking-[0.04em] text-accent">{TOOL_NAME[r.tool]}</span>
                    <span className="text-faint">{whenSaved(r.at)}</span>
                  </div>
                  {r.label.trim() ? <b className="text-[15px] font-[620] leading-snug">{r.label}</b> : null}
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="flex-none font-mono text-[24px] leading-none tracking-[-0.02em]">{r.value}</span>
                    <span className="text-[13.5px] leading-snug text-muted">{r.detail}</span>
                  </div>
                  <span className="mt-1 self-start rounded-sm border border-line-strong px-1.5 py-1 font-mono text-[11px] leading-none text-muted">{placeName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Change the name or place of ${r.label || readingLine(r)}`}
                    aria-expanded={editing === r.id}
                    onClick={() => setEditing(editing === r.id ? null : r.id)}
                    className="grid h-11 w-11 place-items-center rounded-sm text-muted transition-colors hover:text-accent"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 20h4L19 9l-4-4L4 16z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={isArmed ? `Tap again to delete ${r.label || readingLine(r)}` : `Delete ${r.label || readingLine(r)}`}
                    onClick={() => {
                      if (isArmed) {
                        removeReadings([r.id]);
                        setArmed(null);
                        if (editing === r.id) setEditing(null);
                      } else {
                        setArmed(r.id);
                        setAllArmed(false);
                        disarmSoon();
                      }
                    }}
                    className={`grid h-11 w-11 place-items-center rounded-sm text-[11px] font-[600] transition-colors ${isArmed ? 'bg-ink text-mount' : 'text-muted hover:text-ink'}`}
                  >
                    {isArmed ? (
                      'Sure?'
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {editing === r.id ? <EditReading r={r} places={places} onDone={() => setEditing(null)} /> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <button type="button" aria-expanded={preview} onClick={() => setPreview(!preview)} className="h-11 text-[14px] font-[600] text-accent underline underline-offset-2">
          {preview ? 'Hide what gets sent' : 'Show what gets sent'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (allArmed) {
              removeReadings(shown.map((r) => r.id));
              setAllArmed(false);
              setSel(null);
            } else {
              setAllArmed(true);
              setArmed(null);
              disarmSoon();
            }
          }}
          className={`h-11 rounded-sm px-3 text-[13.5px] font-[600] transition-colors ${allArmed ? 'bg-ink text-mount' : 'text-muted underline underline-offset-2 hover:text-ink'}`}
        >
          {allArmed ? `Tap again to delete ${shown.length === 1 ? 'it' : `all ${shown.length}`}` : cur === null ? `Delete all ${shown.length}` : `Delete these ${shown.length}`}
        </button>
      </div>
      {preview ? (
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-sm border border-whatsapp/45 bg-whatsapp/10 p-3 font-mono text-[12.5px] leading-[1.45] text-ink">{message}</pre>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 grid grid-cols-[minmax(0,1fr)_72px] gap-2 border-t border-line bg-paper px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 sm:mx-0 sm:px-0">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-whatsapp h-[58px] justify-center text-[16px]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.2-.2-.4-.3z" />
          </svg>
          Send {shown.length} on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy as text"
          className="flex h-[58px] flex-col items-center justify-center gap-1 rounded-sm border border-line-strong bg-mount text-[12px] font-[600] text-ink transition-colors hover:border-accent"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8" y="8" width="12" height="12" rx="1" />
            <path d="M16 8V4H4v12h4" />
          </svg>
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <p className="mb-16 mt-2 text-[13px] text-faint md:mb-24">
        WhatsApp asks who to send them to. <Link href="/tools/spirit-level" className="text-accent underline underline-offset-2">Back to the spirit level</Link>
      </p>
    </div>
  );
}

function EditReading({ r, places, onDone }: { r: Reading; places: string[]; onDone: () => void }) {
  const [label, setLabel] = useState(r.label);
  const [place, setPlace] = useState(r.place);
  const listId = `places-${r.id}`;
  const save = (e: FormEvent) => {
    e.preventDefault();
    updateReading(r.id, { label: label.trim(), place: place.trim() });
    if (place.trim()) setLastPlace(place.trim());
    onDone();
  };
  return (
    <form onSubmit={save} className="grid gap-3 border-t border-line px-3.5 py-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-[12.5px] text-muted">
        What is it?
        <input
          type="text"
          value={label}
          maxLength={80}
          placeholder="e.g. Worktop, left run"
          onChange={(e) => setLabel(e.target.value)}
          className="h-11 rounded-sm border border-line-strong bg-field px-2.5 text-[16px] text-ink focus:border-accent focus:outline-2 focus:outline-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-muted">
        Place
        <input
          type="text"
          value={place}
          maxLength={60}
          list={listId}
          placeholder="e.g. Kitchen, Crouch End"
          onChange={(e) => setPlace(e.target.value)}
          className="h-11 rounded-sm border border-line-strong bg-field px-2.5 text-[16px] text-ink focus:border-accent focus:outline-2 focus:outline-accent"
        />
        <datalist id={listId}>
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-primary btn-sm">
          Save changes
        </button>
        <button type="button" onClick={onDone} className="h-11 text-[14px] font-[600] text-muted underline underline-offset-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

'use client';
import { useEffect, useId, useRef, useState } from 'react';

/* UK address with a postcode finder. As the customer types a postcode, matching postcodes
   drop down (postcodes.io: free, official ONS data, no key). Picking one fills the town and
   area. "Use my location" lists the nearest postcodes. House number and street are typed,
   and phones can also autofill the lot from a saved address. If the lookup service is ever
   down, the boxes still work as plain text. */

export type Address = { line1: string; area: string; postcode: string };

const API = 'https://api.postcodes.io';
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/;

type Lookup = { admin_ward?: string | null; admin_district?: string | null; parish?: string | null };

function areaFrom(r: Lookup) {
  const parts = [r.admin_ward, r.admin_district].filter((p): p is string => Boolean(p && p.trim()));
  return [...new Set(parts)].join(', ');
}

export default function AddressFinder({
  value,
  onChange,
  inputClass,
}: {
  value: Address;
  onChange: (a: Address) => void;
  inputClass: string;
}) {
  const [list, setList] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);
  const areaAuto = useRef(true); // area box still holds what the lookup filled in, so it may be replaced
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Opening the list cancels a pending close from the box losing focus (e.g. after tapping Use my location).
  const show = () => { if (blurTimer.current) clearTimeout(blurTimer.current); setOpen(true); };
  const valueRef = useRef(value);
  valueRef.current = value;
  const listId = useId();

  useEffect(() => () => { abort.current?.abort(); if (timer.current) clearTimeout(timer.current); if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const set = (patch: Partial<Address>) => onChange({ ...valueRef.current, ...patch });

  async function getJson(url: string) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return res.json();
  }

  async function suggest(q: string) {
    try {
      const data = await getJson(`${API}/postcodes/${encodeURIComponent(q)}/autocomplete?limit=6`);
      const result: string[] = Array.isArray(data?.result) ? data.result : [];
      setList(result);
      setActive(-1);
      if (result.length) show(); else setOpen(false);
      setNote(result.length ? '' : q.replace(/\s/g, '').length >= 5 ? 'No postcode found. Check it, or just type it in.' : '');
    } catch {
      /* lookup unavailable or cancelled: typing still works */
    }
  }

  async function pick(pc: string) {
    setOpen(false);
    setList([]);
    set({ postcode: pc });
    try {
      const data = await getJson(`${API}/postcodes/${encodeURIComponent(pc)}`);
      const area = data?.result ? areaFrom(data.result) : '';
      if (area && (areaAuto.current || !valueRef.current.area.trim())) {
        areaAuto.current = true;
        set({ postcode: pc, area });
      }
      setNote(area ? `Found: ${area}` : '');
    } catch {
      /* fine without the area */
    }
  }

  function onPostcode(raw: string) {
    const v = raw.toUpperCase().slice(0, 9);
    set({ postcode: v });
    if (timer.current) clearTimeout(timer.current);
    const q = v.trim();
    if (q.replace(/\s/g, '').length < 2) {
      setOpen(false);
      setList([]);
      setNote('');
      return;
    }
    timer.current = setTimeout(() => {
      if (FULL_POSTCODE.test(q)) pick(q.replace(/\s+/g, '').replace(/(\w{3})$/, ' $1'));
      else suggest(q);
    }, 220);
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      setNote('Location is not available on this device. Type your postcode instead.');
      return;
    }
    setLocating(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const data = await getJson(`${API}/postcodes?lon=${longitude}&lat=${latitude}&limit=6`);
          const result: string[] = Array.isArray(data?.result) ? data.result.map((r: { postcode: string }) => r.postcode) : [];
          if (result.length) {
            setList(result);
            setActive(0);
            show();
            setNote('Nearest postcodes to you. Pick yours.');
          } else setNote('No UK postcode found near you. Type it in instead.');
        } catch {
          setNote('Could not look that up. Type your postcode instead.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setNote('Location was not shared. Type your postcode instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? list.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(list[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="relative">
        <label htmlFor={`${listId}-pc`} className="font-mono text-[12px] text-faint">Postcode</label>
        <div className="mt-1 flex gap-2">
          <input
            id={`${listId}-pc`}
            className={`${inputClass} uppercase placeholder:normal-case`}
            placeholder="Start typing, e.g. N3 2"
            value={value.postcode}
            onChange={(e) => onPostcode(e.target.value)}
            onKeyDown={onKey}
            onFocus={() => { if (list.length) show(); }}
            onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
            autoComplete="postal-code"
            autoCapitalize="characters"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-list`}
            aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${listId}-opt-${active}` : undefined}
          />
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="flex h-12 flex-none items-center gap-1.5 rounded-sm border border-line-strong bg-mount px-3 text-[13.5px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
            title="Find the postcode where you are now"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" strokeLinecap="round" />
            </svg>
            {locating ? 'Finding…' : 'Use my location'}
          </button>
        </div>
        {open && list.length ? (
          <ul id={`${listId}-list`} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-sm border border-line-strong bg-mount py-1 shadow-[0_12px_30px_-12px_rgb(22_25_28/0.35)]">
            {list.map((pc, i) => (
              <li
                key={pc}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(pc)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3.5 py-2.5 font-mono text-[15px] ${i === active ? 'bg-accent text-on-accent' : 'text-ink'}`}
              >
                {pc}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 min-h-[18px] text-[12.5px] leading-snug text-muted" aria-live="polite">{note}</p>
      </div>
      <label className="block">
        <span className="font-mono text-[12px] text-faint">Town or area</span>
        <input
          className={`${inputClass} mt-1`}
          placeholder="Filled in from the postcode"
          value={value.area}
          onChange={(e) => { areaAuto.current = false; set({ area: e.target.value.slice(0, 80) }); }}
          autoComplete="address-level2"
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="font-mono text-[12px] text-faint">House number and street</span>
        <input
          className={`${inputClass} mt-1`}
          placeholder="e.g. 12 Long Lane, Flat 3"
          value={value.line1}
          onChange={(e) => set({ line1: e.target.value.slice(0, 120) })}
          autoComplete="address-line1"
        />
      </label>
    </div>
  );
}

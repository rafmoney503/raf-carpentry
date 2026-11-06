'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { shrinkPhoto } from '@/app/job-kit/media';
import {
  FILE_ACCEPT,
  FREE_ROUNDS,
  INCLUDED_UNITS,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_UNITS,
  PACK,
  PACKS,
  PHOTO_EXTS,
  WORKING_DAYS,
  extOf,
  fileOk,
  gbp,
  packPrices,
  priceOf,
  type Pack,
} from '@/lib/drawings-service';
import { EMAIL, whatsappUrl } from '@/lib/site';

/* The packs and the order form on /drawings (one component, so "Choose this pack" fills the form below). Sending:
   /api/drawings/order makes the order (a token back), each file goes to /api/drawings/file (photos made smaller on
   the phone first, as the brief does), then /api/drawings/pay opens Stripe's card page. The token is kept for the
   tab (sessionStorage), so someone who cancels on Stripe's page comes back to "Pay when you're ready" with their
   order and files already in. */

const input =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
const KEEP = 'raf_drawings_order';

type Kept = { token: string; pack: Pack; units: number; total: number; at: number };
type Picked = { id: string; file: File; name: string };
type Need = 'what' | 'files' | 'name' | 'email' | 'ticks' | '';

const readKept = (): Kept | null => {
  try {
    const k = JSON.parse(sessionStorage.getItem(KEEP) ?? 'null') as Kept | null;
    return k && Date.now() - k.at < 5.5 * 60 * 60 * 1000 ? k : null;
  } catch {
    return null;
  }
};

const ERR: Record<string, string> = {
  'not-set-up': `Card payments aren't switched on here yet. Email your sizes and photos to ${EMAIL} or send them on WhatsApp instead.`,
  busy: 'Too many orders from here in a few minutes. Wait a little and try again.',
  token: 'This order has expired. Start it again below.',
  size: 'One of the files is too big. Take it off and email it to me after ordering.',
  type: "One of the files can't be sent here. Take it off and email it to me after ordering.",
};
const errText = (code: string) => ERR[code] ?? `Something went wrong (${code}). Try again, or email ${EMAIL}.`;

export default function DrawingsOrder() {
  const [pack, setPack] = useState<Pack>('drawings');
  const [units, setUnits] = useState(INCLUDED_UNITS);
  const [what, setWhat] = useState('');
  const [boards, setBoards] = useState('');
  const [place, setPlace] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [check, setCheck] = useState(false);
  const [start, setStart] = useState(false);
  const [company, setCompany] = useState('');
  const [files, setFiles] = useState<Picked[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [need, setNeed] = useState<Need>('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [kept, setKept] = useState<Kept | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const opened = useRef(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const price = useMemo(() => priceOf(pack, units), [pack, units]);

  useEffect(() => {
    const k = readKept();
    if (k) setKept(k);
    if (new URLSearchParams(location.search).get('cancelled')) setCancelled(true);
  }, []);

  const choose = (p: Pack) => {
    setPack(p);
    formRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const notes: string[] = [];
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        notes.push(`Up to ${MAX_FILES} files.`);
        break;
      }
      const photo = PHOTO_EXTS.includes(extOf(f.name)) || f.type.startsWith('image/');
      if (!fileOk(f.name) && !photo) notes.push(`${f.name}: this kind of file can't be sent here.`);
      else if (!photo && f.size > MAX_FILE_BYTES) notes.push(`${f.name} is over 4 MB: email it to me after ordering.`);
      else next.push({ id: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`, file: f, name: f.name });
    }
    setFiles(next);
    setFileNote(notes.join(' '));
    if (need === 'files' && next.length) setNeed('');
  };

  const missing = (): Need => {
    if (what.trim().length < 10) return 'what';
    if (!files.length) return 'files';
    if (name.trim().length < 2) return 'name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return 'email';
    if (!check || !start) return 'ticks';
    return '';
  };

  const pay = async (token: string) => {
    setBusy('Opening the card payment…');
    const res = await fetch('/api/drawings/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error || 'error');
    location.href = data.url;
  };

  const send = async () => {
    const m = missing();
    setNeed(m);
    setError('');
    if (m) {
      document.getElementById(`dw-${m}`)?.focus();
      return;
    }
    try {
      setBusy('Sending your order…');
      const res = await fetch('/api/drawings/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack, units, what, boards, place, name, email, mobile, files: files.length, check, start, company, ms: Date.now() - opened.current }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; total?: number; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error || 'error');
      const token = data.token;
      for (let i = 0; i < files.length; i++) {
        setBusy(`Sending file ${i + 1} of ${files.length}…`);
        const f = files[i];
        let blob: Blob = f.file;
        let fileName = f.name;
        if (PHOTO_EXTS.includes(extOf(f.name)) || f.file.type.startsWith('image/')) {
          try {
            blob = (await shrinkPhoto(f.file)).blob;
            fileName = `${f.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
          } catch {
            /* a photo the browser can't draw (e.g. HEIC on a computer) goes as it is */
          }
        }
        if (blob.size > MAX_FILE_BYTES) throw new Error('size');
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          const fd = new FormData();
          fd.set('token', token);
          fd.set('i', String(i));
          fd.set('name', fileName);
          fd.set('file', blob, fileName);
          const r = await fetch('/api/drawings/file', { method: 'POST', body: fd });
          if (r.ok) ok = true;
          else {
            const e = ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'error';
            if (e === 'size' || e === 'type' || e === 'token') throw new Error(e);
            await new Promise((w) => setTimeout(w, 1500));
          }
        }
        if (!ok) throw new Error('upload');
      }
      const k: Kept = { token, pack, units, total: data.total ?? price.total, at: Date.now() };
      try {
        sessionStorage.setItem(KEEP, JSON.stringify(k));
      } catch {
        /* storage blocked: paying still works, coming back to pay later doesn't */
      }
      setKept(k);
      await pay(token);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'error';
      setError(code === 'upload' ? "A file didn't go through. Check your signal and press Pay again." : errText(code));
      setBusy('');
    }
  };

  const payKept = async () => {
    if (!kept) return;
    setError('');
    try {
      await pay(kept.token);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'error';
      if (code === 'token') {
        try {
          sessionStorage.removeItem(KEEP);
        } catch {}
        setKept(null);
      }
      setError(errText(code));
      setBusy('');
    }
  };

  const forget = () => {
    try {
      sessionStorage.removeItem(KEEP);
    } catch {}
    setKept(null);
    setCancelled(false);
  };

  const bad = (n: Need) => (need === n ? 'border-[#b42318] ring-2 ring-[#b42318]/15' : '');
  const say = (n: Need, words: string) => (need === n ? <p className="mt-2 text-[14px] font-medium text-[#b42318]">{words}</p> : null);

  return (
    <>
      {/* The packs */}
      <section id="packs" className="scroll-mt-4 border-t border-line">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-14 md:px-10 md:py-20">
          <p className="kicker mb-4">Prices</p>
          <h2 className="max-w-[18em] font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Three packs, paid upfront. Pick what you need.</h2>
          <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-muted md:text-[17px]">
            Each price covers up to {INCLUDED_UNITS} units, about a 3 metre wardrobe. Prices include VAT. Every pack comes within {WORKING_DAYS} working days, with up to {FREE_ROUNDS} rounds of changes free.
          </p>
          <ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
            {PACKS.map((p) => {
              const pr = packPrices(p);
              const lead = p === 'drawings';
              const picked = pack === p;
              return (
                <li key={p} className={`relative flex flex-col rounded-sm border bg-mount p-6 md:p-7 ${lead ? 'border-2 border-accent' : 'border-line-strong'}`} data-pack={p}>
                  {lead ? <span className="absolute -top-3 left-6 rounded-sm bg-accent px-3 py-1 font-mono text-[12px] text-on-accent">Most people pick this</span> : null}
                  <h3 className="font-display text-[22px] font-[650] tracking-[-0.015em]">{PACK[p].name}</h3>
                  <p className="mt-2 text-[15px] leading-snug text-muted md:min-h-[3.2em]">{PACK[p].lead}</p>
                  <p className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-[44px] font-[680] leading-none tracking-[-0.03em]">{gbp(pr.total)}</span>
                    <span className="font-mono text-[13px] text-faint">{gbp(pr.beforeVat)} + VAT</span>
                  </p>
                  <p className="mt-2 font-mono text-[12.5px] text-faint">
                    up to {INCLUDED_UNITS} units · {gbp(pr.perExtra)} a unit more
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-5">
                    {PACK[p].list.map((t) => (
                      <li key={t} className="flex gap-3 text-[15.5px] leading-snug text-ink">
                        <span className="mt-[8px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                        {t}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => choose(p)} aria-pressed={picked} className={`btn mt-7 w-full ${picked ? 'btn-primary' : 'btn-ghost'}`}>
                    {picked ? 'Chosen ✓' : 'Choose this pack'}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 max-w-[70ch] text-[14.5px] leading-relaxed text-faint">
            A unit is one box: one wardrobe section, one chest of drawers, one wall cupboard. Not kitchens.
          </p>
        </div>
      </section>

      {/* The order */}
      <section id="order" className="scroll-mt-4 border-t border-line bg-raised">
        <div ref={formRef} className="mx-auto w-full max-w-[1280px] scroll-mt-4 px-5 py-14 md:px-10 md:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <p className="kicker mb-4">Order</p>
              <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Send me the job.</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-muted">
                Takes about 3 minutes. Have your sizes and a few photos ready. You pay by card on the next page, then I start.
              </p>
              <p className="mt-6 text-[15px] leading-relaxed text-muted">
                Not sure which pack, or something unusual?{' '}
                <a href={whatsappUrl("Hi Raf, I've got a question about drawings and a cut list for my job.")} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                  Ask me on WhatsApp
                </a>{' '}
                first.
              </p>
            </div>

            <div className="lg:col-span-8">
              {kept && cancelled ? (
                <div className="mb-6 rounded-sm border border-accent bg-mount p-5" data-dw-kept>
                  <p className="text-[16px] font-[620]">The payment was cancelled, so nothing was charged.</p>
                  <p className="mt-1 text-[15px] text-muted">
                    Your order and files are with me: {PACK[kept.pack].name}, {kept.units} unit{kept.units === 1 ? '' : 's'}. Pay when you&apos;re ready.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" className="btn btn-primary" onClick={payKept} disabled={Boolean(busy)}>
                      Pay {gbp(kept.total)}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={forget}>
                      Start a new order
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-sm border border-line bg-mount p-5 md:p-7" data-dw-form>
                {/* Pack and units */}
                <fieldset>
                  <legend className="text-[15px] font-[620]">Pack</legend>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {PACKS.map((p) => (
                      <label key={p} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-[15px] ${pack === p ? 'border-accent bg-accent/5 text-ink' : 'border-line-strong text-muted hover:border-ink'}`}>
                        <input type="radio" name="dw-pack" value={p} checked={pack === p} onChange={() => setPack(p)} className="accent-[var(--color-accent)]" />
                        <span className="leading-tight">
                          {PACK[p].name}
                          <span className="block font-mono text-[12px] text-faint">from {gbp(packPrices(p).total)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6">
                  <p className="text-[15px] font-[620]" id="dw-units-label">How many units?</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button type="button" className="h-12 w-12 flex-none rounded-sm border border-line-strong bg-paper text-[22px] text-ink hover:border-ink disabled:opacity-40" onClick={() => setUnits((u) => Math.max(1, u - 1))} disabled={units <= 1} aria-label="One fewer unit">
                      −
                    </button>
                    <span className="min-w-[5.5em] text-center font-mono text-[18px]" aria-live="polite" aria-labelledby="dw-units-label">
                      {units} unit{units === 1 ? '' : 's'}
                    </span>
                    <button type="button" className="h-12 w-12 flex-none rounded-sm border border-line-strong bg-paper text-[22px] text-ink hover:border-ink disabled:opacity-40" onClick={() => setUnits((u) => Math.min(MAX_UNITS, u + 1))} disabled={units >= MAX_UNITS} aria-label="One more unit">
                      +
                    </button>
                  </div>
                  <p className="mt-2 text-[14px] text-faint">A unit is one box. A 3 metre wardrobe is usually 3 or 4 units; a chest of drawers is 1.</p>
                </div>

                {/* The job */}
                <div className="mt-6">
                  <label htmlFor="dw-what" className="text-[15px] font-[620]">
                    What are we making?
                  </label>
                  <p className="mt-1 text-[14px] text-faint">Each unit&apos;s width, height and depth in mm, what goes inside, and the doors. I draw it to your sizes, so measure carefully.</p>
                  <textarea
                    id="dw-what"
                    rows={5}
                    value={what}
                    onChange={(e) => {
                      setWhat(e.target.value);
                      if (need === 'what') setNeed('');
                    }}
                    placeholder="e.g. Alcove wardrobe 1100 wide, 2400 high, 600 deep. Rail at the top, 3 drawers under it, two doors. Second alcove: shelves only."
                    className={`${input} mt-3 h-auto py-3 leading-relaxed ${bad('what')}`}
                  />
                  {say('what', 'Tell me what we’re making: the units, their sizes and what goes inside.')}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="dw-boards" className="text-[15px] font-[620]">
                      Boards <span className="font-normal text-faint">(optional)</span>
                    </label>
                    <input id="dw-boards" value={boards} onChange={(e) => setBoards(e.target.value)} placeholder="e.g. 18 mm MDF, white inside" className={`${input} mt-2`} />
                  </div>
                  <div>
                    <label htmlFor="dw-place" className="text-[15px] font-[620]">
                      Where is it? <span className="font-normal text-faint">(optional)</span>
                    </label>
                    <input id="dw-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Town, or country" autoComplete="address-level2" className={`${input} mt-2`} />
                  </div>
                </div>

                {/* Files */}
                <div className="mt-6">
                  <p className="text-[15px] font-[620]">Sketch, drawings and photos</p>
                  <p className="mt-1 text-[14px] text-faint">Your sketch with sizes, and photos of the space: walls, skirting, ceiling, sockets. Up to {MAX_FILES} files: photos, PDF, SketchUp, DWG or DXF up to 4 MB.</p>
                  <input ref={fileInput} type="file" multiple accept={FILE_ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  <button
                    id="dw-files"
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(e.dataTransfer.files);
                    }}
                    className={`mt-3 flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed px-4 py-5 text-center transition-colors hover:border-accent ${need === 'files' ? 'border-[#b42318]' : 'border-line-strong'}`}
                  >
                    <span className="text-[16px] font-[620] text-accent">+ Add files</span>
                    <span className="text-[13.5px] text-faint">
                      Take a photo or pick files<span className="hidden md:inline">, or drop them here</span>
                    </span>
                  </button>
                  {say('files', 'Add at least one sketch, drawing or photo.')}
                  {fileNote ? <p className="mt-2 text-[14px] text-[#b42318]">{fileNote}</p> : null}
                  {files.length ? (
                    <ul className="mt-3 divide-y divide-line rounded-sm border border-line" data-dw-files>
                      {files.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[14.5px]">
                          <span className="min-w-0 truncate">{f.name}</span>
                          <button type="button" className="flex-none rounded-sm px-2 py-1 font-mono text-[12.5px] text-faint hover:text-ink" onClick={() => setFiles((l) => l.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                {/* You */}
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="dw-name" className="text-[15px] font-[620]">
                      Your name
                    </label>
                    <input id="dw-name" value={name} onChange={(e) => { setName(e.target.value); if (need === 'name') setNeed(''); }} autoComplete="name" className={`${input} mt-2 ${bad('name')}`} />
                    {say('name', 'Add your name.')}
                  </div>
                  <div>
                    <label htmlFor="dw-email" className="text-[15px] font-[620]">
                      Email <span className="font-normal text-faint">(the files come here)</span>
                    </label>
                    <input id="dw-email" type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); if (need === 'email') setNeed(''); }} autoComplete="email" className={`${input} mt-2 ${bad('email')}`} />
                    {say('email', 'Add an email address I can send the files to.')}
                  </div>
                  <div>
                    <label htmlFor="dw-mobile" className="text-[15px] font-[620]">
                      Mobile <span className="font-normal text-faint">(optional)</span>
                    </label>
                    <input id="dw-mobile" type="tel" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} autoComplete="tel" className={`${input} mt-2`} />
                  </div>
                </div>
                {/* People never see this box; bots fill it in. */}
                <div aria-hidden="true" className="hp absolute -left-[9999px] h-0 w-0 overflow-hidden">
                  <label>
                    Company
                    <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </label>
                </div>

                {/* The two ticks */}
                <div id="dw-ticks" tabIndex={-1} className={`mt-6 space-y-3 rounded-sm ${need === 'ticks' ? 'outline outline-2 outline-offset-4 outline-[#b42318]' : ''}`}>
                  <label className="flex cursor-pointer gap-3 text-[15px] leading-snug">
                    <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} className="mt-[3px] h-5 w-5 flex-none accent-[var(--color-accent)]" />
                    <span>I&apos;ll check every size against my own measurements before cutting. The cut is my call.</span>
                  </label>
                  <label className="flex cursor-pointer gap-3 text-[15px] leading-snug">
                    <input type="checkbox" checked={start} onChange={(e) => setStart(e.target.checked)} className="mt-[3px] h-5 w-5 flex-none accent-[var(--color-accent)]" />
                    <span>Start straight away. I understand that once the files are sent to me, I can&apos;t cancel for a refund.</span>
                  </label>
                </div>
                {say('ticks', 'Tick both boxes to go on.')}

                {/* Summary and pay */}
                <div className="mt-7 border-t border-line pt-5" data-dw-summary>
                  <dl className="space-y-1.5 text-[15px]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">
                        {PACK[pack].name}, {units} unit{units === 1 ? '' : 's'}
                      </dt>
                      <dd className="font-mono">{gbp(price.beforeVat)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">VAT (20%)</dt>
                      <dd className="font-mono">{gbp(price.vat)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-line pt-2 text-[17px] font-[650]">
                      <dt>To pay now</dt>
                      <dd className="font-mono" data-dw-total>
                        {gbp(price.total)}
                      </dd>
                    </div>
                  </dl>
                  {error ? (
                    <p className="mt-4 rounded-sm border border-[#b42318]/30 bg-[#b42318]/5 px-3 py-2 text-[14.5px] text-[#b42318]" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button type="button" className="btn btn-primary mt-5 w-full" onClick={send} disabled={Boolean(busy)} data-dw-pay>
                    {busy || `Pay ${gbp(price.total)} and send`}
                  </button>
                  <p className="mt-3 text-center text-[13.5px] text-faint">Card, Apple Pay or Google Pay, through Stripe. Files by email within {WORKING_DAYS} working days.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

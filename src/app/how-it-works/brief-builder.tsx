'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import SocialIcon from '@/components/SocialIcon';
import { BOOKING_URL, EMAIL, whatsappUrl } from '@/lib/site';
import AddressFinder, { type Address } from './address-finder';
import { clearJobFromLink, jobUrl, useJobFromLink, type JobRef } from './job-from-link';
import { kindsIn, kindWords, type KindCount } from '@/lib/design-kinds';
import { removeSaved, savedUrl, useSaved } from '@/lib/saved';
import { Heart } from '@/components/SaveButton';
import WhatHappensNext from './what-happens-next';

export type BriefOptions = {
  what: string[];
  room: string[];
  uses: string[];
  material: string[];
  finish: string[];
  timing: string[];
  budget: string[];
  parking: string[];
  photoTips: string[];
};

/* A customer ticks what fits; the answers become a ready-written WhatsApp message or email to Raf. */

function Chips({ options, value, onPick, multi = false, label }: { options: string[]; value: string | string[]; onPick: (v: string) => void; multi?: boolean; label: string }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => {
        const on = multi ? (value as string[]).includes(o) : value === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o)}
            className="min-h-10 rounded-sm border border-line-strong bg-mount px-3.5 py-2 text-left text-[14.5px] font-medium leading-snug text-ink transition-colors hover:border-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent"
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Field({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <p className="flex items-baseline gap-3">
        <span className="font-mono text-[13px] text-accent">{String(n).padStart(2, '0')}</span>
        <span className="text-[17px] font-[620] text-ink" aria-hidden="true">{title}</span>
        {hint ? <span className="font-mono text-[12px] text-faint">{hint}</span> : null}
      </p>
      {children}
    </fieldset>
  );
}

const input =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

type Sent = 'whatsapp' | 'email' | 'copy';

export default function BriefBuilder({ options, jobs, designKinds = [], designTotal = 0 }: { options: BriefOptions; jobs: JobRef[]; designKinds?: KindCount[]; designTotal?: number }) {
  // Came from "Get a quote" on a job page: that job goes at the top of the message.
  const job = useJobFromLink(jobs);
  // Jobs and 3D designs saved with the hearts (src/lib/saved.ts). The job from the link is already named, so it isn't listed twice.
  const saved = useSaved();
  const liked = useMemo(() => saved.filter((s) => !(job && s.href === `/portfolio/${job.slug}`)), [saved, job]);
  const [what, setWhat] = useState<string[]>([]);
  const [room, setRoom] = useState<string[]>([]);
  const [uses, setUses] = useState<string[]>([]);
  const [material, setMaterial] = useState<string[]>([]);
  const [finish, setFinish] = useState<string[]>([]);
  const [size, setSize] = useState({ w: '', h: '', d: '' });
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [addr, setAddr] = useState<Address>({ line1: '', area: '', postcode: '' });
  const [parking, setParking] = useState<string[]>([]);
  const [access, setAccess] = useState('');
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [timing, setTiming] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);
  // After Send on WhatsApp, Email it or Copy text: the "What happens next" card takes the message's place.
  const [sent, setSent] = useState<Sent | null>(null);
  const [showMsg, setShowMsg] = useState(false);
  const nextRef = useRef<HTMLDivElement>(null);
  const markSent = (how: Sent) => {
    setSent(how);
    setShowMsg(false);
    // On a phone the card sits above the buttons: bring it into view for when they come back from WhatsApp or email.
    window.setTimeout(() => nextRef.current?.scrollIntoView({ behavior: how === 'copy' ? 'smooth' : 'auto', block: 'start' }), 60);
  };

  // A search result like "Start a brief: hiding a boiler, radiator or cylinder" opens /how-it-works?for=...#brief
  // with that choice ticked (?what=, ?room= and ?for= work, only for choices that exist).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pick = (key: string, list: string[], set: React.Dispatch<React.SetStateAction<string[]>>) => {
      const v = q.get(key);
      if (v && list.includes(v)) set((cur) => (cur.includes(v) ? cur : [...cur, v]));
    };
    pick('what', options.what, setWhat);
    pick('room', options.room, setRoom);
    pick('for', options.uses, setUses);
  }, [options]);

  const one = (set: (v: string) => void, cur: string) => (v: string) => set(cur === v ? '' : v);
  // Several answers can be ticked (two rooms, a bookcase and panelling...): tap again to untick.
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    set((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));
  const hasSize = Boolean(size.w || size.h || size.d);

  const filled = [what.length, room.length, uses.length, material.length, finish.length, hasSize, name.trim(), timing, budget].filter(Boolean).length;

  // Some choices contain commas ("MDF only, no paint"), so several picks are joined with " + ".
  const join = (list: string[]) => list.join(' + ');

  const addressText = [addr.line1, addr.area, addr.postcode].map((x) => x.trim()).filter(Boolean).join(', ');

  const message = useMemo(() => {
    const lines = [name.trim() ? `Hi Raf, this is ${name.trim()}. Here is my brief from your website.` : 'Hi Raf, here is my brief from your website.', ''];
    if (job) lines.push(`Something like your job: ${job.title}, ${job.area}`, jobUrl(job.slug), '');
    if (liked.length) lines.push('Things I liked:', ...liked.flatMap((s) => [s.area ? `${s.title}, ${s.area}` : s.title, savedUrl(s)]), '');
    if (what.length) lines.push(`What: ${join(what)}`);
    if (room.length) lines.push(`${room.length > 1 ? 'Rooms' : 'Room'}: ${join(room)}`);
    if (uses.length) lines.push(`For: ${join(uses)}`);
    if (material.length) lines.push(`Material: ${join(material)}`);
    if (finish.length) lines.push(`Finish: ${join(finish)}`);
    if (hasSize) lines.push(`Rough size: ${size.w || '?'} wide x ${size.h || '?'} high x ${size.d || '?'} deep (mm)`);
    if (timing) lines.push(`When: ${timing}`);
    if (budget) lines.push(`Budget: ${budget}`);
    const where = [
      mobile.trim() ? `Mobile: ${mobile.trim()}` : '',
      addressText ? `Address: ${addressText}` : '',
      parking.length ? `Parking: ${join(parking)}` : '',
      access.trim() ? `Parking and access: ${access.trim()}` : '',
    ].filter(Boolean);
    if (where.length) lines.push('', ...where);
    if (notes.trim()) lines.push('', notes.trim());
    lines.push('', 'I will send photos of the space next.');
    return lines.join('\n').replace(/\n{3,}/g, '\n\n'); // never two empty lines in a row
  }, [job, liked, what, room, uses, material, finish, hasSize, size, name, mobile, addressText, parking, access, timing, budget, notes]);

  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(`My project brief${what.length ? `: ${what.join(' + ')}` : ''}`.slice(0, 120))}&body=${encodeURIComponent(message.replace('I will send photos of the space next.', 'Photos of the space attached.'))}`;

  // Raf needs at least a name: stop the send and point at the box instead.
  const gate = (e?: { preventDefault: () => void }) => {
    if (name.trim()) return true;
    e?.preventDefault();
    setNeedName(true);
    nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nameRef.current?.focus({ preventScroll: true });
    return false;
  };

  const copy = async () => {
    if (!gate()) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      markSent('copy');
    } catch {
      /* clipboard blocked */
    }
  };

  const reset = () => {
    setWhat([]); setRoom([]); setUses([]); setMaterial([]); setFinish([]);
    setSize({ w: '', h: '', d: '' }); setName(''); setAddr({ line1: '', area: '', postcode: '' }); setParking([]); setAccess('');
    setTiming(''); setBudget(''); setNotes(''); setNeedName(false); setSent(null);
  };

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
      <form className="md:col-span-7" onSubmit={(e) => e.preventDefault()} aria-label="Project brief">
        {job ? (
          <div className="mb-6 flex items-center gap-3.5 rounded-sm border border-accent/40 bg-mount p-2.5 pr-3">
            <span className="relative h-14 w-14 flex-none overflow-hidden rounded-[2px] bg-raised">
              <Image src={job.cover} alt="" fill sizes="56px" className="object-cover" />
            </span>
            <span className="min-w-0 flex-1 text-[14.5px] leading-snug">
              <span className="block font-mono text-[12px] text-accent">Something like this job</span>
              <span className="line-clamp-2 block font-medium text-ink">{job.title}, {job.area}</span>
            </span>
            <button type="button" onClick={clearJobFromLink} className="flex-none rounded-sm px-2 py-1.5 font-mono text-[12px] text-faint transition-colors hover:text-ink">
              Remove
            </button>
          </div>
        ) : null}
        {liked.length ? (
          <section aria-label="Things you saved" className="mb-6 rounded-sm border border-line-strong bg-mount p-3.5">
            <p className="flex items-center gap-2 text-[16px] font-[620] text-ink">
              <span className="text-accent"><Heart on /></span>
              Things you saved ({liked.length})
            </p>
            <p className="mt-1 text-[14px] leading-snug text-muted">They go in your message with their links.</p>
            <ul className="mt-3 grid gap-2">
              {liked.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="relative h-12 w-16 flex-none overflow-hidden rounded-[2px] border border-line bg-white">
                    {s.image ? <Image src={s.image} alt="" fill sizes="64px" className="object-contain" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <a href={s.href} target="_blank" rel="noopener" className="line-clamp-2 block text-[14.5px] font-medium text-ink hover:text-accent">{s.title}</a>
                    {s.area ? <span className="block font-mono text-[12px] text-faint">{s.area}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSaved(s.id)}
                    aria-label={`Remove ${s.title}`}
                    className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-sm text-muted transition-colors hover:text-ink"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Field n={1} title="What is it?" hint="pick any">
          <Chips label="What is it?" options={options.what} value={what} onPick={toggle(setWhat)} multi />
          {/* A nudge to the Designs in 3D page for what they picked; opens in a new tab so the brief stays filled in. */}
          {(() => {
            const slugs = new Set(what.flatMap((w) => kindsIn(w).map((k) => k.slug)));
            const show = designKinds.filter((k) => slugs.has(k.slug));
            return show.length ? (
              <>
                <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
                  {show.map((k) => (
                    <a key={k.slug} href={`/designs/${k.slug}`} target="_blank" rel="noopener" className="link-more">
                      See {k.count} {kindWords(k)} in 3D <span aria-hidden="true">→</span>
                    </a>
                  ))}
                </p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-faint">Tap Save on any you like and they come into this brief.</p>
              </>
            ) : null;
          })()}
        </Field>
        <Field n={2} title="Which room?" hint="pick any">
          <Chips label="Which room?" options={options.room} value={room} onPick={toggle(setRoom)} multi />
        </Field>
        <Field n={3} title="What is it for?" hint="pick any">
          <Chips label="What is it for?" options={options.uses} value={uses} onPick={toggle(setUses)} multi />
        </Field>
        <Field n={4} title="Material" hint="pick any">
          <Chips label="Material" options={options.material} value={material} onPick={toggle(setMaterial)} multi />
        </Field>
        <Field n={5} title="Finish" hint="pick any">
          <Chips label="Finish" options={options.finish} value={finish} onPick={toggle(setFinish)} multi />
        </Field>
        <Field n={6} title="Rough size" hint="mm, if you have it">
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['w', 'h', 'd'] as const).map((k) => (
              <label key={k} className="block">
                <span className="font-mono text-[12px] text-faint">{k === 'w' ? 'Width' : k === 'h' ? 'Height' : 'Depth'}</span>
                <input
                  className={`${input} mt-1`}
                  inputMode="numeric"
                  placeholder={k === 'w' ? '2400' : k === 'h' ? '2500' : '600'}
                  value={size[k]}
                  onChange={(e) => setSize((s) => ({ ...s, [k]: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) }))}
                />
              </label>
            ))}
          </div>
        </Field>
        <Field n={7} title="Your details and parking" hint="name needed">
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[12px] text-faint">Name</span>
              <input
                ref={nameRef}
                className={`${input} mt-1 ${needName && !name.trim() ? 'border-accent ring-2 ring-accent/20' : ''}`}
                placeholder="Your name"
                value={name}
                onChange={(e) => { setName(e.target.value.slice(0, 80)); setNeedName(false); }}
                autoComplete="name"
                aria-required="true"
                aria-invalid={needName && !name.trim() ? true : undefined}
                aria-describedby="brief-name-note"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[12px] text-faint">Mobile (optional)</span>
              <input
                className={`${input} mt-1`}
                type="tel"
                inputMode="tel"
                placeholder="So I can call you back"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d+ ()-]/g, '').slice(0, 20))}
                autoComplete="tel"
              />
            </label>
          </div>
          <p id="brief-name-note" className={`mt-2 text-[13px] leading-snug ${needName && !name.trim() ? 'font-medium text-accent' : 'text-faint'}`}>
            {needName && !name.trim() ? 'Add your name, then send.' : 'Only sent to me in your message. Nothing is saved on this website.'}
          </p>
          <div className="mt-4">
            <AddressFinder value={addr} onChange={setAddr} inputClass={input} />
          </div>
          <p className="mt-3 font-mono text-[12px] text-faint">Parking</p>
          <Chips label="Parking" options={options.parking} value={parking} onPick={toggle(setParking)} multi />
          <label className="mt-3 block">
            <span className="sr-only">Anything else about parking or access</span>
            <input
              className={input}
              placeholder="Anything else? e.g. 3rd floor, no lift; bay behind the shop"
              value={access}
              onChange={(e) => setAccess(e.target.value.slice(0, 160))}
            />
          </label>
        </Field>
        <Field n={8} title="When?">
          <Chips label="When?" options={options.timing} value={timing} onPick={one(setTiming, timing)} />
        </Field>
        <Field n={9} title="Rough budget">
          <Chips label="Rough budget" options={options.budget} value={budget} onPick={one(setBudget, budget)} />
        </Field>
        <Field n={10} title="Your photos" hint="sent in WhatsApp">
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {options.photoTips.map((t, i) => (
              <li key={i} className="flex items-start gap-3 rounded-sm border border-line bg-mount px-3.5 py-3 text-[14.5px] leading-snug text-ink">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none text-accent">
                  <rect x="1.5" y="4" width="15" height="11" rx="1.5" />
                  <path d="M6 4l1.2-2h3.6L12 4" />
                  <circle cx="9" cy="9.5" r="2.7" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            Press <span className="font-medium text-ink">Send on WhatsApp</span>, then tap <span className="font-medium text-ink">+</span> in the chat and add them. By email, just attach them.
          </p>
        </Field>
        <Field n={11} title="Anything else?" hint="optional">
          <label className="mt-3 block">
            <span className="sr-only">Anything else</span>
            <textarea
              className={`${input} h-28 resize-y py-2.5`}
              placeholder="Sloping ceiling, a boiler on the wall, a colour you have in mind..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 600))}
            />
          </label>
        </Field>
      </form>

      {/* The message as it will arrive */}
      <aside className="md:col-span-5" aria-label="Your message">
        {/* Stays in view while the form is filled in; once sent, the card makes it too tall to stick, so it scrolls normally. */}
        <div className={sent ? '' : 'md:sticky md:top-28'}>
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[13px] text-faint">Your message</p>
            <p className="font-mono text-[13px] text-faint" aria-live="polite">{filled} of 9 filled</p>
          </div>
          <div className="mt-2 h-1 rounded-full bg-raised-2" aria-hidden="true">
            <div className="h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(filled / 9) * 100}%` }} />
          </div>
          {sent ? (
            <div ref={nextRef} className="mt-4 scroll-mt-24">
              <WhatHappensNext how={sent} photoTips={options.photoTips} designTotal={designTotal} />
              <button type="button" onClick={() => setShowMsg((v) => !v)} aria-expanded={showMsg} className="mt-3 font-mono text-[12.5px] text-faint transition-colors hover:text-ink">
                {showMsg ? 'Hide my message' : 'Show my message'}
              </button>
            </div>
          ) : null}
          {!sent || showMsg ? (
            <pre className="mt-4 min-h-[220px] whitespace-pre-wrap break-words rounded-sm border border-line-strong bg-mount p-5 font-mono text-[13.5px] leading-relaxed text-ink">{message}</pre>
          ) : null}
          <div className="mt-4 grid gap-2.5">
            <a href={whatsappUrl(message)} target="_blank" rel="noopener" onClick={(e) => gate(e) && markSent('whatsapp')} className="btn btn-whatsapp w-full gap-2.5">
              <SocialIcon network="whatsapp" size={18} />
              Send on WhatsApp
            </a>
            <div className="grid grid-cols-2 gap-2.5">
              <a href={mailto} onClick={(e) => gate(e) && markSent('email')} className="btn btn-ghost">Email it</a>
              <button type="button" onClick={copy} className="btn btn-ghost">{copied ? 'Copied' : 'Copy text'}</button>
            </div>
          </div>
          {sent ? null : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Add your photos in the WhatsApp chat or attach them to the email. Rather book a visit straight away?{' '}
              <a href={BOOKING_URL} target="_blank" rel="noopener" className="font-medium text-accent hover:underline">Book online</a>.
            </p>
          )}
          {needName && !name.trim() ? (
            <p className="mt-3 text-sm font-medium text-accent" role="alert">Add your name in step 07 first.</p>
          ) : null}
          {filled > 0 || notes ? (
            <button type="button" onClick={reset} className="mt-3 font-mono text-[12px] text-faint transition-colors hover:text-ink">
              Start again
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

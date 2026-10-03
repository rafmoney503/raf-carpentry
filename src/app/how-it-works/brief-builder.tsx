'use client';
import { useMemo, useState } from 'react';
import SocialIcon from '@/components/SocialIcon';
import { EMAIL, QUOTE_URL, whatsappUrl } from '@/lib/site';

export type BriefOptions = {
  what: string[];
  room: string[];
  uses: string[];
  material: string[];
  finish: string[];
  timing: string[];
  budget: string[];
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

export default function BriefBuilder({ options }: { options: BriefOptions }) {
  const [what, setWhat] = useState('');
  const [room, setRoom] = useState('');
  const [uses, setUses] = useState<string[]>([]);
  const [material, setMaterial] = useState('');
  const [finish, setFinish] = useState('');
  const [size, setSize] = useState({ w: '', h: '', d: '' });
  const [area, setArea] = useState('');
  const [timing, setTiming] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [copied, setCopied] = useState(false);

  const one = (set: (v: string) => void, cur: string) => (v: string) => set(cur === v ? '' : v);
  const toggleUse = (v: string) => setUses((u) => (u.includes(v) ? u.filter((x) => x !== v) : [...u, v]));
  const hasSize = Boolean(size.w || size.h || size.d);

  const filled = [what, room, uses.length ? 'y' : '', material, finish, hasSize ? 'y' : '', area.trim(), timing, budget].filter(Boolean).length;

  const message = useMemo(() => {
    const lines = ['Hi Raf, here is my brief from your website.', ''];
    if (what) lines.push(`What: ${what}`);
    if (room) lines.push(`Room: ${room}`);
    if (uses.length) lines.push(`For: ${uses.join(', ')}`);
    if (material) lines.push(`Material: ${material}`);
    if (finish) lines.push(`Finish: ${finish}`);
    if (hasSize) lines.push(`Rough size: ${size.w || '?'} wide x ${size.h || '?'} high x ${size.d || '?'} deep (mm)`);
    if (area.trim()) lines.push(`Area: ${area.trim()}`);
    if (timing) lines.push(`When: ${timing}`);
    if (budget) lines.push(`Budget: ${budget}`);
    if (notes.trim()) lines.push('', notes.trim());
    lines.push('', 'I will send photos of the space next.');
    return lines.join('\n');
  }, [what, room, uses, material, finish, hasSize, size, area, timing, budget, notes]);

  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(`My project brief${what ? `: ${what}` : ''}`)}&body=${encodeURIComponent(message.replace('I will send photos of the space next.', 'Photos of the space attached.'))}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const reset = () => {
    setWhat(''); setRoom(''); setUses([]); setMaterial(''); setFinish('');
    setSize({ w: '', h: '', d: '' }); setArea(''); setTiming(''); setBudget(''); setNotes('');
  };

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
      <form className="md:col-span-7" onSubmit={(e) => e.preventDefault()} aria-label="Project brief">
        <Field n={1} title="What is it?">
          <Chips label="What is it?" options={options.what} value={what} onPick={one(setWhat, what)} />
        </Field>
        <Field n={2} title="Which room?">
          <Chips label="Which room?" options={options.room} value={room} onPick={one(setRoom, room)} />
        </Field>
        <Field n={3} title="What is it for?" hint="pick any">
          <Chips label="What is it for?" options={options.uses} value={uses} onPick={toggleUse} multi />
        </Field>
        <Field n={4} title="Material">
          <Chips label="Material" options={options.material} value={material} onPick={one(setMaterial, material)} />
        </Field>
        <Field n={5} title="Finish">
          <Chips label="Finish" options={options.finish} value={finish} onPick={one(setFinish, finish)} />
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
        <Field n={7} title="Your area">
          <label className="mt-3 block">
            <span className="sr-only">Area or postcode</span>
            <input className={input} placeholder="e.g. Finchley, or N3" value={area} onChange={(e) => setArea(e.target.value.slice(0, 60))} autoComplete="postal-code" />
          </label>
        </Field>
        <Field n={8} title="When?">
          <Chips label="When?" options={options.timing} value={timing} onPick={one(setTiming, timing)} />
        </Field>
        <Field n={9} title="Rough budget">
          <Chips label="Rough budget" options={options.budget} value={budget} onPick={one(setBudget, budget)} />
        </Field>
        <Field n={10} title="Anything else?" hint="optional">
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
        <div className="md:sticky md:top-28">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[13px] text-faint">Your message</p>
            <p className="font-mono text-[13px] text-faint" aria-live="polite">{filled} of 9 filled</p>
          </div>
          <div className="mt-2 h-1 rounded-full bg-raised-2" aria-hidden="true">
            <div className="h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(filled / 9) * 100}%` }} />
          </div>
          <pre className="mt-4 min-h-[220px] whitespace-pre-wrap break-words rounded-sm border border-line-strong bg-mount p-5 font-mono text-[13.5px] leading-relaxed text-ink">{message}</pre>
          <div className="mt-4 grid gap-2.5">
            <a href={whatsappUrl(message)} target="_blank" rel="noopener" className="btn btn-whatsapp w-full gap-2.5">
              <SocialIcon network="whatsapp" size={18} />
              Send on WhatsApp
            </a>
            <div className="grid grid-cols-2 gap-2.5">
              <a href={mailto} className="btn btn-ghost">Email it</a>
              <button type="button" onClick={copy} className="btn btn-ghost">{copied ? 'Copied' : 'Copy text'}</button>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Add your photos in the WhatsApp chat or attach them to the email. Rather book a visit straight away?{' '}
            <a href={QUOTE_URL} target="_blank" rel="noopener" className="font-medium text-accent hover:underline">Book online</a>.
          </p>
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

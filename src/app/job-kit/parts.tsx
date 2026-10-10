'use client';
/* eslint-disable @next/next/no-img-element -- the pictures here are small thumbnails kept on the phone (data URLs), not site images */
import { useRef, useState } from 'react';
import Mark from './mark';
import type { Section, Slot } from './plan';
import { mb, type Item, type Job } from './store';

/* Pieces shared by the Job Kit's job screens and its Designs screens: form styles, chips, the photo slots. */

export const field =
  'w-full min-w-0 rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint/55 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';
export const label = 'font-mono text-[12.5px] uppercase tracking-[0.06em] text-faint';


/* A box that still needs filling in, said plainly under it. */
export function Missing({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
      <Mark state="lost" />
      {children}
    </span>
  );
}

export function Chips({ options, value, onChange, multi }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o) : [...value, o]) : on ? [] : [o])}
            className={`min-h-10 rounded-sm border px-3 py-1.5 text-[15px] transition-colors ${on ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-mount text-ink hover:border-ink'}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function SectionView({
  section,
  job,
  items,
  busy,
  onAdd,
  onRemove,
  onCaption,
}: {
  section: Section;
  job: Job;
  items: Item[];
  busy: Record<string, number>;
  onAdd: (jobId: string, section: Section, slot: Slot, files: File[]) => Promise<void>;
  onRemove: (i: Item) => Promise<void>;
  onCaption: (i: Item, c: string) => Promise<void>;
}) {
  const slots: Slot[] = [...section.slots, ...(section.extra ? [{ id: 'extra', label: section.extra, hint: 'Add a few words so it’s clear what it shows.' }] : [])];
  return (
    <div>
      <p className="text-[15.5px] leading-relaxed text-muted">{section.intro}</p>
      {section.note ? <p className="mt-2 font-mono text-[13px] leading-relaxed text-faint">{section.note}</p> : null}
      <ul className="mt-5 grid gap-3">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            job={job}
            section={section}
            slot={slot}
            items={items.filter((i) => i.section === section.id && i.slot === slot.id)}
            guide={slot.pairWith ? items.find((i) => i.slot === slot.pairWith) : undefined}
            saving={busy[`${job.id}:${slot.id}`] || 0}
            onAdd={onAdd}
            onRemove={onRemove}
            onCaption={onCaption}
          />
        ))}
      </ul>
    </div>
  );
}

export function SlotCard({
  job,
  section,
  slot,
  items,
  guide,
  saving,
  onAdd,
  onRemove,
  onCaption,
}: {
  job: Job;
  section: Section;
  slot: Slot;
  items: Item[];
  guide?: Item;
  saving: number;
  onAdd: (jobId: string, section: Section, slot: Slot, files: File[]) => Promise<void>;
  onRemove: (i: Item) => Promise<void>;
  onCaption: (i: Item, c: string) => Promise<void>;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const video = section.kind === 'video';
  const accept = video ? 'video/*' : 'image/*';
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) void onAdd(job.id, section, slot, files);
  };
  const done = items.length > 0;
  const shown = items.find((i) => i.id === open);

  return (
    <li className={`rounded-sm border bg-mount p-3.5 ${done ? 'border-line-strong' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[16.5px] font-semibold leading-snug">
            {done ? <Mark state="sent" /> : null}
            {slot.label}
          </p>
          {slot.hint ? <p className="mt-1 text-[14.5px] leading-snug text-muted">{slot.hint}</p> : null}
          {slot.target ? <p className="mt-1 font-mono text-[12.5px] text-faint">{slot.target}</p> : null}
        </div>
        {guide?.thumb ? (
          <figure className="shrink-0 text-center">
            <img src={guide.thumb} alt="Your before photo from this spot" className="h-[64px] w-[64px] rounded-sm object-cover opacity-90" />
            <figcaption className="mt-0.5 font-mono text-[11px] text-faint">before</figcaption>
          </figure>
        ) : null}
      </div>

      {items.length || saving ? (
        <ul className="jk-thumbs mt-3">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setOpen(open === i.id ? null : i.id)} className={`jk-thumb ${open === i.id ? 'is-open' : ''}`} aria-label={`${i.kind === 'video' ? 'Clip' : 'Photo'}${i.caption ? `: ${i.caption}` : ''}. Tap for options`}>
                {i.thumb ? <img src={i.thumb} alt="" /> : <span className="jk-thumb-blank">{i.kind === 'video' ? 'Clip' : 'Photo'}</span>}
                {i.kind === 'video' ? <span className="jk-len">{i.duration ? `${Math.round(i.duration)} s` : 'clip'}</span> : null}
                <span className="jk-mark">
                  <Mark state={i.sent ? 'sent' : 'waiting'} />
                </span>
              </button>
            </li>
          ))}
          {Array.from({ length: saving }).map((_, n) => (
            <li key={`s${n}`}>
              <span className="jk-thumb jk-saving" aria-label="Saving">
                <Mark state="sending" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {shown ? <ItemPanel key={shown.id} item={shown} onRemove={() => void onRemove(shown).then(() => setOpen(null))} onCaption={(c) => void onCaption(shown, c)} /> : null}

      <div className="mt-3 flex gap-2">
        {slot.camera !== false ? (
          <button type="button" className={`btn btn-sm flex-1 ${done ? 'btn-ghost' : 'btn-primary'}`} onClick={() => cam.current?.click()}>
            {video ? (done ? 'Film another' : 'Film') : done ? 'Take another' : 'Take photo'}
          </button>
        ) : null}
        <button type="button" className={`btn btn-sm btn-ghost ${slot.camera === false ? 'flex-1' : ''}`} onClick={() => lib.current?.click()}>
          From Photos
        </button>
      </div>
      <input ref={cam} type="file" accept={accept} capture="environment" className="hidden" onChange={pick} />
      <input ref={lib} type="file" accept={accept} multiple className="hidden" onChange={pick} />
    </li>
  );
}

export function ItemPanel({ item, onRemove, onCaption }: { item: Item; onRemove: () => void; onCaption: (c: string) => void }) {
  const [caption, setCaption] = useState(item.caption);
  const [sure, setSure] = useState(false);
  const long = item.kind === 'video' && item.duration && item.duration > 30;
  return (
    <div className="mt-3 rounded-sm border border-line bg-paper p-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12.5px] text-faint">
        <span>{mb(item.bytes)}</span>
        {item.w && item.h ? <span>{item.w} x {item.h}</span> : null}
        {item.duration ? <span>{Math.round(item.duration)} s</span> : null}
        <span>{item.sent ? 'sent' : item.sentParts ? `sending, ${item.sentParts} of ${item.parts} pieces` : 'waiting to send'}</span>
      </div>
      {long ? <p className="mt-2 text-[14px] leading-snug text-ink">Longer than 30 s. Fine for the time-lapse; the site plays up to 24 s of any other clip, so it will be cut.</p> : null}
      <label className="mt-2.5 grid gap-1">
        <span className={label}>What it shows (optional)</span>
        <input
          className={`${field} h-11`}
          value={caption}
          placeholder={item.slot === 'extra' ? 'e.g. Cut round the boiler pipe' : 'e.g. Left alcove'}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== item.caption && onCaption(caption.trim())}
        />
      </label>
      <button type="button" className={`mt-3 h-10 px-0 text-[14.5px] font-semibold ${sure ? 'text-ink underline' : 'text-muted'}`} onClick={() => (sure ? onRemove() : setSure(true))}>
        {sure ? 'Tap again to delete it' : `Delete this ${item.kind === 'video' ? 'clip' : 'photo'}`}
      </button>
    </div>
  );
}

export function Area({ label: l, value, onChange, placeholder }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={label}>{l}</span>
      <textarea className={`${field} min-h-[76px] py-2.5 leading-snug`} rows={2} value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}


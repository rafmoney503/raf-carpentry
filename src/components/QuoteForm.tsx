'use client';
import { useState } from 'react';

export const DEFAULT_SERVICE_OPTIONS = [
  'Fitted wardrobes',
  'Alcove units',
  'Cupboards or a pantry',
  'Garden office fit-out',
  'Something else',
];

type Props = {
  email?: string;
  phone?: string;
  serviceOptions?: string[];
  submitLabel?: string;
  note?: string;
  idPrefix?: string;
};

type Errors = Partial<Record<'name' | 'contact', string>>;

const fieldClass =
  'w-full rounded-sm border border-line-strong bg-field px-3.5 text-base text-ink transition-colors placeholder:text-faint focus:border-accent focus:outline-none aria-[invalid=true]:border-[#b42318]';

/*
  The form isn't connected to a mail service yet, so on submit it opens the visitor's
  email app with the enquiry already written out to info@rafcarpentry.com.
  Swap handleSubmit for a Formspree or Resend call when a backend is ready.
*/
export default function QuoteForm({
  email = 'info@rafcarpentry.com',
  phone = '07792 860221',
  serviceOptions = DEFAULT_SERVICE_OPTIONS,
  submitLabel = 'Get a quote',
  note = "I'll only use your details to reply about this job.",
  idPrefix = 'q',
}: Props) {
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') || '').trim();
    const contact = String(data.get('contact') || '').trim();
    const postcode = String(data.get('postcode') || '').trim();
    const service = String(data.get('service') || '').trim();
    const details = String(data.get('details') || '').trim();

    const next: Errors = {};
    if (!name) next.name = 'Please add your name.';
    if (!contact) next.contact = 'Add a phone number or email so I can reply.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const subject = `Quote request: ${service || 'fitted furniture'}${postcode ? ` (${postcode})` : ''}`;
    const body = [
      `Name: ${name}`,
      `Phone or email: ${contact}`,
      `Postcode: ${postcode || '-'}`,
      `What I need: ${service || '-'}`,
      '',
      details || '',
    ].join('\n');
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Quote request" className="rounded-sm border border-line bg-raised p-5 md:p-9">
      <div className="grid grid-cols-1 gap-x-5 gap-y-[22px] md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={id('name')} className="text-sm font-medium text-ink">Name</label>
          <input id={id('name')} name="name" type="text" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? id('name-error') : undefined} className={`${fieldClass} h-[50px]`} />
          {errors.name && <p id={id('name-error')} className="text-[13px] text-[#b42318]">{errors.name}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={id('contact')} className="text-sm font-medium text-ink">Phone or email</label>
          <input id={id('contact')} name="contact" type="text" autoComplete="email" aria-invalid={!!errors.contact} aria-describedby={errors.contact ? id('contact-error') : undefined} className={`${fieldClass} h-[50px]`} />
          {errors.contact && <p id={id('contact-error')} className="text-[13px] text-[#b42318]">{errors.contact}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={id('postcode')} className="text-sm font-medium text-ink">Postcode</label>
          <input id={id('postcode')} name="postcode" type="text" autoComplete="postal-code" className={`${fieldClass} h-[50px]`} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={id('service')} className="text-sm font-medium text-ink">What do you need?</label>
          <div className="relative">
            <select id={id('service')} name="service" className={`${fieldClass} h-[50px] appearance-none pr-10`}>
              {serviceOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <label htmlFor={id('details')} className="text-sm font-medium text-ink">About the space</label>
          <textarea id={id('details')} name="details" placeholder="Which room, rough size, anything you already have in mind" className={`${fieldClass} h-32 resize-y py-3 leading-normal`} />
          <p className="text-[13px] text-faint">Photos help. I&apos;ll ask for a few when I reply.</p>
        </div>
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-5">
        <button type="submit" className="btn btn-primary w-full md:w-auto">{submitLabel}</button>
        <p className="max-w-[30ch] text-sm leading-normal text-faint">{note}</p>
      </div>
      {sent && (
        <p role="status" className="mt-5 border-t border-line pt-4 text-sm text-muted">
          Your email app should now open with the message ready to send. If it doesn&apos;t, call or text{' '}
          <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-medium text-accent">{phone}</a>.
        </p>
      )}
    </form>
  );
}

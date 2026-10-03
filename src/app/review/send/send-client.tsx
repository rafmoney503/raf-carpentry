'use client';
import { useMemo, useState } from 'react';
import SocialIcon from '@/components/SocialIcon';

const REVIEW_PAGE = 'https://www.rafcarpentry.com/review';

const input =
  'h-12 w-full rounded-sm border border-line-strong bg-mount px-3 text-[16px] text-ink placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20';

/* UK mobile to international digits for wa.me / sms: "07700 900123" -> "447700900123". */
function toIntl(raw: string) {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1);
  return d.replace(/\D/g, '');
}

function draft(name: string, job: string) {
  const hi = name.trim() ? `Hi ${name.trim()}` : 'Hi';
  const enjoy = job.trim() ? ` I hope you're enjoying your new ${job.trim()}.` : '';
  return `${hi}, thanks again for having me.${enjoy}\n\nIf you're happy with the work, a quick Google review would really help other people find me. It only takes a minute:\n${REVIEW_PAGE}\n\nThanks,\nRaf`;
}

export default function SendClient({ jobs }: { jobs: string[] }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [job, setJob] = useState('');
  const [edited, setEdited] = useState<string | null>(null); // the message once Raf changes it by hand
  const [copied, setCopied] = useState(false);

  const message = edited ?? draft(name, job);
  const intl = toIntl(phone);
  // A UK number must be 44 + 10 digits; other countries are let through as typed.
  const phoneOk = !phone.trim() || /^44\d{10}$/.test(intl) || (intl.length >= 8 && !intl.startsWith('44'));
  const hasPhone = Boolean(phone.trim()) && phoneOk;

  const wa = useMemo(() => `https://wa.me/${hasPhone ? intl : ''}?text=${encodeURIComponent(message)}`, [hasPhone, intl, message]);
  // "?&body=" works on both iPhone and Android.
  const sms = useMemo(() => `sms:${hasPhone ? `+${intl}` : ''}?&body=${encodeURIComponent(message)}`, [hasPhone, intl, message]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const clear = () => {
    setName('');
    setPhone('');
    setJob('');
    setEdited(null);
  };

  return (
    <form className="mt-8 grid gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Review request">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[12px] text-faint">Client&apos;s first name</span>
          <input
            className={`${input} mt-1`}
            value={name}
            onChange={(e) => { setName(e.target.value.slice(0, 40)); setEdited(null); }}
            placeholder="e.g. Sarah"
            autoComplete="off"
            autoCapitalize="words"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[12px] text-faint">Mobile number</span>
          <input
            className={`${input} mt-1 ${phoneOk ? '' : 'border-accent ring-2 ring-accent/20'}`}
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 20))}
            placeholder="07..."
            inputMode="tel"
            autoComplete="off"
          />
        </label>
      </div>
      {!phoneOk ? (
        <p className="-mt-2 text-[13px] text-accent">That doesn&apos;t look like a UK mobile. Check it, or leave it empty and pick the chat in WhatsApp.</p>
      ) : null}
      <label className="block">
        <span className="font-mono text-[12px] text-faint">What you made (optional)</span>
        <input
          className={`${input} mt-1`}
          value={job}
          onChange={(e) => { setJob(e.target.value.slice(0, 80)); setEdited(null); }}
          placeholder="e.g. wardrobes"
          list="review-jobs"
          autoComplete="off"
        />
        <datalist id="review-jobs">
          {jobs.map((j) => <option key={j} value={j} />)}
        </datalist>
      </label>

      <div>
        <div className="flex items-baseline justify-between font-mono text-[12px] text-faint">
          <label htmlFor="review-message">Message</label>
          {edited !== null ? (
            <button type="button" onClick={() => setEdited(null)} className="hover:text-ink">Reset</button>
          ) : null}
        </div>
        <textarea
          id="review-message"
          className={`${input} mt-1 h-56 resize-y py-2.5 font-mono text-[14px] leading-relaxed`}
          value={message}
          onChange={(e) => setEdited(e.target.value.slice(0, 900))}
        />
      </div>

      <div className="grid gap-2.5">
        <a href={wa} target="_blank" rel="noopener" className="btn btn-whatsapp w-full gap-2.5">
          <SocialIcon network="whatsapp" size={18} />
          {hasPhone ? 'Send on WhatsApp' : 'Open WhatsApp and pick the chat'}
        </a>
        <div className="grid grid-cols-2 gap-2.5">
          <a href={sms} className="btn btn-ghost">Send as a text</a>
          <button type="button" onClick={copy} className="btn btn-ghost">{copied ? 'Copied' : 'Copy message'}</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[14px] text-muted">
        <a href="/review" className="font-medium text-accent hover:underline">Show the QR code instead</a>
        <button type="button" onClick={clear} className="font-mono text-[12px] text-faint hover:text-ink">Next client (clear)</button>
      </div>
      <p className="text-[13px] leading-relaxed text-faint">
        Nothing typed here is saved. On your phone, tap Share, then Add to Home Screen, and this opens like an app.
      </p>
    </form>
  );
}

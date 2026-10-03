import { BOOKING_URL, QUOTE_HREF } from '@/lib/site';
import Link from 'next/link';
import WhatsAppButton from './WhatsAppButton';

type Props = {
  heading?: string;
  body?: string;
  steps?: string[];
  buttonLabel?: string;
  note?: string;
};

/* Quote panel: "Get a quote" opens the Plan your project page (/how-it-works), which ends in a brief
   that becomes a ready-written WhatsApp message or email. The ServiceM8 booking page stays one tap away for people who want to pick a date. */
export default function QuoteCta({
  heading = 'Get a free quote',
  body = 'Tick what fits in a short brief and it becomes a ready-written message to me, with everything I need to know.',
  steps = [
    'I reply within 24 hours to arrange a visit.',
    'I measure up and talk through the space.',
    'You get a 3D drawing to approve before anything is cut.',
  ],
  buttonLabel = 'Get a quote',
  note = 'Takes two minutes. Send it on WhatsApp or by email.',
}: Props) {
  return (
    <div className="rounded-sm border border-line bg-raised p-6 md:p-10">
      <h3 className="text-[25px] font-[620] leading-tight md:text-[30px]">{heading}</h3>
      <p className="mt-3 max-w-[46ch] text-pretty text-muted">{body}</p>
      {steps.length > 0 && (
        <ol className="mt-7 border-t border-line">
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 border-b border-line py-4">
              <span className="pt-0.5 font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-ink">{s}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-8 flex flex-col gap-3 md:flex-row md:flex-wrap">
        <Link href={QUOTE_HREF} className="btn btn-primary w-full gap-2 md:w-auto">
          {buttonLabel}
          <span aria-hidden="true">→</span>
        </Link>
        <WhatsAppButton className="w-full md:w-auto" />
      </div>
      {note ? <p className="mt-4 text-sm text-faint">{note}</p> : null}
      <p className="mt-1 text-sm text-faint">Or send me photos of the space on WhatsApp.</p>
      <a href={BOOKING_URL} target="_blank" rel="noopener" className="link-more mt-6 text-[15px]">
        Rather pick a date yourself? Book a visit online <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

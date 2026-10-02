import { QUOTE_URL } from '@/lib/site';

type Props = {
  heading?: string;
  body?: string;
  steps?: string[];
  buttonLabel?: string;
  note?: string;
};

/* Quote panel: sends visitors to the ServiceM8 booking page, so every enquiry lands in ServiceM8. */
export default function QuoteCta({
  heading = 'Book a free quote',
  body = 'Tell me what you need and where the job is. It goes straight into my booking system.',
  steps = [
    'I reply within 24 hours to arrange a visit.',
    'I measure up and talk through the space.',
    'You get a 3D drawing to approve before anything is cut.',
  ],
  buttonLabel = 'Get a quote',
  note = 'Opens my booking page in a new tab.',
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
      <a href={QUOTE_URL} target="_blank" rel="noopener" className="btn btn-primary mt-8 w-full gap-2 md:w-auto">
        {buttonLabel}
        <span aria-hidden="true">↗</span>
      </a>
      {note ? <p className="mt-4 text-sm text-faint">{note}</p> : null}
    </div>
  );
}

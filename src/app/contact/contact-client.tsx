import QuoteForm from '@/components/QuoteForm';
import { Container } from '@/components/ui';

export type ContactPageData = {
  title: string;
  titleAccent: string;
  subtitle: string;
  email: string;
  phone: string;
  address: string;
  responseTimeLabel: string;
  responseTimeValue: string;
  formEnabled: boolean;
  formHeading: string;
  formSubmitLabel: string;
};

function formatPhone(p: string) {
  const digits = p.replace(/\s/g, '');
  return digits.length === 11 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : p;
}

export default function ContactClient({ d }: { d: ContactPageData }) {
  const phone = formatPhone(d.phone);
  const details = [
    { label: 'Call, text or WhatsApp', value: phone, href: `tel:${d.phone.replace(/\s/g, '')}` },
    { label: 'Email', value: d.email, href: `mailto:${d.email}` },
    { label: 'Based in', value: d.address },
    { label: d.responseTimeLabel, value: d.responseTimeValue },
  ];

  return (
    <Container className="pb-24 pt-12 md:pb-32 md:pt-20">
      <div className={`grid grid-cols-1 items-start gap-12 ${d.formEnabled ? 'md:grid-cols-12 md:gap-6' : ''}`}>
        <div className="md:col-span-5">
          <h1 className="max-w-[12em] font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[58px]">
            {d.title} <span className="text-accent">{d.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-[48ch] text-pretty text-[17px] leading-relaxed text-muted">{d.subtitle}</p>
          <dl className="mt-10 grid gap-6">
            {details.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-faint">{item.label}</dt>
                <dd className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] md:text-[26px]">
                  {item.href ? (
                    <a href={item.href} className="transition-colors hover:text-accent">{item.value}</a>
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {d.formEnabled ? (
          <div className="md:col-span-6 md:col-start-7">
            <h2 className="mb-5 text-[25px] font-[620] leading-tight">{d.formHeading}</h2>
            <QuoteForm email={d.email} phone={phone} submitLabel={d.formSubmitLabel} idPrefix="contact-q" />
          </div>
        ) : null}
      </div>
    </Container>
  );
}

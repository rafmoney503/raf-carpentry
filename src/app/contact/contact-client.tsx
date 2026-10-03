import QuoteCta from '@/components/QuoteCta';
import { GoogleRating } from '@/components/Reviews';
import Link from 'next/link';
import { Container } from '@/components/ui';
import SocialIcon from '@/components/SocialIcon';
import { whatsappText, whatsappUrl } from '@/lib/site';

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
    { label: 'Call or text', value: phone, href: `tel:${d.phone.replace(/\s/g, '')}` },
    { label: 'WhatsApp', value: 'Message me', href: whatsappUrl(whatsappText('/contact')), whatsapp: true },
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
          <GoogleRating variant="inline" className="mt-6" />
          <dl className="mt-10 grid gap-6">
            {details.map((item) => (
              <div key={item.label}>
                <dt className="text-sm text-faint">{item.label}</dt>
                <dd className="mt-1 font-display text-[24px] font-semibold leading-tight tracking-[-0.015em] md:text-[26px]">
                  {item.href ? (
                    'whatsapp' in item ? (
                      <a href={item.href} target="_blank" rel="noopener" className="inline-flex items-center gap-2.5 transition-colors hover:text-accent">
                        <SocialIcon network="whatsapp" size={24} className="text-whatsapp" />
                        {item.value}
                      </a>
                    ) : (
                      <a href={item.href} className="transition-colors hover:text-accent">{item.value}</a>
                    )
                  ) : (
                    item.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 rounded-sm border border-line bg-raised p-5">
            <p className="font-mono text-[13px] text-accent">Before you get in touch</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">What I need from you, how materials and finishes compare, and a quick brief you can send me in two minutes.</p>
            <Link href="/how-it-works" className="link-more mt-3 text-[15px]">
              Plan your project <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {d.formEnabled ? (
          <div className="md:col-span-6 md:col-start-7">
            <QuoteCta />
          </div>
        ) : null}
      </div>
    </Container>
  );
}

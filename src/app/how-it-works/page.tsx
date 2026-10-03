import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { readPageJson } from '@/lib/pages';
import { Container, PageHeader, SectionHeading } from '@/components/ui';
import WhatsAppButton from '@/components/WhatsAppButton';
import { BOOKING_URL } from '@/lib/site';
import BriefBuilder from './brief-builder';
import Sketch from './sketches';

type Item = { title: string; description: string };
type Material = { name: string; cost: string; bestFor: string; description: string; image: string; imageAlt: string; link: string };
type HowItWorksData = {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  title: string;
  titleAccent: string;
  lede: string;
  needHeading: string;
  needIntro: string;
  need: (Item & { sketch?: string })[];
  getHeading: string;
  get: (Item & { sketch?: string })[];
  materialsHeading: string;
  materialsIntro: string;
  materials: Material[];
  costNote: string;
  finishesHeading: string;
  finishes: Item[];
  briefHeading: string;
  briefIntro: string;
  briefWhat: string[];
  briefRoom: string[];
  briefUses: string[];
  briefMaterial: string[];
  briefFinish: string[];
  briefTiming: string[];
  briefBudget: string[];
  briefParking: string[];
  briefPhotoTips: string[];
  faqHeading: string;
  faq: { question: string; answer: string }[];
  ctaHeading: string;
  ctaText: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const d = readPageJson<HowItWorksData>('how-it-works.json');
  return { title: d.metaTitle, description: d.metaDescription };
}

const jump = [
  { href: '#need', label: 'What I need' },
  { href: '#get', label: 'What you get' },
  { href: '#materials', label: 'Materials' },
  { href: '#brief', label: 'Your brief' },
  { href: '#faq', label: 'Questions' },
];

/* £ to ££££: the filled part in ink, the rest faint, so cost reads at a glance. */
function Cost({ value }: { value: string }) {
  const n = Math.min(4, Math.max(1, value.length));
  return (
    <span className="flex-none font-mono text-[15px]" aria-label={`Cost ${n} of 4`}>
      <span className="text-ink">{'£'.repeat(n)}</span>
      <span className="text-line-strong">{'£'.repeat(4 - n)}</span>
    </span>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] flex-none text-accent">
      <path d="M3.5 9.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export default function HowItWorksPage() {
  const d = readPageJson<HowItWorksData>('how-it-works.json');

  return (
    <>
      <PageHeader kicker={d.kicker} title={d.title} accent={d.titleAccent} lede={d.lede}>
        <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2">
          {jump.map((j) => (
            <a key={j.href} href={j.href} className="inline-flex h-10 items-center rounded-sm border border-line-strong px-4 text-[14.5px] font-medium text-ink transition-colors hover:border-ink">
              {j.label}
            </a>
          ))}
        </nav>
      </PageHeader>

      {/* What I need / what you get */}
      <section id="need" className="scroll-mt-20 border-t border-line">
        <Container className="grid grid-cols-1 gap-6 py-14 md:grid-cols-2 md:py-20">
          <div className="rounded-sm border border-line-strong bg-mount p-6 md:p-9">
            <h2 className="font-display text-[26px] font-[650] leading-tight tracking-[-0.02em] md:text-[30px]">{d.needHeading}</h2>
            <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted">{d.needIntro}</p>
            <ol className="mt-7 border-t border-line">
              {d.need.map((n, i) => {
                const num = String(i + 1).padStart(2, '0');
                return (
                  <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-4 border-b border-line py-4 sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-5">
                    <Sketch name={n.sketch} fallback={num} />
                    <div className="pt-0.5">
                      <h3 className="text-[17px] font-[620] text-ink">
                        <span className="mr-2 font-mono text-[13px] font-normal text-accent">{num}</span>
                        {n.title}
                      </h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-muted">{n.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div id="get" className="scroll-mt-20 rounded-sm border border-line bg-raised p-6 md:p-9">
            <h2 className="font-display text-[26px] font-[650] leading-tight tracking-[-0.02em] md:text-[30px]">{d.getHeading}</h2>
            <ul className="mt-7 border-t border-line-strong">
              {d.get.map((g, i) => (
                <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-4 border-b border-line-strong py-4 sm:grid-cols-[76px_minmax(0,1fr)] sm:gap-5">
                  <Sketch name={g.sketch} fallback={<Check />} />
                  <div className="pt-0.5">
                    <h3 className="flex gap-2 text-[17px] font-[620] text-ink">
                      <Check />
                      {g.title}
                    </h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted">{g.description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#brief" className="btn btn-primary">Put your brief together</a>
            </div>
          </div>
        </Container>
      </section>

      {/* Materials */}
      <section id="materials" className="scroll-mt-20 border-t border-line">
        <Container className="py-14 md:py-20">
          <div className="max-w-[60ch]">
            <SectionHeading>{d.materialsHeading}</SectionHeading>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">{d.materialsIntro}</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {d.materials.map((m) => (
              <Link key={m.name} href={m.link} className="group block">
                <div className="mount p-2 transition-colors group-hover:border-accent">
                  <div className="relative aspect-[4/3] overflow-hidden bg-raised">
                    <Image src={m.image} alt={m.imageAlt} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px" className="object-cover" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-4">
                  <h3 className="text-[21px] font-[620] leading-snug transition-colors group-hover:text-accent">{m.name}</h3>
                  <Cost value={m.cost} />
                </div>
                <p className="mt-2 text-[14px] text-ink"><span className="font-mono text-[12px] text-faint">Best for </span>{m.bestFor}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{m.description}</p>
                <p className="mt-3 text-sm font-medium text-accent">See the job <span aria-hidden="true">→</span></p>
              </Link>
            ))}
          </div>
          <p className="mt-10 max-w-[70ch] border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">{d.costNote}</p>

          <h3 className="mt-16 font-display text-[24px] font-[650] tracking-[-0.02em] md:text-[28px]">{d.finishesHeading}</h3>
          <dl className="mt-6 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-5">
            {d.finishes.map((f, i) => (
              <div key={i} className="border-t border-line-strong py-5">
                <dt className="text-[17px] font-[620] text-ink">{f.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.description}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Brief builder */}
      <section id="brief" className="scroll-mt-20 border-t border-line bg-raised">
        <Container className="py-14 md:py-20">
          <div className="max-w-[60ch]">
            <p className="kicker">Takes two minutes</p>
            <SectionHeading className="mt-3">{d.briefHeading}</SectionHeading>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">{d.briefIntro}</p>
          </div>
          <div className="mt-10">
            <BriefBuilder
              options={{ what: d.briefWhat, room: d.briefRoom, uses: d.briefUses, material: d.briefMaterial, finish: d.briefFinish, timing: d.briefTiming, budget: d.briefBudget, parking: d.briefParking, photoTips: d.briefPhotoTips }}
            />
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line">
        <Container className="grid grid-cols-1 gap-8 py-14 md:grid-cols-12 md:gap-6 md:py-20">
          <SectionHeading className="md:col-span-4">{d.faqHeading}</SectionHeading>
          <div className="border-t border-line md:col-span-8">
            {d.faq.map((q, i) => (
              <details key={i} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-[620] text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                  {q.question}
                  <span className="flex-none font-mono text-[20px] font-normal text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="-mt-1 max-w-[62ch] pb-6 text-[16px] leading-relaxed text-muted">{q.answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* Ready */}
      <section className="border-t border-line">
        <Container className="grid grid-cols-1 items-end gap-8 py-16 md:grid-cols-12 md:gap-6 md:py-20">
          <div className="md:col-span-7">
            <SectionHeading>{d.ctaHeading}</SectionHeading>
            <p className="mt-4 max-w-[52ch] text-muted">{d.ctaText}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-self-end">
            <a href="#brief" className="btn btn-primary">Get a quote</a>
            <WhatsAppButton />
            <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost gap-2">
              Book a visit online <span aria-hidden="true">↗</span>
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}

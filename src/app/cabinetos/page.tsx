import Image from 'next/image';
import Link from 'next/link';
import { readPageJson } from '@/lib/pages';

function imageSrc(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v;
  return '';
}

type BeforeAfterItem = {
  beforeImage?: string;
  afterImage?: string;
  beforeAlt?: string;
  afterAlt?: string;
};

type CabinetosPageData = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  heroImage?: string;
  heroImageAlt?: string;
  mockupEmoji: string;
  mockupPlaceholder: string;
  featuresSectionTitle: string;
  featuresSectionTitleAccent: string;
  featuresSectionSubtitle: string;
  features: { title: string; description: string; icon: string }[];
  beforeAfterItems?: BeforeAfterItem[];
  withoutTitle: string;
  withoutBullets: string[];
  withTitle: string;
  withBullets: string[];
  faqSectionTitle: string;
  faqSectionTitleAccent: string;
  faq: { question: string; answer: string }[];
  bottomCtaTitle: string;
  bottomCtaTitleAccent: string;
  bottomCtaSubtitle: string;
  bottomCtaButtonLabel: string;
};

export default function Cabinetos() {
  const d = readPageJson<CabinetosPageData>('cabinetos.json');
  const heroSrc = imageSrc(d.heroImage);
  const items = d.beforeAfterItems ?? [];
  const [firstPair, ...extraPairs] = items;
  const before0 = imageSrc(firstPair?.beforeImage);
  const after0 = imageSrc(firstPair?.afterImage);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(96,165,250,0.05)] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="max-w-3xl">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 block">{d.eyebrow}</span>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] mb-6">
              {d.title}<br />
              <span className="gold-text">{d.titleAccent}</span>
            </h1>
            <p className="text-lg text-[--text-muted] max-w-xl mb-10 leading-relaxed">
              {d.subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#features" className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
                {d.primaryCtaLabel}
              </a>
              <a href="#faq" className="px-7 py-3.5 rounded-xl border border-[--border] text-[--text] font-bold text-sm hover:border-[--gold] hover:text-[--gold] transition-colors">
                {d.secondaryCtaLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="aspect-video rounded-2xl border border-[--border] bg-[--bg-card] overflow-hidden relative flex items-center justify-center">
          {heroSrc ? (
            <Image
              src={heroSrc}
              alt={d.heroImageAlt || 'Cabinetos app'}
              fill
              className="object-contain"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          ) : (
            <div className="text-center p-8">
              <span className="text-6xl block mb-4">{d.mockupEmoji}</span>
              <p className="text-[--text-muted] text-sm">{d.mockupPlaceholder}</p>
            </div>
          )}
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">{d.featuresSectionTitle}<span className="gold-text">{d.featuresSectionTitleAccent}</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto">{d.featuresSectionSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {d.features.map((f, i) => (
            <div key={i} className="card-hover bg-[--bg-card] border border-[--border] rounded-2xl p-8">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-xl bg-[rgba(96,165,250,0.12)] flex items-center justify-center text-2xl flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-[--text-muted] leading-relaxed">{f.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-red-900/30 bg-[rgba(239,68,68,0.03)] p-8">
            {before0 ? (
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 border border-red-900/20">
                <Image
                  src={before0}
                  alt={firstPair?.beforeAlt || d.withoutTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ) : null}
            <h3 className="text-xl font-bold mb-4 text-red-400">{d.withoutTitle}</h3>
            <ul className="space-y-3 text-sm text-[--text-muted]">
              {d.withoutBullets.map((line, i) => (
                <li key={i} className="flex gap-2"><span className="text-red-400">{'\u2717'}</span> {line}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-green-900/30 bg-[rgba(74,222,128,0.03)] p-8">
            {after0 ? (
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 border border-green-900/20">
                <Image
                  src={after0}
                  alt={firstPair?.afterAlt || d.withTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ) : null}
            <h3 className="text-xl font-bold mb-4 text-green-400">{d.withTitle}</h3>
            <ul className="space-y-3 text-sm text-[--text-muted]">
              {d.withBullets.map((line, i) => (
                <li key={i} className="flex gap-2"><span className="text-green-400">{'\u2713'}</span> {line}</li>
              ))}
            </ul>
          </div>
        </div>

        {extraPairs.map((pair, idx) => {
          const b = imageSrc(pair.beforeImage);
          const a = imageSrc(pair.afterImage);
          if (!b && !a) return null;
          return (
            <div
              key={idx}
              className={`grid gap-6 mt-6 ${b && a ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
            >
              {b ? (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-red-900/30 bg-[rgba(239,68,68,0.03)]">
                  <Image
                    src={b}
                    alt={pair.beforeAlt || d.withoutTitle}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ) : null}
              {a ? (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-green-900/30 bg-[rgba(74,222,128,0.03)]">
                  <Image
                    src={a}
                    alt={pair.afterAlt || d.withTitle}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section id="faq" className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold mb-10 text-center">{d.faqSectionTitle}<span className="gold-text">{d.faqSectionTitleAccent}</span></h2>
        <div className="space-y-4">
          {d.faq.map((f, i) => (
            <div key={i} className="bg-[--bg-card] border border-[--border] rounded-xl p-6">
              <h4 className="font-bold mb-2">{f.question}</h4>
              <p className="text-sm text-[--text-muted] leading-relaxed">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{d.bottomCtaTitle}<span className="gold-text">{d.bottomCtaTitleAccent}</span></h2>
          <p className="text-[--text-muted] max-w-md mx-auto mb-6">{d.bottomCtaSubtitle}</p>
          <Link href="/contact" className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-[--gold] to-[--gold-light] text-[--bg] font-bold text-sm hover:opacity-90 transition-opacity">
            {d.bottomCtaButtonLabel}
          </Link>
        </div>
      </section>
    </>
  );
}

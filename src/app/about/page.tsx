import Image from 'next/image';
import { readPageJson } from '@/lib/pages';
import { Container, SectionHeading } from '@/components/ui';
import SocialIcon, { networkOf } from '@/components/SocialIcon';

type AboutPageData = {
  title: string;
  titleAccent: string;
  storyParagraphs: string[];
  storyClosingLead: string;
  storyClosingBold: string;
  storyClosingRest: string;
  stats: { label: string; value: string }[];
  differentiators: { title: string; description: string }[];
  socialLinks: { label: string; url: string }[];
  profileImage?: string;
  profileImageStyle?: string;
  photoPlaceholderEmoji: string;
  photoPlaceholderText: string;
};

// Until a portrait is added in the CMS, the page uses the photo of Raf measuring timber.
const FALLBACK_PHOTO = '/images/raf-at-work.jpg';

export default function About() {
  const d = readPageJson<AboutPageData>('about.json');
  const imgSrc = typeof d.profileImage === 'string' && d.profileImage.trim() ? d.profileImage.trim() : FALLBACK_PHOTO;

  return (
    <>
      <Container className="pb-16 pt-12 md:pb-24 md:pt-20">
        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-12 md:gap-6">
          <div className="md:col-span-7">
            <h1 className="max-w-[14em] font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[58px]">
              {d.title} <span className="text-accent">{d.titleAccent}</span>
            </h1>
            <div className="mt-8 max-w-[60ch] space-y-4 text-[17px] leading-relaxed text-muted">
              {d.storyParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p>
                {d.storyClosingLead}
                <strong className="font-semibold text-ink">{d.storyClosingBold}</strong>
                {d.storyClosingRest}
              </p>
            </div>
          </div>
          <figure className="md:col-span-5">
            <div className="mount">
              <div className="relative aspect-[4/5] overflow-hidden bg-raised">
                <Image src={imgSrc} alt="Raf Janczy at work" fill priority sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
              </div>
            </div>
          </figure>
        </div>
      </Container>

      <Container className="pb-20 md:pb-28">
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 border-t border-line pt-10 md:grid-cols-4 md:gap-x-6">
          {d.stats.map((s, i) => (
            <div key={i}>
              <div className="font-display text-[44px] font-[620] leading-none tracking-[-0.03em] md:text-[50px]">{s.value}</div>
              <div className="mt-3 text-[15px] text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </Container>

      <section className="border-y border-line bg-raised py-20 md:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-6">
            <SectionHeading className="md:col-span-5">What makes me different</SectionHeading>
            <ol className="md:col-span-7">
              {d.differentiators.map((item, i) => (
                <li key={i} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-t border-line py-7 first:border-t-0 first:pt-0">
                  <span className="pt-1.5 font-mono text-sm text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-[25px] font-[620] leading-tight">{item.title}</h3>
                    <p className="mt-2 text-muted">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <Container className="py-20 md:py-28">
        <SectionHeading>Follow the work</SectionHeading>
        <div className="mt-8 flex flex-wrap gap-3">
          {d.socialLinks.map((s) => {
            const net = networkOf(s.url) ?? networkOf(s.label);
            return (
              <a key={s.label} href={s.url} target="_blank" rel="noopener" className="btn btn-ghost gap-2.5">
                {net ? <SocialIcon network={net} size={18} /> : null}
                {s.label}
              </a>
            );
          })}
        </div>
      </Container>
    </>
  );
}

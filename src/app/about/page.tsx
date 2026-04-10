import Image from 'next/image';
import { readPageJson } from '@/lib/pages';

type ProfileImageStyle = 'rounded' | 'circle' | 'square' | 'phone-frame';

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

function profileImageSrc(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return '';
}

function profileShapeClass(style: string | undefined): string {
  const s = style as ProfileImageStyle | undefined;
  switch (s) {
    case 'circle':
      return 'rounded-full';
    case 'square':
      return 'rounded-none';
    case 'phone-frame':
      return 'rounded-[2rem] border-2 border-zinc-800';
    case 'rounded':
    default:
      return 'rounded-xl';
  }
}

export default function About() {
  const d = readPageJson<AboutPageData>('about.json');
  const imgSrc = profileImageSrc(d.profileImage);
  const shapeClass = profileShapeClass(d.profileImageStyle);

  return (
    <>
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 md:pt-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="gold-line mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {d.title}<br /><span className="gold-text">{d.titleAccent}</span>
            </h1>
            {d.storyParagraphs.map((p, i) => (
              <p key={i} className="text-[--text-muted] leading-relaxed mb-4">
                {p}
              </p>
            ))}
            <p className="text-[--text-muted] leading-relaxed">
              {d.storyClosingLead}<strong className="text-[--text]">{d.storyClosingBold}</strong>{d.storyClosingRest}
            </p>
          </div>
          <div className="aspect-square rounded-2xl border border-[--border] bg-[--bg-card] overflow-hidden flex items-center justify-center">
            {imgSrc ? (
              <div className={`relative w-full h-full overflow-hidden ${shapeClass}`}>
                <Image
                  src={imgSrc}
                  alt={`${d.title} ${d.titleAccent}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ) : (
              <div className="text-center px-4 py-8">
                <span className="text-6xl block mb-3">{d.photoPlaceholderEmoji}</span>
                <p className="text-[--text-muted] text-sm">{d.photoPlaceholderText}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {d.stats.map((s, i) => (
            <div key={i} className="text-center py-8 rounded-2xl border border-[--border] bg-[--bg-card]">
              <div className="text-3xl font-bold gold-text mb-1">{s.value}</div>
              <div className="text-xs text-[--text-muted] uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold mb-8 text-center">What Makes Me <span className="gold-text">Different</span></h2>
        <div className="space-y-4">
          {d.differentiators.map((item, i) => (
            <div key={i} className="bg-[--bg-card] border border-[--border] rounded-xl p-6 flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-[rgba(212,168,83,0.15)] flex items-center justify-center text-[--gold] text-sm font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <h4 className="font-bold mb-1">{item.title}</h4>
                <p className="text-sm text-[--text-muted]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center py-14 rounded-2xl border border-[--border] bg-[--bg-card]">
          <h2 className="text-2xl font-bold mb-6">Follow <span className="gold-text">My Journey</span></h2>
          <div className="flex justify-center gap-4 flex-wrap">
            {d.socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener" className="px-6 py-3 rounded-xl border border-[--border] text-sm hover:border-[--gold] hover:text-[--gold] transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

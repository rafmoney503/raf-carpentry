import Image from 'next/image';

/* Shared building blocks for the inner pages, so every page uses the same width, header and photo mount. */

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-5 md:px-10 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  accent,
  lede,
  kicker,
  children,
}: {
  title: string;
  accent?: string;
  lede?: string;
  kicker?: string;
  children?: React.ReactNode;
}) {
  return (
    <Container className="pb-12 pt-12 md:pb-16 md:pt-20">
      {kicker ? <p className="kicker mb-5">{kicker}</p> : null}
      <h1 className="max-w-[16em] font-display text-[40px] font-[680] leading-[1.04] tracking-[-0.03em] md:text-[58px]">
        {title}
        {accent ? <span className="text-accent">{accent.startsWith(' ') || title.endsWith(' ') ? accent : ` ${accent}`}</span> : null}
      </h1>
      {lede ? <p className="mt-5 max-w-[56ch] text-pretty text-[17px] leading-relaxed text-muted md:text-[19px]">{lede}</p> : null}
      {children}
    </Container>
  );
}

export function SectionHeading({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px] ${className}`}>{children}</h2>
  );
}

export function MountedImage({
  src,
  alt,
  aspect = 'aspect-[4/3]',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
  contain = false,
  className = '',
}: {
  src: string;
  alt: string;
  aspect?: string;
  sizes?: string;
  priority?: boolean;
  contain?: boolean;
  className?: string;
}) {
  return (
    <div className={`mount ${className}`}>
      <div className={`relative overflow-hidden ${contain ? 'bg-white' : 'bg-raised'} ${aspect}`}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={contain ? 'object-contain p-4' : 'object-cover'} />
      </div>
    </div>
  );
}

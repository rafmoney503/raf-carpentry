import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui';
import { GAMES, GAMES_PAGE, playHref, readScore, scoreQuery, scoreWords } from '@/lib/workshop-games/site';

/* A shared score (25 Oct 2026): the link a player sends from the games' Share button, /tools/games/beat?g=...
   Its picture (./card) shows the score in WhatsApp; the page says what it is and opens the same game (the same
   level or board for a challenge). Everything is in the link: nothing is stored. Not in Google (every score is its
   own address); no floating buttons (LayoutShell). */

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const flat = (q: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const s = readScore(flat(await searchParams));
  const w = s ? scoreWords(s) : null;
  const title = w ? `${w.title}. Can you beat it? | Workshop Games` : 'Workshop Games: can you beat it? | Raf Carpentry';
  const description = w ? w.message.split('\n')[0] : 'Four free games about timber, nails and tape measures, from Raf Carpentry in London.';
  const q = s ? scoreQuery(s) : '';
  const image = { url: `${GAMES_PAGE}/beat/card${q ? `?${q}` : ''}`, width: 1200, height: 630, alt: w ? `${w.game}: ${w.title}` : 'Workshop Games' };
  return {
    title,
    description,
    alternates: { canonical: GAMES_PAGE },
    robots: { index: false, follow: true },
    openGraph: { title, description, url: `${GAMES_PAGE}/beat${q ? `?${q}` : ''}`, siteName: 'Raf Carpentry', locale: 'en_GB', type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default async function BeatPage({ searchParams }: Props) {
  const s = readScore(flat(await searchParams));
  const w = s ? scoreWords(s) : null;
  const q = s ? scoreQuery(s) : '';
  const game = s ? GAMES.find((g) => g.id === s.g) : null;

  return (
    <Container className="pb-16 pt-6 md:pb-24 md:pt-12">
      <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[13px] text-faint">
        <Link href="/tools" className="transition-colors hover:text-accent">Tools</Link>
        <span className="px-2 text-line-strong">/</span>
        <Link href={GAMES_PAGE} className="transition-colors hover:text-accent">Workshop Games</Link>
      </nav>
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <p className="font-mono text-[13px] text-accent">{w ? `A score from ${w.game}` : 'Workshop Games'}</p>
          <h1 className="mt-2 font-display text-[38px] font-[680] leading-[1.0] tracking-[-0.03em] md:text-[56px]">
            {w ? (
              <>
                {w.title}. <span className="text-accent">Can you beat it?</span>
              </>
            ) : (
              <>
                Can you <span className="text-accent">beat it?</span>
              </>
            )}
          </h1>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-muted">
            {w ? w.sub : 'Four short games about timber, nails and tape measures, with a new board and new tapes every day.'}
          </p>
          {game ? <p className="mt-3 max-w-[52ch] text-[15.5px] leading-relaxed text-muted">{game.line}</p> : null}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={playHref(s)} className="btn btn-primary gap-2">
              {w ? w.play : 'Play the games'} <span aria-hidden="true">→</span>
            </a>
            <Link href={GAMES_PAGE} className="btn btn-ghost">
              All four games
            </Link>
          </div>
          <p className="mt-5 max-w-[52ch] font-mono text-[12.5px] leading-relaxed text-faint">
            Free, no sign-up and no adverts. On your phone, it goes on the home screen and plays with no signal.
          </p>
        </div>
        <div className="lg:col-span-6">
          <div className="mount">
            {/* the same picture the link shows in WhatsApp */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${GAMES_PAGE}/beat/card${q ? `?${q}` : ''}`} alt={w ? `${w.game}: ${w.title}` : 'Workshop Games'} width={1200} height={630} className="block h-auto w-full" />
          </div>
        </div>
      </div>
    </Container>
  );
}

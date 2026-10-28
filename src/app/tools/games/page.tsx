import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Container } from '@/components/ui';
import { pageMeta, SITE_URL } from '@/lib/seo';
import { GAMES, GAMES_OPEN, GAMES_SCREENS, GAMES_SHORT, squares } from '@/lib/workshop-games/site';
import GamesInstallPanel, { GamesPhone } from './install-panel';
import { AddIcon, MenuIcon, ShareIcon } from '../workshop/install-panel';

/* Workshop Games (25 Oct 2026, Raf: 'Go' to the four games on the 'Workshop Games mockups' design canvas). The page
   for the games: what they are and how to put them on a phone. The games themselves are /tools/games/app (full
   screen); rafcarpentry.com/games comes here and the old /tools/timber-stack goes straight into Timber Stack
   (next.config.ts). No floating buttons (LayoutShell). */

const meta = pageMeta({
  title: 'Workshop Games: free carpentry games for your phone | Raf Carpentry',
  description: 'Five free games about timber, nails, tape measures and keeping things level: Measure Up, Sheet Saver, Timber Stack, Nail Pop and Level Best. New tapes and a new board every day, real sizes, no adverts, and they play with no signal.',
  path: '/tools/games',
  ownImage: true,
});
export const metadata = {
  ...meta,
  manifest: '/workshop-games.webmanifest',
  appleWebApp: { capable: true, title: 'Workshop Games', statusBarStyle: 'black-translucent' as const },
};

const POINTS = ['Free, no sign-up and no adverts', 'iPhone and Android, no app store', 'Plays with no signal once opened', 'New ones every day at midnight'];

const SHOTS: Record<string, { src: string; alt: string }> = {
  measure: GAMES_SCREENS.measure,
  sheet: GAMES_SCREENS.sheet,
  stack: GAMES_SCREENS.stack,
  nail: GAMES_SCREENS.nail,
  level: GAMES_SCREENS.level,
};

const IPHONE = [
  { t: 'Open the games', d: 'In Safari, open them from this page or type ' + GAMES_SHORT + '.' },
  { t: 'Tap Share', d: 'The square with the arrow. On newer iPhones it sits in the menu beside the address bar.', icon: 'share' },
  { t: 'Add to Home Screen', d: 'Scroll down the list, tap Add to Home Screen, then Add.', icon: 'add' },
];
const ANDROID = [
  { t: 'Open the games', d: 'In Chrome, open them from this page or type ' + GAMES_SHORT + '.' },
  { t: 'Install', d: 'Tap Install it on this page if it shows, or open the browser menu (the three dots).', icon: 'menu' },
  { t: 'Install app', d: 'Tap Install app or Add to Home screen. It shows up with your other apps.', icon: 'add' },
];

const FAQ = [
  { q: 'Is it really free?', a: 'Yes. All five games, every level, with no sign-up and no adverts.' },
  { q: 'Are the sizes real?', a: 'They are the sizes I work to: a 1981 mm door, a 900 mm worktop, a 2440 x 1220 sheet of ply, 47 mm sawn timber. The From my jobs pack in Measure Up is taken from things I have built.' },
  { q: 'What changes every day?', a: 'Measure Up has five new tapes and Sheet Saver a new board at midnight, London time, the same for everyone. Measure Up gets harder through the week: by the weekend more is hidden and the grid goes.' },
  { q: 'Does it work with no signal?', a: 'Yes, once the games have been opened with signal. They keep a copy on the phone, so they play in a loft, on the Tube or on a site with no reception.' },
  { q: 'How does Level Best know which way I tilt?', a: 'It reads the phone’s motion sensor. An iPhone asks once whether the games may use motion: tap Allow. Turn on rotation lock so the screen stays upright. On a computer, drag the board or use the arrow keys.' },
  { q: 'Where are my scores kept?', a: 'On your phone only: your stars, your best stack and your Measure Up streak. Nothing is sent anywhere. Share sends a link with the one score you chose to share.' },
  { q: 'Who made them?', a: 'Me, Raf, a carpenter in London. Something for the tea break, about the things I measure, cut and fix every day.' },
];

function StepIcon({ icon }: { icon?: string }) {
  if (icon === 'share') return <ShareIcon className="h-5 w-5" />;
  if (icon === 'add') return <AddIcon className="h-5 w-5" />;
  if (icon === 'menu') return <MenuIcon className="h-5 w-5" />;
  return null;
}

// an example of what Share sends after Measure Up, for the friends section
const EXAMPLE = [3, 12, 0, 48, 15];

export default async function WorkshopGamesPage() {
  const qrSvg = await QRCode.toString(`${SITE_URL}/games?utm_source=qr-games`, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#16191c', light: '#fbfbf9' },
  });

  return (
    <>
      <Container className="pb-16 pt-6 md:pb-20 md:pt-12">
        <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[13px] text-faint">
          <Link href="/tools" className="transition-colors hover:text-accent">Tools</Link>
          <span className="px-2 text-line-strong">/</span>
          <span>Workshop Games</span>
        </nav>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="font-mono text-[13px] text-accent">Free games · iPhone and Android</p>
            <h1 className="mt-2 font-display text-[40px] font-[680] leading-[0.98] tracking-[-0.03em] md:text-[60px]">
              Workshop <span className="text-accent">Games</span>
            </h1>
            <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-muted">
              Five short games about timber, nails, tape measures and keeping things level, with real sizes. Five new tapes and a new board every day, the same for everyone, so you can see who measures best.
            </p>
            <ul className="mt-5 grid max-w-[560px] gap-x-6 gap-y-1.5 text-[15.5px] text-ink sm:grid-cols-2">
              {POINTS.map((t) => (
                <li key={t} className="flex items-baseline gap-2.5">
                  <span aria-hidden="true" className="font-mono text-accent">+</span>
                  {t}
                </li>
              ))}
            </ul>
            <GamesInstallPanel qrSvg={qrSvg} />
          </div>
          <div className="lg:col-span-5">
            <GamesPhone />
          </div>
        </div>
      </Container>

      <section id="games" className="border-t border-line">
        <Container className="py-14 md:py-20">
          <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Five games</h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted">A minute or two each, with sounds you can turn off. Every one has levels to work through and stars to earn.</p>
          <ul className="mt-9 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-5 lg:gap-x-5">
            {GAMES.map((g) => (
              // on a phone the picture sits beside the words, from sm up above them
              <li key={g.id} className="grid grid-cols-[108px_minmax(0,1fr)] items-start gap-4 sm:flex sm:flex-col sm:gap-0">
                <a href={`${GAMES_OPEN}#/${g.id}`} className="group block sm:w-full" aria-label={`Play ${g.name}`}>
                  <div className="mount p-[6px] sm:p-[10px]">
                    <div className="relative aspect-[390/600] overflow-hidden bg-[#121518]">
                      <Image src={SHOTS[g.id].src} alt={SHOTS[g.id].alt} fill sizes="(min-width: 1024px) 19vw, (min-width: 640px) 46vw, 108px" className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]" />
                    </div>
                  </div>
                </a>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 sm:mt-4">
                    <h3 className="text-[19px] font-[650] leading-snug sm:text-[20px]">{g.name}</h3>
                    {g.daily ? <span className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] text-on-accent">Daily</span> : null}
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{g.line}</p>
                  <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-faint">{g.levels}</p>
                  <a href={`${GAMES_OPEN}#/${g.id}`} className="link-more mt-3 self-start">
                    Play {g.name} <span aria-hidden="true">→</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="friends" className="border-t border-line">
        <Container className="py-14 md:py-20">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-6">
              <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Beat your mates</h2>
              <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
                After a game, Share sends your score as a link, with a picture of it in WhatsApp. They tap it and play the same game: today&apos;s tapes, the same board or the same level.
              </p>
              <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-muted">
                The daily ones are the same for everyone in the country, so the whole site team can try today&apos;s board at break and compare.
              </p>
            </div>
            <div className="md:col-span-6">
              <div className="mx-auto max-w-[360px] rounded-[14px] border border-line-strong bg-mount p-4 shadow-[0_18px_40px_-24px_rgba(22,25,28,0.4)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">What Share sends</p>
                <div className="mt-3 rounded-[12px] rounded-tl-[4px] bg-raised px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                  <p>Measure Up, Sun 25 Oct: 78 mm off over 5 tapes.</p>
                  <p className="mt-1 font-mono text-[14px] tracking-[0.04em] text-accent" aria-label="Five rows of squares, one for each tape: more filled squares, closer to the real size">
                    {EXAMPLE.map(squares).join(' ')}
                  </p>
                  <p className="mt-1">Can you beat it?</p>
                  <p className="mt-1 break-all text-accent underline">rafcarpentry.com/tools/games/beat?g=measure…</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="install" className="border-t border-line bg-raised/50">
        <Container className="py-14 md:py-20">
          <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Put them on your phone</h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted">A few taps, once. After that they open from your home screen, full screen, like any other app.</p>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[{ title: 'iPhone', steps: IPHONE }, { title: 'Android', steps: ANDROID }].map((g) => (
              <div key={g.title} className="rounded-sm border border-line-strong bg-mount p-5 md:p-6">
                <h3 className="text-[21px] font-[620]">{g.title}</h3>
                <ol className="mt-4 grid gap-4">
                  {g.steps.map((s, i) => (
                    <li key={s.t} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong font-mono text-[13px] text-accent">{i + 1}</span>
                      <div>
                        <p className="flex items-center gap-2 text-[16px] font-[620] text-ink">
                          {s.t} <StepIcon icon={(s as { icon?: string }).icon} />
                        </p>
                        <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{s.d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <a href={GAMES_OPEN} className="btn btn-primary mt-8 gap-2">
            Play the games <span aria-hidden="true">→</span>
          </a>
        </Container>
      </section>

      <section className="border-t border-line">
        <Container className="py-14 md:py-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6">
            <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:col-span-4 md:text-[40px]">Questions</h2>
            <div className="md:col-span-8">
              {FAQ.map((f) => (
                <div key={f.q} className="border-t border-line py-5 first:border-t-0 first:pt-0">
                  <h3 className="text-[18px] font-[620]">{f.q}</h3>
                  <p className="mt-1.5 max-w-[64ch] text-[16px] leading-relaxed text-muted">{f.a}</p>
                </div>
              ))}
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6">
                <Link href="/tools/workshop" className="link-more">Workshop Tools app <span aria-hidden="true">→</span></Link>
                <Link href="/tools/spirit-level" className="link-more">Spirit level <span aria-hidden="true">→</span></Link>
                <Link href="/wardrobe-planner" className="link-more">Wardrobe planner <span aria-hidden="true">→</span></Link>
                <Link href="/tools" className="link-more">All my tools <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

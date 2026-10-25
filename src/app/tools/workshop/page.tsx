import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Container } from '@/components/ui';
import { TradeNudge } from '@/components/AlsoByMe';
import { pageMeta, SITE_URL } from '@/lib/seo';
import { APP_OPEN, APP_SCREENS, APP_SHORT, APP_TOOLS } from '@/lib/workshop-tools/site';
import InstallPanel, { AddIcon, MenuIcon, ShareIcon } from './install-panel';
import PhonePreview from './phone-preview';

/* Workshop Tools (25 Oct 2026, Raf: 'add Workshop Tool App to Tools in rafcarpentry ... so they can install it for
   free on ios or android'). The page for the app: what it does and how to put it on a phone. The app itself is
   /tools/workshop/app (full screen); rafcarpentry.com/app comes here (next.config.ts). No floating buttons
   (LayoutShell). Linked from the Tools page, the Tools menu, the footer, site search, the sitemap, /tips,
   /calculator, the trade posts on the blog and the thank-you email (AppNudge, brief-email.ts). */

const meta = pageMeta({
  title: 'Workshop Tools: a free carpentry app for your phone | Raf Carpentry',
  description: 'Free setting-out tools for iPhone and Android: hinges, drawer runners, unit sizes, panelling, flooring, stud walls, a calculator and mm to inches. Every size in mm, and it works with no signal.',
  path: '/tools/workshop',
  ownImage: true,
});
export const metadata = {
  ...meta,
  manifest: '/workshop-tools.webmanifest',
  appleWebApp: { capable: true, title: 'Workshop Tools', statusBarStyle: 'default' as const },
};

const POINTS = ['Free, with no sign-up', 'iPhone and Android, no app store', 'Works with no signal once opened', 'Jobs saved on your phone'];

const IPHONE = [
  { t: 'Open the app', d: 'In Safari, open the app from this page or type ' + APP_SHORT + '.' },
  { t: 'Tap Share', d: 'The square with the arrow. On newer iPhones it sits in the menu beside the address bar.', icon: 'share' },
  { t: 'Add to Home Screen', d: 'Scroll down the list, tap Add to Home Screen, then Add.', icon: 'add' },
];
const ANDROID = [
  { t: 'Open the app', d: 'In Chrome, open the app from this page or type ' + APP_SHORT + '.' },
  { t: 'Install', d: 'Tap Install it on this page if it shows, or open the browser menu (the three dots).', icon: 'menu' },
  { t: 'Install app', d: 'Tap Install app or Add to Home screen. It shows up with your other apps.', icon: 'add' },
];

const FAQ = [
  { q: 'Is it really free?', a: 'Yes. Every tool, with no sign-up and no adverts. My kit links to the tools I use on Amazon: if you buy through one, I earn a small fee and it costs you nothing extra.' },
  { q: 'Does it work with no signal?', a: 'Yes, once it has been opened with signal. It keeps a copy of itself on the phone, so it opens in a basement, a loft or a new build with no reception.' },
  { q: 'Where are my saved jobs?', a: 'On your phone only. Tap Save in a tool and it comes back with every number as you left it. Nothing is sent anywhere.' },
  { q: 'Why is it not in the App Store?', a: 'It is a web app: it goes on your home screen straight from the browser, opens full screen like any other app and updates by itself. No store, no download to wait for.' },
  { q: 'Who made it?', a: 'Me, Raf, a carpenter in London. These are the sums I do on every job, put where I can reach them on site.' },
];

function StepIcon({ icon }: { icon?: string }) {
  if (icon === 'share') return <ShareIcon className="h-5 w-5" />;
  if (icon === 'add') return <AddIcon className="h-5 w-5" />;
  if (icon === 'menu') return <MenuIcon className="h-5 w-5" />;
  return null;
}

export default async function WorkshopToolsPage() {
  const qrSvg = await QRCode.toString(`${SITE_URL}/app?utm_source=qr-web`, {
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
          <span>Workshop Tools</span>
        </nav>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="font-mono text-[13px] text-accent">Free app · iPhone and Android</p>
            <h1 className="mt-2 font-display text-[40px] font-[680] leading-[0.98] tracking-[-0.03em] md:text-[60px]">
              Workshop <span className="text-accent">Tools</span>
            </h1>
            <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-muted">
              The setting-out I do on every job, on your phone: hinges, drawer runners, unit sizes, panelling, flooring and stud walls. Every size in mm, and it works with no signal on site.
            </p>
            <ul className="mt-5 grid max-w-[560px] gap-x-6 gap-y-1.5 text-[15.5px] text-ink sm:grid-cols-2">
              {POINTS.map((t) => (
                <li key={t} className="flex items-baseline gap-2.5">
                  <span aria-hidden="true" className="font-mono text-accent">+</span>
                  {t}
                </li>
              ))}
            </ul>
            <InstallPanel qrSvg={qrSvg} />
          </div>
          <div className="lg:col-span-5">
            <PhonePreview />
          </div>
        </div>
      </Container>

      <section className="border-t border-line">
        <Container className="py-14 md:py-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-6">
            <div className="md:col-span-4">
              <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Ten tools in one</h2>
              <p className="mt-3 max-w-[40ch] text-[16px] leading-relaxed text-muted">Type the sizes in, get the marks, the cuts and what to buy. Save a job and pick it up on site.</p>
            </div>
            <ol className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 md:col-span-8">
              {APP_TOOLS.map((t, i) => (
                <li key={t.name} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-line pt-4">
                  <span className="font-mono text-[13px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-[18px] font-[620] leading-snug">{t.name}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted">{t.line}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="-mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
            {[APP_SCREENS.stud, APP_SCREENS.stairs, APP_SCREENS.calc].map((s) => (
              <div key={s.src} className="mount w-[62vw] max-w-[260px] flex-none snap-start md:w-auto md:max-w-none">
                <div className="relative aspect-[390/600] overflow-hidden bg-[#f2efe7]">
                  <Image src={s.src} alt={s.alt} fill sizes="(min-width: 768px) 30vw, 62vw" className="object-cover object-top" />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="install" className="border-t border-line bg-raised/50">
        <Container className="py-14 md:py-20">
          <h2 className="font-display text-[30px] font-[650] leading-[1.06] tracking-[-0.025em] md:text-[40px]">Put it on your phone</h2>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-muted">A few taps, once. After that it opens from your home screen, full screen, like any other app.</p>
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
          <a href={APP_OPEN} className="btn btn-primary mt-8 gap-2">
            Open the app <span aria-hidden="true">→</span>
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
                <Link href="/tools/spirit-level" className="link-more">Spirit level <span aria-hidden="true">→</span></Link>
                <Link href="/tools/games" className="link-more">Workshop Games <span aria-hidden="true">→</span></Link>
                <Link href="/calculator" className="link-more">Workshop calculator <span aria-hidden="true">→</span></Link>
                <Link href="/tips" className="link-more">Workshop tips <span aria-hidden="true">→</span></Link>
                <Link href="/tools" className="link-more">All my tools <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <TradeNudge />
    </>
  );
}

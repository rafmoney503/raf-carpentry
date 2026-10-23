import Link from 'next/link';
import QRCode from 'qrcode';
import { Container } from '@/components/ui';
import { pageMeta, SITE_URL } from '@/lib/seo';
import SpiritLevel from './spirit-level';

/* The phone spirit level (17 Oct 2026). Linked from a card on the Tools page, the Tools menu, search and the
   sitemap. The level itself opens full screen on the phone; on a computer the page shows a code to scan.
   Saved readings go to /tools/readings (22 Oct 2026).
   No floating buttons here (LayoutShell). */

export const metadata = pageMeta({
  title: 'Spirit level on your phone | Free tool from Raf Carpentry',
  description: 'A free spirit level for your phone. Set zero on any surface, flip check for true level, see how many mm to pack up the low end, and save the readings to send on.',
  path: '/tools/spirit-level',
  ownImage: true,
});

const STEPS = [
  {
    title: 'Start it',
    text: 'Tap Start the level. An iPhone asks to use motion once each visit: tap Allow. Nothing leaves your phone.',
  },
  {
    title: 'On its edge or lying flat',
    text: 'Stand the phone on its long edge on whatever you are checking, or lay it flat on its back. It works out which, and keeps the screen on.',
  },
  {
    title: 'Set zero here',
    text: 'Put the phone on a surface and tap Set zero here. From then on it reads from that surface, so the buttons and the case stop mattering. Tilt it to match the surface, or to find an angle from it.',
  },
  {
    title: 'Flip check, for true level',
    text: 'Tap Flip check, turn the phone end for end on the same spot with the same edge down, then tap Second reading. The two readings cancel out the phone’s own error. It remembers the result for that edge.',
  },
  {
    title: 'How much to pack',
    text: 'Pick the length of what you are levelling: 600, 900, 1200 or 2400 mm, or tap the pencil and type your own. It says which end to raise and by how many mm.',
  },
  {
    title: 'Hands free',
    text: 'Tone beeps faster and louder as it gets near level, then holds one steady tone while it reads level. It plays with the phone on silent too, so music playing on the phone pauses while Tone is on. Speak says the mm out loud once the reading settles. Big numbers gives you a reading you can see from a step away.',
  },
  {
    title: 'Hold and Save',
    text: 'Hold freezes the reading for when you can’t see the screen. Save keeps it, with a name and a place, in Your readings, where you can send them all on WhatsApp in one go. They stay on your phone.',
  },
];

export default async function SpiritLevelPage() {
  const qrSvg = await QRCode.toString(`${SITE_URL}/tools/spirit-level`, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#16191c', light: '#fbfbf9' },
  });

  return (
    <Container className="pb-20 pt-6 md:pb-28 md:pt-12">
      <div className="mx-auto max-w-[720px]">
        <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[13px] text-faint">
          <Link href="/tools" className="transition-colors hover:text-accent">Tools</Link>
          <span className="px-2 text-line-strong">/</span>
          <span>Spirit level</span>
        </nav>
        <h1 className="font-display text-[34px] font-[680] leading-none tracking-[-0.03em] md:text-[44px]">Spirit level</h1>
        <p className="mb-6 mt-3 max-w-[56ch] text-[16px] leading-relaxed text-muted">
          Your phone as a level. Set zero on any surface, so the buttons and the case don&apos;t matter, then read the angle and how many mm to pack up the low end.
        </p>

        <SpiritLevel qrSvg={qrSvg} />

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-[24px] font-[650] tracking-[-0.02em]">How to use it</h2>
          <ol className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <span className="font-mono text-[13px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-[17px] font-[620] leading-snug">{s.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="font-display text-[24px] font-[650] tracking-[-0.02em]">How accurate is it?</h2>
          <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-muted">
            A phone reads to about a tenth of a degree, which is about 1.7 mm over a metre. That&apos;s good for checking and setting out. For a long run, stand the phone on a straight edge and read that, and for the final fix check with a proper level.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            <Link href="/calculator" className="link-more">Workshop calculator <span aria-hidden="true">→</span></Link>
            <Link href="/tips" className="link-more">Workshop tips <span aria-hidden="true">→</span></Link>
            <Link href="/tools" className="link-more">All my tools <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </div>
    </Container>
  );
}

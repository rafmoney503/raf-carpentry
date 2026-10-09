import Link from 'next/link';
import { Container } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import TimberStackGame from './timber-stack-game';

/* Timber Stack, a free game (Raf's idea, 9 Oct 2026). Linked from a card on the Tools page.
   The game is on its own page so it can fill a phone screen; no floating buttons here (LayoutShell). */

export const metadata = pageMeta({
  title: 'Timber Stack | A free game from Raf Carpentry',
  description: 'Drop each board on the stack. Whatever hangs over gets cut off. How high can you go?',
  path: '/tools/timber-stack',
  ownImage: true,
});

export default function TimberStackPage() {
  return (
    <Container className="pb-20 pt-6 md:pb-28 md:pt-12">
      <div className="mx-auto max-w-[560px]">
        <nav aria-label="Breadcrumb" className="mb-3 font-mono text-[13px] text-faint">
          <Link href="/tools" className="transition-colors hover:text-accent">Tools</Link>
          <span className="px-2 text-line-strong">/</span>
          <span>Timber Stack</span>
        </nav>
        <h1 className="font-display text-[34px] font-[680] leading-none tracking-[-0.03em] md:text-[44px]">Timber Stack</h1>
        <p className="mb-5 mt-3 text-[16px] text-muted">Cut each board where it hangs over. How high can you stack?</p>

        <TimberStackGame />

        <section className="mt-10 border-t border-line pt-8">
          <h2 className="font-display text-[24px] font-[650] tracking-[-0.02em]">How to play</h2>
          <ul className="mt-4 space-y-2.5 text-[16px] leading-relaxed text-muted">
            <li>A board slides in from the right. Tap the screen, click, or press Space to drop it.</li>
            <li>Any part hanging over the board below is cut off, so the next board is narrower.</li>
            <li>Line it up to within 6 mm for a perfect drop. Three perfect drops in a row and the board grows back 20 mm.</li>
            <li>Miss the stack completely and it is over. The boards speed up as the stack grows.</li>
          </ul>
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

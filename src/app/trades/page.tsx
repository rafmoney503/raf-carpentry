import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import CtaBand from '@/components/CtaBand';
import OpenSketch from '@/components/OpenSketch';
import { MENU } from '@/lib/menu';
import { TRADES, statusClass } from '@/lib/content';

const item = MENU.find((m) => m.href === '/trades')!;

export const metadata: Metadata = {
  title: 'Trades',
  description: 'Systems for decorators, carpenters, kitchen fitters, builders, electricians and plumbers: where the time goes in each trade, and what a system does about it.',
  alternates: { canonical: '/trades' },
};

export default function Trades() {
  return (
    <>
      <PageHeader item={item} title="Trades that measure, quote and chase." lead="Where the time goes in each trade, and what a system does about it. Running means I use it every day; Ask me means I'd build it with you." />

      {TRADES.map((t, i) => (
        <section key={t.id} id={t.id} className={`section${i % 2 ? ' white' : ''}`}>
          <div className="wrap">
            <div className="trade-head">
              <h2 className="h2">{t.name}</h2>
              <span className={statusClass(t.status)}>{t.status}</span>
            </div>
            <p className="lead" style={{ maxWidth: '56ch', marginBottom: 28 }}>
              {t.short}
            </p>
            <div className="trade-cols">
              <div className="card">
                <p className="kicker">Where the time goes</p>
                <ul className="ticks minus">
                  {t.time.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <p className="kicker">What the system does</p>
                <ul className="ticks">
                  {t.system.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="hero-actions" style={{ marginTop: 20 }}>
              <OpenSketch className="btn" preset={{ trade: t.trade }}>
                Sketch mine
              </OpenSketch>
              {t.link ? (
                <Link href={t.link.href} className="btn btn-ghost">
                  {t.link.label}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ))}

      <CtaBand />
    </>
  );
}

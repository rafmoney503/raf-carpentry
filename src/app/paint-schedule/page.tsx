import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import CtaBand from '@/components/CtaBand';
import PaintCalc from '@/components/PaintCalc';
import OpenSketch from '@/components/OpenSketch';
import { SectionHead } from '@/components/blocks';
import { DoorCoats, SpiritLevel } from '@/components/motion-pieces';
import { MENU } from '@/lib/menu';

const item = MENU.find((m) => m.href === '/paint-schedule')!;

export const metadata: Metadata = {
  title: 'Paint schedule for decorators',
  description: 'Work out paint litres and tins from doors, fronts and panels, by brush or spray. A free calculator from the decorator system being built by Rafal Solutions.',
  alternates: { canonical: '/paint-schedule' },
};

export default function PaintSchedule() {
  return (
    <>
      <PageHeader item={item} title="Paint litres from the drawing." lead="For decorators who paint by hand and spray. Being built with a London decorator; the calculator below works today." />

      <section id="calculator" className="section">
        <div className="wrap">
          <PaintCalc />
        </div>
      </section>

      <section id="sums" className="section white">
        <div className="wrap">
          <SpiritLevel className="level-top" />
          <SectionHead kicker="How the sums work" title="Area, coats, coverage, what lands." whisper="Same four numbers a decorator works out in their head, written down." />
          <div className="sums">
            <div className="card">
              <p className="kicker">The sum</p>
              <p className="formula">
                litres = m² × coats ÷ coverage ÷ <span className="hl">share that lands</span>
              </p>
              <DoorCoats />
              <ul className="ticks">
                <li>Doors and fronts: both faces plus the four 18 mm edges</li>
                <li>Panels, plinths and fillers: one face</li>
                <li>Coverage from the tin: here 10 m²/L primer, 12 m²/L top coat</li>
                <li>Share that lands: about 95% by brush and roller, about 65% with an HVLP gun</li>
              </ul>
            </div>
            <div className="card">
              <p className="kicker">Worked example</p>
              <table className="sum-table">
                <tbody>
                  <tr>
                    <td>4 tall doors, 600 × 2000</td>
                    <td>10.0 m²</td>
                  </tr>
                  <tr>
                    <td>6 drawer fronts, 600 × 400</td>
                    <td>3.1 m²</td>
                  </tr>
                  <tr>
                    <td>End panels and plinth</td>
                    <td>4.0 m²</td>
                  </tr>
                  <tr className="total">
                    <td>Paintable area</td>
                    <td>17.1 m²</td>
                  </tr>
                  <tr>
                    <td>Top coat, 2 coats, brush</td>
                    <td>17.1 × 2 ÷ 12 ÷ 0.95 = 3.0 L</td>
                  </tr>
                  <tr>
                    <td>Top coat, 2 coats, spray</td>
                    <td>17.1 × 2 ÷ 12 ÷ 0.65 = 4.4 L</td>
                  </tr>
                </tbody>
              </table>
              <p className="small muted">Spraying the same wardrobes takes about 1.4 L more top coat. The schedule tells you before you start, not halfway through.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="app" className="section">
        <div className="wrap">
          <SectionHead kicker="Being built" title="The decorator's app, fed by the carpenter's drawing." whisper="The carpenter draws it in CabinetOS; the decorator gets the paint list." />
          <div className="app-row">
            <div className="phone-mock" role="img" aria-label="Paint schedule app on a phone: bedroom wardrobes from CabinetOS, 17.1 square metres, 2.6 litres primer and 4.4 litres top coat sprayed">
              <div className="pm-top">
                <span className="mono small muted">‹ Jobs</span>
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--muted)' }}>
                  PAINT SCHEDULE
                </span>
              </div>
              <b className="pm-title">Bedroom wardrobes</b>
              <span className="small muted">From CabinetOS · 4 units</span>
              <div className="pm-chips">
                <span>Brush</span>
                <span className="on">Spray (HVLP)</span>
              </div>
              <div className="pm-list">
                <div>
                  <span>Tall doors × 4</span>
                  <span>10.0 m²</span>
                </div>
                <div>
                  <span>Drawer fronts × 6</span>
                  <span>3.1 m²</span>
                </div>
                <div>
                  <span>Panels and plinth</span>
                  <span>4.0 m²</span>
                </div>
                <div className="pm-total">
                  <span>Paintable area</span>
                  <span>17.1 m²</span>
                </div>
              </div>
              <div className="pm-litres">
                <div>
                  <span className="small muted">Primer</span>
                  <b>2.6 L</b>
                </div>
                <div>
                  <span className="small muted">Top coat</span>
                  <b>
                    <span className="hl">4.4 L</span>
                  </b>
                </div>
              </div>
              <div className="pm-buy">
                <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--muted)' }}>
                  SHOPPING LIST
                </span>
                <div>
                  <span>Primer</span>
                  <span className="mono">1 × 2.5 L + 1 × 1 L</span>
                </div>
                <div>
                  <span>Top coat, satin</span>
                  <span className="mono">1 × 5 L</span>
                </div>
              </div>
              <span className="pm-btn">Add to quote</span>
            </div>
            <div className="app-text">
              <ul className="ticks">
                <li>The carpenter sends the job from CabinetOS: every door, front and panel with its size</li>
                <li>The decorator picks the paint, the coats and brush or spray</li>
                <li>Litres, tins and a shopping list, then the price on the quote</li>
                <li>Walls and ceilings come next: wall area less doors and windows</li>
              </ul>
              <OpenSketch className="btn" preset={{ trade: 'Decorator', pain: 'Working out materials' }}>
                I&apos;m a decorator: sketch mine
              </OpenSketch>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import HeroSearch from '@/components/HeroSearch';
import OpenSketch from '@/components/OpenSketch';
import CtaBand from '@/components/CtaBand';
import SystemsBand from '@/components/SystemsBand';
import { SectionHead, TodayMock } from '@/components/blocks';
import { CarryDiagram } from '@/components/motion-pieces';
import { MENU, tagHref } from '@/lib/menu';
import { TRADES, statusClass } from '@/lib/content';
import { IMG } from '@/lib/site';

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section id="top" className="hero grid-paper">
        <div className="wrap hero-row">
          <div className="hero-text">
            <p className="kicker">Rafal Solutions Ltd · London</p>
            <h1 className="h1">
              Systems for trade businesses. <span className="hl">Built by a carpenter.</span>
            </h1>
            <p className="lead">I turn your quoting, chasing and paperwork into simple phone tools, connected to ServiceM8 and tested on my own jobs first.</p>
            <HeroSearch />
            <div className="hero-actions">
              <OpenSketch className="btn">
                <span className="dot" aria-hidden="true" />
                Sketch my system in 60 seconds
              </OpenSketch>
              <Link href="/how-it-works#enquiry" className="btn btn-ghost">
                See one enquiry, start to finish
              </Link>
            </div>
            <CarryDiagram label="One enquiry, typed once" className="carry-hero" />
          </div>
          <div className="hero-art">
            <div className="stack">
              <div className="mount">
                <Image src={IMG.cabinetosBuild} alt="CabinetOS build screen: a bedroom job with two wardrobes, a chest of drawers and a night stand, 3100 mm wide" width={2400} height={1500} priority sizes="(min-width: 1000px) 540px, 90vw" />
              </div>
              <div className="phone">
                <Image src={IMG.cabinetosPhone} alt="CabinetOS on a phone: sheet 1 of 10, a 2440 by 1220 board laid out with 9% waste" width={780} height={1688} sizes="(min-width: 1000px) 170px, 28vw" />
              </div>
              <p className="tag-note">CabinetOS · live · free plan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section className="facts" aria-label="In numbers">
        <div className="wrap facts-grid">
          <div className="fact">
            <strong>22+ years</strong>
            <span>On the tools in London: wardrobes, kitchens, doors, floors</span>
          </div>
          <div className="fact">
            <strong>10 boards, 9%</strong>
            <span>Waste on the CabinetOS demo job, 85 parts nested</span>
          </div>
          <div className="fact">
            <strong>31 jobs in 3D</strong>
            <span>Every finished job on rafcarpentry.com, turn and open</span>
          </div>
          <div className="fact">
            <strong>0 retyping</strong>
            <span>From a website brief to a ServiceM8 job, photos included</span>
          </div>
        </div>
      </section>

      {/* What a system does: the two moving scenes taking turns */}
      <SystemsBand />

      {/* Running today */}
      <section className="section">
        <div className="wrap">
          <SectionHead kicker="Running today" title="Three systems already doing the work." whisper="Each one started as an evening I lost to paperwork." />
          <div className="three">
            <Link href="/systems#cabinetos" className="card card-link">
              <div className="well">
                <Image src={IMG.cabinetos3d} alt="CabinetOS 3D view of a bedroom job" width={2400} height={1500} sizes="(min-width: 1000px) 380px, 90vw" />
              </div>
              <span className="pill live">Live · free plan</span>
              <h3 className="h3">CabinetOS</h3>
              <p className="body">Cut lists, board layouts and drawings for wardrobe and cabinet makers.</p>
              <span className="link-more">
                See it <span aria-hidden="true">→</span>
              </span>
            </Link>
            <Link href="/systems#job-kit" className="card card-link">
              <TodayMock />
              <span className="pill live">Runs Raf Carpentry every day</span>
              <h3 className="h3">Job Kit</h3>
              <p className="body">Enquiries, diary, emails and money owed on my phone, connected to ServiceM8.</p>
              <span className="link-more">
                See it <span aria-hidden="true">→</span>
              </span>
            </Link>
            <Link href="/systems#planner" className="card card-link">
              <div className="well">
                <Image src={IMG.planner} alt="Wardrobe planner 3D view with the doors open" width={1280} height={960} sizes="(min-width: 1000px) 380px, 90vw" />
              </div>
              <span className="pill live">Live on rafcarpentry.com</span>
              <h3 className="h3">Wardrobe planner</h3>
              <p className="body">Customers plan in 3D; you get the ServiceM8 job and the cut list.</p>
              <span className="link-more">
                See it <span aria-hidden="true">→</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Where to start: the same pages and sections as the menu */}
      <section className="section white">
        <div className="wrap">
          <SectionHead kicker="Where to start" title="Pick the page that sounds like your week." whisper="Every # jumps straight to that part of the page." />
          <div className="start-grid">
            {MENU.filter((m) => m.href !== '/systems').map((m) => (
              <div key={m.href} className="start-card">
                <p className="kicker">{m.kicker}</p>
                <Link href={m.href} className="start-title">
                  {m.title}
                </Link>
                <p className="body small" style={{ fontSize: 15 }}>
                  {m.line}
                </p>
                <div className="tags">
                  {m.tags.map((t) => (
                    <Link key={t.id} href={tagHref(m, t)} className="tag">
                      <span aria-hidden="true">#</span>
                      {t.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trades, short */}
      <section className="section">
        <div className="wrap">
          <SectionHead kicker="Who I build for" title="Trades that measure, quote and chase." whisper="Trade not listed? Tell me how your day goes." />
          <div className="trades">
            {TRADES.map((t) => (
              <Link key={t.id} href={`/trades#${t.id}`} className="trade card-link">
                <div className="trade-top">
                  <h3>{t.name}</h3>
                  <span className={statusClass(t.status)}>{t.status}</span>
                </div>
                <p className="body" style={{ fontSize: 15 }}>
                  {t.short}
                </p>
                <span className="link-more" style={{ marginTop: 'auto' }}>
                  Where the time goes <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

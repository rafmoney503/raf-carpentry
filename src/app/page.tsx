import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import OpenSketch from '@/components/OpenSketch';
import CtaBand from '@/components/CtaBand';
import SystemsBand from '@/components/SystemsBand';
import { TodayMock } from '@/components/blocks';
import HeroSteps from '@/components/home/HeroSteps';
import EnquiryClimb from '@/components/home/EnquiryClimb';
import TiltCard from '@/components/home/TiltCard';
import CountUp from '@/components/home/CountUp';
import ScrollZoom from '@/components/home/ScrollZoom';
import TradesRow from '@/components/home/TradesRow';
import { IMG } from '@/lib/site';

/* Words that rise into place one after another when the page opens (CSS only, so they are there without JavaScript
   and stay still for people who ask for less motion). */
function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="w">
            <span className="wi" style={{ '--d': `${(delay + i * 0.06).toFixed(2)}s` } as React.CSSProperties}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  );
}

const rise = (d: number) => ({ '--d': `${d}s` }) as React.CSSProperties;

export default function Home() {
  return (
    <>
      {/* Hero: the 3D steps behind the words */}
      <section id="top" className="nh" aria-labelledby="nh-title">
        <HeroSteps />
        <div className="wrap nh-text">
          <div className="nh-inner">
            <p className="kicker nh-in" style={rise(0.05)}>
              Rafal Solutions Ltd · London
            </p>
            <h1 className="h1 nh-title" id="nh-title">
              <span className="ln">
                <Words text="Systems for trade businesses." delay={0.12} />
              </span>{' '}
              <span className="ln hl">
                <Words text="Built by a carpenter." delay={0.42} />
              </span>
            </h1>
            <p className="lead nh-lead nh-in" style={rise(0.75)}>
              I turn your quoting, chasing and paperwork into simple phone tools, connected to ServiceM8 and tested on my own jobs first.
            </p>
            <div className="nh-actions nh-in" style={rise(0.9)}>
              <OpenSketch className="btn">
                <span className="dot" aria-hidden="true" />
                Sketch my system in 60 seconds
              </OpenSketch>
              <Link href="#enquiry" className="btn btn-ghost">
                See one enquiry, start to finish
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* In numbers */}
      <section className="nf" aria-label="In numbers">
        <div className="wrap">
          <div className="nf-row">
            <div className="nf-fact" data-reveal>
              <b>
                <CountUp to={22} />
                <i>+</i>
              </b>
              <span>Years on the tools in London: wardrobes, kitchens, doors, floors</span>
            </div>
            <div className="nf-fact" data-reveal style={rise(0.08)}>
              <b>
                <CountUp to={9} />
                <i>%</i>
              </b>
              <span>Waste on the CabinetOS demo job: 10 boards, 85 parts nested</span>
            </div>
            <div className="nf-fact" data-reveal style={rise(0.16)}>
              <b>
                <CountUp to={31} />
              </b>
              <span>Every finished job on rafcarpentry.com in 3D, to turn and open</span>
            </div>
            <div className="nf-fact" data-reveal style={rise(0.24)}>
              <b>0</b>
              <span>Retyping, from a website brief to a ServiceM8 job, photos included</span>
            </div>
          </div>
        </div>
      </section>

      {/* One enquiry: the ball climbs eight steps as the page scrolls */}
      <EnquiryClimb />

      {/* What a system does: the two moving scenes taking turns */}
      <SystemsBand />

      {/* Running today */}
      <section className="section" id="running">
        <div className="wrap">
          <div className="nb-head" data-reveal>
            <p className="kicker">Running today</p>
            <h2 className="h2">Three systems already doing the work.</h2>
            <p className="whisper">Each one started as an evening I lost to paperwork.</p>
          </div>
          <div className="nb">
            <TiltCard href="/systems#cabinetos" className="nb-cab">
              <div className="nb-cab-media">
                <div className="nb-screen">
                  <Image src={IMG.cabinetos3d} alt="CabinetOS 3D view of a bedroom job: two wardrobes, a chest of drawers and a night stand" width={2400} height={1500} sizes="(min-width: 1000px) 640px, 90vw" />
                </div>
                <div className="nb-phone">
                  <Image src={IMG.cabinetosPhone} alt="CabinetOS on a phone: sheet 1 of 10, a 2440 by 1220 board laid out with 9% waste" width={780} height={1688} sizes="(min-width: 1000px) 150px, 26vw" />
                </div>
              </div>
              <div className="nb-text">
                <span className="pill live">Live · free plan</span>
                <h3 className="h3">CabinetOS</h3>
                <p className="body">Cut lists, board layouts and drawings for wardrobe and cabinet makers.</p>
                <span className="link-more">
                  See it <span aria-hidden="true">→</span>
                </span>
              </div>
            </TiltCard>
            <TiltCard href="/systems#job-kit" className="nb-kit">
              <div className="nb-text">
                <span className="pill live">Runs Raf Carpentry every day</span>
                <h3 className="h3">Job Kit</h3>
                <p className="body">Enquiries, diary, emails and money owed on my phone, connected to ServiceM8.</p>
                <span className="link-more">
                  See it <span aria-hidden="true">→</span>
                </span>
              </div>
              <TodayMock />
            </TiltCard>
            <TiltCard href="/systems#planner" className="nb-plan">
              <div className="nb-shot">
                <Image src={IMG.planner} alt="Wardrobe planner 3D view with the doors open" width={1280} height={960} sizes="(min-width: 1000px) 260px, 90vw" />
              </div>
              <div className="nb-text">
                <span className="pill live">Live on rafcarpentry.com</span>
                <h3 className="h3">Wardrobe planner</h3>
                <p className="body">Customers plan in 3D; you get the ServiceM8 job and the cut list.</p>
                <span className="link-more">
                  See it <span aria-hidden="true">→</span>
                </span>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Tested on my own jobs */}
      <section className="section na" aria-labelledby="na-title">
        <div className="wrap na-row">
          <ScrollZoom className="na-photo">
            <div className="na-zoom">
              <Image src={IMG.rafAtWork} alt="Rafal marking a board on the bench with a yellow tape measure" fill sizes="(min-width: 900px) 40vw, 92vw" style={{ objectFit: 'cover' }} />
            </div>
          </ScrollZoom>
          <div className="na-text">
            <h2 className="h2" id="na-title" data-reveal>
              Tested on my own jobs <span className="hl">first.</span>
            </h2>
            <p className="lead" data-reveal style={rise(0.08)}>
              Wardrobes, kitchens, doors and floors, across London. Every system on this site runs Raf Carpentry before it runs your business.
            </p>
            <Link href="/about" className="link-more" data-reveal style={rise(0.16)}>
              About me <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Who I build for */}
      <TradesRow />

      <CtaBand />
    </>
  );
}

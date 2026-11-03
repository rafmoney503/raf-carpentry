import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import OpenSketch from '@/components/OpenSketch';
import CtaBand from '@/components/CtaBand';
import PostCard from '@/components/PostCard';
import { TodayMock } from '@/components/blocks';
import HeroSteps from '@/components/home/HeroSteps';
import EnquiryClimb from '@/components/home/EnquiryClimb';
import StepsLadder from '@/components/home/StepsLadder';
import TiltCard from '@/components/home/TiltCard';
import CountUp from '@/components/home/CountUp';
import ScrollZoom from '@/components/home/ScrollZoom';
import { POSTS } from '@/content/blog/posts';
import { IMG } from '@/lib/site';
import { STEPS5 } from '@/lib/steps';

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
      {/* Hero: the 3D steps in the five colours behind the words */}
      <section id="top" className="nh" aria-labelledby="nh-title">
        <HeroSteps />
        <div className="wrap nh-text">
          <div className="nh-inner">
            <p className="kicker nh-in" style={rise(0.05)}>
              Rafal Solutions Ltd · London
            </p>
            <h1 className="h1 nh-title" id="nh-title">
              <span className="ln">
                <Words text="Software for people who" delay={0.12} />
              </span>{' '}
              <span className="ln">
                <span className="hl">
                  <Words text="build things." delay={0.42} />
                </span>
              </span>
            </h1>
            <p className="lead nh-lead nh-in" style={rise(0.75)}>
              Five tools that cover a whole job, from your first 3D click to a fitted, paid-for wardrobe. Made in a working London workshop by a carpenter of 22 years, and used on his own jobs first.
            </p>
            <div className="nh-actions nh-in" style={rise(0.9)}>
              <OpenSketch className="btn">
                <span className="dot" aria-hidden="true" />
                Start a project
              </OpenSketch>
              <Link href="#steps" className="btn btn-ghost">
                See the five steps
              </Link>
            </div>
            <nav className="nh-ladder nh-in" style={rise(1.05)} aria-label="The five steps">
              {STEPS5.map((s) => (
                <Link key={s.id} href={`#${s.id}`} className="nh-rung" data-c={s.id}>
                  <i aria-hidden="true" />
                  <span>{s.verb}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </section>

      {/* The five steps: a staircase of cards, the ball hops from plank to plank */}
      <section className="section five" id="steps" aria-labelledby="five-title">
        <div className="wrap">
          <div className="five-head" data-reveal>
            <p className="kicker">Five steps, one workshop</p>
            <h2 className="h2" id="five-title">
              Every step of a job, <span className="hl">covered.</span>
            </h2>
            <p className="whisper">Start wherever you are. Three of the five are free to use.</p>
          </div>
          <StepsLadder />
        </div>
      </section>

      {/* One job through all five */}
      <section className="section chain" aria-labelledby="chain-title">
        <div className="wrap">
          <div className="five-head" data-reveal>
            <p className="kicker">One job, start to finish</p>
            <h2 className="h2" id="chain-title">
              Each tool hands the job <span className="hl">to the next.</span>
            </h2>
            <p className="whisper">Nothing is typed twice. That&apos;s how Raf Carpentry&apos;s own wardrobes are made.</p>
          </div>
          <ol className="chain-row">
            {STEPS5.map((s, i) => (
              <li key={s.id} className="chain-step" data-c={s.id} data-reveal style={rise(i * 0.08)}>
                <span className="chain-dot" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="chain-verb">{s.verb}</span>
                <b>{s.flow.title}</b>
                <span className="chain-sub">{s.flow.sub}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* In numbers */}
      <section className="nf" aria-label="In numbers">
        <div className="wrap">
          <div className="nf-row">
            <div className="nf-fact" data-reveal data-c="learn">
              <b>
                <CountUp to={22} />
                <i>+</i>
              </b>
              <span>Years on the tools in London: wardrobes, kitchens, doors, floors</span>
            </div>
            <div className="nf-fact" data-reveal data-c="make" style={rise(0.08)}>
              <b>
                3<i> of 5</i>
              </b>
              <span>Free to use: Build It in 3D, Workshop Tools and the CabinetOS free plan</span>
            </div>
            <div className="nf-fact" data-reveal data-c="fit" style={rise(0.16)}>
              <b>
                <CountUp to={9} />
                <i>%</i>
              </b>
              <span>Waste on the CabinetOS demo job: 10 boards, 85 parts nested</span>
            </div>
            <div className="nf-fact" data-reveal data-c="run" style={rise(0.24)}>
              <b>0</b>
              <span>Retyping, from a website brief to a ServiceM8 job, photos included</span>
            </div>
          </div>
        </div>
      </section>

      {/* Step 5, Run: built for you */}
      <section className="run-intro" id="run-more" aria-labelledby="run-title">
        <div className="wrap run-intro-in" data-reveal>
          <p className="kicker">
            <span className="run-chip">05 · Run</span> Built for you
          </p>
          <h2 className="h2" id="run-title">
            Systems for trade businesses, <span className="hl">built by a carpenter.</span>
          </h2>
          <p className="lead" style={{ maxWidth: '50ch' }}>
            Websites, apps and systems joined up with what you already use, like ServiceM8. Here is one enquiry going through mine.
          </p>
          <div className="tags">
            <Link href="/systems" className="tag">
              <span aria-hidden="true">#</span>Systems running today
            </Link>
            <Link href="/servicem8" className="tag">
              <span aria-hidden="true">#</span>ServiceM8
            </Link>
            <Link href="/trades" className="tag">
              <span aria-hidden="true">#</span>Trades
            </Link>
            <Link href="/paint-schedule" className="tag">
              <span aria-hidden="true">#</span>Paint schedule
            </Link>
          </div>
        </div>
      </section>

      {/* One enquiry: the ball climbs eight steps as the page scrolls */}
      <EnquiryClimb />

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

      {/* From the blog */}
      <section className="section home-blog" aria-labelledby="hb-title">
        <div className="wrap">
          <div className="hb-head" data-reveal>
            <div>
              <p className="kicker">Notes from the workshop</p>
              <h2 className="h2" id="hb-title">
                Everyday problems, <span className="hl">made into tools.</span>
              </h2>
            </div>
            <Link href="/blog" className="link-more">
              All posts <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="post-grid">
            {POSTS.slice(0, 3).map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
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
            <p className="kicker" data-reveal>
              A carpenter built this. It actually works.
            </p>
            <h2 className="h2" id="na-title" data-reveal>
              Tested on my own jobs <span className="hl">first.</span>
            </h2>
            <p className="lead" data-reveal style={rise(0.08)}>
              Wardrobes, kitchens, doors and floors, across London. Every tool on this site runs Raf Carpentry before it runs your business.
            </p>
            <Link href="/about" className="link-more" data-reveal style={rise(0.16)}>
              About me <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import OpenSketch from '@/components/OpenSketch';
import CtaBand from '@/components/CtaBand';
import PostCard from '@/components/PostCard';
import StepIcon from '@/components/StepIcon';
import { POSTS } from '@/content/blog/posts';
import { FLOW } from '@/lib/content';
import { IMG } from '@/lib/site';
import { BUILDITIN3D_URL, STEPS5, type Step } from '@/lib/steps';

/* The home page, the pro version: a calm hero with the real product (CabinetOS in a browser window, the Job Kit's
   Today list on a phone), the tools it works with, the five tools as a grid, how they fit together, the numbers,
   the systems built for other businesses with one enquiry start to finish, who builds it, the latest posts and the
   dark Start a project card. No moving pieces; everything is plain HTML and CSS. */

const WORKS_WITH = ['ServiceM8', 'SketchUp', 'Microsoft 365', 'WhatsApp', 'Stripe', 'Google reviews'];

function Tick({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

function ToolCard({ s, wide = false }: { s: Step; wide?: boolean }) {
  const text = (
    <div className="tool-text">
      <div className="tool-top">
        <span className="tool-icon">
          <StepIcon step={s.id} />
        </span>
        <span className="tool-badge">{s.badge}</span>
      </div>
      <span className="tool-step">
        {s.n} · {s.verb}
      </span>
      <h3>{s.name}</h3>
      <p>{s.line}</p>
      {wide ? (
        <ul className="tool-points">
          {s.points.map((p) => (
            <li key={p}>
              <Tick />
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      <span className="tool-link">
        {s.linkLabel} <span aria-hidden="true">{s.external ? '↗' : '→'}</span>
        {s.external ? <span className="sr"> (opens in a new tab)</span> : null}
      </span>
    </div>
  );
  const body = wide ? (
    <>
      {text}
      <div className="tool-media">
        <Image src={IMG.cabinetosPhone} alt="CabinetOS on a phone: sheet 1 of 10, a 2440 by 1220 board laid out with 9% waste" width={780} height={1688} sizes="180px" style={{ width: 'auto', maxWidth: '100%', maxHeight: 340 }} />
      </div>
    </>
  ) : (
    text
  );
  const cls = `tool${wide ? ' wide' : ''}`;
  return s.external ? (
    <a id={s.id} href={s.href} target="_blank" rel="noopener" className={cls} data-c={s.id}>
      {body}
    </a>
  ) : (
    <Link id={s.id} href={s.href} className={cls} data-c={s.id}>
      {body}
    </Link>
  );
}

export default function Home() {
  const byId = Object.fromEntries(STEPS5.map((s) => [s.id, s])) as Record<Step['id'], Step>;
  return (
    <>
      {/* Hero */}
      <section id="top" className="ph" aria-labelledby="ph-title">
        <div className="wrap ph-row">
          <div className="ph-text">
            <a href={BUILDITIN3D_URL} target="_blank" rel="noopener" className="ph-badge">
              <b>Free</b>
              Build It in 3D: 3D lessons for every age <span aria-hidden="true">→</span>
            </a>
            <h1 className="h1 ph-title" id="ph-title">
              Software for people who build things.
            </h1>
            <p className="lead ph-lead">Five tools that take a job from the first 3D click to a fitted, paid-for wardrobe. Made in a working London workshop, and used on Raf Carpentry jobs first.</p>
            <div className="ph-actions">
              <OpenSketch className="btn">Start a project</OpenSketch>
              <Link href="#steps" className="btn btn-ghost">
                Explore the tools
              </Link>
            </div>
            <ul className="ph-trust">
              <li>
                <Tick />
                22 years on the tools
              </li>
              <li>
                <Tick />3 of 5 tools free
              </li>
              <li>
                <Tick />
                UK Ltd, company no. 13645392
              </li>
            </ul>
          </div>
          <div className="ph-visual">
            <div className="ph-window">
              <div className="ph-bar" aria-hidden="true">
                <span className="ph-dots">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="ph-url">app.cabinetos.co.uk</span>
              </div>
              <Image className="ph-shot" src={IMG.cabinetos3d} alt="CabinetOS 3D view of a bedroom job: two wardrobes, a chest of drawers and a night stand" width={2400} height={1500} sizes="(min-width: 1000px) 600px, 92vw" priority />
            </div>
            <div className="ph-phone" role="img" aria-label="The Job Kit's Today list on a phone: a new website brief, a 9:00 visit and a quote to follow up">
              <div className="ph-phone-top" aria-hidden="true">
                <b>Today</b>
                <span>Job Kit</span>
              </div>
              <div className="ph-row-item new" aria-hidden="true">
                <i>New</i>
                <span>Website brief with 3 photos</span>
              </div>
              <div className="ph-row-item" aria-hidden="true">
                <i>09:00</i>
                <span>Visit: fitted wardrobe, Crouch End</span>
              </div>
              <div className="ph-row-item" aria-hidden="true">
                <i>5 days</i>
                <span>Quote sent: follow up</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Works with */}
      <section className="works" aria-label="Works with">
        <div className="wrap works-row">
          <span>Works with the tools you already use</span>
          <div className="works-names">
            {WORKS_WITH.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </div>
      </section>

      {/* The five tools */}
      <section className="section" id="steps" aria-labelledby="tools-title" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="pro-head">
            <div>
              <p className="kicker">The tools</p>
              <h2 className="h2" id="tools-title">
                Five tools. One job, start to finish.
              </h2>
            </div>
            <p>Start wherever you are. Build It in 3D, the Workshop Tools and the CabinetOS free plan cost nothing.</p>
          </div>
          <div className="tools-grid">
            <ToolCard s={byId.make} wide />
            <ToolCard s={byId.learn} />
            <ToolCard s={byId.design} />
            <ToolCard s={byId.fit} />
            <ToolCard s={byId.run} />
          </div>
        </div>
      </section>

      {/* How they fit together */}
      <section className="fit-band" aria-labelledby="fit-title">
        <div className="wrap" style={{ paddingBlock: 'clamp(56px, 8vw, 88px)' }}>
          <div className="pro-head" style={{ marginBottom: 40 }}>
            <div>
              <p className="kicker">How they fit together</p>
              <h2 className="h2" id="fit-title">
                Each tool hands the job to the next. Nothing is typed twice.
              </h2>
            </div>
          </div>
          <ol className="fit-row">
            {STEPS5.map((s) => (
              <li key={s.id} data-c={s.id}>
                <span>
                  {s.n} {s.verb}
                </span>
                <b>{s.flow.title}</b>
                <em>{s.flow.sub}</em>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* In numbers */}
      <section className="wrap" aria-label="In numbers">
        <div className="pro-nums">
          <div>
            <b>22+</b>
            <span>Years on the tools in London: wardrobes, kitchens, doors, floors</span>
          </div>
          <div>
            <b>3 of 5</b>
            <span>Tools free to use, from the first lesson to the site tools</span>
          </div>
          <div>
            <b>9%</b>
            <span>Waste on the CabinetOS demo job: 85 parts on 10 boards</span>
          </div>
          <div>
            <b>0</b>
            <span>Retyping, from a website brief to a ServiceM8 job</span>
          </div>
        </div>
      </section>

      {/* Built for you */}
      <section className="section built" id="built" aria-labelledby="built-title">
        <div className="wrap built-row">
          <div className="built-text">
            <p className="kicker">Built for you</p>
            <h2 className="h2" id="built-title">
              Systems for trade businesses, built by a carpenter.
            </h2>
            <p>Your quoting, chasing and paperwork turned into simple phone tools, joined up with ServiceM8, Outlook and WhatsApp. Tested on my own business before it runs yours.</p>
            <ul className="check-list">
              <li>
                <Tick size={18} />A mockup on your phone in 2 days
              </li>
              <li>
                <Tick size={18} />
                Working in 2 to 4 weeks
              </li>
              <li>
                <Tick size={18} />
                Joined up with ServiceM8
              </li>
              <li>
                <Tick size={18} />
                You own what I build
              </li>
            </ul>
            <div className="ph-actions" style={{ marginTop: 4 }}>
              <OpenSketch className="btn">Start a project</OpenSketch>
              <Link href="/systems" className="btn btn-ghost">
                See the systems
              </Link>
            </div>
          </div>
          <div className="flow-card">
            <div className="flow-card-top">
              <b>One enquiry, start to finish</b>
              <span>How Raf Carpentry runs today</span>
            </div>
            <ol>
              {FLOW.map((f, i) => (
                <li key={f.title} className={`${f.mine ? 'mine' : ''}${i === FLOW.length - 1 ? ' last' : ''}`}>
                  <i aria-hidden="true">{i + 1}</i>
                  <span>{f.title}</span>
                  <em>{f.mine ? 'One tap' : 'By itself'}</em>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Who builds it */}
      <section className="founder" id="about" aria-labelledby="founder-title">
        <div className="wrap founder-row" style={{ paddingBlock: 'clamp(56px, 8vw, 88px)' }}>
          <div className="founder-photo">
            <Image src={IMG.rafAtWork} alt="Rafal marking a board with a tape measure in the workshop" fill sizes="(min-width: 900px) 40vw, 92vw" style={{ objectFit: 'cover', objectPosition: '50% 30%' }} />
          </div>
          <div className="founder-text">
            <p className="kicker" id="founder-title">
              Who builds it
            </p>
            <blockquote>“Every tool here runs Raf Carpentry before it runs your business. If it doesn&apos;t save me time on a Monday morning, it doesn&apos;t leave the workshop.”</blockquote>
            <div className="founder-who">
              <i aria-hidden="true">RJ</i>
              <span>
                <b>Rafal Janczy</b>
                <span>Founder, Rafal Solutions Ltd · Carpenter, Raf Carpentry</span>
              </span>
            </div>
            <Link href="/about" className="link-more">
              About Rafal <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* From the workshop */}
      <section className="section" aria-labelledby="hb-title" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="pro-head">
            <div>
              <p className="kicker">From the workshop</p>
              <h2 className="h2" id="hb-title">
                Everyday problems, made into tools.
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

      <CtaBand />
    </>
  );
}

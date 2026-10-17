import Image from 'next/image';
import Link from 'next/link';
import OpenSketch from './OpenSketch';
import { FAQ, FLOW, INTEGRATIONS, STEPS } from '@/lib/content';
import { CABINETOS_URL, IMG, RAFCARPENTRY_URL } from '@/lib/site';

/* Sections shared by the home page and the inner pages. */

export function SectionHead({ kicker, title, whisper, id }: { kicker: string; title: React.ReactNode; whisper?: string; id?: string }) {
  return (
    <div className="section-head" id={id}>
      <div>
        <p className="kicker">{kicker}</p>
        <h2 className="h2">{title}</h2>
      </div>
      {whisper ? <p className="whisper">{whisper}</p> : null}
    </div>
  );
}

export function TodayMock() {
  return (
    <div className="well grid" role="img" aria-label="The Job Kit's Today screen, with example jobs">
      <div className="today" aria-hidden="true">
        <div className="today-top">
          <b>Today</b>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            Sat 17 Oct
          </span>
        </div>
        <div className="today-band">TO DO · 5 THINGS</div>
        <div className="today-row">
          <i className="blue">09:00</i>
          <span>Visit: fitted wardrobe, Crouch End</span>
        </div>
        <div className="today-row">
          <i>new</i>
          <span>Website brief with 3 photos</span>
        </div>
        <div className="today-row">
          <i>5 days</i>
          <span>Quote sent: follow up</span>
        </div>
        <div className="today-row">
          <i>£</i>
          <span>£1,350 left to collect</span>
        </div>
        <div className="today-row">
          <i>★</i>
          <span>Ask for a Google review</span>
        </div>
      </div>
    </div>
  );
}

export function CabinetosFeature({ more = false }: { more?: boolean }) {
  return (
    <article className="card feature">
      <div className="feature-img">
        <Image src={IMG.cabinetos3d} alt="CabinetOS 3D view in showroom mode: two wardrobes, a chest of drawers and a night stand with wood fronts" width={2400} height={1500} sizes="(min-width: 1000px) 640px, 90vw" />
      </div>
      <div className="feature-text">
        <span className="pill live">Live · free plan</span>
        <h3 className="h3" style={{ fontSize: 34 }}>
          CabinetOS
        </h3>
        <p className="body">Cut lists, board layouts and drawings for wardrobe and cabinet makers. I built it after a spreadsheet cut-list mistake cost me money on a job.</p>
        <ul className="ticks">
          <li>Demo job: 85 parts on 10 boards, 9% waste</li>
          <li>Front, side, top and 3D drawings</li>
          <li>Cut sheets and labels for the workshop</li>
          {more ? (
            <>
              <li>Showroom mode: finishes for the client, cut list unchanged</li>
              <li>Free plan, paid plans from £19 a month, VAT included</li>
            </>
          ) : null}
        </ul>
        <a href={CABINETOS_URL} target="_blank" rel="noopener" className="link-more">
          Open cabinetos.co.uk <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

export function JobKitCard({ more = false }: { more?: boolean }) {
  return (
    <article className="card">
      <TodayMock />
      <span className="pill live">Runs Raf Carpentry every day</span>
      <h3 className="h3">Job Kit</h3>
      <p className="body">The phone app I open every morning. Enquiries, diary, emails, texts and money owed, in the order they need doing.</p>
      <ul className="ticks">
        <li>Reads and writes my ServiceM8, nothing typed twice</li>
        <li>Replies drafted for me, sent only when I say</li>
        <li>Finished jobs ask for their review</li>
        {more ? (
          <>
            <li>Find any customer by name, mobile or postcode</li>
            <li>My info@ inbox on the same screen as the job</li>
            <li>Property facts before a visit: energy certificate, planning, last sale</li>
            <li>Job photos and clips sent from the van, posts made for Instagram and TikTok</li>
          </>
        ) : null}
      </ul>
    </article>
  );
}

export function PlannerCard() {
  return (
    <article className="card">
      <div className="well">
        <Image src={IMG.planner} alt="Wardrobe planner 3D view: three sage green units with the doors open, rails and shelves inside" width={1280} height={960} sizes="(min-width: 1000px) 560px, 90vw" />
      </div>
      <span className="pill live">Live on rafcarpentry.com</span>
      <h3 className="h3">Wardrobe planner to cut list</h3>
      <p className="body">Customers plan their wardrobe in 3D on the website. It arrives as a ServiceM8 job and a CabinetOS project with the cut list already worked out.</p>
      <ul className="ticks">
        <li>Sizes, units, doors and colour</li>
        <li>Thank-you email with designs like theirs</li>
        <li>Cut list ready before the site visit</li>
      </ul>
      <a href={`${RAFCARPENTRY_URL}/wardrobe-planner`} target="_blank" rel="noopener" className="link-more">
        Try the planner <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

export function FlowSection() {
  return (
    <div className="flow-wrap">
      <ol className="flow">
        {FLOW.map((s, i) => (
          <li key={s.title} className={`flow-step${s.mine ? ' mine' : ''}`}>
            <span className="flow-num" aria-hidden="true">
              {i + 1}
            </span>
            <div className="flow-body">
              <h3>{s.title}</h3>
              <p className="body" style={{ fontSize: 15.5 }}>
                {s.text}
              </p>
              <div className="flow-tags">
                {s.tags.map((t) => (
                  <span key={t} className={t === 'ServiceM8' ? 'pill live' : 'pill'}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <aside className="flow-aside" aria-label="What the customer and I type">
        <div className="counter">
          <span className="kicker">The customer types</span>
          <strong>1×</strong>
          <span className="small muted">Their brief, once, on the website.</span>
        </div>
        <div className="counter">
          <span className="kicker">I type</span>
          <strong>0×</strong>
          <span className="small muted">Their details. I read, check and press send.</span>
        </div>
        <OpenSketch className="btn">Sketch this for my trade</OpenSketch>
      </aside>
    </div>
  );
}

const STEP_SHAPES = ['circle', 'square', 'plus', 'ball'];

export function StepsList() {
  return (
    <ol className="steps" data-motion>
      {STEPS.map((s, i) => (
        <li key={s.title}>
          <span className="step-top">
            <i className={`step-shape ${STEP_SHAPES[i % STEP_SHAPES.length]}`} aria-hidden="true" />
            <span className="mono small muted">{s.when}</span>
          </span>
          <h3>{s.title}</h3>
          <p className="body" style={{ fontSize: 15.5 }}>
            {s.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function FaqList() {
  return (
    <div className="faq">
      {FAQ.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Sm8Grid() {
  return (
    <div className="sm8">
      <div id="reads">
        <span className="pill live">Reads</span>
        <h3>What the system sees</h3>
        <ul className="ticks">
          <li>Jobs by status: Quote, Work Order, Completed, Unsuccessful</li>
          <li>Clients and every contact on them</li>
          <li>Payments taken and what is left to pay</li>
          <li>The diary: visits, work days and who they are for</li>
          <li>Emails and texts on each job</li>
        </ul>
      </div>
      <div id="writes">
        <span className="pill built">Writes</span>
        <h3>What it does for you</h3>
        <ul className="ticks">
          <li>New clients, contacts and Quote jobs from your website</li>
          <li>Customer photos into the job diary</li>
          <li>Status changes: yes to Work Order, finished to Completed</li>
          <li>Bookings made, moved or cancelled</li>
          <li>Emails and texts sent from the job and filed on it</li>
        </ul>
      </div>
      <div id="rules">
        <span className="pill">Rules</span>
        <h3>What it never does</h3>
        <ul className="ticks">
          <li>Delete anything. A cancelled booking is archived and can be restored</li>
          <li>Send a message you haven&apos;t seen</li>
          <li>Send customer details anywhere except your phone, your server and ServiceM8</li>
        </ul>
      </div>
    </div>
  );
}

export function IntegrationsGrid() {
  return (
    <div className="integrations">
      {INTEGRATIONS.map((i) => (
        <div key={i.name} className="tile">
          <b>{i.name}</b>
          <span>{i.what}</span>
          <em>Used in: {i.where}</em>
        </div>
      ))}
    </div>
  );
}

export function NextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="link-more">
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

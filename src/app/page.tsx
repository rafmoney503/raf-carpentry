import Image from 'next/image';
import Header from '@/components/Header';
import HeroSearch from '@/components/HeroSearch';
import OpenSketch from '@/components/OpenSketch';
import PaintCalc from '@/components/PaintCalc';
import ContactForm from '@/components/ContactForm';
import SystemSketch from '@/components/SystemSketch';
import { ADDRESS, CABINETOS_URL, COMPANY, COMPANY_NO, EMAIL, IMG, PHONE_DISPLAY, PHONE_HREF, RAFCARPENTRY_URL, VAT_NO, whatsappUrl } from '@/lib/site';

const FLOW = [
  { title: 'The customer sends their brief', text: 'From the website: what they want, rough sizes, photos of the room. Or a 3D wardrobe they planned themselves.', tags: ['Website'], mine: false },
  { title: 'ServiceM8 fills itself in', text: 'A client, a contact and a Quote job are made, with their photos in the job diary. No typing.', tags: ['ServiceM8'], mine: false },
  { title: 'They get a thank-you straight away', text: 'An email with three designs like theirs, sent through ServiceM8 and filed on the job.', tags: ['ServiceM8', 'Email'], mine: false },
  { title: 'The design becomes a cut list', text: 'A wardrobe planned on the website arrives as a CabinetOS project with the parts already worked out.', tags: ['CabinetOS'], mine: false },
  { title: 'My phone puts it at the top of Today', text: '"New enquiry" sits above the visits, follow-ups and money owed, in the order things need doing.', tags: ['Job Kit'], mine: true },
  { title: 'Claude drafts the reply; I press send', text: 'A first draft in my words, using what they wrote. Nothing goes until I have read it.', tags: ['Claude', 'Outlook'], mine: true },
  { title: 'The visit goes in the diary', text: "Booked in ServiceM8's schedule, confirmed on WhatsApp with the message already typed.", tags: ['ServiceM8', 'WhatsApp'], mine: true },
  { title: 'Quote, work, paid, reviewed', text: 'Quote to Work Order to Completed, with every payment and what is left. Then a Google review request, ready to send.', tags: ['ServiceM8', 'Google'], mine: true },
];

const INTEGRATIONS = [
  { name: 'Microsoft 365', what: 'Read your inbox and reply from your own address, with drafts you approve.', where: 'Job Kit inbox' },
  { name: 'WhatsApp', what: 'Confirmations, follow-ups and review requests with the message already typed.', where: 'Job Kit, websites' },
  { name: 'Claude', what: 'First drafts of replies and quotes. It never sends anything by itself.', where: 'Job Kit' },
  { name: 'Stripe', what: 'Card payments and monthly plans, with failed-payment emails handled.', where: 'CabinetOS' },
  { name: 'Supabase', what: 'Accounts and saved projects, so your work is there on every device.', where: 'CabinetOS' },
  { name: 'SketchUp', what: 'Every finished job drawn in 3D, so customers can turn it round and open the doors.', where: 'rafcarpentry.com' },
  { name: 'Public records', what: 'Land Registry, energy certificates and planning history for the property before a visit.', where: 'Job Kit' },
  { name: 'Postcodes', what: 'Type a postcode, get the street and area. Jobs near a customer worked out in miles.', where: 'rafcarpentry.com' },
];

const TRADES = [
  { name: 'Decorators', status: 'Being built', cls: 'pill built', trade: 'Decorator', text: 'Paint litres and shopping lists from the drawing, by hand or spray. Quotes that count every door.' },
  { name: 'Carpenters and joiners', status: 'Running', cls: 'pill live', trade: 'Carpenter or joiner', text: 'Cut lists, board layouts, 3D designs for clients and a wardrobe planner on your website.' },
  { name: 'Kitchen fitters', status: 'Ask me', cls: 'pill', trade: 'Kitchen fitter', text: 'Fitting packs, appliance and worktop lists, snagging photos sent to the client.' },
  { name: 'Builders and renovators', status: 'Ask me', cls: 'pill', trade: 'Builder', text: 'Stage payments, extras agreed in writing, and a weekly update the client can read.' },
  { name: 'Electricians and plumbers', status: 'Ask me', cls: 'pill', trade: 'Electrician', text: 'Job sheets, parts lists and certificates filed on the job, not in the van.' },
  { name: 'Any small trade business', status: 'Ask me', cls: 'pill', trade: 'Something else', text: 'Enquiries in one list, a diary, money owed and review requests on your phone.' },
];

const FAQ = [
  {
    q: 'Do I own what you build?',
    a: 'Yes. It runs in your own accounts: your ServiceM8, your domain, your hosting. The code is yours too, so you are never stuck with me.',
  },
  {
    q: 'I don’t use ServiceM8. Can you still help?',
    a: 'Yes. I can set ServiceM8 up for you and move your customers across, or look at what your current software allows and connect to that. Tell me what you use and I will check before you spend anything.',
  },
  {
    q: 'How fast is it?',
    a: 'You get a clickable mockup on your phone within 2 days of the visit. A working version takes 2 to 4 weeks, depending on how many parts it has, and you use each part as soon as it is ready.',
  },
  {
    q: 'What does it cost?',
    a: 'It depends on the size of the system, so you get a fixed price after the half-day visit, before any work starts. No price changes halfway through.',
  },
  {
    q: 'Will it work on my phone?',
    a: 'Yes. Everything is built for the phone first and goes on your home screen like an app, without the App Store. It keeps working with no signal and catches up when you are back online.',
  },
  {
    q: 'What happens to my customers’ details?',
    a: 'They stay in your accounts. My systems pass details between your phone, your server and your job software only. Messages to customers go only when you press send.',
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
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
                <a href="#flow" className="btn btn-ghost">
                  See one enquiry, start to finish
                </a>
              </div>
            </div>
            <div className="hero-art">
              <div className="stack">
                <div className="mount">
                  <Image src={IMG.cabinetosBuild} alt="CabinetOS build screen: a bedroom job with two wardrobes, a chest of drawers and a night stand, 3100 mm wide" width={2400} height={1500} priority sizes="(min-width: 1000px) 540px, 90vw" />
                </div>
                <div className="phone">
                  <Image src={IMG.cabinetosPhone} alt="CabinetOS on a phone: sheet 1 of 10, a 2440 by 1220 board laid out with 9% waste" width={780} height={1688} sizes="(min-width: 1000px) 170px, 28vw" />
                </div>
                <p className="tag">CabinetOS · live · free plan</p>
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

        {/* Systems */}
        <section id="systems" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="kicker">Running today</p>
                <h2 className="h2">Three systems already doing the work.</h2>
              </div>
              <p className="whisper">Each one started as an evening I lost to paperwork.</p>
            </div>

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
                </ul>
                <a href={CABINETOS_URL} target="_blank" rel="noopener" style={{ fontWeight: 600, textUnderlineOffset: 4 }}>
                  Open cabinetos.co.uk ↗
                </a>
              </div>
            </article>

            <div className="two">
              <article className="card">
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
                <span className="pill live">Runs Raf Carpentry every day</span>
                <h3 className="h3">Job Kit</h3>
                <p className="body">The phone app I open every morning. Enquiries, diary, emails, texts and money owed, in the order they need doing.</p>
                <ul className="ticks">
                  <li>Reads and writes my ServiceM8, nothing typed twice</li>
                  <li>Replies drafted for me, sent only when I say</li>
                  <li>Finished jobs ask for their review</li>
                </ul>
              </article>

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
                <a href={`${RAFCARPENTRY_URL}/wardrobe-planner`} target="_blank" rel="noopener" style={{ fontWeight: 600, textUnderlineOffset: 4 }}>
                  Try the planner ↗
                </a>
              </article>
            </div>
          </div>
        </section>

        {/* One enquiry, start to finish */}
        <section id="flow" className="section white">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="kicker">Inside one system</p>
                <h2 className="h2">One enquiry, start to finish, typed once.</h2>
              </div>
              <p className="whisper">This is how Raf Carpentry runs today. Yellow steps happen on my phone.</p>
            </div>
            <div className="flow-wrap">
              <ol className="flow">
                {FLOW.map((s, i) => (
                  <li key={s.title} className={`flow-step${s.mine ? ' mine' : ''}`}>
                    <span className="flow-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="flow-body">
                      <h3>{s.title}</h3>
                      <p className="body small" style={{ fontSize: 15.5 }}>
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
          </div>
        </section>

        {/* ServiceM8 + integrations */}
        <section id="servicem8" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="kicker">ServiceM8</p>
                <h2 className="h2">On ServiceM8? I already speak its language.</h2>
              </div>
              <p className="whisper">I run my own business on it, so every connection is tested on real jobs first.</p>
            </div>
            <p className="body" style={{ marginBottom: 28, fontSize: 17 }}>
              My systems connect through ServiceM8&apos;s official API. They read and write the same jobs, clients and diary you see in the app, so you keep working the way you do now and the boring parts fill themselves in.
            </p>
            <div className="sm8">
              <div>
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
              <div>
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
              <div>
                <span className="pill">Rules</span>
                <h3>What it never does</h3>
                <ul className="ticks">
                  <li>Delete anything. A cancelled booking is archived and can be restored</li>
                  <li>Send a message you haven&apos;t seen</li>
                  <li>Send customer details anywhere except your phone, your server and ServiceM8</li>
                </ul>
                <p className="small muted" style={{ marginTop: 'auto' }}>
                  Needs ServiceM8 Starter or above: the Free plan has no API access.
                </p>
              </div>
            </div>

            <h3 className="h3" style={{ marginTop: 56 }}>
              Also connected in my systems
            </h3>
            <div className="integrations">
              {INTEGRATIONS.map((i) => (
                <div key={i.name} className="tile">
                  <b>{i.name}</b>
                  <span>{i.what}</span>
                  <em>Used in: {i.where}</em>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How I work */}
        <section id="how" className="section white">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="kicker">How I work</p>
                <h2 className="h2">From your van to your phone in four steps.</h2>
              </div>
              <p className="whisper">If you can explain it on the phone, I can build it.</p>
            </div>
            <ol className="steps">
              <li>
                <span className="mono small muted">01 · Half a day</span>
                <h3>I watch the job</h3>
                <p className="body" style={{ fontSize: 15.5 }}>
                  On site or in the van. I write down every step that costs you time or money.
                </p>
              </li>
              <li>
                <span className="mono small muted">02 · 2 days</span>
                <h3>You try a mockup</h3>
                <p className="body" style={{ fontSize: 15.5 }}>
                  A clickable version on your own phone. We change it until it feels right.
                </p>
              </li>
              <li>
                <span className="mono small muted">03 · 2 to 4 weeks</span>
                <h3>I build it</h3>
                <p className="body" style={{ fontSize: 15.5 }}>
                  Connected to what you already use, like ServiceM8, Outlook and WhatsApp, and tested on real jobs.
                </p>
              </li>
              <li>
                <span className="mono small muted">04 · Every month</span>
                <h3>It keeps up</h3>
                <p className="body" style={{ fontSize: 15.5 }}>
                  Fixes and small changes as the business grows. You own what I build.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Trades */}
        <section id="trades" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="kicker">Who I build for</p>
                <h2 className="h2">Trades that measure, quote and chase.</h2>
              </div>
              <p className="whisper">Trade not listed? Tell me how your day goes.</p>
            </div>
            <div className="trades">
              {TRADES.map((t) => (
                <div key={t.name} className="trade">
                  <div className="trade-top">
                    <h3>{t.name}</h3>
                    <span className={t.cls}>{t.status}</span>
                  </div>
                  <p className="body" style={{ fontSize: 15 }}>
                    {t.text}
                  </p>
                  <OpenSketch className="linkish" preset={{ trade: t.trade }}>
                    Sketch mine
                  </OpenSketch>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Paint schedule */}
        <section id="paint" className="section white">
          <div className="wrap">
            <PaintCalc />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="kicker">Questions</p>
                <h2 className="h2">What people ask first.</h2>
              </div>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="section white">
          <div className="wrap about">
            <div className="about-pics">
              <div className="mount">
                <Image src={IMG.rafAtWork} alt="Rafal marking a board with a tape measure in the workshop" width={771} height={1050} sizes="(min-width: 700px) 210px, 44vw" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
              </div>
              <div className="mount">
                <Image src={IMG.wardrobe} alt="A finished birch ply wardrobe with LED lighting, built by Rafal in Chiswick" width={591} height={1050} sizes="(min-width: 700px) 210px, 44vw" style={{ aspectRatio: '3 / 4', objectFit: 'cover' }} />
              </div>
            </div>
            <div className="about-text">
              <p className="kicker">About</p>
              <h2 className="h2">A carpenter built this. It actually works.</h2>
              <p className="body">
                I&apos;m Rafal. I&apos;ve fitted wardrobes, kitchens, doors and floors in London for over 22 years, and I still do, as Raf Carpentry. Every system here runs my own business first. If it doesn&apos;t save me time on a Monday morning, it doesn&apos;t leave the workshop.
              </p>
              <p className="body">So when you explain your job, I already know what a site visit, a deposit and a snagging list feel like.</p>
              <div className="hero-actions">
                <a href={RAFCARPENTRY_URL} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                  Raf Carpentry ↗
                </a>
                <a href={CABINETOS_URL} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                  CabinetOS ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="contact">
          <div className="wrap contact-row">
            <div className="contact-text">
              <p className="kicker">Start here</p>
              <h2 className="h2" style={{ fontSize: 'clamp(34px, 6vw, 58px)' }}>
                Tell me what slows <span style={{ color: 'var(--hl)' }}>you down.</span>
              </h2>
              <p>One job, one annoying evening, one thing you type twice. That&apos;s enough to start.</p>
              <div className="contact-lines">
                <a href={PHONE_HREF}>{PHONE_DISPLAY}</a>
                <a href={whatsappUrl('Hi Rafal, I found you on rafalsolutions.co.uk. ')} target="_blank" rel="noopener">
                  WhatsApp
                </a>
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </div>
            </div>
            <div className="contact-form">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink)' }}>
              Rafal Solutions <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· Just Build.</span>
            </span>
            <span>
              {COMPANY} · Company No. {COMPANY_NO} · VAT No. {VAT_NO}
            </span>
            <span>Registered office: {ADDRESS}</span>
          </div>
          <nav className="foot-links" aria-label="Footer">
            <a href={CABINETOS_URL} target="_blank" rel="noopener">
              CabinetOS
            </a>
            <a href={RAFCARPENTRY_URL} target="_blank" rel="noopener">
              Raf Carpentry
            </a>
            <a href="/privacy">Privacy</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </footer>

      <SystemSketch />
    </>
  );
}

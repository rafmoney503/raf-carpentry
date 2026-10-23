'use client';
import { useEffect, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import type { Planning, Property } from '@/lib/property';
import { readPin } from './uploader';
import { post, problemText } from './sm8-post';

/* "Property and customer" on a job (15 Oct 2026; one folded section since 23 Oct 2026, Raf: "the property section
   should have drop down and maybe put together in one section with look them up section ... compact it"). Folded,
   it says the facts that matter (size, rooms, building, tenure, planning); open, the records, planning, and every link
   for the house and the person in one place. Open or folded is remembered on this phone. The building comes from public records through
   POST /api/job-kit/sm8 {action: 'property'} (src/lib/property.ts): what kind of house it is and its tenure (Land
   Registry), planning applications there and nearby (PlanIt), the ward and borough (postcodes.io). It is looked up
   when the job is opened and kept on this phone for 30 days. Nothing is looked up about the person by itself:
   "Look them up" only opens a Google or LinkedIn search for Raf to read, and a work email shows its company's
   website. */

const KEY = 'raf_jobkit_property';
const OPEN_KEY = 'raf_jobkit_property_open'; // '1': Raf keeps the section open
const KEEP = 40;
const DAY = 864e5;
const FRESH = 30 * DAY;
type Saved = Record<string, Property>;
const keyOf = (address: string) => address.toLowerCase().replace(/\s+/g, ' ').trim();
const readAll = (): Saved => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || 'null') as Saved) ?? {};
  } catch {
    return {};
  }
};
function keep(address: string, p: Property) {
  const all = { ...readAll(), [keyOf(address)]: p };
  const top = Object.entries(all)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(top)));
  } catch {
    /* no storage */
  }
}

/* Mailboxes anyone can have: the domain says nothing about where they work. */
const PERSONAL = new Set(
  (
    'gmail.com googlemail.com hotmail.com hotmail.co.uk outlook.com outlook.co.uk live.com live.co.uk msn.com yahoo.com yahoo.co.uk ymail.com rocketmail.com ' +
    'icloud.com me.com mac.com aol.com aol.co.uk btinternet.com btopenworld.com sky.com virginmedia.com ntlworld.com talktalk.net blueyonder.co.uk ' +
    'tiscali.co.uk o2.co.uk orange.net plus.net plusnet.com protonmail.com proton.me pm.me gmx.com gmx.co.uk gmx.de mail.com zoho.com fastmail.com hey.com ' +
    'wp.pl o2.pl onet.pl interia.pl op.pl gazeta.pl tlen.pl yandex.com yandex.ru mail.ru qq.com 163.com libero.it web.de t-online.de free.fr orange.fr laposte.net example.com'
  ).split(' '),
);
export function workDomain(email: string) {
  const d = email.trim().toLowerCase().split('@')[1]?.replace(/[>\s]/g, '') ?? '';
  if (!d || !d.includes('.') || PERSONAL.has(d)) return '';
  return d;
}

const year = (d: string | null) => (d ? d.slice(0, 4) : '');

function PlanningItem({ p, near }: { p: Planning; near?: boolean }) {
  const when = year(p.decided) || year(p.started);
  const meta = [near && p.metres !== null ? `${p.metres} m away` : '', when, p.state, near ? p.address.split(',')[0] : ''].filter(Boolean).join(' · ');
  return (
    <li className="py-2">
      <p className="font-mono text-[12px] text-faint">
        {meta}
        {p.url ? (
          <>
            {meta ? ' · ' : ''}
            <a href={p.url} target="_blank" rel="noopener" className="inline-block py-1 text-accent underline">
              {p.ref || 'the application'}
            </a>
          </>
        ) : null}
      </p>
      <p className="line-clamp-3 text-[14.5px] leading-snug">{p.description || 'No description'}</p>
    </li>
  );
}

export function PropertyBox({ job }: { job: CurrentJob }) {
  const address = job.address.trim();
  const [prop, setProp] = useState<Property | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const look = (force = false) => {
    if (!address) return;
    const had = readAll()[keyOf(address)];
    if (had) setProp(had);
    // Kept 30 days; looked up again after a day while the EPC token wasn't set, so adding it shows soon.
    if (had && !force && Date.now() - had.at < (had.epcReady ? FRESH : DAY)) return;
    setLoading(true);
    setProblem('');
    void post<{ property: Property }>(readPin(), { action: 'property', address }).then((r) => {
      setLoading(false);
      if (!r.ok) {
        setProblem(r.error === 'offline' ? 'No signal: the property is looked up next time you open the job.' : problemText(r.error, r.detail));
        return;
      }
      setProp(r.data.property);
      // A source that didn't answer is asked again next time the job is opened (after 10 minutes), not in 30 days.
      const p = r.data.property;
      keep(address, p.sale === null || p.planning === null || p.epc === null ? { ...p, at: p.at - FRESH + 10 * 60_000 } : p);
    });
  };
  useEffect(() => {
    look();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per address
  }, [address]);

  const domain = workDomain(job.email);
  const pc = prop?.postcode || '';
  const where = [prop?.ward, prop?.borough].filter(Boolean).join(', ');
  const placeWord = prop?.borough || job.area || '';
  const sale = prop?.sale;
  const house = [prop?.flat, prop?.house && /^\d/.test(prop.house) ? `${prop.house} ${prop.street}` : prop?.house].filter(Boolean).join(', ');
  const epc = prop?.epc;
  const links: [string, string][] = [];
  if (epc?.number) links.push(['Energy certificate', `https://find-energy-certificate.service.gov.uk/energy-certificate/${encodeURIComponent(epc.number)}`]);
  else if (pc) links.push(['Energy certificates here', `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(pc)}`]);
  if (prop?.lat !== null && prop?.lat !== undefined && prop.lng !== null) links.push(['Street View', `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${prop.lat},${prop.lng}`]);
  else if (address) links.push(['Map', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s*\n\s*/g, ', '))}`]);
  if (pc) links.push(['Sold prices, floor plans', `https://www.rightmove.co.uk/house-prices/${pc.toLowerCase().replace(/\s+/g, '-')}.html`]);
  const name = job.name.trim();
  const [open, setOpenState] = useState(false);
  const [nearby, setNearby] = useState(false);
  useEffect(() => {
    try {
      setOpenState(localStorage.getItem(OPEN_KEY) === '1');
    } catch {
      /* folded */
    }
  }, []);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try {
      localStorage.setItem(OPEN_KEY, v ? '1' : '0');
    } catch {
      /* this time only */
    }
  };
  if (!address && !name) return null;

  const here = prop?.planning?.here.length ?? 0;
  const building = epc?.type || (sale ? sale.type : '');
  // Folded: the few facts that change how the job is done, from whichever records answered.
  const facts = !address
    ? 'No address on this job · search for them'
    : !prop && loading
      ? 'Looking up the property…'
      : prop && !prop.postcode
        ? 'No postcode on the address · search for them'
        : prop
          ? [
              epc && epc.area !== null ? `${epc.area} m²` : '',
              epc && epc.rooms !== null ? `${epc.rooms} ${epc.rooms === 1 ? 'room' : 'rooms'}` : '',
              building,
              sale?.tenure ?? '',
              prop.planning ? (here ? `${here} planning ${here === 1 ? 'application' : 'applications'}` : 'no planning here') : '',
            ]
              .filter(Boolean)
              .join(' · ') || [pc, where].filter(Boolean).join(' · ')
          : problem
            ? 'Not looked up yet'
            : '';
  const cell = 'min-w-0';
  const term = 'font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint';
  const val = 'mt-0.5 text-[15px] leading-snug';
  const note = 'mt-1 text-[13px] leading-snug text-muted';
  const chip = 'btn btn-ghost btn-sm h-auto min-h-9 whitespace-normal py-1.5 text-left leading-snug';

  return (
    <section id="property" className="mt-6 scroll-mt-[calc(env(safe-area-inset-top)-20px)] rounded-sm border border-line-strong bg-mount">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} data-property-toggle className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-[650]">Property and customer</span>
          <span className="block text-[14px] leading-snug text-muted" data-property-summary>
            {facts}
          </span>
        </span>
        <svg aria-hidden viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 fill-none stroke-current text-faint transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-line px-4 pb-4 pt-3" data-property>
          {address ? (
            <>
              {prop && prop.postcode ? (
                <>
                  <p className="font-mono text-[12.5px] text-faint">{[pc, where].filter(Boolean).join(' · ')}</p>
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3">
                    {prop.epcReady && epc && (epc.area !== null || epc.rooms !== null) ? (
                      <div className={cell}>
                        <dt className={term}>Size</dt>
                        <dd className={`${val} font-semibold`}>{[epc.area !== null ? `${epc.area} m²` : '', epc.rooms !== null ? `${epc.rooms} ${epc.rooms === 1 ? 'room' : 'rooms'}` : ''].filter(Boolean).join(' · ')}</dd>
                      </div>
                    ) : null}
                    {building || epc?.built ? (
                      <div className={cell}>
                        <dt className={term}>Building</dt>
                        <dd className={val}>{[building, epc?.built ? (/^built/.test(epc.built) ? epc.built : `built ${epc.built}`) : ''].filter(Boolean).join(', ')}</dd>
                      </div>
                    ) : null}
                    {prop.epcReady ? (
                      <div className={epc ? cell : `${cell} col-span-2`}>
                        <dt className={term}>Energy (EPC)</dt>
                        <dd className={val}>
                          {epc
                            ? `${epc.band ? `Rated ${epc.band}` : 'On the register'}${epc.date ? ` (${epc.date.slice(0, 4)})` : ''}`
                            : prop.epcError === 'token'
                              ? 'The EPC register turned the token down. Copy a new one from your account page on get-energy-performance-data.communities.gov.uk and replace EPC_API_TOKEN in Vercel.'
                              : epc === null
                                ? 'The register didn’t answer this time.'
                                : `None on record${house ? ` for ${house}` : ''}.`}
                        </dd>
                      </div>
                    ) : null}
                    <div className={sale ? cell : `${cell} col-span-2`}>
                      <dt className={term}>Land Registry</dt>
                      <dd className={val}>
                        {sale
                          ? [sale.tenure, sale.newBuild ? 'new build when sold' : '', sale.year ? `last sold ${sale.year}` : ''].filter(Boolean).join(', ') || sale.type
                          : sale === undefined
                            ? house
                              ? `No sale on record for ${house} since 1995.`
                              : 'Couldn’t read the house number from the address.'
                            : 'Land Registry didn’t answer this time.'}
                      </dd>
                    </div>
                  </dl>
                  {epc && epc.area !== null && epc.rooms ? <p className={note}>Floor area is the whole home inside the walls; rooms are living rooms and bedrooms.</p> : null}
                  {epc?.flatInBuilding ? <p className={note}>Certificate for {epc.address.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}: the job’s address has no flat number.</p> : null}
                  {sale?.flatInBuilding ? <p className={note}>Sale of {sale.address.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}: the job’s address has no flat number.</p> : null}
                  {sale?.tenure === 'Leasehold' ? <p className={`${note} font-medium text-ink`}>Leasehold: building work may need the freeholder’s or managing agent’s permission.</p> : null}

                  <div className="mt-3 border-t border-line pt-2.5">
                    <p className={term}>Planning at this address{prop.planning ? ` (${here})` : ''}</p>
                    {prop.planning === null ? (
                      <p className="mt-0.5 text-[14.5px] text-muted">The planning search didn’t answer this time.</p>
                    ) : here ? (
                      <ul className="divide-y divide-line">
                        {prop.planning.here.map((p) => (
                          <PlanningItem key={p.ref + p.started} p={p} />
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-[14.5px] text-muted">None found{house ? ` for ${house}` : ''}.</p>
                    )}
                    {prop.planning?.nearby.length ? (
                      <>
                        <button type="button" onClick={() => setNearby(!nearby)} aria-expanded={nearby} className="mt-1 h-9 text-[14px] text-accent underline">
                          {nearby ? 'Hide nearby' : `${prop.planning.nearby.length} nearby in the last 5 years`}
                        </button>
                        {nearby ? (
                          <ul className="divide-y divide-line">
                            {prop.planning.nearby.map((p) => (
                              <PlanningItem key={p.ref + p.started} p={p} near />
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </>
              ) : prop ? (
                <p className="text-[14.5px] text-muted">The address has no postcode. Add it in ServiceM8 and the property can be looked up.</p>
              ) : loading ? (
                <p className="font-mono text-[13.5px] text-faint">Looking up the property…</p>
              ) : null}
              {problem ? (
                <p role="alert" className="mt-3 rounded-sm border border-ink bg-paper px-3 py-2 text-[14px] leading-relaxed">
                  {problem}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[14.5px] text-muted">No address on this job in ServiceM8, so there’s no property to look up.</p>
          )}

          {/* Every link in one place: the house, then the person. */}
          <div className="mt-3 border-t border-line pt-3">
            {links.length ? (
              <div className="flex flex-wrap gap-1.5" data-property-links>
                {links.map(([label, href]) => (
                  <a key={label} href={href} target="_blank" rel="noopener" className={chip}>
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
            {name ? (
              <>
                <p className={`${term} ${links.length ? 'mt-3' : ''}`}>Look up {job.first || name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5" data-person-links>
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(`"${name}" ${placeWord}`.trim())}`} target="_blank" rel="noopener" className={chip}>
                    Google
                  </a>
                  <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`} target="_blank" rel="noopener" className={chip}>
                    LinkedIn
                  </a>
                  {domain ? (
                    <a href={`https://${domain}`} target="_blank" rel="noopener" className={chip}>
                      {domain}
                    </a>
                  ) : null}
                </div>
                {domain ? <p className={note}>Their email is at {domain}, not a personal mailbox, so it’s probably where they work.</p> : null}
              </>
            ) : null}
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 font-mono text-[11.5px] leading-relaxed text-faint">
            <span>
              {address ? `Public records: ${prop?.epcReady ? 'EPC register, ' : ''}Land Registry, council planning (PlanIt), ONS postcodes. ` : ''}Searches open for you to read; nothing is saved.
            </span>
            {address ? (
              <button type="button" className="h-8 text-accent underline" disabled={loading} onClick={() => look(true)}>
                {loading ? 'Looking…' : 'Look again'}
              </button>
            ) : null}
          </p>
        </div>
      ) : null}
    </section>
  );
}

'use client';
import { useEffect, useState } from 'react';
import type { CurrentJob } from '@/lib/servicem8';
import type { Planning, Property } from '@/lib/property';
import { readPin } from './uploader';
import { post, problemText } from './sm8-post';

/* "The property" and "Look them up" on a job (15 Oct 2026). The building comes from public records through
   POST /api/job-kit/sm8 {action: 'property'} (src/lib/property.ts): what kind of house it is and its tenure (Land
   Registry), planning applications there and nearby (PlanIt), the ward and borough (postcodes.io). It is looked up
   when the job is opened and kept on this phone for 30 days. Nothing is looked up about the person by itself:
   "Look them up" only opens a Google or LinkedIn search for Raf to read, and a work email shows its company's
   website. */

const KEY = 'raf_jobkit_property';
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
  return (
    <li className="py-2.5">
      <p className="font-mono text-[12.5px] text-faint">{[near && p.metres !== null ? `${p.metres} m away` : '', when, p.state, near ? p.address.split(',')[0] : ''].filter(Boolean).join(' · ')}</p>
      <p className="mt-0.5 line-clamp-3 text-[14.5px] leading-snug">{p.description || 'No description'}</p>
      {p.url ? (
        <a href={p.url} target="_blank" rel="noopener" className="mt-0.5 inline-block h-8 text-[13.5px] leading-8 text-accent underline">
          The application{p.ref ? ` ${p.ref}` : ''}
        </a>
      ) : null}
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
  if (epc?.number) links.push(['The energy certificate', `https://find-energy-certificate.service.gov.uk/energy-certificate/${encodeURIComponent(epc.number)}`]);
  else if (pc) links.push(['Energy certificate', `https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(pc)}`]);
  if (prop?.lat !== null && prop?.lat !== undefined && prop.lng !== null) links.push(['Street View', `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${prop.lat},${prop.lng}`]);
  else if (address) links.push(['Map', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\s*\n\s*/g, ', '))}`]);
  if (pc) links.push(['Sold prices and old floor plans', `https://www.rightmove.co.uk/house-prices/${pc.toLowerCase().replace(/\s+/g, '-')}.html`]);
  const name = job.name.trim();

  return (
    <>
      <section className="mt-6 rounded-sm border border-line-strong bg-mount p-4">
        <h2 className="text-[19px] font-[650]">The property</h2>
        {!address ? (
          <p className="mt-2 text-[14.5px] text-muted">No address on this job in ServiceM8, so there’s nothing to look up.</p>
        ) : !prop && loading ? (
          <p className="mt-2 font-mono text-[13.5px] text-faint">Looking up the property…</p>
        ) : prop && !prop.postcode ? (
          <p className="mt-2 text-[14.5px] text-muted">The address has no postcode. Add it in ServiceM8 and the property can be looked up.</p>
        ) : prop ? (
          <>
            <p className="mt-1 font-mono text-[12.5px] text-faint">{[pc, where].filter(Boolean).join(' · ')}</p>
            <dl className="mt-3 grid gap-3">
              {prop.epcReady ? (
                <div>
                  <dt className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Energy certificate</dt>
                  {epc ? (
                    <>
                      {epc.area !== null || epc.rooms !== null ? (
                        <dd className="mt-0.5 font-display text-[22px] font-[650] leading-tight">
                          {[epc.area !== null ? `${epc.area} m²` : '', epc.rooms !== null ? `${epc.rooms} ${epc.rooms === 1 ? 'room' : 'rooms'}` : ''].filter(Boolean).join(' · ')}
                        </dd>
                      ) : null}
                      <dd className="mt-0.5 text-[15.5px] leading-snug">
                        {[epc.type, epc.built ? (/^built/.test(epc.built) ? epc.built : `built ${epc.built}`) : '', epc.band ? `rated ${epc.band}` : ''].filter(Boolean).join(' · ') || 'On the register'}
                        {epc.date ? <span className="text-muted"> ({epc.date.slice(0, 4)})</span> : null}
                      </dd>
                      {epc.area !== null && epc.rooms ? <dd className="mt-1 text-[13.5px] leading-snug text-muted">Floor area is the whole home, inside the walls. Rooms are the living rooms and bedrooms, not kitchens, bathrooms or halls.</dd> : null}
                      {epc.flatInBuilding ? <dd className="mt-1 text-[13.5px] leading-snug text-muted">Going by the certificate for {epc.address.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}: the address on the job has no flat number.</dd> : null}
                    </>
                  ) : prop.epcError === 'token' ? (
                    <dd className="mt-0.5 text-[14.5px] leading-snug text-muted">The EPC register turned the token down. Copy a new one from your account page on get-energy-performance-data.communities.gov.uk and replace EPC_API_TOKEN in Vercel.</dd>
                  ) : epc === null ? (
                    <dd className="mt-0.5 text-[14.5px] text-muted">The EPC register didn’t answer this time.</dd>
                  ) : (
                    <dd className="mt-0.5 text-[14.5px] text-muted">No energy certificate on record{house ? ` for ${house}` : ''}.</dd>
                  )}
                </div>
              ) : null}
              <div>
                <dt className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Land Registry</dt>
                <dd className="mt-0.5 text-[15.5px] leading-snug">
                  {sale
                    ? [sale.type, sale.tenure, sale.newBuild ? 'new build when sold' : '', sale.year ? `last sold ${sale.year}` : ''].filter(Boolean).join(' · ')
                    : sale === undefined
                      ? house
                        ? `No sale on record for ${house} since 1995.`
                        : 'Couldn’t read the house number from the address.'
                      : 'Land Registry didn’t answer this time.'}
                </dd>
                {sale?.flatInBuilding ? <dd className="mt-1 text-[13.5px] leading-snug text-muted">Going by a sale of {sale.address.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}: the address on the job has no flat number.</dd> : null}
                {sale?.tenure === 'Leasehold' ? <dd className="mt-1 text-[13.5px] leading-snug text-muted">Leasehold: building work may need the freeholder’s or managing agent’s permission.</dd> : null}
              </div>
              <div>
                <dt className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Planning at this address</dt>
                {prop.planning === null ? (
                  <dd className="mt-0.5 text-[14.5px] text-muted">The planning search didn’t answer this time.</dd>
                ) : prop.planning.here.length ? (
                  <dd>
                    <ul className="divide-y divide-line">
                      {prop.planning.here.map((p) => (
                        <PlanningItem key={p.ref + p.started} p={p} />
                      ))}
                    </ul>
                  </dd>
                ) : (
                  <dd className="mt-0.5 text-[14.5px] text-muted">None found{house ? ` for ${house}` : ''}.</dd>
                )}
              </div>
              {prop.planning?.nearby.length ? (
                <div>
                  <dt className="font-mono text-[12px] uppercase tracking-[0.06em] text-faint">Nearby, last 5 years</dt>
                  <dd>
                    <ul className="divide-y divide-line">
                      {prop.planning.nearby.map((p) => (
                        <PlanningItem key={p.ref + p.started} p={p} near />
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
        {problem ? (
          <p role="alert" className="mt-3 rounded-sm border border-ink bg-paper px-3 py-2 text-[14px] leading-relaxed">
            {problem}
          </p>
        ) : null}
        {links.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {links.map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                {label}
              </a>
            ))}
          </div>
        ) : null}
        {address ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 font-mono text-[12px] leading-relaxed text-faint">
            <span>Public records: {prop?.epcReady ? 'EPC register, ' : ''}Land Registry, council planning (PlanIt), ONS postcodes.</span>
            <button type="button" className="h-8 text-accent underline" disabled={loading} onClick={() => look(true)}>
              {loading ? 'Looking…' : 'Look again'}
            </button>
          </p>
        ) : null}
      </section>

      {name ? (
        <section className="mt-6 rounded-sm border border-line-strong bg-mount p-4">
          <h2 className="text-[19px] font-[650]">Look them up</h2>
          {domain ? (
            <p className="mt-2 text-[15px] leading-relaxed">
              Their email is at <strong>{domain}</strong>, not a personal mailbox, so it’s probably where they work.{' '}
              <a href={`https://${domain}`} target="_blank" rel="noopener" className="text-accent underline">
                See the website
              </a>
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`"${name}" ${placeWord}`.trim())}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
              Search Google
            </a>
            <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
              Search LinkedIn
            </a>
          </div>
          <p className="mt-2 font-mono text-[12px] leading-relaxed text-faint">Opens a search for you to read. Common names find other people too. Nothing is saved.</p>
        </section>
      ) : null}
    </>
  );
}

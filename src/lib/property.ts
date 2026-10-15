/* The property behind an enquiry, from free public records, for the Job Kit's "The property" box (15 Oct 2026,
   Raf: 'can jobkit search automatically everything about this person ... so I can understand'). Advised and agreed:
   facts about the building, not the person. So this looks up the address only:
   - postcodes.io (ONS data, free, no key): where the postcode is, its ward and borough;
   - PlanIt (planit.org.uk, free, no key, kept going by donations): planning applications at the address and
     nearby, which shows lofts, extensions and listed or conservation-area work;
   - HM Land Registry price paid (free, Open Government Licence): what kind of property it is (detached, terraced,
     flat), freehold or leasehold, new build, and the year it last sold. The price itself is left out of the box on
     purpose; the phone links to sold prices for Raf to look at himself.
   - the government's EPC register (get-energy-performance-data.communities.gov.uk, free with a GOV.UK One Login
     account; Raf's bearer token in Vercel as EPC_API_TOKEN): the latest energy certificate for the address, for its
     floor area, rooms, kind of home, age band and rating. Built from the service's own published code and JSON
     samples (github.com/communitiesuk/epb-data-frontend lib/views/api_tech_docs, epb-data-warehouse
     spec/fixtures/json_samples and look_up_data.csv): GET /api/domestic/search?postcode= (Bearer token,
     Accept application/json; 404 = none) gives certificateNumber, addressLine1-4, registrationDate and
     currentEnergyEfficiencyBand; GET /api/certificate?certificate_number= gives the certificate's own data
     (total_floor_area, dwelling_type (a string, or {value} in older schemas), habitable_room_count,
     sap_building_parts[].construction_age_band or .construction_year, current_energy_efficiency_band).
   Each source is asked separately and may fail on its own (null), so one being down never empties the box.
   Nothing is stored here. POSTCODES_API, PLANIT_API, LANDREG_SPARQL and EPC_API override the addresses for local
   tests. */

const POSTCODES = () => (process.env.POSTCODES_API || 'https://api.postcodes.io').replace(/\/+$/, '');
const PLANIT = () => (process.env.PLANIT_API || 'https://www.planit.org.uk/api').replace(/\/+$/, '');
const SPARQL = () => (process.env.LANDREG_SPARQL || 'https://landregistry.data.gov.uk/landregistry/query').replace(/\/+$/, '');
const EPC = () => (process.env.EPC_API || 'https://api.get-energy-performance-data.communities.gov.uk').replace(/\/+$/, '');
const UA = 'RafCarpentryJobKit/1.0 (+https://www.rafcarpentry.com)';

export type Planning = { ref: string; address: string; description: string; type: string; state: string; started: string | null; decided: string | null; url: string; metres: number | null };
export type Sale = { type: string; tenure: string; newBuild: boolean; year: string; address: string; flatInBuilding?: boolean };
export type Epc = {
  area: number | null; // total floor area, square metres
  rooms: number | null; // habitable rooms
  type: string; // 'Mid-terrace house', 'Top-floor flat'...
  built: string; // '1930 to 1949', 'built 2021'
  band: string; // 'D'
  date: string; // when it was registered, 'YYYY-MM-DD'
  number: string; // the certificate number, for its page on GOV.UK
  address: string;
  flatInBuilding?: boolean;
};
export type Property = {
  postcode: string;
  house: string; // the number or house name read from the address ('' if none)
  flat: string; // 'Flat 3' etc.
  street: string;
  lat: number | null;
  lng: number | null;
  ward: string;
  borough: string;
  sale: Sale | null | undefined; // undefined: Land Registry has no sale for this address; null: couldn't ask
  planning: { here: Planning[]; nearby: Planning[] } | null; // null: couldn't ask
  epc?: Epc | null; // undefined: no certificate for this address (or no token); null: couldn't ask
  epcReady?: boolean; // EPC_API_TOKEN is set
  epcError?: 'token'; // the register turned the token down
  at: number;
};

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

async function getJson(url: string, init: RequestInit = {}, ms = 7000): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) }, cache: 'no-store', signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/* "Flat 3, 22 Weston Park, Crouch End, London N8 9DD" -> flat 'Flat 3', house '22', street 'Weston Park'.
   "Rose Cottage, Hall Lane, ..." -> house 'Rose Cottage', street 'Hall Lane'. "12a Hall Lane" -> house '12A'. */
export function readAddress(address: string) {
  const one = address.replace(/\s*\n\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const m = one.match(POSTCODE);
  const postcode = m ? `${m[1]} ${m[2]}`.toUpperCase() : '';
  const parts = one
    .replace(POSTCODE, '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  let flat = '';
  let house = '';
  let street = '';
  let i = 0;
  const flatRe = /^(flat|apartment|apt|unit|maisonette)\.?\s*([\w/-]+)\b\s*(.*)$/i;
  const fm = parts[0]?.match(flatRe);
  if (fm) {
    flat = `Flat ${fm[2].toUpperCase()}`;
    if (fm[3]) parts[0] = fm[3];
    else i = 1;
  }
  const numRe = /^(\d+[a-z]?(?:\s*-\s*\d+[a-z]?)?)\s+(.+)$/i;
  const nm = parts[i]?.match(numRe);
  if (nm) {
    house = nm[1].replace(/\s+/g, '').toUpperCase();
    street = nm[2];
  } else if (parts[i] && parts[i + 1]) {
    // A house name, then the street (which may start with its own number: "Rose Cottage, 4 Hall Lane").
    const next = parts[i + 1].match(numRe);
    if (next) {
      house = next[1].replace(/\s+/g, '').toUpperCase();
      street = next[2];
    } else {
      house = parts[i].toUpperCase();
      street = parts[i + 1];
    }
  }
  return { postcode, house, flat, street };
}

const norm = (t: string) =>
  t
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const flatNo = (t: string) => t.match(/\b(\d+[A-Z]?)\b/i)?.[1]?.toUpperCase() ?? norm(t);

/* ---------- postcodes.io ---------- */

async function placeOf(postcode: string): Promise<{ lat: number | null; lng: number | null; ward: string; borough: string } | null> {
  try {
    const d = (await getJson(`${POSTCODES()}/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ''))}`)) as { result?: Row };
    const r = d.result ?? {};
    const lat = typeof r.latitude === 'number' ? r.latitude : null;
    const lng = typeof r.longitude === 'number' ? r.longitude : null;
    return { lat, lng, ward: s(r.admin_ward), borough: s(r.admin_district) };
  } catch {
    return null;
  }
}

/* ---------- PlanIt ---------- */

const STATE: Record<string, string> = { Permitted: 'Approved', Conditions: 'Approved with conditions', Rejected: 'Refused', Withdrawn: 'Withdrawn', Undecided: 'Waiting for a decision', Referred: 'Referred', Unresolved: 'Unresolved' };

function planningOf(r: Row): Planning {
  const km = typeof r.distance === 'number' ? r.distance : Number.parseFloat(s(r.distance));
  return {
    ref: s(r.reference) || s(r.uid),
    address: s(r.address),
    description: s(r.description).replace(/\s+/g, ' '),
    type: s(r.app_type),
    state: STATE[s(r.app_state)] ?? s(r.app_state),
    started: s(r.start_date) || null,
    decided: s(r.decided_date) || null,
    url: s(r.url) || s(r.link),
    metres: Number.isFinite(km) ? Math.round(km * 1000) : null,
  };
}

/* Applications within 80 m: the ones whose address is this house (any age), and up to 5 others from the last
   5 years, nearest first (what the neighbours have done says a lot about the houses on a street). */
async function planningNear(where: { lat: number | null; lng: number | null; postcode: string }, house: string, street: string) {
  const q = new URLSearchParams({ krad: '0.08', pg_sz: '200' });
  if (where.lat !== null && where.lng !== null) {
    q.set('lat', String(where.lat));
    q.set('lng', String(where.lng));
  } else q.set('pcode', where.postcode.replace(/\s+/g, ''));
  try {
    const d = (await getJson(`${PLANIT()}/applics/json?${q}`, {}, 9000)) as { records?: Row[] };
    const all = (d.records ?? []).map(planningOf);
    const key = house && street ? norm(`${house} ${street.split(' ')[0]}`) : '';
    const named = house && !/^\d/.test(house) ? norm(house) : '';
    const isHere = (p: Planning) => {
      const a = ` ${norm(p.address)} `;
      return Boolean((key && a.includes(` ${key} `)) || (named && a.includes(` ${named} `)));
    };
    const byDate = (a: Planning, b: Planning) => (b.started ?? '').localeCompare(a.started ?? '');
    const since = new Date(Date.now() - 5 * 365 * 864e5).toISOString().slice(0, 10);
    const here = all.filter(isHere).sort(byDate).slice(0, 10);
    const nearby = all
      .filter((p) => !isHere(p) && (p.started ?? '') >= since)
      .sort((a, b) => (a.metres ?? 1e9) - (b.metres ?? 1e9))
      .slice(0, 5);
    return { here, nearby };
  } catch {
    return null;
  }
}

/* ---------- HM Land Registry price paid ---------- */

const TYPE: Record<string, string> = { detached: 'Detached house', 'semi-detached': 'Semi-detached house', terraced: 'Terraced house', 'flat-maisonette': 'Flat or maisonette', otherPropertyType: 'Other property' };
const last = (uri: string) => uri.replace(/\/+$/, '').split(/[/#]/).pop() ?? '';

async function sparql(query: string): Promise<Row[]> {
  const url = `${SPARQL()}?${new URLSearchParams({ query })}`;
  const d = (await getJson(url, { headers: { Accept: 'application/sparql-results+json' } }, 9000)) as { results?: { bindings?: Row[] } };
  return (d.results?.bindings ?? []).map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, s((v as Row)?.value)])));
}

/* The latest sale of this house (and flat) in its postcode. The price is not asked for. */
async function saleOf(postcode: string, house: string, flat: string): Promise<Sale | null | undefined> {
  if (!postcode || !house) return undefined;
  const pc = postcode.replace(/"/g, '');
  const query = `PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
SELECT ?paon ?saon ?street ?date ?ptype ?estate ?newbuild WHERE {
  ?addr lrcommon:postcode "${pc}" .
  ?tx lrppi:propertyAddress ?addr ; lrppi:transactionDate ?date .
  OPTIONAL { ?addr lrcommon:paon ?paon }
  OPTIONAL { ?addr lrcommon:saon ?saon }
  OPTIONAL { ?addr lrcommon:street ?street }
  OPTIONAL { ?tx lrppi:propertyType ?ptype }
  OPTIONAL { ?tx lrppi:estateType ?estate }
  OPTIONAL { ?tx lrppi:newBuild ?newbuild }
} ORDER BY DESC(?date) LIMIT 400`;
  let rows: Row[];
  try {
    rows = await sparql(query);
  } catch {
    return null;
  }
  const want = norm(house);
  const wantFlat = flat ? flatNo(flat) : '';
  const same = rows.filter((r) => norm(s(r.paon)) === want);
  // With a flat number, that flat; without one, the house itself, else a flat in the building (the phone says so).
  const match = wantFlat ? same.find((r) => flatNo(s(r.saon)) === wantFlat) : (same.find((r) => !s(r.saon)) ?? same[0]);
  if (!match) return undefined;
  const typeKey = last(s(match.ptype));
  const tenure = last(s(match.estate));
  return {
    type: TYPE[typeKey] ?? (typeKey ? typeKey.replace(/-/g, ' ') : ''),
    tenure: /lease/i.test(tenure) ? 'Leasehold' : /free/i.test(tenure) ? 'Freehold' : '',
    newBuild: /^(true|1)$/i.test(s(match.newbuild)),
    year: s(match.date).slice(0, 4),
    address: [s(match.saon), [s(match.paon), s(match.street)].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    flatInBuilding: !wantFlat && Boolean(s(match.saon)),
  };
}

/* ---------- the EPC register ---------- */

// The register's construction age bands (epb-data-warehouse look_up_data.csv, England and Wales). L means 2012 to
// 2021 in RdSAP 21 and later, where M (2022 on) was added; before that L was 2012 onwards.
const AGE: Record<string, string> = { A: 'before 1900', B: '1900 to 1929', C: '1930 to 1949', D: '1950 to 1966', E: '1967 to 1975', F: '1976 to 1982', G: '1983 to 1990', H: '1991 to 1995', I: '1996 to 2002', J: '2003 to 2006', K: '2007 to 2011', L: '2012 or later', M: '2022 or later' };
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(s(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function builtOf(d: Row, schema: string) {
  const parts = Array.isArray(d.sap_building_parts) ? (d.sap_building_parts as Row[]) : [];
  for (const p of parts) {
    const band = s(p?.construction_age_band).toUpperCase();
    if (band === 'L' && /RdSAP-Schema-2[1-9]/i.test(schema)) return '2012 to 2021';
    if (AGE[band]) return AGE[band];
  }
  for (const p of parts) if (/^\d{4}$/.test(s(p?.construction_year))) return `built ${s(p.construction_year)}`;
  return '';
}

async function epcOf(postcode: string, house: string, flat: string, street: string): Promise<Epc | null | undefined | 'token'> {
  const token = process.env.EPC_API_TOKEN;
  if (!token || !postcode || !house) return undefined;
  const auth = { Authorization: `Bearer ${token}` };
  let rows: Row[];
  try {
    const res = await fetch(`${EPC()}/api/domestic/search?${new URLSearchParams({ postcode, page_size: '500' })}`, {
      headers: { ...auth, Accept: 'application/json', 'User-Agent': UA },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });
    if (res.status === 404) return undefined; // no certificates in this postcode
    if (res.status === 401 || res.status === 403) return 'token'; // the token was turned down (wrong, or the account was closed)
    if (!res.ok) return null;
    const d = (await res.json()) as { data?: unknown };
    rows = Array.isArray(d.data) ? (d.data as Row[]) : Array.isArray((d.data as Row | undefined)?.data) ? ((d.data as Row).data as Row[]) : [];
  } catch {
    return null;
  }
  const word = street ? norm(street).split(' ')[0] : '';
  const wantFlat = flat ? flatNo(flat) : '';
  const lines = (r: Row) => ` ${norm([r.addressLine1, r.addressLine2, r.addressLine3, r.addressLine4].map(s).filter(Boolean).join(' '))} `;
  const isHouse = (r: Row) => {
    const l = lines(r);
    return /^\d/.test(house) ? l.includes(` ${norm(house)} ${word} `) : l.includes(` ${norm(house)} `);
  };
  const hasFlat = (r: Row) => /\b(FLAT|APARTMENT|MAISONETTE)\b/.test(lines(r));
  const same = rows.filter(isHouse).sort((a, b) => s(b.registrationDate).localeCompare(s(a.registrationDate)));
  const pick = wantFlat ? same.find((r) => lines(r).includes(` FLAT ${wantFlat} `) || lines(r).includes(` APARTMENT ${wantFlat} `)) : (same.find((r) => !hasFlat(r)) ?? same[0]);
  if (!pick) return undefined;
  const number = s(pick.certificateNumber);
  const base: Epc = {
    area: null,
    rooms: null,
    type: '',
    built: '',
    band: s(pick.currentEnergyEfficiencyBand).toUpperCase(),
    date: s(pick.registrationDate),
    number,
    address: [pick.addressLine1, pick.addressLine2, pick.addressLine3].map(s).filter(Boolean).join(', '),
    flatInBuilding: !wantFlat && hasFlat(pick),
  };
  if (!number) return base;
  try {
    const d = ((await getJson(`${EPC()}/api/certificate?${new URLSearchParams({ certificate_number: number })}`, { headers: auth }, 9000)) as { data?: Row }).data ?? {};
    const type = d.dwelling_type;
    return {
      ...base,
      area: num(d.total_floor_area) === null ? null : Math.round(num(d.total_floor_area)!),
      rooms: num(d.habitable_room_count),
      type: typeof type === 'object' && type ? s((type as Row).value) : s(type),
      built: builtOf(d, s(pick.schemaType) || s(d.schema_type)),
      band: s(d.current_energy_efficiency_band).toUpperCase() || base.band,
      date: s(d.registration_date) || base.date,
    };
  } catch {
    return base; // the search's rating and date are still worth showing
  }
}

export async function lookupProperty(address: string): Promise<Property> {
  const a = readAddress(address);
  const empty: Property = { ...a, lat: null, lng: null, ward: '', borough: '', sale: null, planning: null, epcReady: Boolean(process.env.EPC_API_TOKEN), at: Date.now() };
  if (!a.postcode) return empty;
  const [place, sale, epc] = await Promise.all([placeOf(a.postcode), saleOf(a.postcode, a.house, a.flat), epcOf(a.postcode, a.house, a.flat, a.street)]);
  const planning = await planningNear({ lat: place?.lat ?? null, lng: place?.lng ?? null, postcode: a.postcode }, a.house, a.street);
  return {
    ...empty,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    ward: place?.ward ?? '',
    borough: place?.borough ?? '',
    sale,
    planning,
    epc: epc === 'token' ? null : epc,
    ...(epc === 'token' ? { epcError: 'token' as const } : {}),
  };
}

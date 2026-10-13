import { readPageJson } from './pages';
import { getAllProjects, type Project } from './projects';

/* Areas (content/pages/areas.json): the rough middle of every area named on a job page, used by Jobs near you
   (home page and /areas, src/components/JobsNear.tsx) and the area pages. An area with AREA_PAGE_MIN or more jobs
   gets its own page at /areas/<slug> (src/app/areas/[slug]); fewer would make thin pages, which Google treats as
   spam, so those areas are listed on /areas and link to their job instead. Built at deploy time (and on the home
   page's hourly refresh); the visitor's postcode is looked up in their browser. */

export const AREA_PAGE_MIN = 3;

export type Area = { name: string; slug: string; lat: number; lng: number; postcode?: string; intro?: string };
export type NearJob = { slug: string; title: string; area: string; img: string; lat: number; lng: number };
type AreasFile = { areas: { name: string; lat: number; lng: number; postcode?: string; intro?: string }[] };

const norm = (s: string) => s.trim().toLowerCase();
export const areaSlug = (name: string) =>
  name
    .split(',')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function getAreas(): Area[] {
  let list: AreasFile['areas'] = [];
  try {
    list = readPageJson<AreasFile>('areas.json').areas ?? [];
  } catch {
    return [];
  }
  return list
    .filter((a) => a?.name && Number.isFinite(a.lat) && Number.isFinite(a.lng))
    .map((a) => ({ name: a.name, slug: areaSlug(a.name), lat: a.lat, lng: a.lng, postcode: a.postcode || undefined, intro: a.intro || undefined }));
}

export function areaOf(name: string, areas = getAreas()) {
  return areas.find((a) => norm(a.name) === norm(name));
}

export const jobsIn = (a: Area, jobs: Project[] = getAllProjects()) => jobs.filter((p) => norm(p.area) === norm(a.name));

/* Areas with a page, most jobs first. */
export function areaPages() {
  const jobs = getAllProjects();
  return getAreas()
    .map((a) => ({ ...a, jobs: jobsIn(a, jobs) }))
    .filter((a) => a.jobs.length >= AREA_PAGE_MIN)
    .sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name));
}

export const getAreaPage = (slug: string) => areaPages().find((a) => a.slug === slug);

/* area name -> page slug, for links from job pages, Jobs near you and service pages. */
export function areaPageLinks(): Record<string, string> {
  return Object.fromEntries(areaPages().map((a) => [a.name, a.slug]));
}

export function getNearJobs(): NearJob[] {
  const areas = getAreas();
  return getAllProjects().flatMap((p) => {
    const a = areaOf(p.area, areas);
    return a ? [{ slug: p.slug, title: p.title, area: p.area, img: p.cover.src, lat: a.lat, lng: a.lng }] : [];
  });
}

export function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/* Other areas within `within` miles of this one, nearest first, each with its jobs (newest first). */
export function nearbyAreas(a: Area, within = 3) {
  const jobs = getAllProjects();
  return getAreas()
    .filter((o) => o.name !== a.name)
    .map((o) => ({ ...o, d: miles(a, o), jobs: jobsIn(o, jobs) }))
    .filter((o) => o.d <= within && o.jobs.length)
    .sort((x, y) => x.d - y.d);
}

import { readPageJson } from './pages';
import { getAllProjects } from './projects';

/* Jobs near you (home page): every job whose area is in content/pages/areas.json, with that area's rough middle.
   Built at deploy time (and on the home page's hourly refresh); the visitor's postcode is looked up in their
   browser (src/components/JobsNear.tsx). */

export type NearJob = { slug: string; title: string; area: string; img: string; lat: number; lng: number };
type Areas = { areas: { name: string; lat: number; lng: number }[] };

const norm = (s: string) => s.trim().toLowerCase();

export function getNearJobs(): NearJob[] {
  let areas: Areas['areas'] = [];
  try {
    areas = readPageJson<Areas>('areas.json').areas ?? [];
  } catch {
    return [];
  }
  const at = new Map(areas.filter((a) => a?.name && Number.isFinite(a.lat) && Number.isFinite(a.lng)).map((a) => [norm(a.name), a]));
  return getAllProjects().flatMap((p) => {
    const a = at.get(norm(p.area));
    return a ? [{ slug: p.slug, title: p.title, area: p.area, img: p.cover.src, lat: a.lat, lng: a.lng }] : [];
  });
}

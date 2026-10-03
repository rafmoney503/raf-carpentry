import { readPageJson } from './pages';
import { getAllProjects, type Project } from './projects';

/* Service pages (/services/<slug>), edited in TinaCMS ("Services"). Each page fills itself with
   the jobs whose type is in matchTypes or which carry one of matchTags, so a new job shows up on
   the right page without touching the service text. */

export type Service = {
  slug: string;
  name: string;
  titleAccent: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  intro: string;
  image?: string;
  /* Loose photos from the Mac folder "0 Services/<service name>" (scripts/service-photos.py).
     The first one becomes the card photo, in place of a drawing. */
  photos?: { src: string; w: number; h: number; alt: string }[];
  matchTypes: string[];
  matchTags: string[];
  points: { title: string; description: string }[];
  faq: { question: string; answer: string }[];
};

export type ServicesData = {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  title: string;
  titleAccent: string;
  lede: string;
  faqHeading: string;
  services: Service[];
};

export function getServicesData(): ServicesData {
  const d = readPageJson<ServicesData>('services.json');
  return {
    ...d,
    services: (d.services ?? [])
      .filter((s) => s?.slug)
      // A photo added in TinaCMS may have no size yet: assume 4:3 so the gallery still works.
      .map((s) => ({ ...s, photos: (s.photos ?? []).filter((p) => p?.src).map((p) => ({ ...p, w: p.w || 1200, h: p.h || 900, alt: p.alt || `${s.name} by Raf Carpentry` })) })),
  };
}

export const getServices = () => getServicesData().services;
export const getService = (slug: string) => getServices().find((s) => s.slug === slug);

/* Card and sharing photo: a dropped-in photo first, then the chosen image or drawing, then the newest job. */
export const coverFor = (s: Service, jobs: Project[]) => s.photos?.[0]?.src || s.image || jobs[0]?.cover.src;

const norm = (s: string) => s.trim().toLowerCase();

export function jobMatches(s: Service, p: Project) {
  const types = (s.matchTypes ?? []).map(norm);
  const tags = (s.matchTags ?? []).map(norm);
  return types.includes(norm(p.type)) || (p.tags ?? []).some((t) => tags.includes(norm(t)));
}

/* Jobs for a service, newest first (getAllProjects is already sorted that way). */
export const jobsFor = (s: Service) => getAllProjects().filter((p) => jobMatches(s, p));

/* The service a job belongs to most: its type first, then its tags. Used to link a job page to its service. */
export function serviceForJob(p: Project) {
  const all = getServices();
  return all.find((s) => (s.matchTypes ?? []).map(norm).includes(norm(p.type))) ?? all.find((s) => jobMatches(s, p));
}

/* Areas the jobs were in, most jobs first, e.g. ["East Finchley", "Palmers Green", "Haringey"]. */
export function areasFor(jobs: Project[]) {
  const count = new Map<string, number>();
  for (const j of jobs) count.set(j.area, (count.get(j.area) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
}

export function joinAreas(list: string[], max = 4) {
  // "Llandeilo, Wales" would break the commas in the list, so it reads "Llandeilo (Wales)".
  const areas = list.map((a) => a.replace(/^([^,]+),\s*(.+)$/, '$1 ($2)'));
  const shown = areas.slice(0, max);
  if (areas.length > max) return `${shown.join(', ')} and more`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

import fs from 'fs';
import path from 'path';

/* Project pages. One JSON file per job in content/projects, made from a folder in
   Documents/Raf Carpentry Projects on Raf's Mac (photos are resized and stripped of GPS first). */

export type Photo = { src: string; w: number; h: number; alt: string };
/* A plan for sale (or free) from a job: SketchUp previews without sizes, plus the Payhip link
   (or a free download). Shown on the job's page and in the Plans section of /sketchup. */
export type PlanSale = {
  previews: Photo[];
  includes: string; // e.g. "SketchUp file and PDF cut list, all sizes in mm"
  price?: string; // e.g. "£4.99"
  buyUrl?: string; // Payhip product link
  freeDownload?: string; // e.g. /plans/alcove-units.zip, when the plan is given away
};
export type Step = { title: string; text: string; image: Photo };
export type Plan = {
  image: Photo;
  real: Photo;
  title: string;
  text: string;
  imageLabel?: string; // caption under the drawing, default "The plan"
  realLabel?: string; // caption under the photo, default "The real thing"
  views?: (Photo & { caption?: string })[];
};
export type Project = {
  slug: string;
  order: number;
  title: string;
  area: string;
  finished: string; // YYYY-MM
  type: string;
  tags?: string[]; // quick-filter chips and search words on My Work
  summary: string;
  intro: string;
  cover: Photo;
  facts: { label: string; value: string }[];
  compare?: { before: Photo; after: Photo; beforeLabel: string; afterLabel: string; caption: string };
  video?: { src: string; poster: Photo; title: string; text: string };
  /* The drawing next to the finished job. `views` are extra drawings (other SketchUp angles, hand sketches)
     shown as a row underneath; tap any drawing to see it full size. */
  plan?: Plan;
  steps: Step[];
  gallery: Photo[];
  planSale?: PlanSale;
  blogSlug?: string;
  tools?: { name: string; link: string }[];
};

const dir = path.join(process.cwd(), 'content/projects');

export function getAllProjects(): Project[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Project)
    .sort((a, b) => b.finished.localeCompare(a.finished) || a.order - b.order);
}

export function getProject(slug: string): Project | undefined {
  return getAllProjects().find((p) => p.slug === slug);
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* Plans that are ready to show: at least one preview and somewhere to buy or download. */
export function isPlanReady(p: Project): p is Project & { planSale: PlanSale } {
  return Boolean(p.planSale && p.planSale.previews.length > 0 && (p.planSale.buyUrl || p.planSale.freeDownload));
}

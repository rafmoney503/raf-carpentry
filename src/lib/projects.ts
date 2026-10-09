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
  /* The job in 3D: a .glb made from a SketchUp model (scripts/su-to-glb.mjs), with a still of it
     that shows while the 3D loads (or instead of it, with no WebGL). Lids and sizes come in the .glb. */
  model3d?: { src: string; poster: Photo; title?: string; text?: string; shape?: 'wide' | 'tall' };
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
  /* Extra photos from the build ("More from the build", squares, 8 shown then "Show all"). */
  buildPhotos?: Photo[];
  /* Short silent clips from the job folder, 720 px wide H.264 in public/videos ("On video"). */
  clips?: { src: string; poster: Photo; caption: string }[];
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

/* Materials and tools per job. Made from the "Project kit" tab of Raf's Google Sheet by
   scripts/kit-from-sheet.py: only rows Raf has checked, and an Amazon link only once that
   product is Confirmed on the Products tab. Kept apart from the job JSONs so re-processing
   photos never wipes it. */
export type KitItem = { name: string; brand?: string; model?: string; link?: string };
export type Kit = { materials: KitItem[]; tools: KitItem[] };

export function getKit(slug: string): Kit | undefined {
  const file = path.join(process.cwd(), 'content/project-kit.json');
  if (!fs.existsSync(file)) return undefined;
  const all = JSON.parse(fs.readFileSync(file, 'utf-8')) as { jobs?: Record<string, Kit> };
  const kit = all.jobs?.[slug];
  return kit && (kit.materials.length > 0 || kit.tools.length > 0) ? kit : undefined;
}

/* Plans that are ready to show: at least one preview and somewhere to buy or download. */
export function isPlanReady(p: Project): p is Project & { planSale: PlanSale } {
  return Boolean(p.planSale && p.planSale.previews.length > 0 && (p.planSale.buyUrl || p.planSale.freeDownload));
}

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
  /* The job in 3D, shown under the drawing and the photo (see Model3DInfo). */
  model3d?: Model3DInfo;
};
/* The job in 3D: a .glb made from a SketchUp model (scripts/su-to-glb.mjs), with a still of it
   that shows while the 3D loads (or instead of it, with no WebGL). What moves and the sizes come in the .glb.
   Jobs with a drawing put it in plan.model3d; jobs without one put it in model3d (its own section). */
export type Model3DInfo = {
  src: string; poster: Photo; title?: string; text?: string; shape?: 'wide' | 'tall';
  standardSizes?: boolean; // drawn at standard sizes from the photos, not measured (shown as a note in the SketchUp page gallery)
  /* The same model as a SketchUp file to download, filled in by the loader when public/models/<job>.skp exists
     (made by scripts/su-to-skp-code.py through the SketchUp connector). Not typed into the job JSON. */
  skp?: { src: string; kb: number };
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
  /* The job in 3D when it has no drawing (a job with a drawing uses plan.model3d instead). */
  model3d?: Model3DInfo;
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
    .map((f) => withSkp(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Project))
    .sort((a, b) => b.finished.localeCompare(a.finished) || a.order - b.order);
}

/* A job's model gets its download (public/models/<job>.skp) when the file is there. Pages are built at deploy
   time, when public/ is on disk (it is left out of the server functions, see next.config.ts). */
function withSkp(p: Project): Project {
  const m = p.plan?.model3d ?? p.model3d;
  if (!m || m.skp) return p;
  const src = m.src.replace(/\.glb$/, '.skp');
  const file = path.join(process.cwd(), 'public', src);
  if (src !== m.src && fs.existsSync(file)) m.skp = { src, kb: Math.max(1, Math.round(fs.statSync(file).size / 1024)) };
  return p;
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

/* A job's 3D SketchUp model, wherever it lives (under the drawing, or its own section). */
export const modelOf = (p: Project): Model3DInfo | undefined => p.plan?.model3d ?? p.model3d;

/* How many jobs have a 3D model: the number in the "See all N jobs in 3D" links. */
export const countModels = () => getAllProjects().filter((p) => modelOf(p)).length;

/* Plans that are ready to show: at least one preview and somewhere to buy or download. */
export function isPlanReady(p: Project): p is Project & { planSale: PlanSale } {
  return Boolean(p.planSale && p.planSale.previews.length > 0 && (p.planSale.buyUrl || p.planSale.freeDownload));
}

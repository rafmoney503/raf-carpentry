import fs from 'fs';
import path from 'path';

/* Project pages. One JSON file per job in content/projects, made from a folder in
   Documents/Raf Carpentry Projects on Raf's Mac (photos are resized and stripped of GPS first). */

export type Photo = { src: string; w: number; h: number; alt: string };
export type Step = { title: string; text: string; image: Photo };
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
  plan?: { image: Photo; real: Photo; title: string; text: string };
  steps: Step[];
  gallery: Photo[];
  planFile?: { href: string; label: string; size?: string };
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

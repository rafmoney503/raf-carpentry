import { readPageJson } from '@/lib/pages';
import type { Photo } from '@/lib/projects';

/* Workshop tips (/tips): Raf's own tips, from content/pages/tips.json (TinaCMS "Workshop tips").
   Tips with the same section name are grouped, sections in the order they first appear.
   Each tip has its own link, /tips#<id>, so one tip can be shared on its own. */

export type Tip = {
  id: string;
  section: string;
  title: string;
  body: string;
  sketch?: string;
  linkLabel?: string;
  linkHref?: string;
  photos?: Photo[];
};

export type TipsData = {
  metaTitle: string;
  metaDescription: string;
  kicker?: string;
  title: string;
  titleAccent?: string;
  intro?: string;
  tips: Tip[];
  ctaHeading?: string;
  ctaText?: string;
};

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function getTipsData(): TipsData {
  const d = readPageJson<TipsData>('tips.json');
  const seen = new Set<string>();
  const tips = (d.tips ?? [])
    .filter((t) => t && t.title)
    .map((t) => {
      let id = slugify(t.id || t.title) || 'tip';
      while (seen.has(id)) id += '-2';
      seen.add(id);
      return {
        ...t,
        id,
        section: (t.section || 'More tips').trim(),
        photos: (t.photos ?? []).filter((p) => p && p.src).map((p) => ({ src: p.src, w: p.w || 1600, h: p.h || 1200, alt: p.alt || t.title })),
      };
    });
  return { ...d, tips };
}

export type TipSection = { name: string; id: string; tips: (Tip & { num: string })[] };

export function tipSections(tips: Tip[]): TipSection[] {
  const out: TipSection[] = [];
  tips.forEach((t) => {
    let s = out.find((x) => x.name.toLowerCase() === t.section.toLowerCase());
    if (!s) out.push((s = { name: t.section, id: `s-${slugify(t.section)}`, tips: [] }));
    s.tips.push({ ...t, num: '' });
  });
  // Numbered in the order they show on the page.
  let n = 0;
  out.forEach((s) => s.tips.forEach((t) => (t.num = String(++n).padStart(2, '0'))));
  return out;
}

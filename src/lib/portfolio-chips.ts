import { readPageJson } from './pages';
import { formatMonth, getAllProjects, getKit, type Project } from './projects';
import { matches } from './search';

/* My Work's quick-filter buttons, in this order, shown only when at least one job (or earlier-work card) matches.
   Shared by the My Work page and the menu's My Work panel, so both always offer the same words. */
export const PORTFOLIO_CHIPS = ['Wardrobes', 'IKEA PAX', 'Window seats', 'Alcoves', 'Bookshelves', 'Desks', 'Storage', 'Wall panelling', 'Birch ply', 'MDF', 'Loft', 'Outdoor'];

/* Everything a visitor might type about a job: title, area, tags, facts, words from the write-up, the kit. */
export function jobSearchText(p: Project) {
  const kit = getKit(p.slug);
  const kitWords = kit ? [...kit.materials, ...kit.tools].map((k) => [k.name, k.brand, k.model].filter(Boolean).join(' ')) : [];
  return [p.title, p.area, formatMonth(p.finished), p.type, ...(p.tags ?? []), p.summary, p.intro, ...p.facts.map((f) => f.value), ...p.steps.map((s) => s.title), ...kitWords].join(' ');
}

type Archive = { projects: { title: string; description: string; category: string }[] };

export function portfolioChips(jobs: Project[] = getAllProjects()) {
  const texts = [...jobs.map(jobSearchText), ...readPageJson<Archive>('portfolio.json').projects.map((a) => `${a.title} ${a.description} ${a.category}`)];
  return PORTFOLIO_CHIPS.filter((c) => texts.some((t) => matches(t, c)));
}

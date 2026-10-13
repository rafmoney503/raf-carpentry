import { getAllDesigns } from './designs';
import { DESIGN_KINDS, kindsIn, kindWords, type DesignKind, type KindCount } from './design-kinds';
import { getAllProjects, getProject, modelOf, type Model3DInfo, type Project } from './projects';
import type { MatchItem } from './design-match';
import { getService, jobMatches } from './services';

/* Everything on the public Designs in 3D page (rafcarpentry.com/designs): every finished job with a 3D model,
   plus any customer design marked `"public": true` in its content/designs JSON (only once that customer has
   said it can be shown; none are by default). Newest first. A job sits under the kinds of its services; a
   customer design under the kinds its title and option names mention. */

export type LibraryItem = {
  id: string; // the job's slug, or "d-<code>"
  title: string;
  area: string;
  month: string; // YYYY-MM
  model: Model3DInfo;
  kinds: string[]; // DesignKind slugs
  job?: string; // the job page's slug
  code?: string; // a public customer design's code
};

function kindsOfJob(p: Project) {
  return DESIGN_KINDS.filter((k) => {
    if (!k.service) return k.words.test(`${p.type} ${p.title}`);
    const s = getService(k.service);
    return s ? jobMatches(s, p) : false;
  }).map((k) => k.slug);
}

export function getLibraryItems(): LibraryItem[] {
  const jobs: LibraryItem[] = getAllProjects().flatMap((p) => {
    const model = modelOf(p);
    return model ? [{ id: p.slug, title: p.title, area: p.area, month: p.finished, model, kinds: kindsOfJob(p), job: p.slug }] : [];
  });
  const designs: LibraryItem[] = getAllDesigns()
    .filter((d) => d.public && !d.example && d.options.length)
    .map((d) => ({
      id: `d-${d.code}`,
      title: d.title,
      area: d.area,
      month: d.made.slice(0, 7),
      model: d.options[0].model,
      kinds: kindsIn([d.title, ...d.options.map((o) => o.name)].join(' ')).map((k) => k.slug),
      code: d.code,
    }));
  return [...designs, ...jobs].sort((a, b) => b.month.localeCompare(a.month));
}

/* The kinds that have at least one design, in button order, with how many. */
export function libraryKinds(items = getLibraryItems()): (KindCount & DesignKind)[] {
  return DESIGN_KINDS.map((k) => ({ ...k, count: items.filter((i) => i.kinds.includes(k.slug)).length })).filter((k) => k.count > 0);
}

/* For a job page: the kind it belongs to most (its own type's service first), with how many designs it has. */
export function kindForJob(p: Project) {
  const kinds = libraryKinds();
  const own = DESIGN_KINDS.find((k) => {
    const s = k.service ? getService(k.service) : undefined;
    return s && (s.matchTypes ?? []).some((t) => t.toLowerCase() === p.type.toLowerCase());
  });
  const mine = kindsOfJob(p);
  return kinds.find((k) => k.slug === own?.slug && mine.includes(k.slug)) ?? kinds.find((k) => mine.includes(k.slug));
}

export const kindForService = (serviceSlug: string) => libraryKinds().find((k) => k.service && k.service === serviceSlug);

/* The link under a job's 3D model: "See 8 more wardrobes in 3D" to its kind, or, when its kind has fewer than
   3 designs, "See all 31 designs in 3D". */
export function in3DLink(p?: Project) {
  const k = p ? kindForJob(p) : undefined;
  if (k && k.count - 1 >= 2) return { href: `/designs/${k.slug}`, label: `See ${k.count - 1} more ${kindWords(k)} in 3D` };
  return { href: '/designs', label: `See all ${getLibraryItems().length} designs in 3D` };
}

/* What the brief's "Designs like yours" and the thank-you email match against (src/lib/design-match.ts): every
   design on the Designs in 3D page with its kinds, its still, and the words a choice can match (title, type, tags,
   summary), each word once, lower case. Small enough to send to the browser with the brief. */
export function matchItems(): MatchItem[] {
  return getLibraryItems().map((i) => {
    const p = i.job ? getProject(i.job) : undefined;
    const text = [i.title, p?.type, ...(p?.tags ?? []), p?.summary].filter(Boolean).join(' ').toLowerCase();
    const words = [...new Set(text.match(/[a-z0-9]+/g) ?? [])].join(' ');
    return { slug: i.job ?? i.id, title: i.title, area: i.area, poster: i.model.poster.src, kinds: i.kinds, words };
  });
}

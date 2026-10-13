import { kindsIn, kindWords, DESIGN_KINDS } from './design-kinds';
import { stem } from './search';

/* "Designs like yours": the 3 job models closest to what a customer ticked in the brief. Used on the Brief sent
   card (in the browser) and in the automatic thank-you email (on the server), so both pick the same three.
   No fs here. The items come from matchItems() in src/lib/design-library.ts.

   Scoring, per design:
   - each of its kinds that a "What is it?" choice is about (wardrobes, alcoves...): +10
   - each of its kinds that a "For" or "Room" choice is about: +4
   - each of its kinds shared with something they saved with a heart (or the job they came from): +6
   - each word from their For, Material, Room and What choices found in its title, type, tags or summary: +3
     ("Hiding a boiler, radiator or cylinder" -> boiler, radiator, cylinder; "IKEA PAX built in" -> ikea, pax)
   - its area named in their address: +2
   - a little for being newer, so ties go to the newest
   Only designs scoring 3 or more are shown (so sometimes 1 or 2). What they saved is left out (they've seen it).
   With no real match at all, the 3 newest are shown as "Recent designs in 3D" instead. */

export type MatchItem = { slug: string; title: string; area: string; poster: string; kinds: string[]; words: string };
export type BriefChoices = { what: string[]; room: string[]; uses: string[]; material: string[]; liked: string[]; address: string };
export type Pick = { slug: string; title: string; area: string; poster: string; href: string };
export type Picks = { picks: Pick[]; more: { href: string; label: string } | null; recent: boolean };

const STOP = new Set(['and', 'the', 'for', 'built', 'not', 'sure', 'other', 'something', 'else', 'only', 'ready', 'decorator', 'paint', 'advise', 'with', 'place', 'room', 'home', 'clothe', 'display']);
// A few choices whose own words don't appear on the job pages
const ALSO: Record<string, string[]> = {
  hallway: ['hall', 'porch', 'shoe'],
  'home office': ['desk', 'office'],
  'a place to work': ['desk', 'office'],
  bathroom: ['vanity', 'bathroom'],
  'tv and media': ['tv', 'media'],
  'folded clothes': ['drawer', 'shel'],
  'hanging clothes': ['wardrobe', 'rail', 'hanging'],
};

function keyWords(choices: string[]) {
  const out = new Set<string>();
  for (const c of choices) {
    for (const w of ALSO[c.toLowerCase()] ?? []) out.add(w);
    for (const raw of c.toLowerCase().split(/[^a-z0-9]+/)) {
      const w = stem(raw);
      if (w.length >= 3 && !STOP.has(w)) out.add(w);
    }
  }
  return [...out];
}

const slugOfLiked = (href: string) => href.replace(/^\/portfolio\//, '').replace(/[#?].*$/, '');

export function closestDesigns(items: MatchItem[], c: BriefChoices, n = 3): Picks {
  if (!items.length) return { picks: [], more: null, recent: false };
  const kindsOf = (list: string[]) => new Set(list.flatMap((t) => kindsIn(t).map((k) => k.slug)));
  const whatKinds = kindsOf(c.what);
  const otherKinds = kindsOf([...c.uses, ...c.room]);
  const liked = new Set(c.liked.map(slugOfLiked));
  const likedKinds = new Set(items.filter((i) => liked.has(i.slug)).flatMap((i) => i.kinds));
  const words = keyWords([...c.uses, ...c.material, ...c.room, ...c.what]);
  const addr = c.address.toLowerCase();

  const scored = items
    .map((it, idx) => {
      let s = 0;
      for (const k of it.kinds) {
        if (whatKinds.has(k)) s += 10;
        if (otherKinds.has(k)) s += 4;
        if (likedKinds.has(k)) s += 6;
      }
      for (const w of words) if (it.words.includes(w)) s += 3;
      const place = it.area.split(',')[0].trim().toLowerCase();
      if (addr && place && addr.includes(place)) s += 2;
      return { it, s: s + Math.max(0, 1 - idx * 0.02) };
    })
    .filter((x) => !liked.has(x.it.slug));
  const best = [...scored].sort((a, b) => b.s - a.s);
  const recent = !best.length || best[0].s < 3;
  // Only real matches (a kind or a word in common); fewer than n is better than padding with unrelated ones.
  const chosen = (recent ? scored : best.filter((x) => x.s >= 3)).slice(0, n).map((x) => x.it);

  // Link each to its kind's page opened on it: the kind they asked for if it's one of its kinds.
  const kindFor = (it: MatchItem) => it.kinds.find((k) => whatKinds.has(k)) ?? it.kinds.find((k) => otherKinds.has(k)) ?? it.kinds[0];
  const picks = chosen.map((it) => {
    const k = kindFor(it);
    return { slug: it.slug, title: it.title, area: it.area, poster: it.poster, href: k ? `/designs/${k}#${it.slug}` : `/designs#${it.slug}` };
  });

  // "All 9 wardrobes in 3D": the kind they asked for (the first that has designs), else the top pick's kind.
  const topKind = [...whatKinds].find((k) => items.some((i) => i.kinds.includes(k))) ?? (recent ? undefined : kindFor(chosen[0]));
  const kind = DESIGN_KINDS.find((k) => k.slug === topKind);
  const count = kind ? items.filter((i) => i.kinds.includes(kind.slug)).length : 0;
  const more = kind && count > picks.length ? { href: `/designs/${kind.slug}`, label: `All ${count} ${kindWords(kind)} in 3D` } : { href: '/designs', label: `All ${items.length} designs in 3D` };
  return { picks, more, recent };
}

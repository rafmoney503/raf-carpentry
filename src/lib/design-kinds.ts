/* The kinds of piece on the Designs in 3D page (rafcarpentry.com/designs/<slug>), in the order the buttons show.
   Jobs are sorted into them by their service (src/lib/services.ts matchTypes / matchTags); customer designs shown
   in public, the brief's "What is it?" choices and words typed in the Job Kit library by `words`.
   No fs here: the brief and the Job Kit use it in the browser. */

export type DesignKind = { slug: string; label: string; short: string; service: string; words: RegExp };

export const DESIGN_KINDS: DesignKind[] = [
  { slug: 'wardrobes', label: 'Wardrobes', short: 'Wardrobes', service: 'fitted-wardrobes', words: /wardrobe|\bpax\b/i },
  { slug: 'alcoves-and-bookcases', label: 'Alcoves and bookcases', short: 'Alcoves', service: 'alcove-units-and-bookcases', words: /alcove|bookcase|bookshel|shelves|shelving/i },
  { slug: 'window-seats', label: 'Window seats and benches', short: 'Window seats', service: 'window-seats-and-benches', words: /window seat|\bseat\b|bench/i },
  { slug: 'desks', label: 'Desks', short: 'Desks', service: 'desks-and-home-offices', words: /\bdesk|home office/i },
  { slug: 'panelling', label: 'Panelling', short: 'Panelling', service: 'wall-panelling', words: /panelling|media wall/i },
  { slug: 'kitchens', label: 'Kitchens', short: 'Kitchens', service: 'kitchens', words: /kitchen|pantry/i },
  { slug: 'cupboards', label: 'Cupboards and storage', short: 'Cupboards', service: 'cupboards-and-storage', words: /cupboard|storage|eaves|vanity|radiator cover|boiler/i },
  { slug: 'doors', label: 'Doors', short: 'Doors', service: 'door-fitting', words: /\bdoors?\b/i },
  // no service page for these; jobs are matched by their words (type "Outdoor": decking, the fence and gate)
  { slug: 'outdoor', label: 'Decking and fences', short: 'Decking', service: '', words: /decking|\bfence|\bgate\b|outdoor/i },
];

/* "Wardrobes" -> "wardrobes", for "See 6 wardrobes in 3D". */
export const kindWords = (k: { label: string }) => k.label.charAt(0).toLowerCase() + k.label.slice(1);

/* The kinds a bit of text is about, e.g. the brief's "Bookcase or shelves" -> alcoves and bookcases. */
export const kindsIn = (text: string) => DESIGN_KINDS.filter((k) => k.words.test(text));

/* A kind with how many designs it has, as the pages and the Job Kit pass it around. */
export type KindCount = { slug: string; label: string; count: number };

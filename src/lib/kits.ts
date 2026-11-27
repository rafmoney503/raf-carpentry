/* The tools for one of Raf's paid plans, on rafcarpentry.com/kit/<slug> (Raf, 27 Nov 2026: "suggest some amazon tools
   required for this project so we can fully use the etsy pdf power"). Amazon doesn't allow its links inside a PDF, so
   the PDF links this page and the links live here. Only Raf's own tools from src/lib/affiliates.ts (his Products tab,
   Confirmed links); an item whose link isn't confirmed shows as words. No imports but the affiliate list. */
import { affiliateLinks } from './affiliates';

export type KitItem = { key: string; why: string };
export type KitGroup = { title: string; items: KitItem[] };
export type Kit = {
  slug: string;
  plan: string;
  title: string;
  lede: string;
  /** Where the plan itself is bought. */
  planHref: string;
  planLabel: string;
  groups: KitGroup[];
  /** Things to buy that aren't tools (no links). */
  materials: string[];
};

export const KITS: Kit[] = [
  {
    slug: 'alcove',
    plan: 'Alcove cupboard and shelves',
    title: 'Tools for the alcove cupboard and shelves',
    lede: 'What I use to build and fit the alcove unit in the plan: a tall box with a cupboard at the bottom and shelves above, scribed to the walls.',
    planHref: 'https://www.etsy.com/shop/GreenBlueBlack',
    planLabel: 'The plan on Etsy',
    groups: [
      {
        title: 'Cutting the boards',
        items: [
          { key: 'festool-track-saw', why: 'Straight, square cuts on full 2440 boards, so the box goes together without gaps.' },
          { key: 'festool-guide-rail-2400', why: 'One cut down the full length of a side panel.' },
          { key: 'festool-guide-rail', why: 'For the shorter cuts: tops, bottoms and shelves.' },
          { key: 'dewalt-jigsaw', why: 'Cutting the fillers along the scribe line.' },
        ],
      },
      {
        title: 'Putting it together',
        items: [
          { key: 'dewalt-impact-driver', why: 'Driving the 3.5 × 40 screws through the box and into the wall.' },
          { key: 'dewalt-drill', why: 'Pilot holes and the 35 mm hinge cups (with a hinge jig).' },
          { key: 'dewalt-pin-nailer', why: 'Holding the fillers and the ceiling strip while the glue sets.' },
          { key: 'dewalt-multi-tool', why: 'Cutting the skirting off neatly where the unit goes.' },
        ],
      },
      {
        title: 'Measuring and levelling',
        items: [
          { key: 'bosch-laser', why: 'Measuring the alcove wall to wall, at the top, middle and bottom.' },
          { key: 'stanley-tape', why: 'Every other size.' },
          { key: 'dewalt-laser-level', why: 'A level line round the alcove for the base frame and the shelves.' },
          { key: 'stabila-level', why: 'Checking the base frame and the box are level and plumb.' },
          { key: 'shinwa-square', why: 'Marking shelf pin lines and checking the box is square.' },
        ],
      },
      {
        title: 'Keeping it clean',
        items: [{ key: 'henry-vacuum', why: 'MDF dust gets everywhere: plug it into the track saw.' }],
      },
    ],
    materials: [
      '18 mm MDF boards (the plan tells you how many for your size)',
      '3.5 × 40 mm screws (I use Reisser), plus wall plugs and screws for the wall',
      'Soft-close hinges, 35 mm cup',
      'Shelf pins, 5 mm',
      'A school compass for the scribing',
    ],
  },
  {
    slug: 'pax',
    plan: 'IKEA PAX, built in',
    title: 'Tools for building in IKEA PAX',
    lede: 'What I use to make PAX look made to measure: the base frame, the fillers scribed to the walls, the top boxes or ceiling strip and the end panels.',
    planHref: '/pax-guide',
    planLabel: 'The PAX guide',
    groups: [
      {
        title: 'Cutting the MDF parts',
        items: [
          { key: 'festool-track-saw', why: 'Fillers, end panels and top boxes cut straight on full boards.' },
          { key: 'festool-guide-rail-2400', why: 'One cut down a full-height filler or end panel.' },
          { key: 'dewalt-jigsaw', why: 'Cutting the fillers along the scribe line.' },
          { key: 'dewalt-multi-tool', why: 'Taking the back skirting off without damaging the wall.' },
        ],
      },
      {
        title: 'Fitting it',
        items: [
          { key: 'dewalt-impact-driver', why: 'Joining the frames, fixing the fillers and screwing it all to the wall.' },
          { key: 'dewalt-drill', why: 'Pilot holes and the hinge holes in made-to-measure doors (with a hinge jig).' },
          { key: 'dewalt-pin-nailer', why: 'Holding the ceiling strip and plinth while the glue sets.' },
          { key: 'irwin-chisels', why: 'Cleaning up a notch round a pipe or the skirting.' },
        ],
      },
      {
        title: 'Measuring and levelling',
        items: [
          { key: 'bosch-laser', why: 'Wall to wall and floor to ceiling in seconds.' },
          { key: 'stanley-tape', why: 'Every other size.' },
          { key: 'dewalt-laser-level', why: 'A level line along the wall for the base frame.' },
          { key: 'stabila-level', why: 'Getting each frame plumb before you join them.' },
        ],
      },
      {
        title: 'Keeping it clean',
        items: [{ key: 'henry-vacuum', why: 'For the MDF dust and the IKEA packaging bits.' }],
      },
    ],
    materials: [
      '18 mm MDF boards for the fillers, end panels and top boxes',
      '3.5 × 40 mm screws for joining the frames',
      'Packers for levelling the base frame',
      'A school compass for the scribing',
    ],
  },
];

export const kitOf = (slug: string) => KITS.find((k) => k.slug === slug) ?? null;

/** An item with its name and link (null when the link isn't confirmed yet). */
export function kitTool(key: string): { name: string; url: string | null } {
  const a = affiliateLinks[key];
  if (!a) return { name: key, url: null };
  return { name: a.name, url: a.url && a.url !== '#' ? a.url : null };
}

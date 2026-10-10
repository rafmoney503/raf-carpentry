/* What the Job Kit asks for on every job, in the order of the "Job photo and video checklist" doc.
   Each slot is a place for one or more photos (or clips); its id goes into the file name, so when a job is
   processed it is clear which photo is the main one, which before and after photos match, and so on. */

export type Kind = 'photo' | 'video';
export type Slot = {
  id: string;
  label: string;
  hint?: string;
  target?: string; // e.g. "10 to 15 s", "3 or 4"
  camera?: boolean; // false: only "From Photos" (the time-lapse is filmed in the Camera app)
  pairWith?: string; // an after photo shows its before photo as a guide
};
export type SectionId = 'before' | 'build' | 'finished' | 'clips' | 'drawings';
/* goal: what "done" looks like on the tab. count 'slots' = how many of the slots (or of `counted`) have something;
   count 'files' = how many photos or clips. */
export type Section = { id: SectionId; title: string; kind: Kind; intro: string; slots: Slot[]; extra?: string; note?: string; goal: number; count: 'slots' | 'files'; counted?: string[] };

export const SECTIONS: Section[] = [
  {
    id: 'before',
    title: 'Before',
    kind: 'photo',
    goal: 3,
    count: 'slots',
    counted: ['before-1', 'before-2', 'before-3'],
    intro: 'First visit or first morning, before anything moves. Phone at chest height, 1x lens. Remember where you stood.',
    slots: [
      { id: 'before-1', label: 'Spot 1: the doorway', hint: 'Wide, from where you walk in.' },
      { id: 'before-2', label: 'Spot 2: straight on', hint: 'Facing the wall the job goes on.' },
      { id: 'before-3', label: 'Spot 3: from the side', hint: '45 degrees from one side.' },
      { id: 'problems', label: 'Problems', hint: 'Uneven wall, pipes, boiler, sockets, sloping ceiling, old skirting.', target: 'one each' },
    ],
    extra: 'Something else',
  },
  {
    id: 'build',
    title: 'Build',
    kind: 'photo',
    goal: 6,
    count: 'slots',
    intro: 'One wide photo and one close-up at each stage. Skip what does not fit this job and add your own.',
    slots: [
      { id: 'room-ready', label: 'Room ready', hint: 'Dust sheets down, skirting off.' },
      { id: 'boards-cut', label: 'Boards cut', hint: 'Track saw on the rail, the board stack.' },
      { id: 'carcass-level', label: 'Carcass in and level', hint: 'With the level in the shot.' },
      { id: 'scribed', label: 'Scribed to the wall', hint: 'The compass line and the cut edge.' },
      { id: 'insides', label: 'Insides in', hint: 'Shelves, rails, drawers and backs.' },
      { id: 'doors-hung', label: 'Doors hung', hint: 'Lined up, gaps even.' },
      { id: 'trims', label: 'Fillers and trims', hint: 'Fillers, mouldings and handles on.' },
      { id: 'cleaned-up', label: 'Cleaned up', hint: 'Ready for the decorator.' },
      { id: 'labels', label: 'Labels', hint: 'Board stamp, hinge and runner boxes, tools with the name facing you.' },
      { id: 'clever-bit', label: 'The clever bit', hint: 'Boiler space, the cut round a pipe, the hidden fixing.' },
    ],
    extra: 'Another stage',
  },
  {
    id: 'finished',
    title: 'Finished',
    kind: 'photo',
    goal: 12,
    count: 'files',
    intro: 'After the clean-up: tools, ladders and dust sheets out. Lights on, curtains open, lens wiped.',
    slots: [
      { id: 'main-upright', label: 'Main photo, upright', hint: 'Straight on, the whole piece, doors shut.' },
      { id: 'main-wide', label: 'Main photo, sideways', hint: 'Same spot, phone turned on its side.' },
      { id: 'after-1', label: 'Spot 1 again', hint: 'Where you stood for Before spot 1, same height.', pairWith: 'before-1' },
      { id: 'after-2', label: 'Spot 2 again', hint: 'Where you stood for Before spot 2.', pairWith: 'before-2' },
      { id: 'after-3', label: 'Spot 3 again', hint: 'Where you stood for Before spot 3.', pairWith: 'before-3' },
      { id: 'angle-left', label: '45 degrees from the left' },
      { id: 'angle-right', label: '45 degrees from the right' },
      { id: 'open', label: 'Open', hint: 'Doors open, drawers out, lids up.', target: 'one per section' },
      { id: 'close-ups', label: 'Close-ups', hint: 'A handle, the scribed edge, a joint, a detail inside.', target: '3 or 4' },
      { id: 'in-room', label: 'In the room', hint: 'Wider, with the room around it.' },
      { id: 'lights', label: 'Lights on and off', hint: 'Only if there is an LED strip.', target: '2' },
    ],
    extra: 'Another finished photo',
  },
  {
    id: 'clips',
    title: 'Clips',
    kind: 'video',
    goal: 3,
    count: 'files',
    intro: 'Upright, 1080p at 30 fps, not 4K. Hold still for 2 seconds at the start and the end. Under 30 seconds each.',
    slots: [
      { id: 'reveal', label: 'The reveal', target: '10 to 15 s', hint: 'Start in the doorway, walk slowly to the piece, stop in front of it. No talking. If you film one clip, film this.' },
      { id: 'open-close', label: 'Open and close', target: '6 to 10 s each', hint: 'One door, one drawer, one lid, slowly. Let the soft close finish.' },
      { id: 'satisfying', label: 'The satisfying moment', target: '5 to 8 s', hint: 'A drawer sliding shut, the scribe being cut, the track saw on the rail. Phone close, hold still.' },
      { id: 'before-clip', label: 'Before clip', target: '3 s', hint: 'From Before spot 1.' },
      { id: 'after-clip', label: 'After clip', target: '3 s', hint: 'Same spot, same height, at the end.', pairWith: 'before-clip' },
      { id: 'timelapse', label: 'Time-lapse of the day', target: '20 to 30 s', camera: false, hint: 'Film it with Time-lapse in the Camera app, add it here from Photos, then delete it from your camera roll.' },
    ],
    extra: 'Another clip',
    note: 'Talking to camera is for Instagram and TikTok. The site does not use it, so leave it out of here.',
  },
  {
    id: 'drawings',
    title: 'Drawings',
    kind: 'photo',
    goal: 1,
    count: 'files',
    intro: 'SketchUp screenshots, the IKEA planner, a photo of your paper sketch. A drawing can become a plan for sale too.',
    slots: [{ id: 'drawing', label: 'Drawings and sketches', hint: 'Screenshots from Photos, or photograph the paper.' }],
  },
];

/* How far a section is, for the tab and the Send list. */
export function progress(section: Section, items: { section: SectionId; slot: string }[]) {
  const mine = items.filter((i) => i.section === section.id);
  if (section.count === 'files') return mine.length;
  const slots = new Set(mine.map((i) => i.slot));
  return section.counted ? section.counted.filter((id) => slots.has(id)).length : slots.size;
}

export const sectionOf = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;

/* The "Kind of job" chips: the service pages' names, so new jobs land on the right page. */
export const KINDS = [
  'Fitted wardrobes',
  'Alcove units',
  'Wall panelling',
  'Window seat',
  'Desk',
  'Kitchen',
  'Cupboards',
  'Doors',
  'Flooring',
  'Stud wall',
  'Decking or fence',
  'Other',
];

/* Raf's own tools (Tools page), as chips for "Tools that did the work". */
export const TOOLS = [
  'Festool track saw',
  'Festool Domino',
  'DeWalt mitre saw',
  'DeWalt laser level',
  'Stabila level',
  'DeWalt impact driver',
  'DeWalt finish nailer',
  'DeWalt jigsaw',
  'DeWalt multi-tool',
  'DeWalt sander',
  'Makita trim router',
  'Hinge jig',
  'School compass (scribing)',
];

export const SHOW_OPTIONS = ['Yes', 'Yes, but no faces', 'No'];
export const REVIEW_OPTIONS = ['Asked', 'Left', 'Not yet'];

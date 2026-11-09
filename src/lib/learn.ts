/* Learn: free guides for people fixing their own homes (9 Nov 2026, Raf: "a learning section for people who fix their
   houses and have no idea about those things ... moving graphic presentations", then "Go" to the plan: one page per
   job, a moving drawing that acts out each step, what to buy with his Amazon links, and when to call him). The words
   are here; each step's drawing is in src/components/learn/scenes.tsx, in the same order. No imports, so the pages,
   the search list and the sitemap all read the same list. */

export type LearnStep = {
  title: string;
  body: string;
  /* a short line under the step, in blue */
  tip?: string;
  link?: { label: string; href: string };
};

export type LearnItem = {
  name: string;
  note?: string;
  /* the product's key in src/lib/affiliates.ts: its Amazon link shows once Raf has confirmed it in his sheet */
  key?: string;
  /* or a page of this site */
  href?: string;
};

export type LearnGuide = {
  slug: string;
  /* the question people ask, as the page title */
  title: string;
  /* the first words on the page, the answer, so search and AI assistants can quote it */
  answer: string;
  kicker: string;
  card: string;
  metaTitle: string;
  metaDescription: string;
  time: string;
  /* which step's drawing stands for the guide on cards */
  hero: number;
  /* ISO 8601 for the HowTo, e.g. PT30M */
  totalTime: string;
  steps: LearnStep[];
  table?: { title: string; intro: string; head: [string, string, string]; rows: [string, string, string][] };
  need: LearnItem[];
  careful: string[];
  faq: { q: string; a: string }[];
  words: string;
  /* the photo or drawing still for sharing, made from the page (public/images/learn/<slug>-<hash>.jpg) */
  still?: string;
};

export const GUIDES: LearnGuide[] = [
  {
    slug: 'hang-heavy-things-on-a-wall',
    title: 'How to hang something heavy on any wall',
    answer:
      'Find out what the wall is first. Brick and block take a wall plug and screw, a timber stud takes a screw straight in, and plasterboard on its own needs a metal cavity fixing. For anything heavy, like a wall cupboard, a TV or a big mirror, fix into the studs or the brickwork.',
    kicker: 'Learn · fixing to walls',
    card: 'Brick, a stud or plasterboard: what the wall is, where the cables run, and the fixing for each.',
    metaTitle: 'How to hang something heavy on any wall | Raf Carpentry',
    metaDescription:
      'Find out what your wall is, find the studs, keep clear of cables, then the right fixing for brick, a stud or plasterboard. Six steps with moving drawings, from a London carpenter.',
    time: 'About 30 minutes',
    hero: 1,
    totalTime: 'PT30M',
    steps: [
      {
        title: 'Knock and listen',
        body:
          'Knock on the wall where it’s going. A hollow knock is plasterboard on a frame of timber studs. A dull, solid knock is brick or block. Knock along the wall too: the hollow sound goes dull where there’s a stud behind.',
        tip: 'In older London houses a hollow wall can be lath and plaster: fix into the timber behind it, never the plaster.',
      },
      {
        title: 'Find the studs, keep clear of cables',
        body:
          'Slide a stud and cable detector across the wall and mark each stud in pencil. Studs are usually 400 or 600 mm apart. Cables run straight up, down and sideways from sockets and switches, and within 150 mm of the ceiling and the corners, so never drill in those lines.',
        tip: 'Pipes often run straight up from radiators and taps. A detector can miss: if in doubt, move the fixing.',
      },
      {
        title: 'Mark the fixing points level',
        body:
          'Hold it up, or measure where its fixing holes are, and mark them in pencil on the wall. Put a spirit level across the marks and move them until the bubble sits in the middle.',
        tip: 'No level? My free spirit level turns your phone into one.',
        link: { label: 'Open the spirit level', href: '/tools/spirit-level' },
      },
      {
        title: 'Drill the hole',
        body:
          'Brick or block: a masonry bit with the drill’s hammer on. A stud: a wood bit a little thinner than the screw, hammer off. Wrap masking tape round the bit at the depth you need, the length of the plug and a few millimetres more, and stop when the tape touches the wall.',
        tip: 'Hoover the dust out of the hole before the plug goes in.',
      },
      {
        title: 'Plug, screw or cavity fixing',
        body:
          'Brick or block: tap the plug in flush with the wall, then drive the screw through what you’re hanging into the plug. A stud: screw straight through the plasterboard into the timber, at least 30 mm into the wood. Plasterboard with no stud behind: a metal cavity fixing, like a spring toggle, opens out behind the board and spreads the load.',
        tip: 'Plastic plugs in plasterboard pull out under weight.',
      },
      {
        title: 'Hang it and check',
        body:
          'Hang it, put the level on top and check again before you let go. Then give it a firm pull down. If anything moves, take it down and fix into a stud or the brick.',
      },
    ],
    table: {
      title: 'Which fixing for which wall',
      intro: 'The wall decides the fixing. Use the plug, bit and screw sizes on the pack together: they’re made as a set.',
      head: ['Your wall', 'The fixing', 'Good for'],
      rows: [
        ['Brick or block (a solid knock)', 'Masonry bit, wall plug and screw', 'Heavy things: wall cupboards, TVs, big mirrors'],
        ['Timber stud behind plasterboard', 'A wood screw straight into the stud', 'Heavy things, with a fixing in every stud it crosses'],
        ['Plasterboard with no stud behind', 'A metal cavity fixing, like a spring toggle', 'Light things: pictures, small shelves. The pack says what it holds'],
        ['Lath and plaster (older houses)', 'A screw into the timber behind', 'Find the timber first: the plaster crumbles'],
        ['Metal studs (the detector says metal)', 'Fixings made for metal studs, or spring toggles', 'Check the pack for metal studs'],
      ],
    },
    need: [
      { name: 'Stud and cable detector', note: 'Finds the studs and warns of live cables and metal pipes', key: 'stud-detector' },
      { name: 'Drill with a hammer setting', note: 'Hammer on for brick, off for wood', key: 'dewalt-drill' },
      { name: 'Masonry and wood drill bits', key: 'drill-bits' },
      { name: 'Wall plugs and screws', note: 'A set, so the plug, bit and screw match', key: 'wall-plugs' },
      { name: 'Metal cavity fixings (spring toggles)', note: 'For plasterboard with no stud behind', key: 'spring-toggles' },
      { name: 'Spirit level', note: 'Or the free spirit level on your phone', key: 'stabila-level' },
      { name: 'Impact driver', note: 'Drives the screws; a drill does it too', key: 'dewalt-impact-driver' },
      { name: 'Tape measure', key: 'stanley-tape' },
      { name: 'Pencil and masking tape' },
    ],
    careful: [
      'Never drill straight above, below or beside a socket or a switch, or within 150 mm of the ceiling or a corner: that’s where cables are allowed to run.',
      'Anything heavy over a bed, a sofa or where children play: fix it into studs or brick, with more fixings than you think it needs.',
      'Two people to lift and hold anything big while it’s fixed.',
    ],
    faq: [
      {
        q: 'Can I hang a TV on plasterboard?',
        a: 'Not on the plasterboard alone. Fix the bracket into the studs behind it, or into a timber batten that is itself screwed across two studs. If the studs aren’t where the bracket needs them, that batten is the answer.',
      },
      {
        q: 'What size wall plug do I need?',
        a: 'The one the pack says goes with your screw and your drill bit. Plug, bit and screw are made as a set: the bit makes the hole, the plug fills it, and the screw spreads the plug so it grips the wall.',
      },
      {
        q: 'How do I know if there’s a cable behind the wall?',
        a: 'Cables are allowed to run straight up, down and sideways from a socket or switch, and within 150 mm of the ceiling and the corners. Keep out of those lines, and check with a cable detector before you drill. If a fixing has to go near one, move it.',
      },
      {
        q: 'How much weight can a wall plug hold?',
        a: 'It depends on the plug, the screw and the wall, and the pack gives a figure for each kind of wall. Into solid brick it holds far more than in plasterboard. For anything heavy use more than one fixing, and go into studs or brick.',
      },
      {
        q: 'Can you put it up for me?',
        a: 'Yes. I fit wall cupboards, shelves, panelling and fitted furniture across London. Press Get a quote, or send me a photo of the wall on WhatsApp.',
      },
    ],
    still: '/images/learn/hang-heavy-things-on-a-wall-13cfbf7e.jpg',
    words:
      'hang heavy mirror picture shelf shelves tv bracket wall cupboard cabinet wall plug plugs rawlplug screw screws fixing fixings plasterboard drywall stud studs brick block lath plaster cavity spring toggle hollow wall anchor drill masonry bit detector cable cables pipe pipes safe zones level',
  },
  {
    slug: 'french-cleat',
    title: 'How to hang a cabinet or mirror with a French cleat',
    answer:
      'A French cleat is one strip of board cut lengthways at 45°. One half goes on the wall with its slope facing up, the other on the back of the cabinet facing down, and the weight pulls them tight together. It holds heavy things, spreads the load along the wall, and lifts off again when you need it to.',
    kicker: 'Learn · fixing to walls',
    card: 'One strip of plywood cut at 45°: the weight pulls the cabinet tight to the wall, and it lifts off again.',
    metaTitle: 'How to hang a cabinet or mirror with a French cleat | Raf Carpentry',
    metaDescription:
      'What a French cleat is, how to cut one at 45° and how to hang a cabinet, mirror or shelf on it, level and tight to the wall. Five steps with moving drawings, from a London carpenter.',
    time: 'About an hour',
    hero: 0,
    totalTime: 'PT1H',
    steps: [
      {
        title: 'How a French cleat works',
        body:
          'The two halves hook together on the 45° cut. The half on the wall has its slope facing up and in towards the wall; the half on the cabinet has its slope facing down. As the weight pushes down, the slope pulls the cabinet in against the wall: the heavier it is, the tighter it sits.',
      },
      {
        title: 'Cut one strip into two',
        body:
          'Take a strip of 18 mm plywood about 100 mm wide, a little shorter than the cabinet is wide. Cut it down its length with the saw tilted to 45°, through the thickness. You get two halves, each with a sloping edge.',
        tip: 'No saw that tilts? A timber merchant can cut the strip for you.',
      },
      {
        title: 'The cleat and a spacer on the cabinet',
        body:
          'Glue and screw one half across the back of the cabinet near the top, with its slope at the bottom, facing down and in towards the cabinet. At the bottom, fix a spacer strip of the same 18 mm board, so the cabinet hangs straight instead of tipping in.',
        tip: 'Measure from the top of the cabinet down to where the slope meets the cabinet. You need that number next.',
      },
      {
        title: 'The wall half, level',
        body:
          'Mark where the top of the cabinet will be. The top of the wall half goes that number lower. Screw it to the wall, level, with its slope at the top facing up and in towards the wall, into every stud it crosses or into the brick with plugs.',
        link: { label: 'Which fixing for your wall', href: '/learn/hang-heavy-things-on-a-wall' },
      },
      {
        title: 'Lift it on',
        body:
          'Lift the cabinet a little above the wall half, keep it against the wall and lower it. The halves hook together and pull it tight to the wall. Slide it sideways to line it up and check it with the level. To take it off, lift it up and out.',
        tip: 'Two people for anything heavy.',
      },
    ],
    need: [
      { name: '18 mm plywood', note: 'A strip about 100 mm wide, a little shorter than the cabinet' },
      { name: 'A saw that tilts to 45°', note: 'The track saw I use, or a table saw', key: 'festool-track-saw' },
      { name: 'Wood glue and screws', note: 'To glue and screw the half on the cabinet' },
      { name: 'Wall fixings for your wall', note: 'Plugs for brick, screws into studs', href: '/learn/hang-heavy-things-on-a-wall' },
      { name: 'Spirit level', key: 'stabila-level' },
      { name: 'Impact driver', key: 'dewalt-impact-driver' },
    ],
    careful: [
      'The cleat is only as strong as its fixings into the wall: a screw into every stud it crosses, or plugs into brick, never plastic plugs in plasterboard.',
      'Check where the cables and pipes run before you drill.',
      'Two people to lift a heavy cabinet or mirror on and off.',
    ],
    faq: [
      {
        q: 'How much weight can a French cleat hold?',
        a: 'As much as its fixings into the wall can hold. The cleat spreads the load along its length, so it’s the screws that decide: into studs or brick, with a fixing in every stud, it holds wall cupboards and big mirrors.',
      },
      {
        q: 'Plywood or MDF for a French cleat?',
        a: 'Plywood. Screws hold better in it and its sloping edge doesn’t crumble. 18 mm is plenty for cabinets and mirrors.',
      },
      {
        q: 'Does the cleat show?',
        a: 'No: it sits behind the cabinet. The spacer at the bottom keeps the cabinet straight, so from the front it looks screwed to the wall.',
      },
      {
        q: 'Can I use one for shelves or tools?',
        a: 'Yes. Run a few wall halves along a wall and anything with a cabinet half on its back hangs on them, and moves along when you want it somewhere else.',
      },
      {
        q: 'Can you fit it for me?',
        a: 'Yes. I build and fit cabinets, shelves and fitted furniture across London. Press Get a quote, or send me a photo of the wall on WhatsApp.',
      },
    ],
    still: '/images/learn/french-cleat-350b0ccd.jpg',
    words:
      'french cleat cleats hang hanging cabinet cupboard mirror heavy wall shelf shelves tool wall 45 degree bevel bevelled rip plywood batten hook spacer z clip split batten floating',
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
export const learnHref = (g: LearnGuide) => `/learn/${g.slug}`;

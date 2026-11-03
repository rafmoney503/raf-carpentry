import { CABINETOS_URL, RAFCARPENTRY_URL } from './site';

/* Rafal Solutions as one company with five steps, one tool for each part of a job: learn 3D, design in SketchUp,
   make with CabinetOS, fit with the phone tools, and run the business with a system built for you. Three of the five
   are free. Each step has its own colour (globals.css: --learn, --design, --make, --fit, --run). The first four are
   their own sites; Run is this site's systems pages. */

export const BUILDITIN3D_URL = 'https://builditin3d.com';
/* The SketchUp extension is sold through CabinetOS; change this when it has a page of its own. */
export const EXTENSION_URL = CABINETOS_URL;
export const TOOLS_URL = `${RAFCARPENTRY_URL}/tools`;

export type StepId = 'learn' | 'design' | 'make' | 'fit' | 'run';
export type Step = {
  id: StepId;
  n: string;
  verb: string;
  name: string;
  badge: string;
  line: string;
  points: string[];
  href: string;
  linkLabel: string;
  external: boolean;
  flow: { title: string; sub: string };
};

export const STEPS5: Step[] = [
  {
    id: 'learn',
    n: '01',
    verb: 'Learn',
    name: 'Build It in 3D',
    badge: 'Free',
    line: 'Learn 3D from the very first click: the mouse, zoom, draw, push and pull. For any age, kids and grandparents too.',
    points: ['Short lessons with exercises', 'Starts from the basics', 'Grows into SketchUp for cabinet makers'],
    href: BUILDITIN3D_URL,
    linkLabel: 'builditin3d.com',
    external: true,
    flow: { title: 'Learn the basics', sub: 'Draw a box, then a cabinet' },
  },
  {
    id: 'design',
    n: '02',
    verb: 'Design',
    name: 'CabinetOS for SketchUp',
    badge: 'SketchUp',
    line: 'Draw wardrobes and cabinets inside SketchUp with the same maths as CabinetOS: real boards, real sizes.',
    points: ['Units that size themselves', 'Opens in your CabinetOS projects', 'One free trial with the app'],
    href: EXTENSION_URL,
    linkLabel: 'Get the extension',
    external: true,
    flow: { title: 'Draw it in SketchUp', sub: 'Units at the client’s sizes' },
  },
  {
    id: 'make',
    n: '03',
    verb: 'Make',
    name: 'CabinetOS',
    badge: 'Free plan',
    line: 'The Cabinet Operating System: cut lists, board layouts and workshop drawings from one design.',
    points: ['Parts nested on 2440 × 1220 boards', 'Drawings to print for the bench', 'A 3D link your client can open'],
    href: CABINETOS_URL,
    linkLabel: 'cabinetos.co.uk',
    external: true,
    flow: { title: 'Cut list in CabinetOS', sub: 'Boards, parts, drawings' },
  },
  {
    id: 'fit',
    n: '04',
    verb: 'Fit',
    name: 'Workshop Tools',
    badge: 'Free',
    line: 'Phone tools for site, made on real jobs. They do the sums so you don’t.',
    points: ['Door hinge positions', 'Drawer runners and unit sizes', 'A spirit level on your phone'],
    href: TOOLS_URL,
    linkLabel: 'Open the tools',
    external: true,
    flow: { title: 'Fit it with the phone tools', sub: 'Hinges, runners, level' },
  },
  {
    id: 'run',
    n: '05',
    verb: 'Run',
    name: 'Built for you',
    badge: 'Made to order',
    line: 'Websites, apps and systems for your business, joined up with what you already use, like ServiceM8.',
    points: ['Enquiries that fill in your jobs', 'Quotes, chasing and paperwork on your phone', 'Tested on Raf Carpentry first'],
    href: '/systems',
    linkLabel: 'See the systems',
    external: false,
    flow: { title: 'Run the job in your system', sub: 'Quote, diary, paid' },
  },
];

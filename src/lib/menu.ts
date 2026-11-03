/* The pages, each with the sections people can jump to (PAGES), and the menu in the top bar (MENU). Each page shows
   its sections as # tags under its title; the menu shows # tags too (a panel under the menu on a computer, a + beside
   each item on a phone), which can point to other pages. Section ids here must match the ids on the pages. */

import { STEPS5 } from './steps';

export type MenuTag = { id: string; label: string; href?: string };
export type MenuItem = { href: string; label: string; kicker: string; title: string; line: string; tags: MenuTag[]; also?: string[] };

export const PAGES: MenuItem[] = [
  {
    href: '/systems',
    label: 'Systems',
    kicker: 'Running today',
    title: 'Three systems already doing the work',
    line: 'CabinetOS, the Job Kit and the wardrobe planner, all tested on my own jobs.',
    tags: [
      { id: 'cabinetos', label: 'CabinetOS' },
      { id: 'job-kit', label: 'Job Kit' },
      { id: 'planner', label: 'Wardrobe planner' },
      { id: 'next', label: 'Being built' },
    ],
  },
  {
    href: '/how-it-works',
    label: 'How it works',
    kicker: 'How I work',
    title: 'From your van to your phone',
    line: 'Four steps from the first visit, and one enquiry followed start to finish.',
    tags: [
      { id: 'steps', label: 'Four steps' },
      { id: 'enquiry', label: 'One enquiry, start to finish' },
      { id: 'questions', label: 'Questions' },
    ],
  },
  {
    href: '/servicem8',
    label: 'ServiceM8',
    kicker: 'ServiceM8',
    title: 'On ServiceM8? I already speak its language',
    line: 'What the systems read, what they write back, and what they never do.',
    tags: [
      { id: 'reads', label: 'What it reads' },
      { id: 'writes', label: 'What it writes' },
      { id: 'rules', label: 'What it never does' },
      { id: 'setup', label: 'What you need' },
      { id: 'integrations', label: 'Other connections' },
    ],
  },
  {
    href: '/trades',
    label: 'Trades',
    kicker: 'Who I build for',
    title: 'Trades that measure, quote and chase',
    line: 'Where the time goes in each trade, and what a system does about it.',
    tags: [
      { id: 'decorators', label: 'Decorators' },
      { id: 'carpenters', label: 'Carpenters and joiners' },
      { id: 'kitchen-fitters', label: 'Kitchen fitters' },
      { id: 'builders', label: 'Builders' },
      { id: 'electricians-plumbers', label: 'Electricians and plumbers' },
      { id: 'any-trade', label: 'Any small trade' },
    ],
  },
  {
    href: '/paint-schedule',
    label: 'Paint schedule',
    kicker: 'Being built now',
    title: 'Paint litres from the drawing',
    line: 'Try the calculator: doors, fronts, panels, coats, brush or spray.',
    tags: [
      { id: 'calculator', label: 'Try it' },
      { id: 'sums', label: 'How the sums work' },
      { id: 'app', label: 'The decorator’s app' },
    ],
  },
  {
    href: '/about',
    label: 'About',
    kicker: 'About',
    title: 'A carpenter built this. It actually works.',
    line: '22 years on the tools in London, and the business these systems run.',
    tags: [
      { id: 'story', label: 'My story' },
      { id: 'numbers', label: 'In numbers' },
      { id: 'company', label: 'The company' },
    ],
  },
];

export const CONTACT_ITEM: MenuItem = {
  href: '/contact',
  label: 'Contact',
  kicker: 'Start here',
  title: 'Tell me what slows you down',
  line: 'One message, straight into my ServiceM8.',
  tags: [
    { id: 'form', label: 'Send a message' },
    { id: 'details', label: 'Phone and WhatsApp' },
    { id: 'next-steps', label: 'What happens next' },
  ],
};

export const START_ITEM: MenuItem = {
  href: '/start',
  label: 'Start a project',
  kicker: 'Built for you',
  title: 'Start a project',
  line: 'Seven quick questions about the website, app or system you have in mind. About a minute.',
  tags: [],
};

export const BLOG_ITEM: MenuItem = {
  href: '/blog',
  label: 'Blog',
  kicker: 'Notes from the workshop',
  title: 'Everyday problems, made into tools',
  line: 'How each tool started: a problem on a real job, and what I built so it would not happen again.',
  tags: [],
};

const page = (href: string) => PAGES.find((p) => p.href === href)!;

/* The top bar: the five steps, the systems built for you (with the pages that belong to them), how it works, the
   blog and about. */
export const MENU: MenuItem[] = [
  {
    href: '/#steps',
    label: 'Five steps',
    kicker: 'One company, five steps',
    title: 'Learn, design, make, fit, run',
    line: 'One tool for each part of a job, from your first 3D click to a fitted, paid-for wardrobe. Three are free.',
    tags: STEPS5.map((s) => ({ id: s.id, label: `${s.verb}: ${s.name}`, href: `/#${s.id}` })),
  },
  {
    ...page('/systems'),
    label: 'Built for you',
    kicker: 'Step 5 · Run',
    title: 'Systems for trade businesses',
    line: 'Websites, apps and systems joined up with what you already use, like ServiceM8. Tested on my own jobs first.',
    also: ['/servicem8', '/trades', '/paint-schedule'],
    tags: [
      { id: 'cabinetos', label: 'CabinetOS', href: '/systems#cabinetos' },
      { id: 'job-kit', label: 'Job Kit', href: '/systems#job-kit' },
      { id: 'planner', label: 'Wardrobe planner', href: '/systems#planner' },
      { id: 'servicem8', label: 'ServiceM8', href: '/servicem8' },
      { id: 'trades', label: 'Trades', href: '/trades' },
      { id: 'paint', label: 'Paint schedule', href: '/paint-schedule' },
    ],
  },
  page('/how-it-works'),
  BLOG_ITEM,
  page('/about'),
];

export const tagHref = (item: MenuItem, tag: MenuTag) => tag.href ?? `${item.href}#${tag.id}`;

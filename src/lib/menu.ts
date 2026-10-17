/* The menu: each page with the sections people can jump to. The header shows these as # tags (a panel under the
   menu on a computer, a + beside each item on a phone), each page shows them under its title, and the home page
   uses them for its "Where to start" cards. Section ids here must match the ids on the pages. */

export type MenuTag = { id: string; label: string };
export type MenuItem = { href: string; label: string; kicker: string; title: string; line: string; tags: MenuTag[] };

export const MENU: MenuItem[] = [
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

export const tagHref = (item: MenuItem, tag: MenuTag) => `${item.href}#${tag.id}`;

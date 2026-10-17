/* The words used on more than one page, kept in one place. Only things that are true of Rafal's own systems today;
   anything not built yet says so ("Being built", "Ask me"). */

export const FLOW = [
  { title: 'The customer sends their brief', text: 'From the website: what they want, rough sizes, photos of the room. Or a 3D wardrobe they planned themselves.', tags: ['Website'], mine: false },
  { title: 'ServiceM8 fills itself in', text: 'A client, a contact and a Quote job are made, with their photos in the job diary. No typing.', tags: ['ServiceM8'], mine: false },
  { title: 'They get a thank-you straight away', text: 'An email with three designs like theirs, sent through ServiceM8 and filed on the job.', tags: ['ServiceM8', 'Email'], mine: false },
  { title: 'The design becomes a cut list', text: 'A wardrobe planned on the website arrives as a CabinetOS project with the parts already worked out.', tags: ['CabinetOS'], mine: false },
  { title: 'My phone puts it at the top of Today', text: '“New enquiry” sits above the visits, follow-ups and money owed, in the order things need doing.', tags: ['Job Kit'], mine: true },
  { title: 'Claude drafts the reply; I press send', text: 'A first draft in my words, using what they wrote. Nothing goes until I have read it.', tags: ['Claude', 'Outlook'], mine: true },
  { title: 'The visit goes in the diary', text: 'Booked in ServiceM8’s schedule, confirmed on WhatsApp with the message already typed.', tags: ['ServiceM8', 'WhatsApp'], mine: true },
  { title: 'Quote, work, paid, reviewed', text: 'Quote to Work Order to Completed, with every payment and what is left. Then a Google review request, ready to send.', tags: ['ServiceM8', 'Google'], mine: true },
];

export const STEPS = [
  { when: '01 · Half a day', title: 'I watch the job', text: 'On site or in the van. I write down every step that costs you time or money.' },
  { when: '02 · 2 days', title: 'You try a mockup', text: 'A clickable version on your own phone. We change it until it feels right.' },
  { when: '03 · 2 to 4 weeks', title: 'I build it', text: 'Connected to what you already use, like ServiceM8, Outlook and WhatsApp, and tested on real jobs.' },
  { when: '04 · Every month', title: 'It keeps up', text: 'Fixes and small changes as the business grows. You own what I build.' },
];

export const INTEGRATIONS = [
  { name: 'Microsoft 365', what: 'Read your inbox and reply from your own address, with drafts you approve.', where: 'Job Kit inbox' },
  { name: 'WhatsApp', what: 'Confirmations, follow-ups and review requests with the message already typed.', where: 'Job Kit, websites' },
  { name: 'Claude', what: 'First drafts of replies and quotes. It never sends anything by itself.', where: 'Job Kit' },
  { name: 'Stripe', what: 'Card payments and monthly plans, with failed-payment emails handled.', where: 'CabinetOS' },
  { name: 'Supabase', what: 'Accounts and saved projects, so your work is there on every device.', where: 'CabinetOS' },
  { name: 'SketchUp', what: 'Every finished job drawn in 3D, so customers can turn it round and open the doors.', where: 'rafcarpentry.com' },
  { name: 'Public records', what: 'Land Registry, energy certificates and planning history for the property before a visit.', where: 'Job Kit' },
  { name: 'Postcodes', what: 'Type a postcode, get the street and area. Jobs near a customer worked out in miles.', where: 'rafcarpentry.com' },
];

export type Trade = { id: string; name: string; status: 'Running' | 'Being built' | 'Ask me'; trade: string; short: string; time: string[]; system: string[]; link?: { href: string; label: string } };

export const TRADES: Trade[] = [
  {
    id: 'decorators',
    name: 'Decorators',
    status: 'Being built',
    trade: 'Decorator',
    short: 'Paint litres and shopping lists from the drawing, by hand or spray. Quotes that count every door.',
    time: ['Working out litres and tins for every job', 'Quotes written by hand in the evening', 'Spray jobs where the paint runs out halfway'],
    system: ['Paint schedule: litres and tins per coat, brush or spray', 'Quotes priced from the schedule and your own rates', 'Door and panel sizes straight from the carpenter’s CabinetOS drawing'],
    link: { href: '/paint-schedule', label: 'Try the paint schedule' },
  },
  {
    id: 'carpenters',
    name: 'Carpenters and joiners',
    status: 'Running',
    trade: 'Carpenter or joiner',
    short: 'Cut lists, board layouts, 3D designs for clients and a wardrobe planner on your website.',
    time: ['Cut lists and board orders worked out by hand', 'Drawings to show the client before they say yes', 'Enquiries with no sizes and no photos'],
    system: ['CabinetOS: parts, cut list and board layouts from the drawing', 'A 3D design the client can turn round on their phone', 'A wardrobe planner on your website that sends you the job'],
    link: { href: '/systems#cabinetos', label: 'See CabinetOS' },
  },
  {
    id: 'kitchen-fitters',
    name: 'Kitchen fitters',
    status: 'Ask me',
    trade: 'Kitchen fitter',
    short: 'Fitting packs, appliance and worktop lists, snagging photos sent to the client.',
    time: ['Chasing the client for appliance and worktop decisions', 'Snagging lists on scraps of paper', 'Fitting days lost to a missing part'],
    system: ['A fitting pack per kitchen: units, appliances, worktop and fixings', 'Decisions the client still owes you, with a reminder ready to send', 'Snagging photos filed on the job and sent to the client'],
  },
  {
    id: 'builders',
    name: 'Builders and renovators',
    status: 'Ask me',
    trade: 'Builder',
    short: 'Stage payments, extras agreed in writing, and a weekly update the client can read.',
    time: ['Keeping track of stage payments and what is left', 'Extras agreed on site and argued about later', 'Clients asking “how is it going?” every day'],
    system: ['Stage payments with what is paid and what is left, from ServiceM8', 'Extras agreed in writing before the work starts', 'A weekly photo update drafted for you to send'],
  },
  {
    id: 'electricians-plumbers',
    name: 'Electricians and plumbers',
    status: 'Ask me',
    trade: 'Electrician',
    short: 'Job sheets, parts lists and certificates filed on the job, not in the van.',
    time: ['Certificates and job sheets typed up after work', 'Parts lists rebuilt from memory for every job', 'Yearly checks nobody reminds the customer about'],
    system: ['Job sheets and certificates filed on the ServiceM8 job from your phone', 'Parts lists picked from your usual parts', 'A reminder ready to send when a yearly check is due'],
  },
  {
    id: 'any-trade',
    name: 'Any small trade business',
    status: 'Ask me',
    trade: 'Something else',
    short: 'Enquiries in one list, a diary, money owed and review requests on your phone.',
    time: ['Enquiries spread across WhatsApp, email and voicemail', 'Forgetting who you promised to call back', 'Never getting round to asking for reviews'],
    system: ['Every enquiry in one list in ServiceM8, photos included', 'Today on your phone: visits, follow-ups and money owed', 'Finished jobs ask for their Google review; you press send'],
  },
];

export const statusClass = (s: Trade['status']) => (s === 'Running' ? 'pill live' : s === 'Being built' ? 'pill built' : 'pill');

export const FAQ = [
  { q: 'Do I own what you build?', a: 'Yes. It runs in your own accounts: your ServiceM8, your domain, your hosting. The code is yours too, so you are never stuck with me.' },
  {
    q: 'I don’t use ServiceM8. Can you still help?',
    a: 'Yes. I can set ServiceM8 up for you and move your customers across, or look at what your current software allows and connect to that. Tell me what you use and I will check before you spend anything.',
  },
  { q: 'How fast is it?', a: 'You get a clickable mockup on your phone within 2 days of the visit. A working version takes 2 to 4 weeks, depending on how many parts it has, and you use each part as soon as it is ready.' },
  { q: 'What does it cost?', a: 'It depends on the size of the system, so you get a fixed price after the half-day visit, before any work starts. No price changes halfway through.' },
  { q: 'Will it work on my phone?', a: 'Yes. Everything is built for the phone first and goes on your home screen like an app, without the App Store. It keeps working with no signal and catches up when you are back online.' },
  { q: 'What happens to my customers’ details?', a: 'They stay in your accounts. My systems pass details between your phone, your server and your job software only. Messages to customers go only when you press send.' },
];

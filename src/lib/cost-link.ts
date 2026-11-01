/* Where the menu's and footer's prices link goes. While one job is on (COST_LIVE in src/lib/cost-calculator.ts)
   it goes straight to that job's page, and /cost redirects there too; with more on, change it to
   { href: '/cost', label: 'Cost calculator' }. No imports, so the menu can use it without loading every job's
   words; scripts/cost-calculator/check.mjs fails if this and COST_LIVE disagree. */
export const COST_LINK = { href: '/cost/fitted-wardrobes', label: 'Wardrobe prices' };

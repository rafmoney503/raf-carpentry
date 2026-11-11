/* Every app HQ watches. To add one: its Vercel project id, the address it lives at, and which pages count as its
   home page (so HQ can say how many people saw only that). `extras` are counts of people who opened a kind of page,
   written as a Vercel Web Analytics filter (OData: route, requestPath, startswith...). */

export type Extra = { key: string; label: string; filter: string };

export type Site = {
  key: string;
  name: string;
  sub: string;
  project: string;
  vercelName: string;
  url: string;
  initial: string;
  color: string; // on light backgrounds
  ink: string; // text on `color`
  light: string; // on dark backgrounds
  home: string; // filter for the home page
  extras: Extra[];
};

export const TEAM_ID = 'team_pc2mKRP43Mre23IApQxx0jyl';

export const SITES: Site[] = [
  {
    key: 'rafcarpentry',
    vercelName: 'raf-carpentry',
    name: 'rafcarpentry.com',
    sub: 'Raf Carpentry',
    project: 'prj_IkzuBXXOBx9bpqK3nZEduUPQyPAM',
    url: 'https://www.rafcarpentry.com',
    initial: 'R',
    color: '#2547d0',
    ink: '#ffffff',
    light: '#7d97ff',
    home: "requestPath eq '/'",
    extras: [
      { key: 'games', label: 'played Workshop Games', filter: "startswith(requestPath, '/tools/games')" },
    ],
  },
  {
    key: 'cabinetos',
    vercelName: 'cabinetos-site',
    name: 'CabinetOS',
    sub: 'cabinetos.co.uk',
    project: 'prj_NAMxl5ZbJIfUKK7ZS5drlffMd1iF',
    url: 'https://www.cabinetos.co.uk',
    initial: 'C',
    color: '#1f8f4e',
    ink: '#ffffff',
    light: '#48c47e',
    home: "route eq '/'",
    extras: [
      { key: 'app', label: 'used the app', filter: "startswith(route, '/app')" },
      { key: 'demo', label: 'tried the demo', filter: "startswith(route, '/demo')" },
    ],
  },
  {
    key: 'builditin3d',
    vercelName: 'builditin3d',
    name: 'Build It in 3D',
    sub: 'builditin3d.com',
    project: 'prj_mkqMcs4CNN0MrsVzMzcAvE5kwAn6',
    url: 'https://builditin3d.com',
    initial: '3D',
    color: '#ffc531',
    ink: '#121417',
    light: '#ffc531',
    home: "route eq '/[lang]' or requestPath eq '/'",
    extras: [
      { key: 'lesson', label: 'opened a lesson', filter: "route eq '/[lang]/courses/[course]/[lesson]'" },
      { key: 'games', label: 'played a game', filter: "startswith(route, '/[lang]/games/')" },
    ],
  },
  {
    key: 'rafalsolutions',
    vercelName: 'rafal-solutions',
    name: 'Rafal Solutions',
    sub: 'rafalsolutions.co.uk',
    project: 'prj_0q6OCvpqX9a2uCSlM6gnPbHUhReG',
    url: 'https://www.rafalsolutions.co.uk',
    initial: 'RS',
    color: '#121417',
    ink: '#ffe45c',
    light: '#f7f6f2',
    home: "requestPath eq '/'",
    extras: [],
  },
  {
    key: 'builtforyou',
    vercelName: 'built-for-you',
    name: 'Built for you',
    sub: 'app.rafalsolutions.co.uk',
    project: 'prj_7PqQ6aQSfwrc9cfO6kLYhL9CRVLE',
    url: 'https://app.rafalsolutions.co.uk',
    initial: 'B',
    color: '#6d4ad8',
    ink: '#ffffff',
    light: '#a48bff',
    home: "requestPath eq '/'",
    extras: [],
  },
];

export function siteByKey(key: string): Site | undefined {
  return SITES.find((s) => s.key === key);
}

/* Friendlier names for where visitors came from. */
const SOURCE_NAMES: [RegExp, string][] = [
  [/^classroom\.google\./, 'Google Classroom'],
  [/^(www\.)?google\./, 'Google search'],
  [/^(www\.)?bing\.com$/, 'Bing'],
  [/^(www\.)?duckduckgo\.com$/, 'DuckDuckGo'],
  [/^(search\.)?yahoo\./, 'Yahoo'],
  [/^(www\.)?ecosia\.org$/, 'Ecosia'],
  [/^(chatgpt\.com|chat\.openai\.com)$/, 'ChatGPT'],
  [/^(www\.)?perplexity\.ai$/, 'Perplexity'],
  [/^(copilot\.microsoft\.com)$/, 'Copilot'],
  [/^(l\.|m\.|www\.)?facebook\.com$/, 'Facebook'],
  [/^(l\.|www\.)?instagram\.com$/, 'Instagram'],
  [/^(www\.)?tiktok\.com$/, 'TikTok'],
  [/^(www\.|m\.)?youtube\.com$/, 'YouTube'],
  [/^(t\.co|x\.com|twitter\.com)$/, 'X'],
  [/^(www\.)?linkedin\.com$/, 'LinkedIn'],
  [/^(www\.)?reddit\.com$/, 'Reddit'],
  [/^(api\.)?whatsapp\.com$|^wa\.me$/, 'WhatsApp'],
  [/^com\.google\.android\.gm$|^mail\.google\.com$/, 'Gmail'],
  [/^github\.com$/, 'GitHub'],
  [/^(www\.)?rafcarpentry\.com$/, 'rafcarpentry.com'],
  [/^(www\.)?cabinetos\.co\.uk$/, 'CabinetOS'],
  [/^builditin3d\.com$/, 'Build It in 3D'],
  [/^(www\.)?rafalsolutions\.co\.uk$/, 'Rafal Solutions'],
];

export function sourceName(host: string): string {
  const h = host.toLowerCase();
  for (const [re, name] of SOURCE_NAMES) if (re.test(h)) return name;
  return h.replace(/^www\./, '');
}

/* Sources that are one place under several host names, counted together. */
export function sourceKey(host: string): string {
  return sourceName(host).toLowerCase().replace(/[^a-z0-9.]+/g, '-');
}

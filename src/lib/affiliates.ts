// Add your Amazon affiliate links here.
// Update the URL once — it's used across the whole site (tools page, blog posts, etc.)
// To add a new tool: copy a line, change the key, name, url, and category.

export const affiliateLinks: Record<string, { name: string; url: string; category: string }> = {
  // Power Tools
  'makita-track-saw':     { name: 'Makita Track Saw',           url: '#', category: 'Power Tools' },
  'festool-domino':       { name: 'Festool Domino Joiner',      url: '#', category: 'Power Tools' },
  'makita-drill':         { name: 'Makita Cordless Drill',       url: '#', category: 'Power Tools' },
  'makita-jigsaw':        { name: 'Makita Cordless Jigsaw',      url: '#', category: 'Power Tools' },

  // Hand Tools
  'stanley-tape':         { name: 'Stanley FatMax Tape 5m',      url: '#', category: 'Hand Tools' },
  'irwin-chisels':        { name: 'Irwin Marples Chisels',       url: '#', category: 'Hand Tools' },
  'bahco-saw':            { name: 'Bahco Hand Saw',              url: '#', category: 'Hand Tools' },
  'stabila-level':        { name: 'Stabila Spirit Level',         url: '#', category: 'Hand Tools' },

  // Measuring
  'bosch-laser':          { name: 'Bosch Laser Measure',         url: '#', category: 'Measuring' },
  'shinwa-square':        { name: 'Shinwa Combination Square',   url: '#', category: 'Measuring' },
  'incra-rule':           { name: 'Incra T-Rule',                url: '#', category: 'Measuring' },

  // Software
  'sketchup-pro':         { name: 'SketchUp Pro',                url: '#', category: 'Software' },
};

// Helper: get a link by key
export function getAffiliateUrl(key: string): string {
  return affiliateLinks[key]?.url || '#';
}

export function getAffiliateName(key: string): string {
  return affiliateLinks[key]?.name || key;
}

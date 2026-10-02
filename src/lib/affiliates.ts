// Raf's products and their links, mirrored from the Products tab of his Google Sheet
// "Raf Carpentry Amazon links" by scripts/links-from-sheet.py (only Confirmed rows get a link; '#' means not yet).

export const affiliateLinks: Record<string, { name: string; url: string; category: string }> = {
  // Power Tools
  "festool-track-saw": { name: "Festool TSC 55 KEB Track Saw", url: "https://link.amazon/B09cZDeJP", category: "Power Tools" },
  "festool-domino": { name: "Festool Domino Joiner", url: "https://link.amazon/B0fjrVzgM", category: "Power Tools" },
  "dewalt-drill": { name: "DeWalt Cordless Drill", url: "#", category: "Power Tools" },
  "dewalt-jigsaw": { name: "DeWalt Cordless Jigsaw", url: "https://link.amazon/B0i0c5CMu", category: "Power Tools" },
  "festool-guide-rail": { name: "Festool Guide Rail 1400 mm", url: "#", category: "Power Tools" },
  "dewalt-impact-driver": { name: "DeWalt Impact Driver", url: "https://link.amazon/B0dwGcKYq", category: "Power Tools" },
  "dewalt-mitre-saw": { name: "DeWalt Mitre Saw", url: "https://link.amazon/B05c5GsFX", category: "Power Tools" },
  "dewalt-sander": { name: "DeWalt Random Orbital Sander", url: "https://link.amazon/B031DQY1u", category: "Power Tools" },
  "dewalt-multi-tool": { name: "DeWalt Multi-Tool", url: "https://link.amazon/B06LvLFsZ", category: "Power Tools" },
  "makita-trim-router": { name: "Makita Trim Router", url: "https://link.amazon/B0036Ifid", category: "Power Tools" },
  "dewalt-pin-nailer": { name: "DeWalt Finish Nailer", url: "https://link.amazon/B09m5xhew", category: "Power Tools" },
  "festool-guide-rail-2400": { name: "Festool Guide Rail 2400 mm", url: "https://link.amazon/B02jNHys2", category: "Power Tools" },

  // Hand Tools
  "stanley-tape": { name: "Stanley FatMax Tape Measure 5m", url: "https://link.amazon/B0gnYBmMd", category: "Hand Tools" },
  "irwin-chisels": { name: "Irwin Marples Chisels", url: "https://link.amazon/B0d24xz9j", category: "Hand Tools" },
  "bahco-saw": { name: "Bahco Hand Saw", url: "#", category: "Hand Tools" },
  "stabila-level": { name: "Stabila Spirit Level", url: "https://link.amazon/B01e0FQsL", category: "Hand Tools" },
  "stabila-electronic-level": { name: "Stabila Digital Level", url: "https://link.amazon/B01AH95gQ", category: "Hand Tools" },

  // Measuring & Layout
  "bosch-laser": { name: "Bosch Laser Measure", url: "https://link.amazon/B0a1GvdVU", category: "Measuring & Layout" },
  "shinwa-square": { name: "Shinwa Combination Square", url: "#", category: "Measuring & Layout" },
  "incra-rule": { name: "Incra T-Rule", url: "#", category: "Measuring & Layout" },
  "dewalt-laser-level": { name: "DeWalt Laser Level", url: "https://link.amazon/B0elL28Zc", category: "Measuring & Layout" },

  // Software & Digital
  "sketchup-pro": { name: "SketchUp Pro", url: "https://www.sketchup.com/", category: "Software & Digital" },
  "cabinetos": { name: "Cabinetos", url: "/cabinetos", category: "Software & Digital" },

  // Workshop & Site
  "henry-vacuum": { name: "Henry Vacuum", url: "https://link.amazon/B08MSwRs2", category: "Workshop & Site" },
};

// Helper: get a link by key
export function getAffiliateUrl(key: string): string {
  return affiliateLinks[key]?.url || '#';
}

// Amazon links (full or short) are paid links: they get rel="sponsored" and the Associate sentence.
export function isAmazonLink(href?: string): boolean {
  return Boolean(href && /(^|\/\/|\.)(amazon\.|amzn\.|link\.amazon)/.test(href));
}

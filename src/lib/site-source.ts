/* Where a visit came from, worked out from the referring address and ?utm_source=. No imports, so the visit counter
   (site-stats-server.ts) and the page both use it: the PAX guide's Buy button sends the same word to Stripe, so a
   sale says how its buyer found the page (19 Nov 2026). Links in posts carry ?utm_source=threads / youtube, because
   those apps often send no referrer and the visit would read as typed in. */

export const CAMPAIGN_TAGS = /^(pwa|pwa-new|pwa-games|pwa-games-new|pwa-calc|beat|qr-[a-z0-9]{2,16}|email-[a-z0-9]{2,16}|quote|booked|invoice|review|launch-email|gbp|groups|ads-[a-z0-9]{2,16})$/;

/* Where a visit came from, from the referring address (or ?utm_source=). */
export function sourceOf(ref: string, utm: string): { kind: string; host: string } {
  let host = '';
  try {
    host = ref ? new URL(ref).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch {
    host = '';
  }
  const u = utm.toLowerCase();
  // the Workshop Tools and Workshop Games tags (QR codes, emails, the home-screen icons, score links) are kept as they are,
  // so the Job Kit shows each one (SOURCE_LABEL in site-stats.ts); '-new' = the app's first open from that phone's home
  // screen (SiteStats homeTag), so an install
  if (CAMPAIGN_TAGS.test(u)) return { kind: u, host: host.slice(0, 80) };
  const test = (re: RegExp) => re.test(u) || re.test(host);
  const kind = test(/(^|\.)google\.|^google$/)
    ? 'google'
    : test(/bing\.com|^bing$/)
      ? 'bing'
      : test(/duckduckgo/)
        ? 'duckduckgo'
        : test(/yahoo\./)
          ? 'yahoo'
          : test(/ecosia/)
            ? 'ecosia'
            : test(/chatgpt|openai/)
              ? 'chatgpt'
              : test(/perplexity|claude\.ai|gemini\.google|copilot\.microsoft/)
                ? 'ai'
                : test(/instagram|^ig$/)
                  ? 'instagram'
                  : test(/threads\.(net|com)|^threads$/)
                    ? 'threads'
                    : test(/etsy\.com|^etsy$/)
                      ? 'etsy'
                  : test(/facebook|^fb$|fb\.com|fb\.me/)
                    ? 'facebook'
                    : test(/tiktok/)
                      ? 'tiktok'
                      : test(/youtube|youtu\.be/)
                        ? 'youtube'
                        : test(/pinterest/)
                          ? 'pinterest'
                          : test(/linkedin|lnkd\.in/)
                            ? 'linkedin'
                            : test(/^t\.co$|twitter|^x\.com$|^x$/)
                              ? 'x'
                              : test(/whatsapp|^wa\.me$/)
                                ? 'whatsapp'
                                : test(/mail\.|outlook|^email$|^newsletter$/)
                                  ? 'email'
                                  : test(/rafalsolutions/)
                                    ? 'rafalsolutions'
                                    : test(/cabinetos/)
                                      ? 'cabinetos'
                                      : test(/checkatrade|mybuilder|ratedpeople|trustatrader|yell\.com|houzz|bark\.com|nextdoor/)
                                        ? 'directory'
                                        : host || u
                                          ? 'other'
                                          : 'direct';
  return { kind, host: host.slice(0, 80) };
}

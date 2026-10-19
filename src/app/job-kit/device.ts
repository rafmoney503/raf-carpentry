/* What this device is called where the other one names it ('In step with your iPhone', 'the photos are on your
   iPhone'): from the browser. */
export function deviceLabel() {
  if (typeof navigator === 'undefined') return 'computer';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows computer';
  return 'computer';
}

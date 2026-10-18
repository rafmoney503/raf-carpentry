'use client';

import { Analytics } from '@vercel/analytics/next';
import { statsOff } from '@/lib/site-stats';

/* Vercel Web Analytics (page views only, no cookies), skipping anyone who opted out on /privacy (and Raf's own
   phone, marked by the Job Kit) and pages shown inside the Job Kit's heatmaps. */
export default function VercelAnalytics() {
  return <Analytics beforeSend={(e) => (statsOff() || window.top !== window.self ? null : e)} />;
}

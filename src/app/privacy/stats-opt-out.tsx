'use client';

import { useSyncExternalStore } from 'react';
import { setStatsOff, statsOff } from '@/lib/site-stats';

/* The privacy page's switch for the website stats: kept in this browser only (raf_stats_off), the one thing the
   site stores for it. Also stops Vercel's page counts (src/components/VercelAnalytics.tsx). */
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === null || e.key === 'raf_stats_off' ? fn() : undefined;
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
};

export default function StatsOptOut() {
  const off = useSyncExternalStore(subscribe, statsOff, () => false);
  const flip = () => {
    setStatsOff(!off);
    listeners.forEach((fn) => fn());
  };
  return (
    <div className="mt-6 rounded-sm border border-line-strong bg-mount p-5">
      <p className="font-semibold" aria-live="polite">
        {off ? 'Your visits aren’t counted in this browser.' : 'Your visits are counted in this browser, without your name.'}
      </p>
      <button type="button" onClick={flip} className={`btn btn-sm mt-4 ${off ? 'btn-ghost' : 'btn-primary'}`}>
        {off ? 'Count my visits again' : 'Don’t count my visits'}
      </button>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">
        This is remembered in this browser only. On another phone or computer, or after clearing your browser’s data, tap it there too.
      </p>
    </div>
  );
}

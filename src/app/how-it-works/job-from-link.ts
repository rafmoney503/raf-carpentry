'use client';
import { useEffect, useState } from 'react';

/* "Get a quote" on a job page opens /how-it-works?job=<slug>. The page header and the brief both
   show that job, and the brief puts it at the top of the message. Removing it in the brief drops
   ?job from the address and tells the header to hide its note too. */

export type JobRef = { slug: string; title: string; area: string; cover: string };

const EVENT = 'raf:briefjob';

function readSlug() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('job') ?? '';
}

export function useJobFromLink(jobs: JobRef[]) {
  const [job, setJob] = useState<JobRef | null>(null);
  useEffect(() => {
    const sync = () => setJob(jobs.find((j) => j.slug === readSlug()) ?? null);
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('popstate', sync);
    };
  }, [jobs]);
  return job;
}

export function clearJobFromLink() {
  const url = new URL(window.location.href);
  url.searchParams.delete('job');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(EVENT));
}

export const jobUrl = (slug: string) => `https://www.rafcarpentry.com/portfolio/${slug}`;

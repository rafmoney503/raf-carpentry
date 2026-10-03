'use client';
import Image from 'next/image';
import { useJobFromLink, type JobRef } from './job-from-link';

/* Under the page title: "You're asking about: <job>", so a customer who pressed Get a quote on a
   job page sees it was picked up. Hidden when they arrived any other way. */
export default function JobNote({ jobs }: { jobs: JobRef[] }) {
  const job = useJobFromLink(jobs);
  if (!job) return null;
  return (
    <a href="#brief" className="mt-6 flex max-w-[560px] items-center gap-3.5 rounded-sm border border-line-strong bg-mount p-2.5 pr-4 transition-colors hover:border-accent">
      <span className="relative h-14 w-14 flex-none overflow-hidden rounded-[2px] bg-raised">
        <Image src={job.cover} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="min-w-0 text-[14.5px] leading-snug text-muted">
        <span className="block font-mono text-[12px] text-accent">Something like this job</span>
        <span className="line-clamp-2 block font-medium text-ink">{job.title}, {job.area}</span>
        <span className="block">It&apos;s already in your brief below.</span>
      </span>
    </a>
  );
}

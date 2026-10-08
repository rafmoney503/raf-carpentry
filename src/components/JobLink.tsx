'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { preloadJobCover } from '@/lib/job-cover';

/* A link to a job page that starts loading the job's main photo as soon as a mouse or finger
   reaches it, so the photo is ready when it grows into the page. */
export default function JobLink({ cover, ...props }: ComponentProps<typeof Link> & { cover: string }) {
  const ready = () => preloadJobCover(cover);
  return <Link {...props} onPointerEnter={ready} onPointerDown={ready} onFocus={ready} />;
}

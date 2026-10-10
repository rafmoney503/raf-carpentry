import type { Metadata, Viewport } from 'next';
import { getAllProjects } from '@/lib/projects';
import JobKitApp, { type Done } from './job-kit-app';

/* Raf's Job Kit: a phone app (add to home screen) for the photos, clips, sizes and notes of each job,
   following the "Job photo and video checklist". Files go to a private GitHub inbox as they are taken
   (src/lib/job-kit-server.ts) and Claude turns a sent job into a job page, 3D model and blog post
   (scripts/job-kit-fetch.py). Not linked anywhere and not in Google. */

export const metadata: Metadata = {
  title: 'Job Kit | Raf Carpentry',
  description: 'Photos, clips and sizes from each job.',
  robots: { index: false, follow: false },
  manifest: '/job-kit.webmanifest',
  appleWebApp: { capable: true, title: 'Job Kit', statusBarStyle: 'default' },
  icons: { apple: '/images/job-kit/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function JobKitPage() {
  // Jobs Claude has turned into pages (their job JSON has `jobKit`), so the app can say "On your website".
  // The page is rebuilt on every deploy, and making a job page always ends with one.
  const done: Done = {};
  for (const p of getAllProjects()) if (p.jobKit) done[p.jobKit] = { slug: p.slug, title: p.title };
  return <JobKitApp done={done} />;
}

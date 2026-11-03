import type { StepId } from '@/lib/steps';

/* The blog: notes from the workshop on how each tool started, from a problem on a real job. The words of each post
   are in a markdown file of the same name in this folder (read on the server, src/lib/blog.ts); this list is small
   enough for the site search to use in the browser. Newest first. `step` gives the post its colour. */

export type PostMeta = { slug: string; title: string; summary: string; date: string; step: StepId | 'all'; minutes: number };

export const POSTS: PostMeta[] = [
  {
    slug: 'every-tool-started-as-a-problem',
    title: 'Every tool here started as a problem on a job',
    summary: 'Why Rafal Solutions makes tools at all, why three of the five are free, and what this blog is for.',
    date: '2026-11-03',
    step: 'all',
    minutes: 3,
  },
  {
    slug: 'learning-3d-from-the-first-click',
    title: 'Learning 3D from the very first click',
    summary: 'Build It in 3D starts before any drawing tool: the mouse, zoom, draw, push and pull. For kids and grandparents too.',
    date: '2026-11-03',
    step: 'learn',
    minutes: 3,
  },
  {
    slug: 'from-the-drawing-to-the-cut-list',
    title: 'From the drawing to the cut list, without typing it twice',
    summary: 'How a wardrobe drawn in SketchUp becomes parts, board layouts and bench drawings in CabinetOS.',
    date: '2026-11-03',
    step: 'make',
    minutes: 3,
  },
  {
    slug: 'hinges-that-miss-the-shelves',
    title: 'Hinges that miss the shelves, and other sums for site',
    summary: 'The Workshop Tools are small phone tools for the sums you do on every fit. They are free.',
    date: '2026-11-03',
    step: 'fit',
    minutes: 3,
  },
  {
    slug: 'one-enquiry-typed-once',
    title: 'One enquiry, typed once',
    summary: 'What happens between a customer pressing send on my website and the job being paid, and why nobody retypes it.',
    date: '2026-11-03',
    step: 'run',
    minutes: 4,
  },
];

export const STEP_LABEL: Record<PostMeta['step'], string> = {
  all: 'All five steps',
  learn: 'Learn',
  design: 'Design',
  make: 'Make',
  fit: 'Fit',
  run: 'Run',
};

export const postDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });

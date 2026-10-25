import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Which build this is: the Job Kit compares it with the live one (/api/job-kit/version) and loads a new version by
     itself (src/app/job-kit/update.ts). Vercel's commit id, else the time of the build. */
  env: {
    JK_BUILD: process.env.VERCEL_GIT_COMMIT_SHA || process.env.JK_BUILD || String(Date.now()),
  },
  /* The photos, videos and 3D models in public/ are served straight from Vercel's CDN, never by a server
     function. A few pages and sharing pictures check or read public/ files with fs while the site is being
     built, so Next.js traced the whole folder (over 200 MB) into every server function, and with the blog
     photos added on 10 Oct 2026 the functions went over Vercel's 250 MB limit and deploys failed.
     The build still sees every file; only the traced copies are left out. */
  /* rafcarpentry.com/app: the short address for the Workshop Tools app on cards, QR codes and emails
     (?utm_source=... is passed on, so the Job Kit's Website stats show where each person came from). */
  async redirects() {
    return [{ source: '/app', destination: '/tools/workshop', permanent: false }];
  },
  outputFileTracingExcludes: {
    "**": ["public/**/*"],
  },
  /* The Job Kit asks which design requests have a page yet and where each stands (on /designs, built into a job);
     that route reads content/designs and the jobs at run time. */
  outputFileTracingIncludes: {
    "/api/job-kit/designs": ["./content/designs/*.json", "./content/projects/*.json", "./content/pages/*.json"],
    /* Send to Raf matches the brief to the job models (src/lib/design-library.ts reads these at run time). */
    "/api/brief": ["./content/projects/*.json", "./content/pages/*.json", "./content/designs/*.json"],
    /* The recently looked at card names the jobs (src/lib/recent-designs.ts reads these at run time). */
    "/api/recent": ["./content/projects/*.json", "./content/pages/*.json", "./content/designs/*.json"],
    /* Blog stats in the Job Kit name every post and its topic (src/lib/blog.ts and projects.ts read these at run time). */
    "/api/job-kit/stats": ["./content/blog/*.md", "./content/projects/*.json"],
  },
};

export default nextConfig;

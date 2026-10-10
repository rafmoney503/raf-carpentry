import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The photos, videos and 3D models in public/ are served straight from Vercel's CDN, never by a server
     function. A few pages and sharing pictures check or read public/ files with fs while the site is being
     built, so Next.js traced the whole folder (over 200 MB) into every server function, and with the blog
     photos added on 10 Oct 2026 the functions went over Vercel's 250 MB limit and deploys failed.
     The build still sees every file; only the traced copies are left out. */
  outputFileTracingExcludes: {
    "**": ["public/**/*"],
  },
  /* The Job Kit asks which design requests have a page yet; that route reads content/designs at run time. */
  outputFileTracingIncludes: {
    "/api/job-kit/designs": ["./content/designs/*.json"],
  },
};

export default nextConfig;

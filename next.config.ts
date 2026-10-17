import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* rafalsolutions.co.uk (no www) goes to www.rafalsolutions.co.uk; that redirect is set on the domain in
     Vercel > Domains, not here. */
  poweredByHeader: false,
  images: {
    /* The photos and CabinetOS screenshots are the ones already published on rafcarpentry.com (its public/images
       folder), so they live in one place. To keep a copy here instead, put the files in public/img and change
       IMG in src/lib/site.ts to '/img'. */
    remotePatterns: [{ protocol: 'https', hostname: 'www.rafcarpentry.com', pathname: '/images/**' }],
  },
};

export default nextConfig;

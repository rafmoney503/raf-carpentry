import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // www.rafcarpentry.com is the main address. Anyone landing on the Vercel address
  // is sent there permanently (308), keeping the page they asked for.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "raf-carpentry.vercel.app" }],
        destination: "https://www.rafcarpentry.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

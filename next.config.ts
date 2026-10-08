import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React <ViewTransition>: job photos grow from their card into the job page; pages fade across (woodwork.css)
    viewTransition: true,
  },
};

export default nextConfig;

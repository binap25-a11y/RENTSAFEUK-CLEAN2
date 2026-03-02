
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // In Next.js 15, this is a top-level property
  serverExternalPackages: ['firebase'],
};

export default nextConfig;

import type { NextConfig } from 'next';

/**
 * RentSafeUK Next.js Configuration
 * Includes fixes for Cross-Origin script loading in Cloud Workstations.
 */
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['firebase'],
  experimental: {
    // Enable cross-origin requests from the dev environment to prevent ChunkLoadErrors
    // and HMR connection timeouts in proxied environments.
    allowedDevOrigins: [
      '*.cloudworkstations.dev',
      'localhost:9002',
      '0.0.0.0:9002'
    ]
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      }
    ],
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['firebase'],
  experimental: {
    // Suppress cross-origin warnings in the workstation environment
    allowedDevOrigins: ['*.cloudworkstations.dev'],
  },
  images: {
    // Disable Image Optimization globally for compatibility with Netlify deployments
    // using external storage like Firebase and Supabase.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'owfjowiiyshhqzhatwqr.supabase.co',
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

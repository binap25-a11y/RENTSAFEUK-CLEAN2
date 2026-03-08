
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['firebase'],
  images: {
    // Critical for Netlify: Disable global image optimization to allow direct serving from external storage
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
  // Fix for Cloud Workstations cross-origin issues during preview
  experimental: {
    allowedDevOrigins: [
      '*.cloudworkstations.dev',
      '*.cluster-ikslh4rdsnbqsvu5nw3v4dqjj2.cloudworkstations.dev'
    ]
  }
};

export default nextConfig;

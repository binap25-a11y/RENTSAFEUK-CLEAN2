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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'owfjowiiyshhqzhatwqr.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      }
    ],
  },
  // Silence workstation CORS warnings
  experimental: {
    allowedDevOrigins: [
      '*.cloudworkstations.dev',
      'localhost:9000',
      'localhost:9002'
    ]
  }
};

export default nextConfig;

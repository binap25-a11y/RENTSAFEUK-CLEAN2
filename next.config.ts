
import type {NextConfig} from 'next';

// This is a configuration file for Next.js.
const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['firebase'],
};

export default nextConfig;

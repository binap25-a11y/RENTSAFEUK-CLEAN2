
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
  experimental: {
    allowedDevOrigins: ["https://*.cloudworkstations.dev"],
  },
};

export default nextConfig;

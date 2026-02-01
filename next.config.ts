
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
  allowedDevOrigins: ['https://6000-firebase-rentsafeuk-test-1769862118961.cluster-ikslh4rdsnbqsvu5nw3v4dqjj2.cloudworkstations.dev'],
};

export default nextConfig;


import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  // @ts-ignore - This is a valid Next.js config option, but the type might not be updated yet.
  allowedDevOrigins: [
    'https://9000-firebase-studio-1753130726791.cluster-c3a7z3wnwzapkx3rfr5kz62dac.cloudworkstations.dev'
  ]
};

export default nextConfig;

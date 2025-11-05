import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // Transpile workspace packages
  transpilePackages: [
    '@business-automation/database',
    '@business-automation/schema',
    '@business-automation/config',
  ],

  // External packages for server components
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  // Image optimization
  images: {
    domains: [],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default config;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'punjabcashandcarry.com.pk',
        port: '8084',
        pathname: '/items/**',
      },
    ],
  },
};

export default nextConfig;

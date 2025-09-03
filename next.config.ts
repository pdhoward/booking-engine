import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
      removeConsole: process.env.NODE_ENV === "production"
    },
  reactStrictMode: true,
    images: {
      remotePatterns: [
        new URL('https://www.datocms-assets.com/**'), 
        new URL('https://res.cloudinary.com/stratmachine/**')],
    },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;



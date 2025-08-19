import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
    images: {
      remotePatterns: [
        new URL('https://www.datocms-assets.com/**'), 
        new URL('https://res.cloudinary.com/stratmachine/**')],
    },
};

export default nextConfig;



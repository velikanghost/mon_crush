// @ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  images: {
    remotePatterns: [
      {
        hostname: "imagedelivery.net",
      },
    ],
  },
  // Configuration for Turbopack
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  experimental: {
    turbo: {
      resolveAlias: {},
    },
  },
};

module.exports = nextConfig;

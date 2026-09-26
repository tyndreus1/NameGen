import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@resvg/resvg-js",
    "sharp",
    "potrace",
    "opentype.js",
    "@prisma/client",
  ],
  outputFileTracingIncludes: {
    "/api/generate": ["./src/lib/generate/image-worker.cjs"],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.next/**",
          "**/*.db",
          "**/*.db-journal",
          "**/*.db-wal",
          "**/*.db-shm",
          "**/data/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@resvg/resvg-js",
    "sharp",
    "potrace",
    "opentype.js",
    "@prisma/client",
  ],
};

export default nextConfig;

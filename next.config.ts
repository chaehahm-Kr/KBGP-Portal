import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/api/retailer-applications",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-requested-with, Accept" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;

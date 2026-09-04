import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@const/ui", "@const/backend"],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/chat/completions",
        destination: "/v1/chat/completions",
      },
    ];
  },
};

export default nextConfig;

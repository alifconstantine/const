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
};

export default nextConfig;

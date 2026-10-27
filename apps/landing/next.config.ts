import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@const/ui"],
  reactStrictMode: true,
};

export default nextConfig;

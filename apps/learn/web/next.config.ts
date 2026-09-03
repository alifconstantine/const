import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@const/ui", "@const/backend"],
  reactStrictMode: true,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@const/ui", "@const/remote"],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/r/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;

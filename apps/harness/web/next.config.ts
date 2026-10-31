import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@const/ui", "@const/remote"],
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/remote/:path*", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Cache-Control", value: "private, no-cache, must-revalidate" },
      ] },
      {
        source: "/r/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'none'; object-src 'none'; frame-ancestors 'self' capacitor: http://localhost https://localhost https://*.const.web.id https://const.web.id",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

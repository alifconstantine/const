import type { MetadataRoute } from "next";
import { guides } from "@/content/docs";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/product",
    "/integrations",
    "/ecosystem",
    "/docs",
    "/download",
    ...guides.map(({ slug }) => `/docs/${slug}`),
  ];
  // Draft legal notices and private pairing routes are intentionally omitted.
  return paths.map((path) => ({ url: `https://harness.const.web.id${path}` }));
}

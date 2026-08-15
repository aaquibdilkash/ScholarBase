import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/messages", "/notifications"],
    },
    sitemap: "https://scholarbase.app/sitemap.xml",
  };
}

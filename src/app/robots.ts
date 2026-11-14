import type { MetadataRoute } from "next";

import { SITE_URL } from "@/constants/seo";

/**
 * Crawl policy.
 *
 * `/_next/` is deliberately NOT disallowed. Google renders pages with the
 * framework's CSS and JS chunks, so blocking them makes the site look broken to
 * the renderer and damages indexing. Only non-page endpoints and private
 * surfaces are excluded here.
 *
 * There is no `?q=` rule either. A `Disallow` prevents the fetch, which also
 * hides the `X-Robots-Tag: noindex, follow` that `src/proxy.ts` sets on search
 * URLs — the bot would then never see the directive and could still index the
 * URL from an inbound link. The header is the correct control; robots.txt is
 * not.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/messages", "/notifications", "/api/", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

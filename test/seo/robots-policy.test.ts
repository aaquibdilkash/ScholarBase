/**
 * robots.txt policy.
 *
 * Two failures are easy to ship and invisible afterwards: an over-broad
 * `Disallow` that blocks the framework's own assets, and a `Disallow` on search
 * URLs that prevents the bot from ever seeing the `noindex` header those URLs
 * carry. Both are pinned here.
 */
import { describe, expect, it } from "vitest";
import type { MetadataRoute } from "next";

import robots from "@/app/robots";
import { SITE_URL } from "@/constants/seo";

const config = robots() as MetadataRoute.Robots & {
  rules: { userAgent: string; allow: string; disallow: string[] };
};

describe("robots.txt", () => {
  it("advertises the sitemap on the canonical host", () => {
    expect(config.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("blocks private surfaces and non-page endpoints", () => {
    expect(config.rules.disallow).toEqual(
      expect.arrayContaining([
        "/admin",
        "/messages",
        "/notifications",
        "/api/",
        "/auth/",
      ]),
    );
  });

  it("never blocks the assets a renderer needs", () => {
    // Google renders pages with /_next/static CSS and JS. Disallowing the
    // framework's own files makes a healthy site look broken to the renderer.
    expect(config.rules.disallow.some((path) => path.startsWith("/_next"))).toBe(
      false,
    );
  });

  it("does not block ?q= URLs, so the noindex header stays readable", () => {
    // A Disallow prevents the fetch, which hides `X-Robots-Tag` and lets the
    // URL be indexed from an inbound link instead. The header is the control.
    expect(config.rules.disallow.some((path) => path.includes("q="))).toBe(false);
  });
});

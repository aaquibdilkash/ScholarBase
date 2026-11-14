/**
 * Sitemap composition, kept out of the route so it can be tested without a
 * database or Next's cache runtime.
 *
 * Two protocol limits drive everything here: 50,000 URLs and 50 MB per file
 * (sitemaps.org). Google does not raise an error past either — it stops
 * reading, and the rest of the file is silently ignored. So the array is
 * capped here instead of being left to grow until discovery quietly tails off.
 *
 * Every URL is built from `SITE_URL`. It is deliberately NOT built from
 * `NEXT_PUBLIC_SITE_URL`: a missing env var in a container would emit
 * `http://localhost:3000` locs while the canonical tags still said
 * `scholarbase.app`, which is worse than a missing sitemap.
 */
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/constants/seo";

/** sitemaps.org ceiling for a single file. */
export const SITEMAP_MAX_URLS = 50_000;

/**
 * Warn before the ceiling, not at it.
 *
 * Sharding is a planned change with a 30-minute diff, not an emergency. Giving
 * 5,000 URLs of headroom means the log line arrives while there is still time
 * to act on it.
 */
export const SITEMAP_WARN_THRESHOLD = 45_000;

/** Indexable marketing and listing pages; the homepage is the empty string. */
export const STATIC_PATHS = [
  "",
  "/feed",
  "/scholars",
  "/supervisor",
  "/surveys",
  "/admissions",
  "/academic-positions",
  "/call-for-papers",
  "/results",
  "/blog",
  "/research-tools",
  "/grants",
  "/learn",
  "/journals",
  "/publications",
  "/contributions",
  "/help",
  "/shield",
  "/contact",
  "/about",
  "/careers",
  "/privacy",
  "/terms",
] as const;

/** The columns a sitemap entry needs from any content row. */
export type SitemapRow = {
  createdAt?: Date | null;
  updatedAt?: Date | null;
  editedAt?: Date | null;
};

/**
 * A row's real last-edit time.
 *
 * `updatedAt` is the last resort on purpose. Counter updates (votes, comments,
 * bookmarks) bump it, so preferring it would claim every post changed each time
 * someone voted — and Google learns to distrust a `lastmod` that moves without
 * the content changing. `editedAt` is the only column that means "the author
 * actually edited this". Falling back to `createdAt` under-reports rather than
 * over-reports, which is the safe direction.
 */
export function lastModifiedOf(row: SitemapRow): Date | undefined {
  return row.editedAt ?? row.createdAt ?? row.updatedAt ?? undefined;
}

/**
 * Builds one sitemap entry per row.
 *
 * Generic over the row type so call sites keep their Prisma projection: `href`
 * sees the real row, not the three date columns, and a null slug cannot slip
 * into a URL unnoticed. The constraint is `object` rather than `SitemapRow`
 * because a generic constrained to an all-optional shape makes TypeScript
 * contextually type inline row literals as that shape and then reject their
 * extra keys. `lastModifiedOf` only reads three optional columns, so the view
 * below is total.
 */
export function contentEntries<T extends object>(
  rows: readonly T[],
  href: (row: T) => string,
): MetadataRoute.Sitemap {
  return rows.map((row) => ({
    url: `${SITE_URL}${href(row)}`,
    lastModified: lastModifiedOf(row as SitemapRow),
  }));
}

/**
 * Static pages deliberately carry NO `lastModified`.
 *
 * The previous version stamped `new Date()` on all of them, which tells a
 * crawler every marketing page changed at the moment it was crawled. A `lastmod`
 * that is always "now" is noise; omitting it is more accurate than fabricating
 * it, and the field is optional.
 */
export function staticEntries(): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}

/**
 * Enforces the per-file URL limit and surfaces the approach to it.
 *
 * Truncating keeps the file valid: an over-limit sitemap is rejected wholesale
 * by some consumers and silently tail-cut by Google, so a 50,000-URL file is
 * strictly better than a 50,001-URL one. The warning is the signal to shard by
 * route segment, which is the only sharding shape that works here — Next 16
 * does not emit a sitemap index for `generateSitemaps`, so `/sitemap.xml` would
 * 404 if the root file were replaced by it.
 */
export function capSitemap(
  entries: MetadataRoute.Sitemap,
): MetadataRoute.Sitemap {
  if (entries.length > SITEMAP_MAX_URLS) {
    console.warn(
      `[sitemap] ${entries.length} URLs exceeds the ${SITEMAP_MAX_URLS} limit; truncating. ` +
        "Shard by route segment (e.g. app/scholars/sitemap.ts) and list each file in robots.ts.",
    );
    return entries.slice(0, SITEMAP_MAX_URLS);
  }

  if (entries.length >= SITEMAP_WARN_THRESHOLD) {
    console.warn(
      `[sitemap] ${entries.length} URLs is past the ${SITEMAP_WARN_THRESHOLD} warning threshold ` +
        `(limit ${SITEMAP_MAX_URLS}). Plan a shard before this becomes a truncation.`,
    );
  }

  return entries;
}

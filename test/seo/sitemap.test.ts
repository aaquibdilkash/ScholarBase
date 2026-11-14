/**
 * Sitemap composition.
 *
 * These pin the three things that used to fail silently:
 *
 *  - the host, which came from `NEXT_PUBLIC_SITE_URL` and fell back to
 *    `http://localhost:3000` while the canonical tags still said
 *    `scholarbase.app`;
 *  - the 50,000 URL protocol ceiling, past which Google ignores the tail;
 *  - `lastmod`, which used to be `new Date()` for static pages and `updatedAt`
 *    for content — a timestamp that moves whenever someone votes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SITEMAP_MAX_URLS,
  SITEMAP_WARN_THRESHOLD,
  STATIC_PATHS,
  capSitemap,
  contentEntries,
  lastModifiedOf,
  staticEntries,
} from "@/lib/sitemap";
import { SITE_URL } from "@/constants/seo";

describe("staticEntries", () => {
  it("builds absolute URLs on the canonical host", () => {
    for (const entry of staticEntries()) {
      expect(entry.url.startsWith(SITE_URL)).toBe(true);
      expect(entry.url).not.toContain("localhost");
    }
  });

  it("includes the homepage and every indexable module", () => {
    const urls = staticEntries().map((entry) => entry.url);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/feed`);
    expect(urls).toContain(`${SITE_URL}/scholars`);
  });

  it("omits lastModified instead of claiming every page changed now", () => {
    expect(staticEntries().every((entry) => entry.lastModified === undefined)).toBe(
      true,
    );
  });

  it("never lists a private or auth route", () => {
    expect(STATIC_PATHS).not.toContain("/admin");
    expect(STATIC_PATHS).not.toContain("/login");
    expect(STATIC_PATHS).not.toContain("/messages");
  });
});

describe("contentEntries", () => {
  it("prefixes each row's path with the canonical host", () => {
    const entries = contentEntries([{ id: "abc" }], (row) => `/feed/${row.id}`);
    expect(entries).toEqual([{ url: `${SITE_URL}/feed/abc`, lastModified: undefined }]);
  });

  it("passes the real row to the href builder", () => {
    const entries = contentEntries(
      [{ id: "r1", supervisorId: "s1" }],
      (row) => `/supervisor/${row.supervisorId}/recommendation/${row.id}`,
    );
    expect(entries[0].url).toBe(`${SITE_URL}/supervisor/s1/recommendation/r1`);
  });
});

describe("lastModifiedOf", () => {
  const edited = new Date("2026-05-01T00:00:00.000Z");
  const created = new Date("2026-01-01T00:00:00.000Z");
  const bumped = new Date("2026-06-01T00:00:00.000Z");

  it("prefers editedAt over a counter-bumped updatedAt", () => {
    // The regression this guards: `updatedAt` moves on every vote, so a vote
    // would claim the post's content changed and teach Google to ignore
    // `lastmod` for the whole site.
    expect(lastModifiedOf({ editedAt: edited, createdAt: created, updatedAt: bumped })).toBe(edited);
  });

  it("falls back to createdAt when the author never edited", () => {
    expect(lastModifiedOf({ editedAt: null, createdAt: created, updatedAt: bumped })).toBe(created);
  });

  it("only reaches for updatedAt when nothing better exists", () => {
    expect(lastModifiedOf({ updatedAt: bumped })).toBe(bumped);
  });

  it("returns undefined when the row has no dates at all", () => {
    expect(lastModifiedOf({})).toBeUndefined();
  });
});

describe("capSitemap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const entries = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      url: `${SITE_URL}/item/${index}`,
    }));

  it("passes a normal sitemap through untouched and silently", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = entries(100);

    expect(capSitemap(input)).toHaveLength(100);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns past the threshold without truncating", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = entries(SITEMAP_WARN_THRESHOLD);

    expect(capSitemap(input)).toHaveLength(SITEMAP_WARN_THRESHOLD);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("truncates at the protocol ceiling so the file stays valid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input = entries(SITEMAP_MAX_URLS + 25);

    expect(capSitemap(input)).toHaveLength(SITEMAP_MAX_URLS);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

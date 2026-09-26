import { describe, expect, it } from "vitest";

import {
  FEED_PAGE_SIZE_DEFAULT,
  FEED_PAGE_SIZE_MAX,
  FEED_PUBLIC_REVALIDATE_SECONDS,
  normalizeFeedPageSize,
} from "@/lib/feed-cache";

describe("normalizeFeedPageSize", () => {
  it("falls back to the default for missing or non-finite input", () => {
    expect(normalizeFeedPageSize(undefined)).toBe(FEED_PAGE_SIZE_DEFAULT);
    expect(normalizeFeedPageSize(Number.NaN)).toBe(FEED_PAGE_SIZE_DEFAULT);
    expect(normalizeFeedPageSize(Number.POSITIVE_INFINITY)).toBe(
      FEED_PAGE_SIZE_DEFAULT,
    );
  });

  it("clamps into the cache-key-safe range", () => {
    expect(normalizeFeedPageSize(0)).toBe(1);
    expect(normalizeFeedPageSize(-25)).toBe(1);
    expect(normalizeFeedPageSize(1_000)).toBe(FEED_PAGE_SIZE_MAX);
  });

  it("truncates fractional page sizes and passes valid ones through", () => {
    expect(normalizeFeedPageSize(7.9)).toBe(7);
    expect(normalizeFeedPageSize(20)).toBe(20);
  });
});

describe("FEED_PUBLIC_REVALIDATE_SECONDS", () => {
  it("is a positive, finite cache TTL in seconds", () => {
    expect(FEED_PUBLIC_REVALIDATE_SECONDS).toBeGreaterThan(0);
    expect(Number.isFinite(FEED_PUBLIC_REVALIDATE_SECONDS)).toBe(true);
  });
});

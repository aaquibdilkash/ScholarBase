/**
 * Carousel arrow visibility.
 *
 * Regression guard. The profile content and bookmarks tabs render one item per
 * section to begin with (`take: 1`), so a carousel with exactly one child is
 * the normal starting state on both tabs. The right arrow is the only way to
 * request the second item, and a `childCount > 1` guard on it hid the arrow
 * from first render — silently making every section unpageable.
 *
 * The mirror-image bug is guarded here too: an arrow left pointing at a card
 * that does not exist. That happened because visibility was derived from the
 * measured scroll offset, which is only sampled on scroll and resize events and
 * goes stale when a slide is appended.
 */
import { describe, expect, it } from "vitest";

import {
  shouldShowLeftArrow,
  shouldShowRightArrow,
} from "@/components/ui/carousel-arrows";

describe("shouldShowRightArrow", () => {
  it("shows with a single child when more items remain", () => {
    // The exact state both profile tabs start in: one item loaded, more to come.
    expect(
      shouldShowRightArrow({
        activeIndex: 0,
        childCount: 1,
        hasMore: true,
        canLoadMore: true,
      }),
    ).toBe(true);
  });

  it("stays hidden with a single child and nothing more", () => {
    // The "why do I see the arrow if there are no cards" case.
    expect(
      shouldShowRightArrow({
        activeIndex: 0,
        childCount: 1,
        hasMore: false,
        canLoadMore: true,
      }),
    ).toBe(false);
    expect(
      shouldShowRightArrow({
        activeIndex: 0,
        childCount: 1,
        hasMore: false,
        canLoadMore: false,
      }),
    ).toBe(false);
  });

  it("stays hidden with no cards at all, whatever the count claims", () => {
    expect(
      shouldShowRightArrow({
        activeIndex: 0,
        childCount: 0,
        hasMore: true,
        canLoadMore: true,
      }),
    ).toBe(false);
  });

  it("hides on the last card once loading is exhausted", () => {
    expect(
      shouldShowRightArrow({
        activeIndex: 2,
        childCount: 3,
        hasMore: false,
        canLoadMore: false,
      }),
    ).toBe(false);
  });

  it("shows on the last card while another can be fetched", () => {
    expect(
      shouldShowRightArrow({
        activeIndex: 2,
        childCount: 3,
        hasMore: true,
        canLoadMore: true,
      }),
    ).toBe(true);
  });

  it("shows whenever a loaded card sits to the right", () => {
    // Navigation between already-loaded slides never depends on the loader.
    expect(
      shouldShowRightArrow({
        activeIndex: 0,
        childCount: 3,
        hasMore: false,
        canLoadMore: false,
      }),
    ).toBe(true);
  });

  it("stays hidden when there is more to load but no handler", () => {
    // `onLoadMore` is omitted by the parent once a section is exhausted, so
    // `hasMore` alone must not conjure a dead arrow.
    expect(
      shouldShowRightArrow({
        activeIndex: 1,
        childCount: 2,
        hasMore: true,
        canLoadMore: false,
      }),
    ).toBe(false);
  });
});

describe("shouldShowLeftArrow", () => {
  it("is hidden on the first card", () => {
    expect(shouldShowLeftArrow({ activeIndex: 0, childCount: 1 })).toBe(false);
    expect(shouldShowLeftArrow({ activeIndex: 0, childCount: 4 })).toBe(false);
  });

  it("shows once there is a card behind", () => {
    expect(shouldShowLeftArrow({ activeIndex: 1, childCount: 2 })).toBe(true);
    expect(shouldShowLeftArrow({ activeIndex: 3, childCount: 4 })).toBe(true);
  });

  it("is hidden with no cards at all", () => {
    expect(shouldShowLeftArrow({ activeIndex: 0, childCount: 0 })).toBe(false);
  });
});

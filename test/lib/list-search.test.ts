import { describe, expect, it } from "vitest";

import { buildSearchHref } from "@/lib/list-search";

/**
 * List-page search writes `?q=` to the URL. Clearing the box must remove the
 * parameter instead of leaving `?q=` behind, so the page returns to its
 * original unfiltered list (`/feed`, not `/feed?q=`).
 */
describe("buildSearchHref", () => {
  it("adds a trimmed query while keeping existing params", () => {
    expect(buildSearchHref("/scholars", "?tab=trending&sort=reputation", "  ada  ")).toBe(
      "/scholars?tab=trending&sort=reputation&q=ada",
    );
  });

  it("returns the bare pathname when the box is empty", () => {
    expect(buildSearchHref("/feed", "?q=genomics", "")).toBe("/feed");
  });

  it("treats a whitespace-only box as empty", () => {
    expect(buildSearchHref("/journals", "?q=genomics&tab=latest", "   ")).toBe(
      "/journals?tab=latest",
    );
  });

  it("keeps unrelated params and drops only q", () => {
    expect(buildSearchHref("/feed", "?tab=following&q=climate", "")).toBe(
      "/feed?tab=following",
    );
  });

  it("works when there is no current search string", () => {
    expect(buildSearchHref("/events", "", "ai")).toBe("/events?q=ai");
  });

  it("encodes the query so it stays a valid URL", () => {
    expect(buildSearchHref("/publications", "", "graph & network")).toBe(
      "/publications?q=graph+%26+network",
    );
  });
});

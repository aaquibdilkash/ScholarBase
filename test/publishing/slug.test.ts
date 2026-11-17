/**
 * Venue slugs are public URLs (`/sbj/<slug>`, `/sbc/<slug>`) and are printed in
 * the ISSN application, so they cannot change after launch without notifying the
 * national centre. The normalization tests here are the contract the form preview
 * and the Server Action both rely on.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_VENUE_SLUG,
  isValidVenueSlug,
  normalizeVenueSlug,
} from "@/lib/publishing/slug";

describe("normalizeVenueSlug", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(normalizeVenueSlug("Indian Journal of Optics")).toBe("indian-journal-of-optics");
  });

  it("strips punctuation and collapses runs", () => {
    expect(normalizeVenueSlug("  Indian  Journal — of Optics!  ")).toBe("indian-journal-of-optics");
    expect(normalizeVenueSlug("a___b")).toBe("a-b");
  });

  it("trims leading and trailing separators", () => {
    expect(normalizeVenueSlug("--Journal--")).toBe("journal");
    expect(normalizeVenueSlug("!!!")).toBe("");
  });

  it("caps the length", () => {
    const out = normalizeVenueSlug("a".repeat(100));
    expect(out).toHaveLength(MAX_VENUE_SLUG);
  });
});

describe("isValidVenueSlug", () => {
  it("accepts normalized slugs", () => {
    expect(isValidVenueSlug("indian-journal-of-optics")).toBe(true);
    expect(isValidVenueSlug("smr2")).toBe(true);
  });

  it("rejects empty, short, uppercase, and edge-hyphenated slugs", () => {
    expect(isValidVenueSlug("")).toBe(false);
    expect(isValidVenueSlug("ab")).toBe(false);
    expect(isValidVenueSlug("Journal")).toBe(false);
    expect(isValidVenueSlug("-journal")).toBe(false);
    expect(isValidVenueSlug("journal-")).toBe(false);
    expect(isValidVenueSlug("journal--of-optics")).toBe(false);
    expect(isValidVenueSlug("journal of optics")).toBe(false);
  });

  it("rejects anything longer than the cap", () => {
    expect(isValidVenueSlug("a".repeat(MAX_VENUE_SLUG + 1))).toBe(false);
  });
});

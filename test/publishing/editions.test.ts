import { describe, expect, it } from "vitest";

import {
  editionDisplayLabel,
  editionTermLabel,
  isValidEditionSlug,
  normalizeEditionSlug,
} from "@/lib/publishing/editions";

describe("conference edition keys", () => {
  it("accepts annual, half-yearly, and quarterly occurrence keys", () => {
    expect(["2027", "2027-h1", "2027-h2", "2027-q1", "2027-q4"].every(isValidEditionSlug)).toBe(true);
    expect(isValidEditionSlug("2027-q5")).toBe(false);
    expect(isValidEditionSlug("2027/annual")).toBe(false);
  });

  it("normalizes editor-entered keys and labels", () => {
    expect(normalizeEditionSlug(" 2027 Q1 ")).toBe("2027-q1");
    expect(editionTermLabel("q3")).toBe("Quarter 3");
    expect(editionDisplayLabel(2027, "h1")).toBe("2027 — Half 1");
  });
});

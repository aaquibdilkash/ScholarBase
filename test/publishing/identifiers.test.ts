/**
 * ISSN / ISBN check digits.
 *
 * A wrong check digit is invisible on the page and in the database but corrupts
 * every citation that quotes it, and an ISSN cannot be reissued for a journal
 * just because the site printed it wrong. The vectors below include the two
 * cases that are easy to get wrong: an `X` ISSN check digit and the 1/3 ISBN-13
 * weighting.
 */
import { describe, expect, it } from "vitest";

import {
  formatIsbn13,
  formatIssn,
  isValidIsbn13,
  isValidIssn,
  normalizeIsbn,
  normalizeIssn,
} from "@/lib/publishing/identifiers";

describe("ISSN", () => {
  it("accepts a valid ISSN with its hyphen", () => {
    // Hearing Research; weighted sum 160 -> 11 - (160 mod 11) = 5.
    expect(isValidIssn("0378-5955")).toBe(true);
  });

  it("accepts a valid ISSN without separators", () => {
    expect(isValidIssn("03785955")).toBe(true);
  });

  it("accepts the X check digit", () => {
    // 0000-006X: sum 12 -> 12 mod 11 = 1 -> 11 - 1 = 10 -> "X".
    expect(isValidIssn("0000-006X")).toBe(true);
    expect(isValidIssn("0000-006x")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidIssn("0378-5954")).toBe(false);
    expect(isValidIssn("0000-0060")).toBe(false);
  });

  it("rejects wrong lengths and non-numeric bodies", () => {
    expect(isValidIssn("")).toBe(false);
    expect(isValidIssn("0378-595")).toBe(false);
    expect(isValidIssn("0378-59555")).toBe(false);
    expect(isValidIssn("037A-5955")).toBe(false);
  });

  it("normalizes separators and case", () => {
    expect(normalizeIssn(" 0378 5955 ")).toBe("03785955");
    expect(normalizeIssn("0000-006x")).toBe("0000006X");
    expect(normalizeIssn("0000-006X")).toBe("0000006X");
  });

  it("formats only valid values", () => {
    expect(formatIssn("03785955")).toBe("0378-5955");
    expect(formatIssn("0000006x")).toBe("0000-006X");
    expect(formatIssn("0378-5954")).toBe("");
  });
});

describe("ISBN-13", () => {
  it("accepts a valid hyphenated ISBN-13", () => {
    // 978-3-16-148410-0: alternating 1/3 weights sum to 100, check digit 0.
    expect(isValidIsbn13("978-3-16-148410-0")).toBe(true);
  });

  it("accepts the same number without separators", () => {
    expect(isValidIsbn13("9783161484100")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidIsbn13("978-3-16-148410-1")).toBe(false);
  });

  it("rejects ISBN-10 and other lengths", () => {
    expect(isValidIsbn13("0-306-40615-2")).toBe(false);
    expect(isValidIsbn13("978316148410")).toBe(false);
    expect(isValidIsbn13("97831614841001")).toBe(false);
    expect(isValidIsbn13("")).toBe(false);
  });

  it("normalizes separators", () => {
    expect(normalizeIsbn(" 978 3 16 148410 0 ")).toBe("9783161484100");
  });

  it("formats only valid values", () => {
    expect(formatIsbn13("9783161484100")).toBe("978-3-16-148410-0");
    expect(formatIsbn13("9783161484101")).toBe("");
  });
});

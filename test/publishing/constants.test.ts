import { describe, expect, it } from "vitest";

import {
  isPdfUpload,
  MAX_MANUSCRIPT_KEYWORD_COUNT,
  MAX_MANUSCRIPT_KEYWORD_LENGTH,
  parseManuscriptKeywords,
  validateManuscriptKeywords,
} from "@/lib/publishing/constants";

describe("isPdfUpload", () => {
  it("accepts the PDF MIME type", () => {
    expect(isPdfUpload({ type: "application/pdf", name: "paper.pdf" })).toBe(true);
  });

  it("accepts an empty MIME type when the extension is .pdf", () => {
    expect(isPdfUpload({ type: "", name: "Paper.PDF" })).toBe(true);
  });

  it("rejects an empty MIME type without a PDF extension", () => {
    expect(isPdfUpload({ type: "", name: "paper.docx" })).toBe(false);
  });

  it("rejects a non-PDF MIME type even when the name ends in .pdf", () => {
    expect(isPdfUpload({ type: "image/png", name: "paper.pdf" })).toBe(false);
  });
});

describe("parseManuscriptKeywords", () => {
  it("trims, collapses whitespace, and de-duplicates case-insensitively", () => {
    expect(
      parseManuscriptKeywords("  Optics , rural   clinics, OPTICS ,, "),
    ).toEqual(["Optics", "rural clinics"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseManuscriptKeywords("   ,  ")).toEqual([]);
  });
});

describe("validateManuscriptKeywords", () => {
  it("accepts a list within both caps", () => {
    expect(validateManuscriptKeywords("optics, clinics")).toBeNull();
  });

  it("rejects more keywords than the cap", () => {
    const keywords = Array.from(
      { length: MAX_MANUSCRIPT_KEYWORD_COUNT + 1 },
      (_, index) => `k${index}`,
    ).join(", ");

    expect(validateManuscriptKeywords(keywords)).toMatch(/at most/i);
  });

  it("rejects a keyword over the per-keyword cap", () => {
    expect(
      validateManuscriptKeywords("x".repeat(MAX_MANUSCRIPT_KEYWORD_LENGTH + 1)),
    ).toMatch(/characters or fewer/i);
  });
});

import { describe, expect, it } from "vitest";
import { anonymizeAuthorId, cleanText } from "@/lib/netnokit/anonymize";

describe("anonymizeAuthorId", () => {
  it("is stable for the same salt/platform/author", () => {
    const a = anonymizeAuthorId("salt", "youtube", "UC123", "alice");
    const b = anonymizeAuthorId("salt", "youtube", "UC123", "alice");
    expect(a).toBe(b);
  });

  it("differs across salts", () => {
    const a = anonymizeAuthorId("salt1", "youtube", "UC123", "alice");
    const b = anonymizeAuthorId("salt2", "youtube", "UC123", "alice");
    expect(a).not.toBe(b);
  });

  it("falls back to display name when author id missing", () => {
    const a = anonymizeAuthorId("salt", "youtube", null, "alice");
    const b = anonymizeAuthorId("salt", "youtube", "", "alice");
    expect(a).toBe(b);
  });
});

describe("cleanText", () => {
  it("strips URLs", () => {
    expect(cleanText("hi https://example.com/x there")).toBe("hi [URL] there");
  });

  it("collapses whitespace", () => {
    expect(cleanText("a   b\nc")).toBe("a b c");
  });
});

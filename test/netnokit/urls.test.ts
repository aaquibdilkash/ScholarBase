import { describe, expect, it } from "vitest";
import { parseNetnoKitUrl } from "@/lib/netnokit/urls";

describe("parseNetnoKitUrl", () => {
  it("parses youtube watch URLs", () => {
    const r = parseNetnoKitUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it("parses youtu.be", () => {
    const r = parseNetnoKitUrl("https://youtu.be/dQw4w9WgXcQ?t=42");
    expect(r).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it("parses shorts", () => {
    const r = parseNetnoKitUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(r).toEqual({ platform: "youtube", videoId: "dQw4w9WgXcQ" });
  });

  it("parses instagram post", () => {
    const r = parseNetnoKitUrl("https://www.instagram.com/p/ABC123_-/");
    expect(r).toEqual({ platform: "instagram", shortcode: "ABC123_-", kind: "post" });
  });

  it("parses instagram reel", () => {
    const r = parseNetnoKitUrl("https://instagram.com/reel/XYZ987/");
    expect(r).toEqual({ platform: "instagram", shortcode: "XYZ987", kind: "reel" });
  });

  it("rejects unknown hosts", () => {
    expect(parseNetnoKitUrl("https://example.com/watch?v=abc")).toBeNull();
  });

  it("rejects empty", () => {
    expect(parseNetnoKitUrl("")).toBeNull();
  });

  it("rejects malformed", () => {
    expect(parseNetnoKitUrl("not a url")).toBeNull();
  });
});

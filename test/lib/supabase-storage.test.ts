/**
 * Public-URL -> Storage-key extraction.
 *
 * `getPublicUrl` percent-encodes the object path, while Storage `copy` and
 * `remove` take the raw key. A file saved by the browser as `download (2).jpeg`
 * lives under that literal key and is addressed as `download%20(2).jpeg`, so
 * returning the encoded string made every promote/delete target a key that did
 * not exist ("Object not found") and the save failed with the generic
 * "Your images could not be saved" toast.
 */
import { describe, expect, it } from "vitest";

import {
  extractBlogImagePathsFromHtml,
  extractBlogImageUrlsFromHtml,
  extractCoverImagePath,
} from "@/lib/supabase-storage";

const SUPABASE_URL = "https://api.staging.scholarbase.app";
const publicUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/content-images/${path}`;

describe("extractCoverImagePath", () => {
  it("returns the decoded key for a file name containing spaces and brackets", () => {
    const url = publicUrl(
      "users/u1/published/cfp-cover/abc/download%20(2).jpeg",
    );

    expect(extractCoverImagePath(url)).toBe(
      "users/u1/published/cfp-cover/abc/download (2).jpeg",
    );
  });

  it("decodes non-ASCII file names", () => {
    const url = publicUrl("users/u1/drafts/article-cover/abc/r%C3%A9sum%C3%A9.png");

    expect(extractCoverImagePath(url)).toBe(
      "users/u1/drafts/article-cover/abc/résumé.png",
    );
  });

  it("leaves a plain key untouched", () => {
    const url = publicUrl("users/u1/published/article-cover/abc/photo.png");

    expect(extractCoverImagePath(url)).toBe(
      "users/u1/published/article-cover/abc/photo.png",
    );
  });

  it("unwraps a literal percent sign in the key", () => {
    // Stored as `100%.png`; getPublicUrl escapes the percent to `%25`.
    const url = publicUrl("users/u1/published/article-cover/abc/100%25.png");

    expect(extractCoverImagePath(url)).toBe(
      "users/u1/published/article-cover/abc/100%.png",
    );
  });

  it("returns null for a URL outside the content-images bucket", () => {
    expect(
      extractCoverImagePath("https://res.cloudinary.com/demo/image/upload/a.jpg"),
    ).toBeNull();
    expect(extractCoverImagePath("")).toBeNull();
    expect(extractCoverImagePath(null)).toBeNull();
  });

  it("does not throw on a malformed escape and keeps the raw key", () => {
    expect(
      extractCoverImagePath(publicUrl("users/u1/published/cover/abc/100%.png")),
    ).toBe("users/u1/published/cover/abc/100%.png");
  });
});

describe("extractBlogImageUrlsFromHtml", () => {
  it("returns the verbatim src for rewriting and the decoded key for Storage", () => {
    const src = publicUrl("users/u1/drafts/article-inline/abc/download%20(2).jpeg");
    const html = `<p>x</p><img src="${src}" alt="fig" />`;

    expect(extractBlogImageUrlsFromHtml(html)).toEqual([
      {
        url: src,
        path: "users/u1/drafts/article-inline/abc/download (2).jpeg",
      },
    ]);
  });

  it("extracts decoded keys from a body with several images", () => {
    const html = [
      `<img src="${publicUrl("users/u1/drafts/article-inline/a/one.png")}" />`,
      `<img src="${publicUrl("users/u1/drafts/article-inline/b/two%20(1).png")}" />`,
    ].join("");

    expect(extractBlogImagePathsFromHtml(html)).toEqual([
      "users/u1/drafts/article-inline/a/one.png",
      "users/u1/drafts/article-inline/b/two (1).png",
    ]);
  });

  it("ignores images that are not in the content-images bucket", () => {
    const html = `<img src="https://res.cloudinary.com/demo/image/upload/a.jpg" />`;

    expect(extractBlogImageUrlsFromHtml(html)).toEqual([]);
  });
});

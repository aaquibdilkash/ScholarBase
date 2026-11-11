/**
 * `extractImageUrlsFromHtml` feeds the shared ImageLightbox from rich
 * content: the lightbox needs the ordered list of images in the body and the
 * index of the one that was clicked.
 */
import { describe, expect, it } from "vitest";

import { extractImageUrlsFromHtml } from "@/lib/html";

describe("extractImageUrlsFromHtml", () => {
  it("returns an empty list for empty content", () => {
    expect(extractImageUrlsFromHtml("")).toEqual([]);
  });

  it("finds a single image", () => {
    expect(
      extractImageUrlsFromHtml('<p>a</p><img src="https://cdn.test/a.png" alt="a" />'),
    ).toEqual(["https://cdn.test/a.png"]);
  });

  it("keeps document order", () => {
    const html =
      '<img src="https://cdn.test/a.png" /><p>mid</p><img src="https://cdn.test/b.png" />';

    expect(extractImageUrlsFromHtml(html)).toEqual([
      "https://cdn.test/a.png",
      "https://cdn.test/b.png",
    ]);
  });

  it("de-duplicates repeated sources", () => {
    const html =
      '<img src="https://cdn.test/a.png" /><img src="https://cdn.test/a.png" />';

    expect(extractImageUrlsFromHtml(html)).toEqual(["https://cdn.test/a.png"]);
  });

  it("ignores images with no src", () => {
    expect(extractImageUrlsFromHtml('<img alt="broken" />')).toEqual([]);
  });

  it("ignores other tags that mention a src", () => {
    expect(extractImageUrlsFromHtml('<script src="https://cdn.test/x.js" />')).toEqual(
      [],
    );
  });

  it("ignores content with no images at all", () => {
    expect(extractImageUrlsFromHtml("<p>just text</p>")).toEqual([]);
  });

  it("handles single-quoted src attributes", () => {
    expect(extractImageUrlsFromHtml("<img src='https://cdn.test/a.png' />")).toEqual([
      "https://cdn.test/a.png",
    ]);
  });
});

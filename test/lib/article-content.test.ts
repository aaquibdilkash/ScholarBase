/**
 * `repairLegacyInlineImages` — the repair for articles whose inline images
 * were stored as ESCAPED TEXT.
 *
 * Before the blog composer had the Tiptap Image extension, the editor schema
 * had no node that could hold an `<img>`, so inserting an image stored the tag
 * as `&lt;img src="..."&gt;` — literal markup that rendered as the URL on the
 * page instead of the image.
 */
import { describe, expect, it } from "vitest";

import { repairLegacyInlineImages } from "@/lib/article-content";

describe("repairLegacyInlineImages", () => {
  it("converts an escaped image tag back into a real element", () => {
    const html =
      '<p>before</p>&lt;img src="https://cdn.test/a.png" alt="a" /&gt;';

    const result = repairLegacyInlineImages(html);

    expect(result).toBe(
      '<p>before</p><img src="https://cdn.test/a.png" alt="a" />',
    );
  });

  it("decodes the entities inside the escaped attributes", () => {
    const html =
      '&lt;img src="https://cdn.test/a.png?x=1&amp;y=2" alt="Tom &amp; Jerry" /&gt;';

    const result = repairLegacyInlineImages(html);

    expect(result).toContain('src="https://cdn.test/a.png?x=1&y=2"');
    expect(result).toContain('alt="Tom & Jerry"');
  });

  it("leaves content that already holds a real image tag untouched", () => {
    const html = '<p>text</p><img src="https://cdn.test/a.png" alt="a" />';

    expect(repairLegacyInlineImages(html)).toBe(html);
  });

  it("is idempotent", () => {
    const html =
      '<p>before</p>&lt;img src="https://cdn.test/a.png" alt="a" /&gt;';

    const once = repairLegacyInlineImages(html);
    const twice = repairLegacyInlineImages(once);

    expect(twice).toBe(once);
  });

  it("handles several escaped images in one body", () => {
    const html =
      '&lt;img src="https://cdn.test/a.png" /&gt;<p>mid</p>&lt;img src="https://cdn.test/b.png" /&gt;';

    const result = repairLegacyInlineImages(html);

    expect(result.match(/<img /g)).toHaveLength(2);
    expect(result).toContain("https://cdn.test/a.png");
    expect(result).toContain("https://cdn.test/b.png");
  });

  it("does not touch other escaped markup", () => {
    const html = "<p>5 &lt; 6 &amp;&amp; 7 &gt; 6</p>";

    expect(repairLegacyInlineImages(html)).toBe(html);
  });

  it("returns an empty body unchanged", () => {
    expect(repairLegacyInlineImages("")).toBe("");
  });
});

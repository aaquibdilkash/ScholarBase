/**
 * Per-page structured data.
 *
 * The failure mode here is silent: a malformed or missing block still renders a
 * perfect page, and the only symptom is that a search engine quietly ignores
 * it. So the contract is pinned rather than left to a validator run.
 */
import { describe, expect, it } from "vitest";

import {
  CONTENT_SCHEMA,
  buildBreadcrumbList,
  buildContentJsonLd,
  plainText,
} from "@/lib/schema";
import { serializeJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/constants/seo";

describe("CONTENT_SCHEMA", () => {
  it("covers every content module the sitemap knows about", () => {
    expect(Object.keys(CONTENT_SCHEMA)).toHaveLength(18);
  });

  it("uses a real schema.org type for each module", () => {
    for (const type of Object.values(CONTENT_SCHEMA)) {
      expect(type).toMatch(/^[A-Z][A-Za-z]+$/);
    }
  });
});

describe("buildContentJsonLd", () => {
  it("emits absolute URLs and links back to the site entity graph", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.article,
      path: "/blog/hello",
      name: "Hello",
    });

    expect(node.url).toBe(`${SITE_URL}/blog/hello`);
    expect(node["@id"]).toBe(`${SITE_URL}/blog/hello#main`);
    expect(node.isPartOf).toEqual({ "@id": `${SITE_URL}/#website` });
    expect(node.publisher).toEqual({ "@id": `${SITE_URL}/#organization` });
  });

  it("omits site-published back-references from a person profile", () => {
    // A scholar/supervisor page is a person, not an article the site
    // published: claiming a `publisher` and a `isPartOf` there is inaccurate.
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.user,
      path: "/scholars/ada",
      name: "Ada",
    });

    expect(node).not.toHaveProperty("publisher");
    expect(node).not.toHaveProperty("isPartOf");
    expect(node.mainEntityOfPage).toEqual({ "@id": `${SITE_URL}/scholars/ada` });
  });

  it("adds headline for article-like types only", () => {
    const article = buildContentJsonLd({
      type: CONTENT_SCHEMA.article,
      path: "/blog/hello",
      name: "Hello",
    });
    const person = buildContentJsonLd({
      type: CONTENT_SCHEMA.user,
      path: "/scholars/ada",
      name: "Ada",
    });

    expect(article.headline).toBe("Hello");
    expect(person.headline).toBeUndefined();
  });

  it("strips rich text out of the description", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.socialPost,
      path: "/feed/1",
      name: "Post",
      description: "<p>Hello <strong>world</strong></p>",
    });

    expect(node.description).toBe("Hello world");
    expect(String(node.description)).not.toContain("<");
  });

  it("clamps a long description instead of emitting a wall of text", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.article,
      path: "/blog/hello",
      name: "Hello",
      description: "x".repeat(5000),
    });

    expect(String(node.description).length).toBeLessThanOrEqual(301);
    expect(String(node.description).endsWith("…")).toBe(true);
  });

  it("omits empty optional fields rather than emitting undefined", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.article,
      path: "/blog/hello",
      name: "Hello",
      description: "   ",
      image: "  ",
      keywords: [],
      author: { name: "" },
    });

    expect(node).not.toHaveProperty("description");
    expect(node).not.toHaveProperty("image");
    expect(node).not.toHaveProperty("keywords");
    expect(node).not.toHaveProperty("author");
  });

  it("serialises dates to ISO and ignores an unparseable one", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.article,
      path: "/blog/hello",
      name: "Hello",
      datePublished: new Date("2026-01-02T03:04:05.000Z"),
      dateModified: "not-a-date",
    });

    expect(node.datePublished).toBe("2026-01-02T03:04:05.000Z");
    expect(node).not.toHaveProperty("dateModified");
  });

  it("links the author to their profile and absolutises the image", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.publication,
      path: "/publications/1",
      name: "Paper",
      author: { name: "Ada", path: "/scholars/ada" },
      image: "/uploads/cover.png",
    });

    expect(node.author).toEqual({
      "@type": "Person",
      name: "Ada",
      url: `${SITE_URL}/scholars/ada`,
    });
    expect(node.image).toEqual({
      "@type": "ImageObject",
      url: `${SITE_URL}/uploads/cover.png`,
    });
  });

  it("merges type-specific fields and lets them override the defaults", () => {
    const node = buildContentJsonLd({
      type: CONTENT_SCHEMA.academicPosition,
      path: "/academic-positions/1",
      name: "Lecturer",
      extra: {
        title: "Lecturer",
        datePosted: "2026-01-01T00:00:00.000Z",
        publisher: { "@type": "Organization", name: "University" },
      },
    });

    expect(node.title).toBe("Lecturer");
    expect(node.datePosted).toBe("2026-01-01T00:00:00.000Z");
    expect(node.publisher).toEqual({
      "@type": "Organization",
      name: "University",
    });
  });
});

describe("buildBreadcrumbList", () => {
  it("numbers positions from 1 and absolutises every item", () => {
    const node = buildBreadcrumbList([
      { name: "Journals", path: "/journals" },
      { name: "Nature", path: "/journals/1" },
    ]);
    const items = node.itemListElement as Record<string, unknown>[];

    expect(node["@type"]).toBe("BreadcrumbList");
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[0].item).toBe(`${SITE_URL}/journals`);
    expect(items[1].item).toBe(`${SITE_URL}/journals/1`);
  });
});

describe("plainText", () => {
  it("collapses whitespace and strips markup", () => {
    expect(plainText("<p>Hello   <em>world</em></p>")).toBe("Hello world");
  });

  it("returns undefined for empty input", () => {
    expect(plainText("   ")).toBeUndefined();
    expect(plainText(null)).toBeUndefined();
    expect(plainText(undefined)).toBeUndefined();
  });
});

describe("serializeJsonLd", () => {
  it("cannot break out of the surrounding script tag", () => {
    // The escaping is a security boundary, not formatting: the output is
    // injected with dangerouslySetInnerHTML.
    const payload = serializeJsonLd({ name: "</script><script>alert(1)" });

    expect(payload).not.toContain("<");
    expect(JSON.parse(payload).name).toBe("</script><script>alert(1)");
  });
});

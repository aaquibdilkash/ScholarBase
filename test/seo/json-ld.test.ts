/**
 * The JSON-LD injection point.
 *
 * Two properties matter and neither is visible in a normal page check: the
 * script carries the per-request CSP nonce (without it the block is blocked in
 * production and the failure is silent), and a multi-node page is emitted as a
 * single `@graph` rather than two scripts with duplicate `@context`.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-nonce": "test-nonce" }),
}));

async function render(data: Parameters<typeof import("@/components/seo/JsonLd").JsonLd>[0]["data"]) {
  const { JsonLd } = await import("@/components/seo/JsonLd");
  const element = await JsonLd({ data });
  return renderToStaticMarkup(element as ReactElement);
}

describe("JsonLd", () => {
  it("emits a script tag carrying the request's CSP nonce", async () => {
    const html = await render({ "@type": "Thing", name: "x" });

    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('nonce="test-nonce"');
  });

  it("adds @context to a single node", async () => {
    const html = await render({ "@type": "Thing", name: "x" });
    const payload = JSON.parse(html.replace(/^<script[^>]*>|<\/script>$/g, ""));

    expect(payload["@context"]).toBe("https://schema.org");
    expect(payload["@type"]).toBe("Thing");
  });

  it("merges several nodes into one @graph", async () => {
    const html = await render([
      { "@type": "Article", name: "a" },
      { "@type": "BreadcrumbList", itemListElement: [] },
    ]);
    const payload = JSON.parse(html.replace(/^<script[^>]*>|<\/script>$/g, ""));

    expect(payload["@context"]).toBe("https://schema.org");
    expect(payload["@graph"]).toHaveLength(2);
    expect(payload["@graph"][1]["@type"]).toBe("BreadcrumbList");
  });

  it("escapes a closing tag inside content", async () => {
    const html = await render({ "@type": "Thing", name: "</script>" });

    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});

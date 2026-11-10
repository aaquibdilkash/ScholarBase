import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SITE_JSON_LD, buildSiteJsonLd } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/constants/seo";

/**
 * Brand-entity structured data.
 *
 * This is the only first-party signal Google can use for the logo tile in its
 * "About the source" panel and the brand knowledge card: `og:image` is a
 * 1200x630 link-preview card and is ignored there. If the block disappears, the
 * page still renders perfectly -- Search just quietly loses the signal -- so it
 * is pinned here rather than left to a manual check.
 *
 * The escaping assertion is a security guard, not a formatting preference: the
 * block is injected with `dangerouslySetInnerHTML`, so an unescaped `<` in a
 * future value could terminate the surrounding `<script>` element.
 */
describe("site JSON-LD", () => {
  const graph = JSON.parse(SITE_JSON_LD)["@graph"] as Record<string, unknown>[];
  const organization = graph.find((node) => node["@type"] === "Organization")!;
  const website = graph.find((node) => node["@type"] === "WebSite")!;

  it("declares both the Organization and the WebSite", () => {
    expect(organization).toBeTruthy();
    expect(website).toBeTruthy();
    expect(organization.name).toBe(SITE_NAME);
    expect(website.url).toBe(SITE_URL);
  });

  it("links the WebSite to the Organization as its publisher", () => {
    expect(website.publisher).toEqual({ "@id": organization["@id"] });
  });

  it("advertises a square 512x512 logo, not the 1200x630 card", () => {
    const logo = organization.logo as Record<string, unknown>;
    expect(logo["@type"]).toBe("ImageObject");
    expect(logo.url).toBe(`${SITE_URL}/logo.png`);
    expect(logo.width).toBe(512);
    expect(logo.height).toBe(512);
  });

  it("points at a logo file that exists at the declared size", () => {
    expect(existsSync(join(process.cwd(), "public", "logo.png"))).toBe(true);
    const bytes = readFileSync(join(process.cwd(), "public", "logo.png"));
    expect(bytes.readUInt32BE(16)).toBe(512);
    expect(bytes.readUInt32BE(20)).toBe(512);
  });

  it("cannot break out of the surrounding script tag", () => {
    expect(buildSiteJsonLd()).not.toContain("<");
  });

  it("serialises once at module load", () => {
    expect(SITE_JSON_LD).toBe(buildSiteJsonLd());
  });
});

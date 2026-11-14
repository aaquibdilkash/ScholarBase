/**
 * Search-result URL indexing policy.
 *
 * `/feed?q=…` is a duplicate of `/feed` to a crawler. `buildMetadata` already
 * canonicalises it, but a canonical is a hint; the proxy upgrades it to a
 * directive for the engines that do not consolidate duplicates reliably.
 *
 * The assertions that matter most are the negative ones. `noindex` is the only
 * header on this site that can remove a page from Google, so the scope is
 * pinned: no `q`, no header.
 */
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { CSP_HEADER } from "@/lib/csp";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

async function proxyFor(url: string) {
  const { proxy } = await import("@/proxy");
  const request = new NextRequest(url, {
    headers: { host: new URL(url).host },
  });
  return proxy(request);
}

describe("search-result URLs", () => {
  it("are marked noindex but follow", async () => {
    const response = await proxyFor("https://scholarbase.app/feed?q=machine+learning");
    // `follow`, not `nofollow`: the rows on a result page must keep passing
    // credit to their own canonical detail pages.
    expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
  });

  it("are marked on every list module, not just the feed", async () => {
    const response = await proxyFor("https://scholarbase.app/scholars?q=ada");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, follow");
  });

  it("keep the CSP on the response that is actually returned", async () => {
    // The file documents a trap: a response object can be REPLACED by the
    // Supabase token-refresh callback, silently discarding headers set earlier.
    const response = await proxyFor("https://scholarbase.app/feed?q=ml");
    expect(response.headers.get(CSP_HEADER)).toBeTruthy();
  });
});

describe("everything else stays indexable", () => {
  it("leaves the plain list page alone", async () => {
    const response = await proxyFor("https://scholarbase.app/feed");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("leaves tab and sort variants alone", async () => {
    const response = await proxyFor("https://scholarbase.app/feed?tab=trending");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("ignores an empty query", async () => {
    const response = await proxyFor("https://scholarbase.app/feed?q=");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("ignores API routes even when they take a q param", async () => {
    const response = await proxyFor("https://scholarbase.app/api/shield?q=ml");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("leaves detail pages alone", async () => {
    const response = await proxyFor("https://scholarbase.app/publications/abc123");
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("staging stays fully noindex", () => {
  it("keeps nofollow rather than being downgraded to follow", async () => {
    const response = await proxyFor("https://staging.scholarbase.app/feed?q=ml");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

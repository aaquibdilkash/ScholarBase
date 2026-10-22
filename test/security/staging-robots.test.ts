import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

describe("staging SEO shield", () => {
  it("marks staging requests as noindex", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("https://staging.scholarbase.app/feed", {
      headers: { host: "staging.scholarbase.app" },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

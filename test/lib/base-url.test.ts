/**
 * `getBaseUrl` is what turns a server action into a link someone clicks in
 * their inbox. Its previous version trusted `NEXT_PUBLIC_SITE_URL` blindly and
 * then fell back to the request `Host` header, so a build that missed the
 * variable emailed links to `http://0.0.0.0:3000` — dead for every recipient.
 *
 * These tests pin the resolution order and, more importantly, that an internal
 * origin can never be returned in production.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({ headers: async () => state.headers }));

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;

beforeEach(() => {
  state.headers = new Headers();
  delete env.NEXT_PUBLIC_SITE_URL;
  delete env.NEXT_PUBLIC_APP_URL;
  delete env.APP_URL;
});

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  delete env.NEXT_PUBLIC_SITE_URL;
  delete env.NEXT_PUBLIC_APP_URL;
  delete env.APP_URL;
});

describe("getBaseUrl", () => {
  it("prefers the configured site URL and strips the trailing slash", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_SITE_URL = "https://scholarbase.app/";
    state.headers = new Headers({ host: "attacker.example" });

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://scholarbase.app");
  });

  it("accepts a bare host, the way people type it into a dashboard", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_SITE_URL = "scholarbase.app";

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://scholarbase.app");
  });

  it("falls back to NEXT_PUBLIC_APP_URL, which the Dockerfile also ships", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_APP_URL = "https://scholarbase.app";

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://scholarbase.app");
  });

  it("does not let a runtime APP_URL override the canonical site URL", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_SITE_URL = "https://scholarbase.app";
    env.APP_URL = "https://wrong.example";

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://scholarbase.app");
  });

  it("uses a runtime APP_URL when no build-time value was baked in", async () => {
    env.NODE_ENV = "production";
    env.APP_URL = "https://prod.scholarbase.app";

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://prod.scholarbase.app");
  });

  it("falls back to the forwarded request origin when unset", async () => {
    env.NODE_ENV = "production";
    state.headers = new Headers({
      "x-forwarded-host": "prod.scholarbase.app",
      "x-forwarded-proto": "https",
    });

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://prod.scholarbase.app");
  });

  it("ignores an internal NEXT_PUBLIC_SITE_URL in production", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_SITE_URL = "http://0.0.0.0:3000";
    state.headers = new Headers({
      "x-forwarded-host": "scholarbase.app",
      "x-forwarded-proto": "https",
    });

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("https://scholarbase.app");
  });

  it("throws instead of returning an internal origin in production", async () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_SITE_URL = "http://0.0.0.0:3000";
    state.headers = new Headers({ host: "0.0.0.0:3000" });

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).rejects.toThrow(/public site URL/i);
  });

  it("throws when production has neither an env value nor a request origin", async () => {
    env.NODE_ENV = "production";

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("keeps local development on localhost", async () => {
    env.NODE_ENV = "development";

    const { getBaseUrl } = await import("@/lib/url");

    await expect(getBaseUrl()).resolves.toBe("http://localhost:3000");
  });
});

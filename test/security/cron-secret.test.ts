/**
 * `verifyCronSecret` — the single gate in front of every cron and job route.
 *
 * RULE 6 requires these routes to be protected by a `CRON_SECRET` bearer token.
 * Seven routes delegate that check to `lib/cron.ts`, so whatever this function
 * decides IS their authentication. The behaviour that matters most is the one
 * nobody thinks about: what happens when the env var is missing? A helper that
 * fails OPEN there would expose soft-delete purging, digest email dispatch and
 * push fan-out to anyone who finds the URL.
 *
 * Note the routes never mention `CRON_SECRET` themselves — an earlier grep for
 * the literal string in the route files found nothing and looked alarming. They
 * all call this helper, which reads the env var internally.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn(async () => new Headers());

vi.mock("next/headers", () => ({ headers: () => headersMock() }));

const SECRET = "s3cr3t-cron-value";

/** Fresh import each time so the module reads the current env. */
const verify = async () => {
  vi.resetModules();
  const mod = await import("@/lib/cron");
  return mod.verifyCronSecret();
};

const withAuth = (value: string | null) =>
  headersMock.mockResolvedValue(
    value === null ? new Headers() : new Headers({ authorization: value }),
  );

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("verifyCronSecret", () => {
  it("accepts the exact secret as a bearer token", async () => {
    withAuth(`Bearer ${SECRET}`);
    expect(await verify()).toBe(true);
  });

  it("accepts the bare secret with no Bearer prefix", async () => {
    withAuth(SECRET);
    expect(await verify()).toBe(true);
  });

  it("is case-insensitive about the Bearer prefix", async () => {
    withAuth(`bearer ${SECRET}`);
    expect(await verify()).toBe(true);
  });

  it("DENIES when CRON_SECRET is unset, even with a bearer header present", async () => {
    // The fail-open case. If this ever returns true, every cron route is public.
    delete process.env.CRON_SECRET;
    withAuth("Bearer anything");
    expect(await verify()).toBe(false);
  });

  it("denies when the header is missing entirely", async () => {
    withAuth(null);
    expect(await verify()).toBe(false);
  });

  it("denies a wrong secret", async () => {
    withAuth("Bearer wrong-value");
    expect(await verify()).toBe(false);
  });

  it("denies a secret that is a PREFIX of the real one", async () => {
    // Guards against a naive `startsWith` comparison.
    withAuth(`Bearer ${SECRET.slice(0, 5)}`);
    expect(await verify()).toBe(false);
  });

  it("denies a secret with the real one as a prefix", async () => {
    withAuth(`Bearer ${SECRET}-extra`);
    expect(await verify()).toBe(false);
  });

  it("denies an empty bearer value", async () => {
    withAuth("Bearer ");
    expect(await verify()).toBe(false);
  });

  it("denies when the header is empty string", async () => {
    withAuth("");
    expect(await verify()).toBe(false);
  });
});

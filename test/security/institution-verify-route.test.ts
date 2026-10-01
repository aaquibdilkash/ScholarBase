/**
 * `/auth/verify-institution` — the route that grants `institutionVerifiedAt`.
 *
 * That timestamp is the verified badge rendered on every card in the app, so
 * this route is the single place the app decides a user is institutionally
 * trustworthy. It had NO test: the request action, the emailed link and this
 * consumer were all uncovered, meaning the badge was granted by unverified
 * logic.
 *
 * The route is written carefully (token is stored hashed, the update is
 * atomic and re-checks the token AND expiry inside the `WHERE` clause). These
 * tests exist to prove that, and to catch the obvious ways it could rot: a
 * token belonging to another account, a replayed link, an expired link, and a
 * malformed token that must not reach the database.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");

let sessionUser: { id: string } | null = null;

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sessionUser } }) },
  }),
}));

const OWNER = "u-owner";
const STRANGER = "u-stranger";

/**
 * Seeds the owner, REPLACING any existing row.
 *
 * `fakeDb.seed` inserts rather than upserts, so re-seeding the same id left the
 * first row's values in place — the expiry and legacy overrides in these tests
 * silently did nothing and the route verified an already-valid token.
 */
const seed = (overrides: Record<string, unknown> = {}) => {
  const rows = fakeDb.rows("user");
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].id === OWNER) rows.splice(i, 1);
  }
  fakeDb.seed("user", {
    id: OWNER,
    name: "Owner",
    handle: "owner",
    email: "owner@uni.edu",
    institutionEmail: null,
    institutionDomain: null,
    institutionVerifiedAt: null,
    pendingInstitutionEmail: "owner@uni.edu",
    pendingInstitutionDomain: "uni.edu",
    institutionVerificationTokenHash: TOKEN_HASH,
    institutionVerificationExpiresAt: new Date(Date.now() + 60_000),
    isDeleted: false,
    ...overrides,
  });
};

/** Runs the route and reports `?institution=` from the redirect it returns. */
const run = async (token: string | null) => {
  const { GET } = await import("@/app/auth/verify-institution/route");
  const { NextRequest } = await import("next/server");
  const url = new URL("https://sb.test/auth/verify-institution");
  if (token !== null) url.searchParams.set("token", token);
  const res = await GET(new NextRequest(url));
  const location = res.headers.get("location") ?? "";
  return { status: res.status, location, result: new URL(location).searchParams.get("institution") };
};

const row = (id = OWNER) => fakeDb.rows("user").find((u) => u.id === id)!;

beforeEach(() => {
  resetFakeDb();
  sessionUser = { id: OWNER };
  seed();
});

describe("GET /auth/verify-institution", () => {
  it("verifies a valid token and records the institution", async () => {
    const { result, location } = await run(RAW_TOKEN);

    expect(result).toBe("verified");
    // Redirects to the OWNER's settings, never anyone else's.
    expect(location).toContain(`/scholars/${OWNER}/settings`);

    expect(row().institutionVerifiedAt).toBeInstanceOf(Date);
    expect(row().institutionEmail).toBe("owner@uni.edu");
    expect(row().institutionDomain).toBe("uni.edu");
  });

  it("clears the pending fields so the badge cannot be re-granted", async () => {
    await run(RAW_TOKEN);

    expect(row().pendingInstitutionEmail).toBeNull();
    expect(row().pendingInstitutionDomain).toBeNull();
    expect(row().institutionVerificationTokenHash).toBeNull();
    expect(row().institutionVerificationExpiresAt).toBeNull();
  });

  it("cannot be replayed: the same link a second time is rejected", async () => {
    // The token hash is nulled on success, so the second click finds nothing.
    expect((await run(RAW_TOKEN)).result).toBe("verified");
    expect((await run(RAW_TOKEN)).result).toBe("invalid");

    // And the verified timestamp must not move.
    const first = (row().institutionVerifiedAt as Date).getTime();
    await run(RAW_TOKEN);
    expect((row().institutionVerifiedAt as Date).getTime()).toBe(first);
  });

  it("refuses a token that belongs to ANOTHER account", async () => {
    fakeDb.seed("user", {
      id: STRANGER,
      name: "Stranger",
      handle: "stranger",
      email: "s@uni.edu",
      institutionEmail: null,
      institutionVerifiedAt: null,
      pendingInstitutionEmail: null,
      pendingInstitutionDomain: null,
      institutionVerificationTokenHash: null,
      institutionVerificationExpiresAt: null,
      isDeleted: false,
    });

    // The owner holds the hash; the stranger is signed in and clicks the link.
    sessionUser = { id: STRANGER };
    const { result } = await run(RAW_TOKEN);

    expect(result).toBe("invalid");
    expect(row(STRANGER).institutionVerifiedAt).toBeNull();
    expect(row(OWNER).institutionVerifiedAt).toBeNull();
  });

  it("rejects an EXPIRED token without granting the badge", async () => {
    seed({ institutionVerificationExpiresAt: new Date(Date.now() - 1_000) });

    const { result } = await run(RAW_TOKEN);

    expect(result).toBe("expired");
    expect(row().institutionVerifiedAt).toBeNull();
    // The pending fields survive so the user can request a fresh link.
    expect(row().pendingInstitutionEmail).toBe("owner@uni.edu");
  });

  it("rejects a token with no expiry set at all", async () => {
    seed({ institutionVerificationExpiresAt: null });
    expect((await run(RAW_TOKEN)).result).toBe("expired");
    expect(row().institutionVerifiedAt).toBeNull();
  });

  it("rejects a malformed token without touching the database", async () => {
    for (const bad of ["short", "z".repeat(64), `${RAW_TOKEN}extra`, ""]) {
      const { result } = await run(bad);
      expect(result, `token: ${bad}`).toBe("invalid");
      expect(row().institutionVerifiedAt).toBeNull();
    }
  });

  it("sends an anonymous visitor to login, preserving the token to resume", async () => {
    sessionUser = null;
    const { location } = await run(RAW_TOKEN);

    expect(location).toContain("/login");
    expect(location).toContain("institution-verification-login-required");
    // A well-formed token survives the login round-trip; a junk one is dropped
    // rather than echoed into a callback URL.
    expect(location).toContain(encodeURIComponent(RAW_TOKEN));
  });

  it("drops a malformed token from the anonymous callback URL", async () => {
    sessionUser = null;
    const { location } = await run("not-a-token");

    expect(location).toContain("/login");
    expect(location).not.toContain("callbackUrl");
  });

  it("still verifies a legacy token created before the pending fields existed", async () => {
    // Backwards compatibility: old rows stored only the legacy institutionEmail.
    seed({ pendingInstitutionEmail: null, pendingInstitutionDomain: null });

    const { result } = await run(RAW_TOKEN);

    expect(result).toBe("verified");
    expect(row().institutionVerifiedAt).toBeInstanceOf(Date);
  });
});

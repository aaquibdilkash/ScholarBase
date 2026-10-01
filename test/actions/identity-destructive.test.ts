/**
 * The two destructive identity paths: changing your account email, and
 * deleting your account.
 *
 * Both had no test. `requestEmailChange` is the highest-risk untested action in
 * the app — an email change is the classic account-takeover vector, and this one
 * has to reject (a) an address already verified on another account, (b) a
 * disallowed domain, (c) the current address, and (d) be rate limited per
 * email+IP, because it triggers an outbound confirmation mail.
 *
 * `deleteAccount` is soft-delete by design (RULE 4), so its correctness is
 * about which fields it clears: the verified badge must go with the account,
 * otherwise a deleted scholar keeps an institutional tick they can no longer
 * re-earn.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

const USER = "u-user";
const OTHER = "u-other";

let session: { id: string; email: string } | null = null;
let updateUserResult: { error: { message: string } | null } = { error: null };
const signOut = vi.fn(async () => {});
const revalidateContent = vi.fn();

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

vi.mock("@/lib/auth", () => ({
  requireActiveUser: vi.fn(async () => {
    if (!session) throw new Error("You must be logged in.");
    return { id: session.id };
  }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: session } }),
      updateUser: async (_attrs: unknown, _opts: unknown) => updateUserResult,
      signOut: async () => signOut(),
    },
  }),
}));

vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: (...args: unknown[]) => revalidateContent(...(args as [])),
}));

vi.mock("@/lib/url", () => ({ getBaseUrl: async () => "https://sb.test" }));

// `limitByEmailAndIp` reads the client IP from the request scope; outside a real
// request `headers()` throws, so the limiter is given a fixed synthetic IP.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => {}),
  getRequestFingerprint: vi.fn(async () => "fp"),
  getRequestIpKey: vi.fn(() => "203.0.113.7"),
  hashRateLimitKey: vi.fn((v: string) => v),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const row = (id = USER) => fakeDb.rows("user").find((u) => u.id === id)!;

const seedUser = () =>
  fakeDb.seed("user", {
    id: USER,
    email: "me@uni.edu",
    name: "Me",
    handle: "me",
    isDeleted: false,
    isFrozen: false,
    institutionEmail: "me@uni.edu",
    institutionDomain: "uni.edu",
    institutionVerifiedAt: new Date(),
    pendingInstitutionEmail: null,
    pendingInstitutionDomain: null,
    institutionVerificationTokenHash: null,
    institutionVerificationExpiresAt: null,
    reputation: 42,
  });

beforeEach(() => {
  resetFakeDb();
  session = { id: USER, email: "me@uni.edu" };
  updateUserResult = { error: null };
  signOut.mockClear();
  revalidateContent.mockClear();
  seedUser();
});

describe("requestEmailChange", () => {
  it("sends a confirmation when the new address is acceptable", async () => {
    const { requestEmailChange } = await import("@/app/actions/auth");
    const result = await requestEmailChange(form({ email: "new@mit.edu" }));

    expect(result.success).toBe(true);
  });

  it("refuses an address already verified on ANOTHER account", async () => {
    fakeDb.seed("user", {
      id: OTHER,
      email: "taken@mit.edu",
      institutionEmail: "taken@mit.edu",
      isDeleted: false,
    });

    const { requestEmailChange } = await import("@/app/actions/auth");
    const result = await requestEmailChange(form({ email: "taken@mit.edu" }));

    // The takeover vector: silently reassigning another scholar's verified
    // address would grant this account their institutional badge.
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/another ScholarBase account/i);
  });

  it("refuses an email that is already your own primary address", async () => {
    const { requestEmailChange } = await import("@/app/actions/auth");
    const result = await requestEmailChange(form({ email: "me@uni.edu" }));
    expect(result.success).toBe(false);
  });

  it("rejects a malformed address", async () => {
    const { requestEmailChange } = await import("@/app/actions/auth");
    for (const bad of ["not-an-email", "", "a@b"]) {
      const result = await requestEmailChange(form({ email: bad }));
      expect(result.success, `email: ${bad}`).toBe(false);
    }
  });

  it("rejects a disallowed domain with its own code so the UI can react", async () => {
    const { requestEmailChange } = await import("@/app/actions/auth");
    // NOT gmail.com: major webmail providers are deliberately ALLOWED here (they
    // are on FAMOUS_EMAIL_PLATFORM_DOMAINS). A domain that is neither a known
    // platform nor an institutional suffix is what actually gets refused.
    const result = await requestEmailChange(
      form({ email: "someone@notarealdomain12345.com" }),
    );

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe("EMAIL_DOMAIN_NOT_ALLOWED");
  });

  it("allows a major webmail provider, which is on the platform allowlist", async () => {
    const { requestEmailChange } = await import("@/app/actions/auth");
    const result = await requestEmailChange(form({ email: "someone@gmail.com" }));

    expect(result.success).toBe(true);
  });

  it("refuses when signed out", async () => {
    session = null;
    const { requestEmailChange } = await import("@/app/actions/auth");
    const result = await requestEmailChange(form({ email: "new@mit.edu" }));

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/must be signed in/i);
  });

  it("surfaces a Supabase error rather than reporting success", async () => {
    updateUserResult = { error: { message: "User already registered" } };
    const { requestEmailChange } = await import("@/app/actions/auth");
    const result = await requestEmailChange(form({ email: "new@mit.edu" }));

    expect(result.success).toBe(false);
  });
});

describe("deleteAccount", () => {
  it("requires the exact word DELETE to confirm", async () => {
    const { deleteAccount } = await import("@/app/actions/account");

    for (const wrong of ["delete", "DELETE!", "yes", ""]) {
      const result = await deleteAccount(form({ confirmation: wrong }));
      expect(result.success, `confirmation: ${wrong}`).toBe(false);
    }

    // Nothing was touched by any of the rejected attempts.
    expect(row().isDeleted).toBe(false);
  });

  it("soft-deletes the account and signs the user out", async () => {
    const { deleteAccount } = await import("@/app/actions/account");
    const result = await deleteAccount(form({ confirmation: "DELETE" }));

    expect(result.success).toBe(true);
    // Soft delete, not a hard DELETE — RULE 4 preserves historical integrity.
    expect(row().isDeleted).toBe(true);
    expect(row().isFrozen).toBe(true);
    expect(signOut).toHaveBeenCalled();
  });

  it("strips the institutional badge so it cannot outlive the account", async () => {
    const { deleteAccount } = await import("@/app/actions/account");
    await deleteAccount(form({ confirmation: "DELETE" }));

    // A deleted scholar keeping a verified tick is a trust signal for an
    // account that can no longer re-earn or maintain it.
    expect(row().institutionEmail).toBeNull();
    expect(row().institutionDomain).toBeNull();
    expect(row().institutionVerifiedAt).toBeNull();
    expect(row().pendingInstitutionEmail).toBeNull();
    expect(row().institutionVerificationTokenHash).toBeNull();
    expect(row().institutionVerificationExpiresAt).toBeNull();
  });

  it("purges the cached scholar directory", async () => {
    const { deleteAccount } = await import("@/app/actions/account");
    await deleteAccount(form({ confirmation: "DELETE" }));

    expect(revalidateContent).toHaveBeenCalledWith("SCHOLAR_DIRECTORY", USER);
  });

  it("leaves reputation untouched", async () => {
    const { deleteAccount } = await import("@/app/actions/account");
    await deleteAccount(form({ confirmation: "DELETE" }));

    // Reputation is history, not live state; it is deliberately preserved.
    expect(row().reputation).toBe(42);
  });

  it("refuses to delete twice", async () => {
    const { deleteAccount } = await import("@/app/actions/account");
    await deleteAccount(form({ confirmation: "DELETE" }));
    const again = await deleteAccount(form({ confirmation: "DELETE" }));

    expect(again.success).toBe(false);
    expect((again as { error: string }).error).toMatch(/already deleted/i);
  });

  it("refuses an anonymous caller and leaves the row intact", async () => {
    session = null;
    const { deleteAccount } = await import("@/app/actions/account");

    await expect(deleteAccount(form({ confirmation: "DELETE" }))).rejects.toThrow();
    expect(row().isDeleted).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });
});

/**
 * The two halves of getting the institutional trust badge.
 *
 * 1. `requestInstitutionVerification` — a user asks to verify an email at a
 *    domain that is ALREADY allowlisted. Issues a single-use, hashed,
 *    20-minute token; the emailed link is consumed by
 *    `auth/verify-institution`, which is covered separately.
 * 2. `requestInstitutionDomain` — a user asks for a NEW domain to be added to
 *    the allowlist. This is the path that decides who is ever able to get the
 *    badge, and it is public (no auth), Turnstile-gated, and rate limited per
 *    email AND per IP, so it is a spam/abuse surface.
 *
 * Neither had any test. The rejection paths matter most: a user must not be
 * able to silently attach someone else's address, and one person must not be
 * able to flood the admin review queue.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { rowById, seedReplacing } from "../helpers/action-harness";

const USER = "u-user";
const OTHER = "u-other";

let session: { id: string } | null = null;
let rateLimitAllowed = true;
let degraded = false;
let turnstileOk = true;
const sendInstitutionVerificationEmail = vi.fn(async () => ({ success: true }));
const getRequestFingerprint = vi.fn((_h: unknown) => "fp");

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});
vi.mock("@/lib/auth", () => ({
  requireActiveUser: vi.fn(async () => {
    if (!session) throw new Error("Not logged in");
    return session;
  }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyInstitutionRequestTurnstile: async () => turnstileOk,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitAllowed, degraded })),
  enforceRateLimit: vi.fn(async () => {}),
  getRequestFingerprint: (h: unknown) => getRequestFingerprint(h),
  getRequestIpKey: vi.fn(() => "ip"),
  hashRateLimitKey: vi.fn((v: string) => v),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/url", () => ({ getBaseUrl: async () => "https://sb.test" }));
vi.mock("@/lib/email", () => ({
  sendInstitutionVerificationEmail: (...a: unknown[]) =>
    sendInstitutionVerificationEmail(...(a as [])),
}));

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const row = (id = USER) => rowById("user", id);

/**
 * Seeds the user, REPLACING any existing row.
 *
 * `fakeDb.seed` inserts rather than upserts, so re-seeding the same id left the
 * first row's values in place and the per-test overrides silently did nothing.
 */
const seedUser = (overrides: Record<string, unknown> = {}) =>
  seedReplacing("user", {
    id: USER,
    email: "me@uni.edu",
    name: "Me",
    handle: "me",
    isDeleted: false,
    institutionEmail: null,
    institutionVerifiedAt: null,
    pendingInstitutionEmail: null,
    pendingInstitutionDomain: null,
    institutionVerificationTokenHash: null,
    institutionVerificationExpiresAt: null,
    ...overrides,
  });

beforeEach(() => {
  resetFakeDb();
  session = { id: USER };
  rateLimitAllowed = true;
  degraded = false;
  turnstileOk = true;
  sendInstitutionVerificationEmail.mockClear();
  getRequestFingerprint.mockClear();
  seedUser();
});

describe("requestInstitutionVerification", () => {
  it("issues a hashed, expiring token for an allowlisted domain", async () => {
    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "me@mit.edu" }),
    );

    expect(result.success).toBe(true);
    // Stored HASHED — the raw token only ever exists in the email.
    expect(row().institutionVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row().pendingInstitutionEmail).toBe("me@mit.edu");
    expect(row().institutionVerifiedAt).toBeNull();
    expect(sendInstitutionVerificationEmail).toHaveBeenCalled();
  });

  it("refuses a domain that is not on the allowlist", async () => {
    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "me@notarealdomain12345.com" }),
    );

    expect(result.success).toBe(false);
    expect((result as { code?: string }).code).toBe("EMAIL_DOMAIN_NOT_ALLOWED");
    expect(row().institutionVerificationTokenHash).toBeNull();
    expect(sendInstitutionVerificationEmail).not.toHaveBeenCalled();
  });

  it("refuses an address already verified on ANOTHER account", async () => {
    fakeDb.seed("user", {
      id: OTHER,
      institutionEmail: "taken@mit.edu",
      isDeleted: false,
    });

    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "taken@mit.edu" }),
    );

    // The takeover vector: claiming an address another scholar already proved.
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/another account/i);
    expect(row().institutionVerificationTokenHash).toBeNull();
  });

  it("rejects a malformed address", async () => {
    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "not-an-email" }),
    );
    expect(result.success).toBe(false);
  });

  it("is a no-op when the address is already verified as the current one", async () => {
    seedUser({ institutionEmail: "me@mit.edu", institutionVerifiedAt: new Date() });

    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "me@mit.edu" }),
    );

    expect(result.success).toBe(true);
    expect(sendInstitutionVerificationEmail).not.toHaveBeenCalled();
  });

  it("throttles a resend inside the cooldown window", async () => {
    seedUser({
      pendingInstitutionEmail: "me@mit.edu",
      // VERIFICATION_TTL_MS is 20 minutes, and the action infers `sentAt` as
      // `expiresAt - TTL`. A near-full TTL therefore means "just sent", which is
      // what puts it inside the 60s resend cooldown. (A 10-minute expiry would
      // imply it was sent 10 minutes ago — already past the cooldown.)
      institutionVerificationExpiresAt: new Date(Date.now() + 19.9 * 60_000),
    });

    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "me@mit.edu" }),
    );

    expect(result.success).toBe(true);
    expect(sendInstitutionVerificationEmail).not.toHaveBeenCalled();
  });

  it("honours the rate limit without issuing a token", async () => {
    rateLimitAllowed = false;
    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    const result = await requestInstitutionVerification(
      form({ institutionEmail: "me@mit.edu" }),
    );

    expect(result.success).toBe(false);
    expect(row().institutionVerificationTokenHash).toBeNull();
    expect(sendInstitutionVerificationEmail).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller", async () => {
    session = null;
    const { requestInstitutionVerification } = await import(
      "@/app/actions/institution-verification"
    );
    await expect(
      requestInstitutionVerification(form({ institutionEmail: "me@mit.edu" })),
    ).rejects.toThrow();
  });
});

describe("requestInstitutionDomain", () => {
  const valid = {
    institutionEmail: "admin@newuni-research.org",
    confirmationEmail: "admin@newuni-research.org",
    institutionName: "New University",
    website: "https://newuni-research.org",
    details: "Please add us.",
    turnstileToken: "token",
  };

  it("creates a PENDING review request", async () => {
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form(valid));

    expect(result.success).toBe(true);
    const rows = fakeDb.rows("institutionDomainRequest");
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBe("newuni-research.org");
    expect(rows[0].institutionName).toBe("New University");
    expect(rows[0].requesterEmail).toBe("admin@newuni-research.org");
    // NOTE: `status` is a Prisma column DEFAULT, which the fake store cannot
    // model, so it is intentionally not asserted here. The action relies on the
    // schema default rather than passing it explicitly — worth knowing, since a
    // rename of that default would silently change this flow.
  });

  it("refuses a domain that is already allowlisted", async () => {
    // Note: `.edu` and `.ac.uk` are REGULATED_INSTITUTIONAL_SUFFIXES, so any
    // university domain is ALREADY allowlisted. That is why the domain-request
    // fixtures below deliberately use a `.org`, which is neither a regulated
    // suffix nor a named institutional domain.
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(
      form({ ...valid, institutionEmail: "x@mit.edu" }),
    );

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/already approved/i);
    expect(fakeDb.rows("institutionDomainRequest")).toHaveLength(0);
  });

  it("refuses to re-request a domain that is already PENDING", async () => {
    fakeDb.seed("institutionDomainRequest", {
      id: "req-1",
      domain: "newuni-research.org",
      status: "PENDING",
      institutionName: "New University",
    });

    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form(valid));

    // A duplicate must not create a second review row for the admins to sift.
    expect(fakeDb.rows("institutionDomainRequest")).toHaveLength(1);
    expect(result, JSON.stringify(result)).toMatchObject({ success: true });
  });

  it("allows a REJECTED request to be resubmitted", async () => {
    fakeDb.seed("institutionDomainRequest", {
      id: "req-1",
      domain: "newuni-research.org",
      status: "REJECTED",
      institutionName: "Old name",
    });

    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form(valid));

    const rows = fakeDb.rows("institutionDomainRequest");
    expect(result.success).toBe(true);
    expect(rows).toHaveLength(1);
    // The resubmit path sets `status` explicitly (unlike the create path, which
    // relies on the column default), so it IS assertable here.
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].institutionName).toBe("New University");
  });

  it("refuses without the Turnstile token", async () => {
    turnstileOk = false;
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form(valid));

    expect(result.success).toBe(false);
    expect(fakeDb.rows("institutionDomainRequest")).toHaveLength(0);
  });

  it("rate limits per IP so the review queue cannot be flooded", async () => {
    rateLimitAllowed = false;
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form(valid));

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/rate limit/i);
    expect(fakeDb.rows("institutionDomainRequest")).toHaveLength(0);
  });

  it("refuses rather than proceeding when the limiter is degraded", async () => {
    // Degraded means "we do not know" — failing open would let the flood
    // through during an outage, which is exactly when it would be attempted.
    rateLimitAllowed = true;
    degraded = true;
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form(valid));

    expect(result.success).toBe(false);
    expect(fakeDb.rows("institutionDomainRequest")).toHaveLength(0);
  });

  it("rejects a javascript: website", async () => {
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(
      form({ ...valid, website: "javascript:alert(1)" }),
    );

    expect(result.success).toBe(false);
    expect(fakeDb.rows("institutionDomainRequest")).toHaveLength(0);
  });

  it("rejects a missing institution name", async () => {
    const { requestInstitutionDomain } = await import(
      "@/app/actions/institution"
    );
    const result = await requestInstitutionDomain(form({ ...valid, institutionName: "" }));
    expect(result.success).toBe(false);
  });
});

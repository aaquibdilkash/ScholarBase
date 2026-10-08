/**
 * M5 of the launch-readiness audit — signup used to defeat Supabase's
 * built-in anti-enumeration protection.
 *
 * Supabase answers signUp() for an already-registered email with an
 * AMBIGUOUS signal (a user object whose `identities` array is empty) precisely
 * so callers cannot tell registered from unregistered. signup() detected that
 * signal and returned "An account with this email already exists" — a
 * definitive yes/no for phishing reconnaissance against researchers.
 *
 * The property asserted here is not wording taste: BOTH outcomes must return
 * responses identical in success flag AND message, so nothing observable
 * distinguishes them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let signUpResponse: {
  data: { user: { identities: Array<{ id: string }> } | null } | null;
  error: { message: string } | null;
};

const signUpMock = vi.fn(async () => signUpResponse);

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signUp: signUpMock } })),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, degraded: false })),
  getRequestIpKey: vi.fn(() => "ip"),
  hashRateLimitKey: vi.fn((v: string) => v),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("@/lib/email-domain-allowlist", () => ({
  isAllowedEmailDomain: vi.fn(() => true),
}));
vi.mock("@/lib/account-recovery", () => ({
  recoverDeletedAccount: vi.fn(async () => null),
}));
vi.mock("@/lib/users", () => ({
  ensureUserProfile: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/url", () => ({ getBaseUrl: async () => "https://sb.test" }));

const form = (overrides: Record<string, string> = {}) => {
  const fd = new FormData();
  const fields: Record<string, string> = {
    email: "new@university.edu",
    password: "Sup3rSecret!",
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const submit = async (fd: FormData) => {
  const { signup } = await import("@/app/actions/auth");
  return signup(fd);
};

beforeEach(() => {
  signUpMock.mockClear();
  signUpResponse = {
    data: { user: { identities: [{ id: "provider|123" }] } },
    error: null,
  };
});

describe("signup anti-enumeration", () => {
  it("a NEW email succeeds with the shared ambiguous message", async () => {
    const result = await submit(form());
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("message");
  });

  it("an EXISTING email (empty identities) gets the BYTE-identical response", async () => {
    signUpResponse = { data: { user: { identities: [] } }, error: null };
    const existing = await submit(form());

    signUpResponse = {
      data: { user: { identities: [{ id: "provider|123" }] } },
      error: null,
    };
    const fresh = await submit(form());

    // The whole point: nothing observable distinguishes the two.
    expect(existing).toEqual(fresh);
    expect(existing.success).toBe(true);
  });

  it("a duplicate reported as an ERROR also gets the identical response", async () => {
    signUpResponse = {
      data: null,
      error: { message: "User already registered" },
    };
    const dup = await submit(form());

    signUpResponse = {
      data: { user: { identities: [{ id: "provider|123" }] } },
      error: null,
    };
    const fresh = await submit(form());

    expect(dup).toEqual(fresh);
  });

  it("genuinely different failures still surface as errors", async () => {
    signUpResponse = {
      data: null,
      error: { message: "Signup is disabled" },
    };
    const result = await submit(form());
    expect(result.success).toBe(false);
  });

  it("does not contain the old definitive wording", async () => {
    signUpResponse = { data: { user: { identities: [] } }, error: null };
    const result = await submit(form());
    const message = "message" in result ? result.message : "";
    expect(message).not.toMatch(/already exists/i);
  });
});

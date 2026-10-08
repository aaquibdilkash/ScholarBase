/**
 * H3 of the launch-readiness audit — the public contact form could burn the
 * entire Resend free-tier daily cap in under a minute.
 *
 * Three things used to stack: both rate-limit keys were fully
 * attacker-controlled (self-reported email, spoofable IP fingerprint), the
 * email-keyed limiter was SKIPPED entirely when the raw email field was
 * empty, and there was no CAPTCHA. Now: validation first, limits
 * unconditionally, then a server-verified Turnstile token — before any email
 * is constructed, let alone sent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let turnstileOk = true;
let rateLimitAllowed = true;
const sendMock = vi.fn(async () => ({ id: "email_1" }));
const verifyMock = vi.fn(async (token: string) =>
  // Mirror the real verifier: an empty token is rejected before any round-trip.
  token ? turnstileOk : false,
);

vi.mock("@/lib/turnstile", () => ({
  verifyContactFormTurnstile: (token: string) => verifyMock(token),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: rateLimitAllowed, degraded: false })),
  getRequestFingerprint: vi.fn(() => "fp"),
  hashRateLimitKey: vi.fn((v: string) => v),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const form = (overrides: Record<string, string> = {}) => {
  const fd = new FormData();
  const fields: Record<string, string> = {
    name: "Jane Doe",
    email: "jane@university.edu",
    subject: "Partnership",
    message: "Hello from the department.",
    turnstileToken: "valid-token",
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const submit = async (fd: FormData) => {
  const { sendContactMessage } = await import("@/app/actions/contact");
  return sendContactMessage({ message: "", success: false }, fd);
};

beforeEach(() => {
  turnstileOk = true;
  rateLimitAllowed = true;
  sendMock.mockClear();
  verifyMock.mockClear();
});

describe("sendContactMessage", () => {
  it("sends when valid AND the Turnstile token verifies", async () => {
    const result = await submit(form());
    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith("valid-token");
  });

  it("rejects a missing token WITHOUT sending", async () => {
    const result = await submit(form({ turnstileToken: "" }));
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/security verification/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a failed verification WITHOUT sending", async () => {
    turnstileOk = false;
    const result = await submit(form());
    expect(result.success).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rate limits apply even when Turnstile would pass", async () => {
    rateLimitAllowed = false;
    const result = await submit(form());
    expect(result.success).toBe(false);
    expect(result.message).toBe("Rate limit exceeded");
    // The limit short-circuits BEFORE the Turnstile round-trip: a limited
    // attacker must not even cost a siteverify call.
    expect(verifyMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never reaches Turnstile or Resend with an invalid payload", async () => {
    const result = await submit(form({ email: "not-an-email" }));
    expect(result.success).toBe(false);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

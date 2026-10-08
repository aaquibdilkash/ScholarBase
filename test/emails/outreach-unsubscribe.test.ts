/**
 * H4 of the launch-readiness audit — unsubscribe-link signing silently
 * reused CRON_SECRET in production when EMAIL_UNSUBSCRIBE_SECRET was unset.
 *
 * The HMAC itself was always correct (timing-safe compare, purpose-bound
 * signing). The bug was two unrelated systems sharing one secret by silent
 * fallback: rotating either secret would invalidate the other's tokens, and a
 * leak of either would forge the other's credentials. Production now
 * hard-fails instead of borrowing.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  signOutreachUnsubscribeToken,
  verifyOutreachUnsubscribeToken,
} from "@/lib/emails/outreachUnsubscribe";

const saved: Record<string, string | undefined> = {};
const KEYS = ["NODE_ENV", "EMAIL_UNSUBSCRIBE_SECRET", "CRON_SECRET", "RESEND_API_KEY"];

function setEnv(overrides: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (!(k in saved)) saved[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
    delete saved[k];
  }
});

describe("outreach unsubscribe signing secret", () => {
  it("production HARD-FAILS when EMAIL_UNSUBSCRIBE_SECRET is missing", async () => {
    setEnv({
      NODE_ENV: "production",
      EMAIL_UNSUBSCRIBE_SECRET: undefined,
      // The old bug: CRON_SECRET present made the fallback SUCCEED silently.
      CRON_SECRET: "cron-secret-value",
    });

    expect(() => signOutreachUnsubscribeToken("a@b.c")).toThrow(
      /EMAIL_UNSUBSCRIBE_SECRET/,
    );
  });

  it("production uses the DEDICATED secret when set", async () => {
    setEnv({
      NODE_ENV: "production",
      EMAIL_UNSUBSCRIBE_SECRET: "dedicated-outreach-secret",
      CRON_SECRET: "cron-secret-value",
    });

    const token = signOutreachUnsubscribeToken("a@b.c");
    expect(verifyOutreachUnsubscribeToken("a@b.c", token)).toBe(true);
    // Purpose-bound: the token is not valid for a different address.
    expect(verifyOutreachUnsubscribeToken("other@b.c", token)).toBe(false);
  });

  it("a tampered token is rejected", async () => {
    setEnv({
      NODE_ENV: "test",
      EMAIL_UNSUBSCRIBE_SECRET: "dev-secret",
    });

    const token = signOutreachUnsubscribeToken("a@b.c");
    const flipped = (token[0] === "a" ? "b" : "a") + token.slice(1);
    expect(verifyOutreachUnsubscribeToken("a@b.c", flipped)).toBe(false);
    expect(verifyOutreachUnsubscribeToken("a@b.c", null)).toBe(false);
  });

  it("non-production keeps the documented dev fallback chain", async () => {
    setEnv({
      NODE_ENV: "test",
      EMAIL_UNSUBSCRIBE_SECRET: undefined,
      CRON_SECRET: "dev-cron-secret",
    });

    const token = signOutreachUnsubscribeToken("a@b.c");
    expect(verifyOutreachUnsubscribeToken("a@b.c", token)).toBe(true);
  });
});

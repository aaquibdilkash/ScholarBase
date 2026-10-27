/**
 * `staleOAuthIdentities` decides which linked logins are revoked after a
 * primary-email change.
 *
 * The property that matters is asymmetric: revoking too little leaves a way into
 * the account that its owner just moved away from (`kdmsc121@gmail.com` still
 * signing in after the primary email became `kahkashadilkashh0@gmail.com`), and
 * revoking too much locks the owner out. Both directions are asserted here.
 */
import type { UserIdentity } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { staleOAuthIdentities } from "@/lib/auth-identities";

const identity = (
  identityId: string,
  provider: string,
  email?: string,
): UserIdentity => ({
  identity_id: identityId,
  id: identityId,
  user_id: "u-1",
  provider,
  identity_data: email === undefined ? {} : { email },
});

const emails = (identities: UserIdentity[]) =>
  identities.map((i) => i.identity_data?.email);

describe("staleOAuthIdentities", () => {
  it("proposes a Google identity still holding the previous address", () => {
    const all = [
      identity("e-1", "email", "new@gmail.com"),
      identity("g-old", "google", "old@gmail.com"),
    ];

    expect(emails(staleOAuthIdentities(all, "new@gmail.com"))).toEqual([
      "old@gmail.com",
    ]);
  });

  it("keeps a Google identity that matches the new primary address", () => {
    const all = [
      identity("e-1", "email", "new@gmail.com"),
      identity("g-same", "google", "new@gmail.com"),
      identity("g-old", "google", "old@gmail.com"),
    ];

    expect(emails(staleOAuthIdentities(all, "new@gmail.com"))).toEqual([
      "old@gmail.com",
    ]);
  });

  it("never touches the email identity, even when its data lags behind", () => {
    const all = [
      identity("e-1", "email", "old@gmail.com"),
      identity("g-1", "google", "new@gmail.com"),
    ];

    expect(staleOAuthIdentities(all, "new@gmail.com")).toEqual([]);
  });

  it("compares addresses the same way sign-in does (case, gmail dots, plus tags)", () => {
    const all = [
      identity("e-1", "email", "new@gmail.com"),
      identity("g-case", "google", " New@Gmail.com "),
      identity("g-dots", "google", "n.ew+tag@gmail.com"),
      identity("g-diff", "google", "old@gmail.com"),
    ];

    expect(emails(staleOAuthIdentities(all, "new@gmail.com"))).toEqual([
      "old@gmail.com",
    ]);
  });

  it("keeps an identity whose email cannot be read, rather than guessing", () => {
    const all = [
      identity("e-1", "email", "new@gmail.com"),
      identity("g-unknown", "google"),
    ];

    expect(staleOAuthIdentities(all, "new@gmail.com")).toEqual([]);
  });

  it("refuses to strip the account's last way in", () => {
    // Google-only account: the sole identity points at the old address, and
    // unlinking it would leave nothing to sign in with.
    const all = [identity("g-only", "google", "old@gmail.com")];

    expect(staleOAuthIdentities(all, "new@gmail.com")).toEqual([]);
  });

  it("keeps every identity when they are all tied to old addresses", () => {
    const all = [
      identity("g-1", "google", "old1@gmail.com"),
      identity("g-2", "google", "old2@gmail.com"),
    ];

    expect(staleOAuthIdentities(all, "new@gmail.com")).toEqual([]);
  });

  it("is a no-op without a usable primary address", () => {
    const all = [
      identity("e-1", "email", ""),
      identity("g-1", "google", "old@gmail.com"),
    ];

    expect(staleOAuthIdentities(all, "   ")).toEqual([]);
  });

  it("is a no-op for a password-only account", () => {
    expect(
      staleOAuthIdentities([identity("e-1", "email", "new@gmail.com")], "new@gmail.com"),
    ).toEqual([]);
  });
});

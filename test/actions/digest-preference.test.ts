/**
 * The opt-IN surface for the digest cadence.
 *
 * Before this action existed, `digestPreference` had exactly one writer: the
 * link inside a digest email, which only accepts WEEKLY or NEVER. That made the
 * feature strictly opt-OUT, and it is why flipping the schema default to opt-in
 * could not be done safely — a user on NEVER receives no email, therefore no
 * link, therefore no way to discover the feature ever existed.
 *
 * These tests pin the contract that makes an opt-in default viable: the value
 * is validated at the boundary, the viewer comes from the session (never a
 * client argument), and the PERSISTED value is returned rather than the input.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import {
  getDigestPreference,
  updateDigestPreference,
} from "@/app/actions/notification-preferences";
import { seedReplacing, userRow } from "../helpers/action-harness";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const USER = "u-user";
const OTHER = "u-other";

let session: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  requireActiveUser: vi.fn(async () => {
    if (!session) throw new Error("Not logged in");
    return session;
  }),
}));

const row = (id = USER) => fakeDb.rows("user").find((u) => u.id === id)!;

beforeEach(() => {
  resetFakeDb();
  session = { id: USER };
  seedReplacing("user", userRow(USER, { digestPreference: "DAILY" }));
  seedReplacing("user", userRow(OTHER, { digestPreference: "DAILY" }));
});

describe("updateDigestPreference", () => {
  it("persists each cadence", async () => {
    for (const pref of ["DAILY", "WEEKLY", "NEVER"] as const) {
      const result = await updateDigestPreference(pref);
      expect(result.success).toBe(true);
      expect(row().digestPreference).toBe(pref);
    }
  });

  it("returns the PERSISTED value, not the input", async () => {
    // RULE 1: the client splices this into its own state, so it must reflect
    // what the database holds rather than what the caller hoped to write.
    const result = await updateDigestPreference("WEEKLY");

    expect(result).toEqual({
      success: true,
      data: { digestPreference: "WEEKLY" },
    });
  });

  it("normalises case and surrounding whitespace", async () => {
    // The value arrives from a hand-built string; the client is not the only
    // caller a server action has.
    const result = await updateDigestPreference("  weekly  ");
    expect(result.success).toBe(true);
    expect(row().digestPreference).toBe("WEEKLY");
  });

  it("rejects an unrecognised value WITHOUT writing", async () => {
    // The enum reaches the action as a plain string. Writing it straight to
    // Prisma would let a crafted call set a value the app cannot render.
    for (const bad of ["HOURLY", "", "DAILY; DROP TABLE", "null"]) {
      const result = await updateDigestPreference(bad);
      expect(result.success, `value: ${bad}`).toBe(false);
      expect(row().digestPreference).toBe("DAILY");
    }
  });

  it("writes only the caller's own row", async () => {
    // RULE 1 identity contract: there is deliberately no user id parameter, so
    // this cannot be aimed at another account from the browser.
    await updateDigestPreference("NEVER");

    expect(row(USER).digestPreference).toBe("NEVER");
    expect(row(OTHER).digestPreference).toBe("DAILY");
  });

  it("rejects an anonymous caller and writes nothing", async () => {
    session = null;

    await expect(updateDigestPreference("NEVER")).rejects.toThrow();
    expect(row(USER).digestPreference).toBe("DAILY");
    expect(row(OTHER).digestPreference).toBe("DAILY");
  });

  it("leaves every other profile field untouched", async () => {
    const before = { ...row() };

    await updateDigestPreference("NEVER");

    const after = row();
    // Everything except the cadence must be byte-identical: this is a narrow
    // write, and a shared `update` payload that accidentally spread other fields
    // would silently rewrite profile data on every radio click.
    expect(after.handle).toBe(before.handle);
    expect(after.email).toBe(before.email);
    expect(after.reputation).toBe(before.reputation);
    expect(after.institutionVerifiedAt).toBe(before.institutionVerifiedAt);
    expect(after.isDeleted).toBe(false);
    expect(after.digestPreference).toBe("NEVER");
  });
});

describe("getDigestPreference", () => {
  it("returns the stored cadence", async () => {
    seedReplacing("user", userRow(USER, { digestPreference: "WEEKLY" }));
    expect(await getDigestPreference()).toBe("WEEKLY");
  });

  it("falls back to NEVER when the profile has no stored value", async () => {
    // The opt-in default: a user with nothing stored must read as "Off", not
    // "Daily", or the settings page would show a cadence that isn't theirs.
    seedReplacing("user", userRow(USER, { digestPreference: undefined }));
    expect(await getDigestPreference()).toBe("NEVER");
  });

  it("rejects an anonymous caller", async () => {
    session = null;
    await expect(getDigestPreference()).rejects.toThrow();
  });
});

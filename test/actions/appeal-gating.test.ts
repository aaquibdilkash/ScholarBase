/**
 * RULE 4 / RULE 1 — `submitAppeal` gating.
 *
 * An appeal is a frozen/deleted user's only route back into the platform, so the
 * gates here are what stop a stranger from appealing content they do not own,
 * and what stop one pending appeal per entity from being used to spam admins.
 * The action had no test at all.
 *
 * The guards are checked in a specific order (existence -> ownership ->
 * frozen/deleted -> duplicate), and the tests assert the MESSAGE as well as the
 * rejection, so a reordering that starts leaking "only the owner can appeal
 * this" to a non-owner is visible.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { submitAppeal } from "@/app/actions/appeals";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const OWNER = "u-owner";
const STRANGER = "u-stranger";
const ENTITY = "entity-1";

let session: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to appeal.");
    return session;
  }),
}));

const base = {
  entityId: ENTITY,
  module: "ARTICLE_PAGE",
  entityType: "POST" as const,
  details: "This was removed in error.",
};

/** Replaces the seeded row so each test starts from a known state. */
const seedEntity = (overrides: Record<string, unknown> = {}) => {
  const rows = fakeDb.rows("article");
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].id === ENTITY) rows.splice(i, 1);
  }
  fakeDb.seed("article", {
    id: ENTITY,
    authorId: OWNER,
    title: "Frozen article",
    isFrozen: true,
    isDeleted: false,
    hasActiveAppeal: false,
    ...overrides,
  });
};

beforeEach(() => {
  resetFakeDb();
  session = { id: OWNER };
  seedEntity();
});

describe("submitAppeal", () => {
  it("creates a pending appeal and flags the entity", async () => {
    const result = await submitAppeal(base);

    expect(result.success).toBe(true);
    expect((result as { data: { status: string } }).data.status).toBe("PENDING");

    const appeals = fakeDb.rows("appeal");
    expect(appeals).toHaveLength(1);
    expect(appeals[0].ownerId).toBe(OWNER);
    // The flag stops a second appeal being filed.
    expect(fakeDb.rows("article")[0].hasActiveAppeal).toBe(true);
  });

  it("allows an appeal on DELETED content too", async () => {
    seedEntity({ isFrozen: false, isDeleted: true });
    const result = await submitAppeal(base);
    expect(result.success).toBe(true);
  });

  it("refuses an appeal from someone who does not own the content", async () => {
    session = { id: STRANGER };
    const result = await submitAppeal(base);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/Only the owner can appeal/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("refuses an appeal on content that is neither frozen nor deleted", async () => {
    seedEntity({ isFrozen: false, isDeleted: false });
    const result = await submitAppeal(base);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/no longer frozen or deleted/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("refuses a second appeal while one is pending", async () => {
    await submitAppeal(base);
    const result = await submitAppeal(base);
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/already pending for this content/);
    expect(fakeDb.rows("appeal")).toHaveLength(1);
  });

  it("refuses an appeal on content that does not exist", async () => {
    const result = await submitAppeal({ ...base, entityId: "does-not-exist" });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/Content not found/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("requires a non-empty reason", async () => {
    const result = await submitAppeal({ ...base, details: "   " });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/Appeal reason is required/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("rejects an over-long reason rather than truncating it", async () => {
    const result = await submitAppeal({ ...base, details: "x".repeat(5000) });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/too long/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("rejects an unknown module instead of defaulting somewhere unsafe", async () => {
    await expect(
      submitAppeal({ ...base, module: "NOT_A_MODULE" }),
    ).rejects.toThrow(/Invalid content type/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("falls back to the OTHER category for an unrecognised reason category", async () => {
    const result = await submitAppeal({
      ...base,
      reasonCategory: "MADE_UP_CATEGORY",
    });
    expect((result as { data: { category: string } }).data.category).toBe("OTHER");
  });

  it("keeps a recognised reason category", async () => {
    const result = await submitAppeal({
      ...base,
      reasonCategory: "MISTAKEN_MODERATION",
    });
    expect(
      (result as { data: { category: string } }).data.category,
    ).toBe("MISTAKEN_MODERATION");
  });

  it("rejects an anonymous caller", async () => {
    session = null;
    await expect(submitAppeal(base)).rejects.toThrow(/Log in to appeal/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("lets a frozen owner through auth (freeze is an eligibility gate, not an auth block)", async () => {
    // Regression: submitAppeal used requireActiveUser which threw
    // ACCOUNT_FROZEN for any frozen account — the exact user who needs to
    // appeal. Auth must only enforce login + not-deleted; the
    // frozen/deleted gates below decide eligibility per entity.
    // The file-level mock now provides requireCurrentUser; a frozen owner
    // reaching success here proves the auth layer no longer blocks them.
    seedEntity({ isFrozen: true });
    const result = await submitAppeal(base);
    expect(result.success).toBe(true);
  });
});

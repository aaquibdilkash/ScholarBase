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
  requireActiveUser: vi.fn(async () => {
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
    await expect(submitAppeal(base)).rejects.toThrow(
      /Only the owner can appeal/,
    );
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("refuses an appeal on content that is neither frozen nor deleted", async () => {
    seedEntity({ isFrozen: false, isDeleted: false });
    await expect(submitAppeal(base)).rejects.toThrow(
      /Only frozen or deleted content can be appealed/,
    );
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("refuses a second appeal while one is pending", async () => {
    await submitAppeal(base);
    await expect(submitAppeal(base)).rejects.toThrow(
      /already pending for this content/,
    );
    expect(fakeDb.rows("appeal")).toHaveLength(1);
  });

  it("refuses an appeal on content that does not exist", async () => {
    await expect(
      submitAppeal({ ...base, entityId: "does-not-exist" }),
    ).rejects.toThrow(/Content not found/);
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("requires a non-empty reason", async () => {
    await expect(submitAppeal({ ...base, details: "   " })).rejects.toThrow(
      /Appeal reason is required/,
    );
    expect(fakeDb.rows("appeal")).toHaveLength(0);
  });

  it("rejects an over-long reason rather than truncating it", async () => {
    await expect(
      submitAppeal({ ...base, details: "x".repeat(5000) }),
    ).rejects.toThrow(/too long/);
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
});

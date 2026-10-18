/**
 * `getMyContentFreezeContext` - owner/admin-only freeze dialog for one
 * frozen content entity.
 *
 * Mirrors `freeze-context.test.ts` (account freeze) but scoped to a content
 * id. The security-critical properties, in order of blast radius:
 * 1. Report excerpts must NEVER leak to a stranger - the dialog exists to
 *    tell the OWNER why the post was frozen, not the world.
 * 2. Reporter identity is NEVER selected (same retaliation guarantee as the
 *    account-level dialog).
 * 3. Admins may inspect any frozen entity; everyone else must own it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { getMyContentFreezeContext } from "@/app/actions/content-freeze-context";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const OWNER = "u-frozen-owner";
const OTHER = "u-stranger";
const ADMIN = "u-admin";
const POST_ID = "post-1";

let session: { id: string } | null = null;
let mockIsAdmin = false;

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to view freeze details.");
    return session;
  }),
  isUserAdmin: vi.fn(async () => mockIsAdmin),
}));

const seedPost = (overrides: Record<string, unknown> = {}) => {
  fakeDb.seed("socialPost", {
    id: POST_ID,
    authorId: OWNER,
    isFrozen: true,
    hasActiveAppeal: true,
    reportCount: 2,
    ...overrides,
  });
};

beforeEach(() => {
  resetFakeDb();
  session = { id: OWNER };
  mockIsAdmin = false;
  seedPost();
});

describe("getMyContentFreezeContext", () => {
  it("returns frozen flags, grouped reports, the pending appeal, and isOwner for the owner", async () => {
    fakeDb.seed("report", [
      {
        id: "r1",
        entityId: POST_ID,
        status: "PENDING",
        category: "SPAM",
        details: "spammy post content",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "r2",
        entityId: POST_ID,
        status: "PENDING",
        category: "HARASSMENT",
        details: "harassing comment",
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);
    fakeDb.seed("appeal", {
      id: "a1",
      entityId: POST_ID,
      ownerId: OWNER,
      status: "PENDING",
      category: "SPAM",
      createdAt: new Date("2026-01-04T00:00:00Z"),
    });

    const ctx = await getMyContentFreezeContext(POST_ID, "SOCIAL_FEED");

    expect(ctx).toMatchObject({
      isFrozen: true,
      hasActiveAppeal: true,
      reportCount: 2,
      isOwner: true,
      isAdmin: false,
    });
    expect(ctx.reports).toHaveLength(2);
    expect(ctx.reports).toContainEqual({
      category: "SPAM",
      count: 1,
      excerpts: ["spammy post content"],
    });
    expect(ctx.pendingAppeal).toMatchObject({ id: "a1", category: "SPAM" });
  });

  it("lets an admin inspect someone else's frozen content (isOwner false, isAdmin true)", async () => {
    session = { id: ADMIN };
    mockIsAdmin = true;

    const ctx = await getMyContentFreezeContext(POST_ID, "SOCIAL_FEED");

    expect(ctx.isOwner).toBe(false);
    expect(ctx.isAdmin).toBe(true);
    expect(ctx.isFrozen).toBe(true);
  });

  it("rejects a stranger so report excerpts never leak publicly", async () => {
    session = { id: OTHER };
    fakeDb.seed("report", {
      id: "r1",
      entityId: POST_ID,
      status: "PENDING",
      category: "SPAM",
      details: "leaky excerpt",
      createdAt: new Date(),
    });

    await expect(
      getMyContentFreezeContext(POST_ID, "SOCIAL_FEED"),
    ).rejects.toThrow(/Not authorized to view freeze details/);
  });

  it("requires login", async () => {
    session = null;
    await expect(
      getMyContentFreezeContext(POST_ID, "SOCIAL_FEED"),
    ).rejects.toThrow(/Log in to view freeze details/);
  });

  it("throws when the content row does not exist", async () => {
    await expect(
      getMyContentFreezeContext("missing-id", "SOCIAL_FEED"),
    ).rejects.toThrow(/Content not found/);
  });

  it("ignores resolved reports and other entities' reports", async () => {
    fakeDb.seed("report", [
      { id: "r1", entityId: POST_ID, status: "RESOLVED", category: "SPAM", details: "old", createdAt: new Date() },
      { id: "r2", entityId: "other-entity", status: "PENDING", category: "SPAM", details: "not mine", createdAt: new Date() },
    ]);

    const ctx = await getMyContentFreezeContext(POST_ID, "SOCIAL_FEED");

    expect(ctx.reports).toEqual([]);
  });

  it("returns null pendingAppeal when the appeal is decided or belongs to someone else", async () => {
    fakeDb.seed("appeal", {
      id: "a1",
      entityId: POST_ID,
      ownerId: OTHER,
      status: "PENDING",
      category: "SPAM",
      createdAt: new Date(),
    });

    const ctx = await getMyContentFreezeContext(POST_ID, "SOCIAL_FEED");

    expect(ctx.pendingAppeal).toBeNull();
  });

  it("never selects reporter identity in the report query", async () => {
    fakeDb.seed("report", {
      id: "r1",
      entityId: POST_ID,
      status: "PENDING",
      category: "SPAM",
      details: "x",
      reporterId: "u-reporter",
      createdAt: new Date(),
    });

    await getMyContentFreezeContext(POST_ID, "SOCIAL_FEED");

    const reportCalls = fakeDb
      .calls()
      .filter((call) => call.model === "report");
    expect(reportCalls.length).toBeGreaterThan(0);
    for (const call of reportCalls) {
      const select = (call.args.select ?? {}) as Record<string, unknown>;
      expect(select).not.toHaveProperty("reporterId");
      expect(select).not.toHaveProperty("reporter");
    }
  });
});

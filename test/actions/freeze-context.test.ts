/**
 * `getMyFreezeContext` — owner-only freeze reason dialog.
 *
 * This action ships without a test and the manifest gate (`test/manifest.test.ts`)
 * fails the suite until it is covered. The security-critical property: reporter
 * identity (`reporterId` / `reporter` relation) must NEVER be selected — the
 * dialog shows anonymized category counts + truncated excerpts so a frozen owner
 * cannot retaliate against reporters.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { getMyFreezeContext } from "@/app/actions/freeze-context";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const OWNER = "u-frozen-owner";
const OTHER = "u-other";

let session: { id: string } | null = null;

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to view freeze details.");
    return session;
  }),
}));

const seedOwner = (overrides: Record<string, unknown> = {}) => {
  fakeDb.seed("user", {
    id: OWNER,
    isFrozen: true,
    hasActiveAppeal: true,
    reportCount: 2,
    ...overrides,
  });
};

beforeEach(() => {
  resetFakeDb();
  session = { id: OWNER };
  seedOwner();
});

describe("getMyFreezeContext", () => {
  it("returns frozen flags, grouped reports, and the pending appeal", async () => {
    fakeDb.seed("report", [
      {
        id: "r1",
        entityId: OWNER,
        status: "PENDING",
        category: "SPAM",
        details: "spammy post content",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "r2",
        entityId: OWNER,
        status: "PENDING",
        category: "HARASSMENT",
        details: "harassing comment",
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);
    fakeDb.seed("appeal", {
      id: "a1",
      entityId: OWNER,
      ownerId: OWNER,
      status: "PENDING",
      category: "SPAM",
      createdAt: new Date("2026-01-04T00:00:00Z"),
    });

    const ctx = await getMyFreezeContext();

    expect(ctx.isFrozen).toBe(true);
    expect(ctx.hasActiveAppeal).toBe(true);
    expect(ctx.reportCount).toBe(2);
    expect(ctx.reports).toHaveLength(2);
    expect(ctx.reports).toContainEqual({
      category: "SPAM",
      count: 1,
      excerpts: ["spammy post content"],
    });
    expect(ctx.pendingAppeal).toMatchObject({ id: "a1", category: "SPAM" });
  });

  it("groups same-category reports and caps excerpts at 3, truncated to 140 chars", async () => {
    fakeDb.seed(
      "report",
      [1, 2, 3, 4, 5].map((n) => ({
        id: `r${n}`,
        entityId: OWNER,
        status: "PENDING",
        category: "SPAM",
        details: `${"x".repeat(200)}-${n}`,
        createdAt: new Date(`2026-01-0${n}T00:00:00Z`),
      })),
    );

    const ctx = await getMyFreezeContext();

    expect(ctx.reports).toHaveLength(1);
    expect(ctx.reports[0].category).toBe("SPAM");
    expect(ctx.reports[0].count).toBe(5);
    expect(ctx.reports[0].excerpts).toHaveLength(3);
    for (const excerpt of ctx.reports[0].excerpts) {
      expect(excerpt.length).toBeLessThanOrEqual(140);
    }
  });

  it("ignores resolved/dismissed and other users' reports", async () => {
    fakeDb.seed("report", [
      { id: "r1", entityId: OWNER, status: "RESOLVED", category: "SPAM", details: "old", createdAt: new Date() },
      { id: "r2", entityId: OTHER, status: "PENDING", category: "SPAM", details: "not mine", createdAt: new Date() },
    ]);

    const ctx = await getMyFreezeContext();

    expect(ctx.reports).toEqual([]);
  });

  it("returns null pendingAppeal when the appeal belongs to someone else or is decided", async () => {
    fakeDb.seed("appeal", {
      id: "a1",
      entityId: OWNER,
      ownerId: OTHER,
      status: "PENDING",
      category: "SPAM",
      createdAt: new Date(),
    });

    const ctx = await getMyFreezeContext();

    expect(ctx.pendingAppeal).toBeNull();
  });

  it("returns safe defaults when the user row is missing", async () => {
    for (const row of fakeDb.rows("user")) {
      if (row.id === OWNER) fakeDb.rows("user").splice(fakeDb.rows("user").indexOf(row), 1);
    }

    const ctx = await getMyFreezeContext();

    expect(ctx).toMatchObject({
      isFrozen: false,
      hasActiveAppeal: false,
      reportCount: 0,
      reports: [],
      pendingAppeal: null,
    });
  });

  it("requires login", async () => {
    session = null;
    await expect(getMyFreezeContext()).rejects.toThrow(/Log in to view freeze details/);
  });

  it("never selects reporter identity in the report query", async () => {
    fakeDb.seed("report", {
      id: "r1",
      entityId: OWNER,
      status: "PENDING",
      category: "SPAM",
      details: "x",
      reporterId: "u-reporter",
      createdAt: new Date(),
    });

    await getMyFreezeContext();

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

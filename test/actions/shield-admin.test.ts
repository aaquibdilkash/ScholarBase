/**
 * Admin → Scholar Shield read surface.
 *
 * The usage log is the only record of what the Shield actually did, so the
 * admin tabs are the one place a moderator can answer "which engine ran, for
 * whom, and when". These tests pin the two contracts the UI depends on:
 * the summary counts each tool independently (with a trailing-7-day window),
 * and the list is strictly filtered by tool, newest first, paginated.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const ADMIN = "u-admin";
let session: { id: string } | null = null;
let isAdmin = false;

vi.mock("@/lib/auth", () => ({
  requireCurrentUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to access admin.");
    return session;
  }),
  requireActiveUser: vi.fn(async () => {
    if (!session) throw new Error("Log in to access admin.");
    return session;
  }),
  isUserAdmin: vi.fn(async () => isAdmin),
}));
vi.mock("@/lib/tri-split/modules/registry", () => ({
  revalidateContent: vi.fn(),
  loadContentPage: vi.fn(async () => []),
}));
vi.mock("@/lib/qstash", () => ({ queueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({
  notifyUserById: vi.fn(async () => {}),
}));

import {
  getAdminShieldSummary,
  getAdminShieldUsage,
} from "@/app/actions/admin";

const SCHOLAR = "u-scholar";

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

let rowCounter = 0;
function usageRow(overrides: Record<string, unknown> = {}) {
  rowCounter += 1;
  return {
    id: `rep_${rowCounter}`,
    userId: SCHOLAR,
    tool: "DETECTOR",
    model: "on-device/cadence",
    overallScore: 50,
    neuralScore: null,
    cadenceScore: 40,
    createdAt: daysAgo(1),
    user: {
      id: SCHOLAR,
      name: "Ada Lovelace",
      handle: "ada",
      email: "ada@example.com",
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetFakeDb();
  rowCounter = 0;
  session = { id: ADMIN };
  isAdmin = true;
});

describe("getAdminShieldSummary", () => {
  it("counts each tool and windows the trailing 7 days", async () => {
    fakeDb.seed("shieldUsage", [
      usageRow({ tool: "DETECTOR", createdAt: daysAgo(1) }),
      usageRow({ tool: "DETECTOR", createdAt: daysAgo(30) }),
      usageRow({
        tool: "REWRITER",
        model: "groq/openai/gpt-oss-120b",
        createdAt: daysAgo(2),
      }),
      usageRow({ tool: "REWRITER", model: "nano", createdAt: daysAgo(10) }),
    ]);

    const summary = await getAdminShieldSummary();

    expect(summary.detector).toEqual({ total: 2, last7Days: 1 });
    expect(summary.rewriter).toEqual({ total: 2, last7Days: 1 });
    expect(summary.total).toBe(4);
  });

  it("returns zeros for an empty log", async () => {
    const summary = await getAdminShieldSummary();

    expect(summary).toEqual({
      detector: { total: 0, last7Days: 0 },
      rewriter: { total: 0, last7Days: 0 },
      total: 0,
    });
  });
});

describe("getAdminShieldUsage", () => {
  it("filters to the requested tool, newest first, and paginates", async () => {
    fakeDb.seed("shieldUsage", [
      usageRow({ tool: "DETECTOR", createdAt: daysAgo(3) }),
      usageRow({ tool: "DETECTOR", createdAt: daysAgo(2) }),
      usageRow({ tool: "DETECTOR", createdAt: daysAgo(1) }),
      usageRow({ tool: "REWRITER", model: "nano", createdAt: daysAgo(1) }),
    ]);

    const firstPage = await getAdminShieldUsage("DETECTOR", 1, 2);

    expect(firstPage.page).toBe(1);
    expect(firstPage.pageSize).toBe(2);
    expect(firstPage.total).toBe(3);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items.every((item) => item.tool === "DETECTOR")).toBe(true);
    // Newest first.
    expect(firstPage.items[0].createdAt.getTime()).toBeGreaterThan(
      firstPage.items[1].createdAt.getTime(),
    );

    const secondPage = await getAdminShieldUsage("DETECTOR", 2, 2);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.page).toBe(2);
  });

  it("returns rewriter rows with their engine and scholar", async () => {
    fakeDb.seed(
      "shieldUsage",
      usageRow({
        tool: "REWRITER",
        model: "groq/openai/gpt-oss-120b",
        overallScore: null,
        neuralScore: null,
        cadenceScore: null,
      }),
    );

    const page = await getAdminShieldUsage("REWRITER");

    expect(page.total).toBe(1);
    expect(page.items[0].model).toBe("groq/openai/gpt-oss-120b");
    expect(page.items[0].user?.handle).toBe("ada");
  });

  it("falls back to the Detector tab for an unknown tool", async () => {
    fakeDb.seed("shieldUsage", usageRow({ tool: "DETECTOR" }));

    const page = await getAdminShieldUsage("OTHER" as never);

    expect(page.total).toBe(1);
    expect(page.items[0].tool).toBe("DETECTOR");
  });

  it("clamps an invalid page to the first page", async () => {
    fakeDb.seed("shieldUsage", usageRow({ tool: "DETECTOR" }));

    const page = await getAdminShieldUsage("DETECTOR", Number.NaN);

    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(1);
  });

  it("refuses a non-admin before touching the database", async () => {
    isAdmin = false;

    await expect(getAdminShieldUsage("DETECTOR")).rejects.toThrow(
      /Not authorized/i,
    );
    await expect(getAdminShieldSummary()).rejects.toThrow(/Not authorized/i);
  });
});

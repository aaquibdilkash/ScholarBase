/**
 * Scholar Shield usage tracking.
 *
 * Before this landed, neither detector scans nor rewriter runs left any trace:
 * the PDF carried a client-generated submission id that was never persisted, so
 * "how much is Shield used, and which engine ran?" was unanswerable. These tests
 * pin the contract that every use writes one auditable row, that the per-scholar
 * counters move in the same transaction, and that a report is fetchable by the
 * cuid printed on the PDF.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";
import { seedReplacing, userRow } from "../helpers/action-harness";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

let session: { id: string } | null = null;
let frozen = false;

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => {
    if (!session) throw new Error("Not logged in");
    return { frozen, user: session };
  }),
  // transactions.ts (imported for TRANSACTION_OPTIONS) reads this at module load.
  isUserAdmin: vi.fn(async () => false),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    limited: false,
    degraded: false,
  })),
  RATE_LIMIT_ERROR: "Too many requests. Please slow down.",
  RATE_LIMIT_DEGRADED_ERROR:
    "Request protection is temporarily unavailable. Please try again in a moment.",
}));

import { recordShieldUse } from "@/app/actions/shield";
import {
  getShieldReport,
  getShieldUsageCounts,
  getShieldUsageHistory,
} from "@/lib/shield/usage";

const USER = "u-shield";
const OTHER = "u-other";

const usageRows = () => fakeDb.rows("shieldUsage");
const userRowById = (id = USER) => fakeDb.rows("user").find((u) => u.id === id)!;

beforeEach(() => {
  resetFakeDb();
  session = { id: USER };
  frozen = false;
  seedReplacing(
    "user",
    userRow(USER, {
      shieldDetectorUses: 0,
      shieldRewriterUses: 0,
      shieldTotalUses: 0,
    }),
  );
  seedReplacing(
    "user",
    userRow(OTHER, {
      shieldDetectorUses: 0,
      shieldRewriterUses: 0,
      shieldTotalUses: 0,
    }),
  );
});

describe("recordShieldUse", () => {
  it("records a detector scan and bumps both detector + total counters", async () => {
    const result = await recordShieldUse({
      tool: "DETECTOR",
      model: "on-device/cadence",
      overallScore: 62,
      cadenceScore: 58,
      neuralScore: null,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.tool).toBe("DETECTOR");
    expect(result.data.model).toBe("on-device/cadence");
    expect(result.data.overallScore).toBe(62);
    expect(result.data.cadenceScore).toBe(58);
    expect(result.data.neuralScore).toBeNull();
    expect(typeof result.data.id).toBe("string");
    expect(result.data.id.length).toBeGreaterThan(0);

    expect(usageRows()).toHaveLength(1);
    expect(userRowById().shieldDetectorUses).toBe(1);
    expect(userRowById().shieldRewriterUses).toBe(0);
    expect(userRowById().shieldTotalUses).toBe(1);
  });

  it("records a rewriter run and bumps both rewriter + total counters", async () => {
    const result = await recordShieldUse({
      tool: "REWRITER",
      model: "groq/openai/gpt-oss-120b",
    });

    expect(result.success).toBe(true);
    expect(usageRows()[0].model).toBe("groq/openai/gpt-oss-120b");
    expect(userRowById().shieldDetectorUses).toBe(0);
    expect(userRowById().shieldRewriterUses).toBe(1);
    expect(userRowById().shieldTotalUses).toBe(1);
  });

  it("accumulates counters independently for detector and rewriter", async () => {
    await recordShieldUse({ tool: "DETECTOR", model: "on-device/cadence" });
    await recordShieldUse({
      tool: "DETECTOR",
      model: "on-device/tmr-raid",
      neuralScore: 71,
    });
    await recordShieldUse({ tool: "REWRITER", model: "nano" });

    expect(usageRows()).toHaveLength(3);
    expect(userRowById().shieldDetectorUses).toBe(2);
    expect(userRowById().shieldRewriterUses).toBe(1);
    expect(userRowById().shieldTotalUses).toBe(3);
  });

  it("attributes the row to the session user, never a client argument", async () => {
    await recordShieldUse({ tool: "DETECTOR", model: "on-device/cadence" });

    expect(usageRows()[0].userId).toBe(USER);
    expect(userRowById(OTHER).shieldTotalUses).toBe(0);
  });

  it("rejects an invalid tool without writing", async () => {
    const result = await recordShieldUse({
      tool: "OTHER" as never,
      model: "anything",
    });

    expect(result.success).toBe(false);
    expect(usageRows()).toHaveLength(0);
    expect(userRowById().shieldTotalUses).toBe(0);
  });

  it("rejects an empty model without writing", async () => {
    const result = await recordShieldUse({ tool: "DETECTOR", model: "   " });

    expect(result.success).toBe(false);
    expect(usageRows()).toHaveLength(0);
  });

  it("clamps scores to 0–100 and rounds them", async () => {
    await recordShieldUse({
      tool: "DETECTOR",
      model: "on-device/cadence",
      overallScore: 123.6,
      neuralScore: -4,
      cadenceScore: 42.4,
    });

    const row = usageRows()[0];
    expect(row.overallScore).toBe(100);
    expect(row.neuralScore).toBe(0);
    expect(row.cadenceScore).toBe(42);
  });

  it("rejects a frozen account without writing", async () => {
    frozen = true;

    const result = await recordShieldUse({
      tool: "DETECTOR",
      model: "on-device/cadence",
    });

    expect(result.success).toBe(false);
    expect(usageRows()).toHaveLength(0);
    expect(userRowById().shieldTotalUses).toBe(0);
  });

  it("rejects an anonymous caller and writes nothing", async () => {
    session = null;

    await expect(
      recordShieldUse({ tool: "DETECTOR", model: "on-device/cadence" }),
    ).rejects.toThrow();

    expect(usageRows()).toHaveLength(0);
  });
});

describe("shield usage reads", () => {
  it("reads the materialized counters without scanning rows", async () => {
    seedReplacing(
      "user",
      userRow(USER, {
        shieldDetectorUses: 3,
        shieldRewriterUses: 2,
        shieldTotalUses: 5,
      }),
    );

    expect(await getShieldUsageCounts(USER)).toEqual({
      shieldDetectorUses: 3,
      shieldRewriterUses: 2,
      shieldTotalUses: 5,
    });
  });

  it("falls back to zeros for an unknown scholar", async () => {
    expect(await getShieldUsageCounts("missing")).toEqual({
      shieldDetectorUses: 0,
      shieldRewriterUses: 0,
      shieldTotalUses: 0,
    });
  });

  it("finds a report by the cuid printed on the PDF", async () => {
    const result = await recordShieldUse({
      tool: "DETECTOR",
      model: "on-device/cadence",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const report = await getShieldReport(result.data.id);
    expect(report?.id).toBe(result.data.id);
    expect(report?.tool).toBe("DETECTOR");
  });

  it("returns history filtered by tool", async () => {
    await recordShieldUse({ tool: "DETECTOR", model: "on-device/cadence" });
    await recordShieldUse({ tool: "REWRITER", model: "nano" });
    await recordShieldUse({ tool: "DETECTOR", model: "on-device/tmr-raid" });

    const all = await getShieldUsageHistory(USER);
    expect(all).toHaveLength(3);

    const detectors = await getShieldUsageHistory(USER, { tool: "DETECTOR" });
    expect(detectors).toHaveLength(2);
    expect(detectors.every((row) => row.tool === "DETECTOR")).toBe(true);
  });
});

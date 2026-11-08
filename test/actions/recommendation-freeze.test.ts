/**
 * Regression: a recommendation could still be created on a supervisor profile
 * that moderators had frozen. The detail page shows the "frozen by moderators"
 * banner (voting / reporting / commenting disabled), so the server must reject
 * the write too — not only the UI.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { createRecommendation } from "@/app/actions/recommendations";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const SUPERVISOR = "sup-1";

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => ({ frozen: false, user: { id: AUTHOR } })),
  requireCurrentUser: vi.fn(async () => ({ id: AUTHOR })),
  isAuthorizedOrAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => {}),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));

vi.mock("@/lib/tri-split/modules/profile-tab", () => ({
  revalidateProfileContent: vi.fn(),
}));

function validForm(): FormData {
  const formData = new FormData();
  formData.set("feedback", "A thoughtful recommendation.");
  formData.set("rating", "5");
  formData.set("turnaroundTimeDays", "7");
  formData.set("responsivenessScore", "4");
  formData.set("guidanceScore", "4");
  return formData;
}

beforeEach(() => {
  resetFakeDb();
});

describe("createRecommendation freeze gating", () => {
  it("rejects a recommendation on a frozen supervisor", async () => {
    fakeDb.seed("supervisor", {
      id: SUPERVISOR,
      isFrozen: true,
      isDeleted: false,
    });

    const result = await createRecommendation(validForm(), SUPERVISOR);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected the write to be rejected");
    expect(result.error).toMatch(/frozen by moderators/i);
  });

  it("rejects a recommendation on a deleted supervisor", async () => {
    fakeDb.seed("supervisor", {
      id: SUPERVISOR,
      isFrozen: false,
      isDeleted: true,
    });

    const result = await createRecommendation(validForm(), SUPERVISOR);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected the write to be rejected");
    expect(result.error).toMatch(/not found/i);
  });
});

/**
 * Regression: a recommendation could still be created on a supervisor profile
 * that moderators had frozen. The detail page shows the "frozen by moderators"
 * banner (voting / reporting / commenting disabled), so the server must reject
 * the write too — not only the UI.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import {
  createRecommendation,
  updateRecommendation,
} from "@/app/actions/recommendations";
import { notifyFollowersOfActivity } from "@/lib/notifications";

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

vi.mock("@/lib/notifications", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    notifyFollowersOfActivity: vi.fn(async () => {}),
  };
});

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
  vi.clearAllMocks();
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

describe("createRecommendation follower notifications", () => {
  beforeEach(() => {
    fakeDb.seed("user", {
      id: AUTHOR,
      email: "ada@example.org",
      recommendationCount: 0,
    });
    fakeDb.seed("supervisor", {
      id: SUPERVISOR,
      name: "Prof Ada",
      isFrozen: false,
      isDeleted: false,
      recommendationCount: 0,
      ratingSum: 0,
    });
  });

  it("a public recommendation notifies followers", async () => {
    const result = await createRecommendation(validForm(), SUPERVISOR);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(fakeDb.rows("recommendation")).toHaveLength(1);
    const recommendationId = String(fakeDb.rows("recommendation")[0]?.id);
    expect(notifyFollowersOfActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: AUTHOR,
        type: "content-published",
        targetType: "Recommendation",
        targetId: `${SUPERVISOR}/${recommendationId}`,
        title: expect.stringContaining("added a new supervisor recommendation"),
        body: "Prof Ada — 5/5",
      }),
    );
  });

  it("an anonymous recommendation does not notify followers", async () => {
    const formData = validForm();
    formData.append("isAnonymous", "on");

    const result = await createRecommendation(formData, SUPERVISOR);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
  });

  it("keeps the supervisor aggregate count when a recommendation becomes anonymous", async () => {
    fakeDb.rows("supervisor")[0].recommendationCount = 2;
    fakeDb.rows("supervisor")[0].ratingSum = 9;
    fakeDb.seed("recommendation", {
      id: "rec-1",
      authorId: AUTHOR,
      supervisorId: SUPERVISOR,
      rating: 5,
      isAnonymous: false,
      isDeleted: false,
    });

    const formData = validForm();
    formData.append("isAnonymous", "on");
    const result = await updateRecommendation(formData, "rec-1");

    expect(result.success).toBe(true);
    expect(fakeDb.rows("supervisor")[0].recommendationCount).toBe(2);
    expect(fakeDb.rows("supervisor")[0].ratingSum).toBe(9);
  });

  it("rejects ratings outside the five-point scale", async () => {
    const formData = validForm();
    formData.set("rating", "10");

    const result = await createRecommendation(formData, SUPERVISOR);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected the rating to be rejected");
    expect(result.error).toBe("Rating must be between 1 and 5.");
  });
});

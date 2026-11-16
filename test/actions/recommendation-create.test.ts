/**
 * Regression: a new recommendation notifies the supervisor's author, and an
 * anonymous recommendation stays silent for both followers and the author.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { createRecommendation } from "@/app/actions/recommendations";
import { notifyFollowersOfActivity, notifyUserById } from "@/lib/notifications";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const SUPERVISOR = "sup-1";
const SUPERVISOR_AUTHOR = "u-supervisor-author";

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => ({ frozen: false, user: { id: AUTHOR } })),
  requireCurrentUser: vi.fn(async () => ({ id: AUTHOR })),
  isAuthorizedOrAdmin: vi.fn(async () => true),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  enforceRateLimit: vi.fn(async () => ({ allowed: true })),
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
    notifyUserById: vi.fn(async () => {}),
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
  fakeDb.seed("user", {
    id: AUTHOR,
    email: "ada@example.org",
    recommendationCount: 0,
  });
  fakeDb.seed("user", {
    id: SUPERVISOR_AUTHOR,
    email: "prof@example.org",
    supervisorCount: 0,
  });
  fakeDb.seed("supervisor", {
    id: SUPERVISOR,
    name: "Prof Ada",
    authorId: SUPERVISOR_AUTHOR,
    author: { id: SUPERVISOR_AUTHOR },
    isFrozen: false,
    isDeleted: false,
    recommendationCount: 0,
    ratingSum: 0,
  });
});

describe("createRecommendation parent-author notifications", () => {
  it("a public recommendation notifies the supervisor author", async () => {
    const result = await createRecommendation(validForm(), SUPERVISOR);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(fakeDb.rows("recommendation")).toHaveLength(1);
    const recommendationId = String(fakeDb.rows("recommendation")[0]?.id);
    expect(notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: SUPERVISOR_AUTHOR,
        actorId: AUTHOR,
        type: "recommendation-created",
        targetType: "Recommendation",
        targetId: `${SUPERVISOR}/${recommendationId}`,
        title: expect.stringContaining("added a recommendation to your supervisor"),
        body: "Prof Ada — 5/5",
      }),
    );
  });

  it("a public recommendation does not notify the supervisor author when the recommender is the author", async () => {
    fakeDb.rows("supervisor")[0].author = { id: AUTHOR };
    fakeDb.rows("supervisor")[0].authorId = AUTHOR;

    const result = await createRecommendation(validForm(), SUPERVISOR);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(notifyUserById).not.toHaveBeenCalled();
  });

  it("an anonymous recommendation does not notify the supervisor author", async () => {
    const formData = validForm();
    formData.append("isAnonymous", "on");

    const result = await createRecommendation(formData, SUPERVISOR);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
    expect(notifyUserById).not.toHaveBeenCalled();
  });
});

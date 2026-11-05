import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../fake-prisma";
import { getSupervisorRecommendationMeta } from "@/app/actions/supervisors";
import { getJournalReviewMeta } from "@/app/actions/journalReviews";

/**
 * The carousel bound is "live rows + engaged tombstones", while the heading and
 * the rating average stay live-only. Using one count for both made the two
 * disagree: the average was dragged down by deleted ratings, or the rail hid a
 * tombstone that page 1 still returned.
 */

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => null),
  getActiveUser: vi.fn(),
  requireActiveUser: vi.fn(),
  requireCurrentUser: vi.fn(),
  isAuthorizedOrAdmin: vi.fn(),
  isUserAdmin: vi.fn(async () => false),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => {}),
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  RATE_LIMIT_ERROR: "Rate limit exceeded",
}));

vi.mock("@/lib/qstash", () => ({
  queueNotification: vi.fn(async () => {}),
}));

vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
  notifyMentionedUsers: vi.fn(async () => {}),
  notifyUserById: vi.fn(async () => {}),
  resolveMentionedUsers: vi.fn(async () => []),
}));

const PARENT_ID = "parent-1";

beforeEach(() => {
  resetFakeDb();
});

const RECOMMENDATIONS = [
  { id: "r1", supervisorId: PARENT_ID, rating: 5, authorId: "u1", isDeleted: false, totalComments: 0 },
  { id: "r2", supervisorId: PARENT_ID, rating: 3, authorId: "u2", isDeleted: false, totalComments: 0 },
  // Engaged tombstone: reachable, excluded from rating/count.
  { id: "r3", supervisorId: PARENT_ID, rating: 4, authorId: "u3", isDeleted: true, totalComments: 2 },
  // Unengaged tombstone: not reachable at all.
  { id: "r4", supervisorId: PARENT_ID, rating: 5, authorId: "u4", isDeleted: true, totalComments: 0 },
];

const REVIEWS = RECOMMENDATIONS.map((row) => ({
  ...row,
  supervisorId: undefined,
  journalId: PARENT_ID,
}));

describe("getSupervisorRecommendationMeta", () => {
  it("counts live rows only but pages through engaged tombstones", async () => {
    fakeDb.seed("recommendation", RECOMMENDATIONS);

    const meta = await getSupervisorRecommendationMeta(PARENT_ID);

    expect(meta.totalCount).toBe(2);
    expect(meta.visibleCount).toBe(3);
    expect(meta.avgRating).toBe(4);
    expect(meta.ratingDistribution).toEqual([
      { stars: 5, count: 1, percentage: 50 },
      { stars: 4, count: 0, percentage: 0 },
      { stars: 3, count: 1, percentage: 50 },
      { stars: 2, count: 0, percentage: 0 },
      { stars: 1, count: 0, percentage: 0 },
    ]);
  });
});

describe("getJournalReviewMeta", () => {
  it("counts live rows only but pages through engaged tombstones", async () => {
    fakeDb.seed("journalReview", REVIEWS);

    const meta = await getJournalReviewMeta(PARENT_ID);

    expect(meta.totalCount).toBe(2);
    expect(meta.visibleCount).toBe(3);
    expect(meta.avgRating).toBe(4);
    expect(meta.hasUserReview).toBe(false);
  });
});

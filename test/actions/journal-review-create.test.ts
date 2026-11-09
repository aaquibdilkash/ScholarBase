/**
 * Regression: creating a journal review must fan out a follower notification
 * (public) or stay silent (anonymous), mirroring the supervisor recommendation
 * contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { createJournalReview } from "@/app/actions/journalReviews";
import { notifyFollowersOfActivity } from "@/lib/notifications";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const JOURNAL = "jrn-1";

vi.mock("@/lib/auth", () => ({
  getActiveUser: vi.fn(async () => ({
    frozen: false,
    user: { id: AUTHOR, email: "ada@example.org" },
  })),
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

vi.mock("@/lib/notifications", () => ({
  notifyFollowersOfActivity: vi.fn(async () => {}),
}));

function validForm(): FormData {
  const formData = new FormData();
  formData.set("feedback", "A thoughtful review.");
  formData.set("rating", "5");
  formData.set("turnaroundTimeDays", "14");
  formData.set("editorialQualityScore", "4");
  formData.set("peerReviewRigorScore", "4");
  formData.set("outcome", "ACCEPTED");
  return formData;
}

beforeEach(() => {
  resetFakeDb();
  vi.clearAllMocks();
  fakeDb.seed("user", {
    id: AUTHOR,
    email: "ada@example.org",
    journalReviewCount: 0,
  });
  fakeDb.seed("journal", {
    id: JOURNAL,
    title: "Nature Fake",
    isDeleted: false,
    reviewCount: 0,
    ratingSum: 0,
  });
});

describe("createJournalReview follower notifications", () => {
  it("a public review notifies followers", async () => {
    const result = await createJournalReview(validForm(), JOURNAL);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(fakeDb.rows("journalReview")).toHaveLength(1);
    const reviewId = String(fakeDb.rows("journalReview")[0]?.id);
    expect(notifyFollowersOfActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: AUTHOR,
        type: "content-published",
        targetType: "JournalReview",
        targetId: `${JOURNAL}/${reviewId}`,
        title: expect.stringContaining("reviewed a journal"),
        body: "Nature Fake — 5/5",
      }),
    );
  });

  it("an anonymous review does not notify followers", async () => {
    const formData = validForm();
    formData.append("isAnonymous", "on");

    const result = await createJournalReview(formData, JOURNAL);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
  });
});

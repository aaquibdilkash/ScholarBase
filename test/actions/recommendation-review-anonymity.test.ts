/**
 * Regression: flipping a recommendation or journal review back to public
 * re-announces to followers AND the parent author, because the non-anon → anon
 * path deleted all of the creator's own notification rows for this content.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeDb, resetFakeDb } from "../fake-prisma";

import { updateRecommendation } from "@/app/actions/recommendations";
import { updateJournalReview } from "@/app/actions/journalReviews";
import {
  notifyFollowersOfActivity,
  notifyUserById,
} from "@/lib/notifications";

vi.mock("@/lib/db", async () => {
  const { fakeDb } = await import("../fake-prisma/instance");
  return { default: fakeDb.client };
});

const AUTHOR = "u-author";
const SUPERVISOR = "sup-1";
const SUPERVISOR_AUTHOR = "u-supervisor-author";
const JOURNAL = "jrn-1";
const JOURNAL_AUTHOR = "u-journal-author";

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

function recForm(anonymous = false): FormData {
  const formData = new FormData();
  formData.set("feedback", "A thoughtful recommendation.");
  formData.set("rating", "5");
  formData.set("turnaroundTimeDays", "7");
  formData.set("responsivenessScore", "4");
  formData.set("guidanceScore", "4");
  if (anonymous) formData.append("isAnonymous", "on");
  return formData;
}

function reviewForm(anonymous = false): FormData {
  const formData = new FormData();
  formData.set("feedback", "A thoughtful review.");
  formData.set("rating", "5");
  formData.set("turnaroundTimeDays", "14");
  formData.set("editorialQualityScore", "4");
  formData.set("peerReviewRigorScore", "4");
  formData.set("outcome", "ACCEPTED");
  if (anonymous) formData.append("isAnonymous", "on");
  return formData;
}

beforeEach(() => {
  resetFakeDb();
  vi.clearAllMocks();
  fakeDb.seed("user", {
    id: AUTHOR,
    email: "ada@example.org",
    recommendationCount: 0,
    journalReviewCount: 0,
  });
  fakeDb.seed("user", {
    id: SUPERVISOR_AUTHOR,
    email: "prof@example.org",
    supervisorCount: 0,
  });
  fakeDb.seed("user", {
    id: JOURNAL_AUTHOR,
    email: "editor@example.org",
    journalCount: 0,
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
  fakeDb.seed("journal", {
    id: JOURNAL,
    title: "Nature Fake",
    authorId: JOURNAL_AUTHOR,
    author: { id: JOURNAL_AUTHOR },
    isDeleted: false,
    reviewCount: 0,
    ratingSum: 0,
  });
});

describe("recommendation anonymity flip-back", () => {
  function seedRecommendation(anonymous: boolean) {
    fakeDb.seed("recommendation", {
      id: "rec-1",
      authorId: AUTHOR,
      supervisorId: SUPERVISOR,
      // The fake returns a row's materialised relations on `include`, so seed
      // the parent the update path reads back (`updated.supervisor.name`).
      supervisor: {
        id: SUPERVISOR,
        name: "Prof Ada",
        author: { id: SUPERVISOR_AUTHOR },
      },
      rating: 4,
      feedback: "Good mentor.",
      isAnonymous: anonymous,
      isDeleted: false,
    });
  }

  it("anonymous → public re-announces to followers and the supervisor author", async () => {
    seedRecommendation(true);

    const result = await updateRecommendation(recForm(false), "rec-1");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(notifyFollowersOfActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "content-published",
        targetType: "Recommendation",
        targetId: `${SUPERVISOR}/rec-1`,
      }),
    );
    expect(notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: SUPERVISOR_AUTHOR,
        actorId: AUTHOR,
        type: "recommendation-created",
        targetType: "Recommendation",
        targetId: `${SUPERVISOR}/rec-1`,
      }),
    );
  });

  it("public → anonymous does not re-announce", async () => {
    seedRecommendation(false);

    await updateRecommendation(recForm(true), "rec-1");

    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
    expect(notifyUserById).not.toHaveBeenCalled();
  });

  it("editing an already-public recommendation does not re-announce", async () => {
    seedRecommendation(false);

    await updateRecommendation(recForm(false), "rec-1");

    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
    expect(notifyUserById).not.toHaveBeenCalled();
  });
});

describe("journal review anonymity flip-back", () => {
  function seedReview(anonymous: boolean) {
    fakeDb.seed("journalReview", {
      id: "rev-1",
      authorId: AUTHOR,
      journalId: JOURNAL,
      // `include` reads the materialised parent, so seed it for
      // `updated.journal.title` in the edit path.
      journal: {
        id: JOURNAL,
        title: "Nature Fake",
        author: { id: JOURNAL_AUTHOR },
      },
      rating: 4,
      feedback: "Fast turnaround.",
      isAnonymous: anonymous,
      isDeleted: false,
    });
  }

  it("anonymous → public re-announces to followers and the journal author", async () => {
    seedReview(true);

    const result = await updateJournalReview(reviewForm(false), "rev-1");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected the write to succeed");
    expect(notifyFollowersOfActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "content-published",
        targetType: "JournalReview",
        targetId: `${JOURNAL}/rev-1`,
      }),
    );
    expect(notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: JOURNAL_AUTHOR,
        actorId: AUTHOR,
        type: "journal-review-created",
        targetType: "JournalReview",
        targetId: `${JOURNAL}/rev-1`,
      }),
    );
  });

  it("public → anonymous does not re-announce", async () => {
    seedReview(false);

    await updateJournalReview(reviewForm(true), "rev-1");

    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
    expect(notifyUserById).not.toHaveBeenCalled();
  });

  it("editing an already-public review does not re-announce", async () => {
    seedReview(false);

    await updateJournalReview(reviewForm(false), "rev-1");

    expect(notifyFollowersOfActivity).not.toHaveBeenCalled();
    expect(notifyUserById).not.toHaveBeenCalled();
  });
});

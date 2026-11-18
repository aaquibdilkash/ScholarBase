/**
 * Peer-review workflow.
 *
 * The review workspace is where a paper earns a decision, so these tests pin the
 * four refusals that keep it honest: no seat, no self-review, no author review,
 * and no acceptance without a report. They also pin the anonymity contract — a
 * submitted report must not write the reviewer's id onto the author-visible
 * timeline.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manuscriptFindUnique: vi.fn(),
  manuscriptUpdateMany: vi.fn(),
  roleFindMany: vi.fn(),
  taskFindUnique: vi.fn(),
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskCount: vi.fn(),
  eventCreate: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
  getActiveUser: vi.fn(),
  isUserAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
  notifyUserById: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    manuscript: {
      findUnique: mocks.manuscriptFindUnique,
      updateMany: mocks.manuscriptUpdateMany,
    },
    editorialRole: { findMany: mocks.roleFindMany },
    reviewTask: {
      findUnique: mocks.taskFindUnique,
      create: mocks.taskCreate,
      update: mocks.taskUpdate,
      count: mocks.taskCount,
    },
    manuscriptEvent: { create: mocks.eventCreate },
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/auth", () => ({
  getActiveUser: mocks.getActiveUser,
  isUserAdmin: mocks.isUserAdmin,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("@/lib/notifications", () => ({
  notifyUserById: mocks.notifyUserById,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  assignReviewerAction,
  decideManuscriptAction,
  submitReviewReportAction,
  type ReviewActionResult,
} from "@/app/actions/reviews";
import { reviewReportBody } from "@/lib/publishing/review-reports";
import { rankReviewerCandidates } from "@/lib/publishing/reviewer-suggestions";

const EMPTY: ReviewActionResult = { success: false, message: "" };

function formWith(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

const MANUSCRIPT = {
  id: "manuscript-1",
  title: "Phase retrieval for sparse apertures",
  status: "SUBMITTED" as const,
  round: 0,
  authorId: "author-1",
  venueId: "venue-1",
  venue: { name: "Indian Journal of Optics", type: "JOURNAL" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveUser.mockResolvedValue({
    frozen: false,
    user: { id: "editor-1", email: "editor@university.edu" },
  });
  mocks.isUserAdmin.mockResolvedValue(false);
  mocks.enforceRateLimit.mockResolvedValue({ allowed: true });
  mocks.manuscriptFindUnique.mockResolvedValue(MANUSCRIPT);
  mocks.roleFindMany.mockResolvedValue([{ roleTitle: "EDITOR_IN_CHIEF" }]);
  mocks.taskFindUnique.mockResolvedValue(null);
  mocks.taskCount.mockResolvedValue(1);
  mocks.manuscriptUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        reviewTask: { create: mocks.taskCreate },
        manuscript: { updateMany: mocks.manuscriptUpdateMany },
        manuscriptEvent: { create: mocks.eventCreate },
      }),
  );
});

describe("assignReviewerAction", () => {
  const reviewer = {
    id: "reviewer-1",
    name: "Dr R. Reader",
    handle: "reader",
    isFrozen: false,
    isDeleted: false,
  };

  beforeEach(() => {
    mocks.userFindUnique.mockResolvedValue(reviewer);
  });

  it("refuses a viewer with no seat on the venue", async () => {
    mocks.roleFindMany.mockResolvedValue([]);

    const result = await assignReviewerAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, reviewerEmail: "reader@uni.edu" }),
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/editor of this venue/i);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("refuses the paper's own author as a reviewer", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...reviewer, id: MANUSCRIPT.authorId });

    const result = await assignReviewerAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, reviewerEmail: "author@uni.edu" }),
    );

    expect(result.message).toMatch(/cannot review it/i);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("refuses self-review", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...reviewer, id: "editor-1" });

    const result = await assignReviewerAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, reviewerEmail: "editor@uni.edu" }),
    );

    expect(result.message).toMatch(/self-review/i);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("refuses a second assignment on the same round", async () => {
    mocks.taskFindUnique.mockResolvedValue({ id: "task-1", isCompleted: false });

    const result = await assignReviewerAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, reviewerEmail: "reader@uni.edu" }),
    );

    expect(result.message).toMatch(/already assigned/i);
    expect(mocks.taskCreate).not.toHaveBeenCalled();
  });

  it("opens peer review on the first assignment and notifies the reviewer", async () => {
    const result = await assignReviewerAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, reviewerEmail: "reader@uni.edu" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.taskCreate).toHaveBeenCalledWith({
      data: {
        manuscriptId: MANUSCRIPT.id,
        reviewerId: reviewer.id,
        round: 0,
      },
    });
    // SUBMITTED → UNDER_REVIEW
    expect(mocks.manuscriptUpdateMany).toHaveBeenCalledWith({
      where: { id: MANUSCRIPT.id, status: "SUBMITTED" },
      data: { status: "UNDER_REVIEW" },
    });
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: reviewer.id,
        type: "manuscript-review-assigned",
        targetType: "editorialManuscript",
      }),
    );
  });

  it("does not re-open review when the paper is already under review", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "UNDER_REVIEW",
    });

    const result = await assignReviewerAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, reviewerEmail: "reader@uni.edu" }),
    );

    expect(result.success).toBe(true);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });
});

describe("submitReviewReportAction", () => {
  const REPORTABLE = { ...MANUSCRIPT, status: "UNDER_REVIEW" as const };

  beforeEach(() => {
    mocks.manuscriptFindUnique.mockResolvedValue(REPORTABLE);
    mocks.taskFindUnique.mockResolvedValue({ id: "task-1", isCompleted: false });
    mocks.taskUpdate.mockResolvedValue({});
    mocks.roleFindMany.mockResolvedValue([]);
  });

  it("refuses a report from someone who is not assigned", async () => {
    mocks.taskFindUnique.mockResolvedValue(null);

    const result = await submitReviewReportAction(
      EMPTY,
      formWith({
        manuscriptId: REPORTABLE.id,
        score: "8",
        decision: "ACCEPT",
        comments: "A careful and complete piece of work that I recommend.",
      }),
    );

    expect(result.message).toMatch(/not assigned/i);
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });

  it("refuses a score outside the scale", async () => {
    const result = await submitReviewReportAction(
      EMPTY,
      formWith({
        manuscriptId: REPORTABLE.id,
        score: "11",
        decision: "ACCEPT",
        comments: "A careful and complete piece of work that I recommend.",
      }),
    );

    expect(result.message).toMatch(/1 to 10/);
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });

  it("refuses a report with no reasoning", async () => {
    const result = await submitReviewReportAction(
      EMPTY,
      formWith({
        manuscriptId: REPORTABLE.id,
        score: "8",
        decision: "ACCEPT",
        comments: "Fine.",
      }),
    );

    expect(result.message).toMatch(/short paragraph/i);
    expect(mocks.taskUpdate).not.toHaveBeenCalled();
  });

  it("records the report and keeps the reviewer anonymous on the timeline", async () => {
    const result = await submitReviewReportAction(
      EMPTY,
      formWith({
        manuscriptId: REPORTABLE.id,
        score: "8",
        decision: "MINOR_REVISION",
        comments: "The method is sound; the evaluation needs a baseline.",
      }),
    );

    expect(result.success).toBe(true);
    expect(mocks.taskUpdate).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        score: 8,
        decision: "MINOR_REVISION",
        isCompleted: true,
        inlineComments: [
          { body: "The method is sound; the evaluation needs a baseline." },
        ],
      }),
    });

    const event = mocks.eventCreate.mock.calls[0][0].data;
    expect(event.type).toBe("REVIEW_SUBMITTED");
    expect(event.actorId).toBeUndefined();
    expect(event.note).not.toMatch(/editor-1/);
  });
});

describe("decideManuscriptAction", () => {
  it("refuses to publish outside the publication panel", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "ACCEPTED_JOURNAL",
    });

    const result = await decideManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, toStatus: "PUBLISHED" }),
    );

    expect(result.message).toMatch(/publication panel/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses acceptance with no completed report", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "UNDER_REVIEW",
    });
    mocks.taskCount.mockResolvedValue(0);

    const result = await decideManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, toStatus: "ACCEPTED_JOURNAL" }),
    );

    expect(result.message).toMatch(/at least one review report/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("requires a decision letter for a rejection", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "UNDER_REVIEW",
    });

    const result = await decideManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, toStatus: "REJECTED" }),
    );

    expect(result.message).toMatch(/decision letter/i);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses an edge the state machine does not have", async () => {
    const result = await decideManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, toStatus: "ACCEPTED_JOURNAL" }),
    );

    expect(result.success).toBe(false);
    expect(mocks.manuscriptUpdateMany).not.toHaveBeenCalled();
  });

  it("records the decision, appends the event, and notifies the author", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "UNDER_REVIEW",
    });

    const result = await decideManuscriptAction(
      EMPTY,
      formWith({
        manuscriptId: MANUSCRIPT.id,
        toStatus: "REVISION_REQUIRED",
        note: "Add a baseline comparison and report variance.",
      }),
    );

    expect(result.success).toBe(true);
    expect(mocks.manuscriptUpdateMany).toHaveBeenCalledWith({
      where: { id: MANUSCRIPT.id, status: "UNDER_REVIEW" },
      data: { status: "REVISION_REQUIRED" },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "STATUS_CHANGED",
        fromStatus: "UNDER_REVIEW",
        toStatus: "REVISION_REQUIRED",
        note: "Add a baseline comparison and report variance.",
      }),
    });
    expect(mocks.notifyUserById).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: MANUSCRIPT.authorId,
        type: "manuscript-decision",
        targetType: "manuscript",
      }),
    );
  });

  it("reports a lost race instead of overwriting another decision", async () => {
    mocks.manuscriptFindUnique.mockResolvedValue({
      ...MANUSCRIPT,
      status: "UNDER_REVIEW",
    });
    mocks.manuscriptUpdateMany.mockResolvedValue({ count: 0 });

    const result = await decideManuscriptAction(
      EMPTY,
      formWith({ manuscriptId: MANUSCRIPT.id, toStatus: "REVISION_REQUIRED" }),
    );

    expect(result.message).toMatch(/another session/i);
  });
});

describe("reviewReportBody", () => {
  it("reads the stored note shape", () => {
    expect(reviewReportBody([{ body: "Solid methods." }])).toBe("Solid methods.");
  });

  it("tolerates a legacy bare string", () => {
    expect(reviewReportBody("A plain string report.")).toBe("A plain string report.");
  });

  it("returns an empty string for anything unreadable", () => {
    expect(reviewReportBody(null)).toBe("");
    expect(reviewReportBody([{ page: 4 }])).toBe("");
  });
});

describe("rankReviewerCandidates", () => {
  const people = [
    {
      id: "u-optics",
      name: "Dr Optics",
      email: "optics@uni.edu",
      interests: "optics, photonics",
    },
    {
      id: "u-both",
      name: "Dr Both",
      email: "both@uni.edu",
      interests: "Optics and sparse apertures",
    },
    {
      id: "u-none",
      name: "Dr Elsewhere",
      email: "elsewhere@uni.edu",
      interests: "medieval history",
    },
  ];

  it("ranks by how many keywords the interests contain", () => {
    const ranked = rankReviewerCandidates(people, ["optics", "apertures"]);

    expect(ranked.map((candidate) => candidate.id)).toEqual([
      "u-both",
      "u-optics",
    ]);
    expect(ranked[0].matched).toEqual(["optics", "apertures"]);
  });

  it("drops people with no overlap", () => {
    const ranked = rankReviewerCandidates(people, ["optics"]);

    expect(ranked.some((candidate) => candidate.id === "u-none")).toBe(false);
  });

  it("honours the exclusion list", () => {
    const ranked = rankReviewerCandidates(people, ["optics"], ["u-both"]);

    expect(ranked.map((candidate) => candidate.id)).toEqual(["u-optics"]);
  });

  it("returns nothing when the manuscript has no keywords", () => {
    expect(rankReviewerCandidates(people, [])).toEqual([]);
  });
});

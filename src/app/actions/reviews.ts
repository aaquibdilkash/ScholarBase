"use server";

import type { ManuscriptStatus, ReviewDecision } from "@prisma/client";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db";
import { getActiveUser, isUserAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue } from "@/lib/form";
import {
  MAX_DECISION_NOTE,
  MAX_REVIEW_COMMENTS,
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from "@/lib/publishing/constants";
import {
  canAssignReviewer,
  canEditorSetStatus,
  isStatusAllowedForVenue,
  type EditorialActor,
} from "@/lib/publishing/permissions";
import { canTransition, nextStatuses } from "@/lib/publishing/transitions";
import { MANUSCRIPT_STATUS_LABELS } from "@/lib/publishing/labels";
import { notifyUserById } from "@/lib/notifications";

/**
 * The peer-review workflow: assign a reviewer, record a report, decide.
 *
 * Three separate actions rather than one, because they have three different
 * actors: an editor assigns, a reviewer reports, an editor decides. Each one
 * re-checks the seat it needs — the UI hiding a button is never the check.
 *
 * `PUBLISHED` is deliberately not reachable here. `publishManuscriptAction` is
 * the only writer of that status because it also records the citation locator;
 * a decision action that could set it would publish a paper with no volume.
 */

export type ReviewActionResult = {
  success: boolean;
  message: string;
};

/** Statuses in which a reviewer may still be added. */
const ASSIGNABLE_STATUSES: readonly ManuscriptStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
];

/** Statuses in which a reviewer may submit a report. */
const REPORTABLE_STATUSES: readonly ManuscriptStatus[] = [
  "UNDER_REVIEW",
  "REVISION_REQUIRED",
];

const DECISIONS: readonly ReviewDecision[] = [
  "ACCEPT",
  "MINOR_REVISION",
  "MAJOR_REVISION",
  "REJECT",
];

function fail(message: string): ReviewActionResult {
  return { success: false, message };
}

function revalidateManuscript(manuscriptId: string) {
  revalidatePath("/workspace/editorial");
  revalidatePath(`/workspace/editorial/manuscripts/${manuscriptId}`);
  revalidatePath(`/workspace/submissions/${manuscriptId}`);
}

/** Every editorial seat the actor holds on one venue, plus platform admin. */
async function actorFor(userId: string, venueId: string): Promise<EditorialActor> {
  const [isAdmin, roles] = await Promise.all([
    isUserAdmin(userId),
    prisma.editorialRole.findMany({
      where: { userId, venueId },
      select: { roleTitle: true },
    }),
  ]);

  return { isAdmin, roles: roles.map((role) => role.roleTitle) };
}

/** Desk recipients for one venue: every editorial seat holder, de-duplicated. */
async function deskRecipients(venueId: string): Promise<string[]> {
  const seats = await prisma.editorialRole.findMany({
    where: { venueId },
    select: { userId: true },
  });

  return [...new Set(seats.map((seat) => seat.userId))];
}

/**
 * Assign a reviewer by email address.
 *
 * The paper moves to `UNDER_REVIEW` the moment the first reviewer is attached —
 * an editor who has found a reader has already triaged the paper, so asking for
 * a second click would only let a submission sit in the queue looking untouched.
 */
export async function assignReviewerAction(
  _previous: ReviewActionResult,
  formData: FormData,
): Promise<ReviewActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:reviewer",
    key: auth.user.id,
    limit: 40,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  if (!manuscriptId) return fail("Choose a manuscript first.");

  const email = readFormValue(formData, "reviewerEmail").toLowerCase();
  if (!email) return fail("Enter the reviewer's account email.");

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      status: true,
      round: true,
      authorId: true,
      venueId: true,
      venue: { select: { name: true } },
    },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");

  const actor = await actorFor(auth.user.id, manuscript.venueId);
  if (!canAssignReviewer(actor)) {
    return fail("Only an editor of this venue can assign reviewers.");
  }

  if (!ASSIGNABLE_STATUSES.includes(manuscript.status)) {
    return fail(
      `${MANUSCRIPT_STATUS_LABELS[manuscript.status]} manuscripts cannot take a new reviewer.`,
    );
  }

  const reviewer = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, handle: true, isFrozen: true, isDeleted: true },
  });
  if (!reviewer) {
    return fail(
      "No ScholarBase account uses that email. Ask the reviewer to create one first.",
    );
  }
  if (reviewer.isFrozen || reviewer.isDeleted) {
    return fail("That account cannot be assigned to review.");
  }
  if (reviewer.id === manuscript.authorId) {
    return fail("The author of a paper cannot review it.");
  }
  if (reviewer.id === auth.user.id) {
    return fail("Assign someone else — self-review is a conflict of interest.");
  }

  const existing = await prisma.reviewTask.findUnique({
    where: {
      manuscriptId_reviewerId_round: {
        manuscriptId,
        reviewerId: reviewer.id,
        round: manuscript.round,
      },
    },
    select: { id: true, isCompleted: true },
  });
  if (existing) {
    return fail(
      existing.isCompleted
        ? `${reviewer.name ?? reviewer.handle ?? "That reviewer"} has already reported on this round.`
        : `${reviewer.name ?? reviewer.handle ?? "That reviewer"} is already assigned.`,
    );
  }

  const actorName = auth.user.email ?? "an editor";

  await prisma.$transaction(async (tx) => {
    await tx.reviewTask.create({
      data: {
        manuscriptId,
        reviewerId: reviewer.id,
        round: manuscript.round,
      },
    });

    await tx.manuscriptEvent.create({
      data: {
        manuscriptId,
        type: "REVIEW_ASSIGNED",
        actorId: auth.user.id,
        note: `Reviewer assigned by ${actorName}.`,
      },
    });

    // First reviewer on a submitted paper opens peer review. Conditional on the
    // status we read so two editors assigning at once cannot double-transition.
    if (manuscript.status === "SUBMITTED") {
      await tx.manuscript.updateMany({
        where: { id: manuscriptId, status: "SUBMITTED" },
        data: { status: "UNDER_REVIEW" },
      });
      await tx.manuscriptEvent.create({
        data: {
          manuscriptId,
          type: "STATUS_CHANGED",
          actorId: auth.user.id,
          fromStatus: "SUBMITTED",
          toStatus: "UNDER_REVIEW",
          note: "Peer review opened.",
        },
      });
    }
  });

  await notifyUserById({
    recipientId: reviewer.id,
    actorId: auth.user.id,
    type: "manuscript-review-assigned",
    targetType: "editorialManuscript",
    targetId: manuscriptId,
    title: `Review requested: ${manuscript.title}`,
    body: `You have been asked to review this submission for ${manuscript.venue.name}. Reports are recorded privately.`,
  });

  revalidateManuscript(manuscriptId);

  return {
    success: true,
    message: `Assigned ${reviewer.name ?? reviewer.handle ?? email} to review this manuscript.`,
  };
}

/**
 * Record a reviewer's report.
 *
 * The report is stored on the reviewer's own `ReviewTask` row, and the timeline
 * event is written with no actor so the author's timeline never reveals who
 * reviewed the paper. Only the desk sees the name.
 */
export async function submitReviewReportAction(
  _previous: ReviewActionResult,
  formData: FormData,
): Promise<ReviewActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:review-report",
    key: auth.user.id,
    limit: 20,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  if (!manuscriptId) return fail("Choose a manuscript first.");

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      status: true,
      round: true,
      venueId: true,
      venue: { select: { name: true } },
    },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");

  if (!REPORTABLE_STATUSES.includes(manuscript.status)) {
    return fail(
      `${MANUSCRIPT_STATUS_LABELS[manuscript.status]} manuscripts are not accepting reports.`,
    );
  }

  const assignment = await prisma.reviewTask.findUnique({
    where: {
      manuscriptId_reviewerId_round: {
        manuscriptId,
        reviewerId: auth.user.id,
        round: manuscript.round,
      },
    },
    select: { id: true, isCompleted: true },
  });
  if (!assignment) return fail("You are not assigned to review this manuscript.");

  const score = Number(readFormValue(formData, "score"));
  if (
    !Number.isInteger(score) ||
    score < MIN_REVIEW_SCORE ||
    score > MAX_REVIEW_SCORE
  ) {
    return fail(
      `Give a whole-number score from ${MIN_REVIEW_SCORE} to ${MAX_REVIEW_SCORE}.`,
    );
  }

  const decision = readFormValue(formData, "decision") as ReviewDecision;
  if (!DECISIONS.includes(decision)) return fail("Choose a recommendation.");

  const body = readFormValue(formData, "comments");
  if (body.length < 40) {
    return fail("Write at least a short paragraph explaining the recommendation.");
  }
  if (body.length > MAX_REVIEW_COMMENTS) {
    return fail(`Keep the report under ${MAX_REVIEW_COMMENTS} characters.`);
  }

  await prisma.reviewTask.update({
    where: { id: assignment.id },
    data: {
      score,
      decision,
      // The stored shape is a list of anchored notes; a whole-report comment has
      // no page anchor, so the anchor fields are omitted rather than faked.
      inlineComments: [{ body }],
      isCompleted: true,
      completedAt: new Date(),
    },
  });

  await prisma.manuscriptEvent.create({
    data: {
      manuscriptId,
      // No actor: the author timeline must not identify the reviewer.
      type: "REVIEW_SUBMITTED",
      note: `A reviewer submitted a report recommending ${decision.replace(/_/g, " ").toLowerCase()}.`,
    },
  });

  const recipients = (await deskRecipients(manuscript.venueId)).filter(
    (recipientId) => recipientId !== auth.user.id,
  );
  await Promise.all(
    recipients.map((recipientId) =>
      notifyUserById({
        recipientId,
        actorId: auth.user.id,
        type: "manuscript-review-completed",
        targetType: "editorialManuscript",
        targetId: manuscriptId,
        title: `A review landed: ${manuscript.title}`,
        body: `A reviewer recommended ${decision.replace(/_/g, " ").toLowerCase()} for this submission.`,
      }),
    ),
  );

  revalidateManuscript(manuscriptId);

  return {
    success: true,
    message: assignment.isCompleted
      ? "Report updated."
      : "Report submitted. Thank you.",
  };
}

/**
 * Record an editorial decision.
 *
 * Every edge comes from `MANUSCRIPT_TRANSITIONS`, the role check comes from
 * `STATUS_ACTOR_ROLES`, and the venue check from `isStatusAllowedForVenue`, so
 * this action cannot invent a path the state machine does not have.
 */
export async function decideManuscriptAction(
  _previous: ReviewActionResult,
  formData: FormData,
): Promise<ReviewActionResult> {
  const auth = await getActiveUser();
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "manuscript:decision",
    key: auth.user.id,
    limit: 40,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  if (!manuscriptId) return fail("Choose a manuscript first.");

  const toStatus = readFormValue(formData, "toStatus") as ManuscriptStatus;
  if (!toStatus) return fail("Choose a decision.");

  const note = readFormValue(formData, "note");
  if (note.length > MAX_DECISION_NOTE) {
    return fail(`Keep the decision letter under ${MAX_DECISION_NOTE} characters.`);
  }

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: {
      id: true,
      title: true,
      status: true,
      authorId: true,
      venueId: true,
      venue: { select: { name: true, type: true } },
    },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");

  // Publishing owns the citation locator, so it is not a decision.
  if (toStatus === "PUBLISHED") {
    return fail("Publish from the publication panel so the volume is recorded.");
  }

  if (!canTransition(manuscript.status, toStatus)) {
    const allowed = nextStatuses(manuscript.status)
      .filter((status) => status !== "PUBLISHED" && status !== "WITHDRAWN")
      .map((status) => MANUSCRIPT_STATUS_LABELS[status])
      .join(", ");
    return fail(
      `A ${MANUSCRIPT_STATUS_LABELS[manuscript.status].toLowerCase()} manuscript cannot become ${MANUSCRIPT_STATUS_LABELS[toStatus].toLowerCase()}. Available: ${allowed || "none"}.`,
    );
  }

  const actor = await actorFor(auth.user.id, manuscript.venueId);
  if (!canEditorSetStatus(actor, toStatus)) {
    return fail("Your editorial seat cannot record that decision.");
  }
  if (!isStatusAllowedForVenue(toStatus, manuscript.venue.type)) {
    return fail(
      `${MANUSCRIPT_STATUS_LABELS[toStatus]} is not available at a ${manuscript.venue.type.toLowerCase()}.`,
    );
  }

  const requiresReport =
    toStatus === "ACCEPTED_JOURNAL" ||
    toStatus === "ACCEPTED_PROCEDINGS" ||
    toStatus === "REJECTED";
  if (requiresReport) {
    const reports = await prisma.reviewTask.count({
      where: { manuscriptId, isCompleted: true },
    });
    if (reports === 0) {
      return fail(
        "Record at least one review report before accepting or rejecting. Use desk rejection for a paper that never reached review.",
      );
    }
  }

  if (
    (toStatus === "REJECTED" || toStatus === "DESK_REJECTED") &&
    note.length === 0
  ) {
    return fail("Add a decision letter so the author knows why.");
  }

  let updated = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.manuscript.updateMany({
        where: { id: manuscriptId, status: manuscript.status },
        data: { status: toStatus },
      });
      updated = result.count;
      if (updated === 0) throw new DecisionConflict();

      await tx.manuscriptEvent.create({
        data: {
          manuscriptId,
          type: "STATUS_CHANGED",
          actorId: auth.user.id,
          fromStatus: manuscript.status,
          toStatus,
          note: note || `Decision: ${MANUSCRIPT_STATUS_LABELS[toStatus]}.`,
        },
      });
    });
  } catch (error) {
    if (error instanceof DecisionConflict) {
      return fail("This manuscript changed in another session. Reload and retry.");
    }
    throw error;
  }

  await notifyUserById({
    recipientId: manuscript.authorId,
    actorId: auth.user.id,
    type: "manuscript-decision",
    targetType: "manuscript",
    targetId: manuscriptId,
    title: `Decision on ${manuscript.title}`,
    body: `${manuscript.venue.name}: ${MANUSCRIPT_STATUS_LABELS[toStatus]}.`,
  });

  revalidateManuscript(manuscriptId);

  return {
    success: true,
    message: `Recorded: ${MANUSCRIPT_STATUS_LABELS[toStatus]}.`,
  };
}

class DecisionConflict extends Error {}

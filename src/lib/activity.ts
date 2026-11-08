/**
 * Activity visibility + routing metadata.
 *
 * `UserActivity` rows are written once and read as a static feed, so deleting
 * the thing they describe cannot be done by a join at read time. Instead:
 *
 *   hiddenByContent — the parent content row is soft-deleted
 *   hiddenByComment — the comment/reply the row describes is soft-deleted
 *
 * Both flip independently, and a row is visible only when both are false. That
 * is what makes recover exact: recovering content clears `hiddenByContent`
 * without resurrecting activity for a comment that is still deleted.
 *
 * Every content module goes through these helpers — user delete, admin delete
 * and admin recover — so no module can drift.
 */
import type { Prisma } from "@prisma/client";

/** Content module → the moduleType used by comment-vote activity rows. */
export const ACTIVITY_COMMENT_MODULE = {
  SOCIAL_POST: "SOCIAL_POST_COMMENT",
  ARTICLE: "ARTICLE_COMMENT",
  HELP_POST: "HELP_POST_COMMENT",
  CONTRIBUTION: "CONTRIBUTION_COMMENT",
  PUBLICATION: "PUBLICATION_COMMENT",
  RESEARCH_TOOL: "RESEARCH_TOOL_COMMENT",
  RESEARCH_GRANT: "RESEARCH_GRANT_COMMENT",
  COURSE: "COURSE_COMMENT",
  JOURNAL: "JOURNAL_COMMENT",
  RESULT: "RESULT_COMMENT",
  RESEARCH_SURVEY: "RESEARCH_SURVEY_COMMENT",
  RESEARCH_EVENT: "RESEARCH_EVENT_COMMENT",
  PHD_ADMISSION: "PHD_ADMISSION_COMMENT",
  JOB_VACANCY: "JOB_VACANCY_COMMENT",
  SUPERVISOR: "SUPERVISOR_COMMENT",
  RECOMMENDATION: "RECOMMENDATION_COMMENT",
  JOURNAL_REVIEW: "JOURNAL_REVIEW_COMMENT",
} as const;

export type ActivityContentModule = keyof typeof ACTIVITY_COMMENT_MODULE;

/**
 * Moderation's comment contentType (the Prisma model key, e.g. `articleComment`)
 * → the activity module that owns its parent content.
 */
export const COMMENT_CONTENT_TYPE_TO_ACTIVITY: Record<
  string,
  ActivityContentModule
> = {
  socialComment: "SOCIAL_POST",
  articleComment: "ARTICLE",
  helpComment: "HELP_POST",
  contributionComment: "CONTRIBUTION",
  publicationComment: "PUBLICATION",
  researchToolComment: "RESEARCH_TOOL",
  researchGrantComment: "RESEARCH_GRANT",
  courseComment: "COURSE",
  journalComment: "JOURNAL",
  resultComment: "RESULT",
  surveyComment: "RESEARCH_SURVEY",
  researchEventComment: "RESEARCH_EVENT",
  admissionComment: "PHD_ADMISSION",
  vacancyComment: "JOB_VACANCY",
  supervisorComment: "SUPERVISOR",
  recommendationComment: "RECOMMENDATION",
  journalReviewComment: "JOURNAL_REVIEW",
};

/**
 * contentType (the moderation key, e.g. `blog`, `feed`, `recommendation`) →
 * the `moduleType` stored on `UserActivity` rows (e.g. `ARTICLE`,
 * `SOCIAL_POST`, `RECOMMENDATION`).
 */
export const CONTENT_TYPE_TO_ACTIVITY_MODULE: Record<string, ActivityContentModule> = {
  feed: "SOCIAL_POST",
  blog: "ARTICLE",
  publication: "PUBLICATION",
  journal: "JOURNAL",
  researchTool: "RESEARCH_TOOL",
  researchGrant: "RESEARCH_GRANT",
  course: "COURSE",
  admission: "PHD_ADMISSION",
  event: "RESEARCH_EVENT",
  vacancy: "JOB_VACANCY",
  help: "HELP_POST",
  result: "RESULT",
  contribution: "CONTRIBUTION",
  supervisor: "SUPERVISOR",
  recommendation: "RECOMMENDATION",
  survey: "RESEARCH_SURVEY",
  journalReview: "JOURNAL_REVIEW",
};

/** All route ids a content row may be stored under in activity rows. */
const activityIds = (id: string, ...extraIds: string[]) =>
  [...new Set([id, ...extraIds].filter((value): value is string => !!value))];

type ActivityClient = Pick<Prisma.TransactionClient, "userActivity">;

function contentWhere(
  moduleType: ActivityContentModule,
  ids: string[],
): Prisma.UserActivityWhereInput {
  return {
    OR: [
      { moduleType, entityId: { in: ids } },
      // Comment / comment-vote rows carry the parent content id here.
      { parentEntityId: { in: ids } },
    ],
  };
}

function commentWhere(
  moduleType: ActivityContentModule,
  commentId: string,
  legacy?: { userId: string; content: string },
): Prisma.UserActivityWhereInput {
  const or: Prisma.UserActivityWhereInput[] = [
    { entityChildId: commentId },
    // Comment-vote rows written before entityChildId existed.
    {
      moduleType: ACTIVITY_COMMENT_MODULE[moduleType],
      entityId: commentId,
    },
  ];

  const snippet = legacy?.content?.replace(/\s+/g, " ").trim();
  if (legacy && snippet) {
    // Comment/reply rows written before entityChildId existed stored the
    // normalized comment text after a `|||` delimiter.
    or.push({
      moduleType,
      userId: legacy.userId,
      action: { in: ["COMMENTED", "REPLIED"] },
      entityTitle: { contains: `|||${snippet}` },
    });
  }

  return { OR: or };
}

/** Hide every activity row that describes this content row (any user). */
export async function hideContentActivity(
  tx: ActivityClient,
  moduleType: ActivityContentModule,
  id: string,
  ...extraIds: string[]
): Promise<void> {
  const ids = activityIds(id, ...extraIds);
  await tx.userActivity.updateMany({
    where: {
      ...contentWhere(moduleType, ids),
      hiddenByContent: false,
    },
    data: { hiddenByContent: true },
  });
}

/** Re-show activity hidden by this content row's deletion. */
export async function restoreContentActivity(
  tx: ActivityClient,
  moduleType: ActivityContentModule,
  id: string,
  ...extraIds: string[]
): Promise<void> {
  const ids = activityIds(id, ...extraIds);
  await tx.userActivity.updateMany({
    where: {
      ...contentWhere(moduleType, ids),
      hiddenByContent: true,
    },
    data: { hiddenByContent: false },
  });
}

/** Hide activity for one deleted comment/reply (its author and its voters). */
export async function hideCommentActivity(
  tx: ActivityClient,
  moduleType: ActivityContentModule,
  commentId: string,
  legacy: { userId: string; content: string },
): Promise<void> {
  await tx.userActivity.updateMany({
    where: { ...commentWhere(moduleType, commentId, legacy), hiddenByComment: false },
    data: { hiddenByComment: true },
  });
}

/** Re-show activity for one recovered comment/reply. */
export async function restoreCommentActivity(
  tx: ActivityClient,
  moduleType: ActivityContentModule,
  commentId: string,
  legacy: { userId: string; content: string },
): Promise<void> {
  await tx.userActivity.updateMany({
    where: { ...commentWhere(moduleType, commentId, legacy), hiddenByComment: true },
    data: { hiddenByComment: false },
  });
}
